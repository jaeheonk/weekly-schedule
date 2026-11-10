import { ScheduleItem } from '../types/schedule';
import {
  CloudSyncSnapshot,
  SyncTimestampedFlag,
  WeeklyItemOverride,
  ItemParentReaction,
  ParentPraiseNote,
  HeartRewardRedemption,
  RewardPreset,
  StarTransaction,
  StarRedemptionRequest,
  StarRewardPreset,
} from '../types/snapshot';
import { getMasterScheduleItems } from './defaultSchedule';

/**
 * Normalizes compound dictionary keys (e.g. `${weekKey}_${UUID}`) so the UUID part is always uppercase.
 * If the key has no underscore (e.g. standalone UUID in deletedItemTimestamps), returns uppercase.
 */
export function normalizeCompoundKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  const underscoreIdx = key.indexOf('_');
  if (underscoreIdx !== -1) {
    const prefix = key.slice(0, underscoreIdx);
    const suffix = key.slice(underscoreIdx + 1);
    return `${prefix}_${suffix.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F-]{36}$/.test(key)) {
    return key.toUpperCase();
  }
  return key;
}

/**
 * Swift DefaultScheduleData 및 ScheduleStore.swift:normalizeItemsToCanonicalIDs와 100% 동일하게
 * 기본 시간표 항목(targetWeekKey === null)을 정규 결정론적 대문자 ID로 교정합니다.
 */
export function normalizeItemsToCanonicalIDs(inputItems: ScheduleItem[] = []): ScheduleItem[] {
  const defaults = getMasterScheduleItems();
  const canonicalByStartSig = new Map<string, ScheduleItem>();
  for (const def of defaults) {
    const cleanTitle = def.title.trim();
    const startSig = `${def.weekday}|${def.startHour}:${def.startMinute}|${cleanTitle}`;
    canonicalByStartSig.set(startSig, def);
  }

  const result: ScheduleItem[] = [];
  for (const rawItem of inputItems) {
    const upperId = rawItem.id ? rawItem.id.toUpperCase() : rawItem.id;
    const item: ScheduleItem = {
      ...rawItem,
      id: upperId,
      subTasks: (rawItem.subTasks || []).map((s) => ({
        ...s,
        id: s.id ? s.id.toUpperCase() : s.id,
      })),
    };

    // 특정 주차 전용 추가 일정은 기본 정규 일정 정규화 대상에서 제외
    if (item.targetWeekKey) {
      result.push(item);
      continue;
    }

    const cleanTitle = item.title.trim();
    const startSig = `${item.weekday}|${item.startHour}:${item.startMinute}|${cleanTitle}`;
    const canonical = canonicalByStartSig.get(startSig);
    if (canonical) {
      const canonicalUpperId = canonical.id.toUpperCase();
      if (item.id !== canonicalUpperId) {
        item.id = canonicalUpperId;
      }
      // 토요일 주간 미션이 이전 버전(21:30 종료)으로 되어 있으면 22:30으로 함께 보정
      if (
        item.weekday === 6 &&
        item.startHour === 12 &&
        item.endHour === 21 &&
        item.endMinute === 30
      ) {
        item.endHour = 22;
        item.endMinute = 30;
      }
      if (canonical.subTasks && item.subTasks && canonical.subTasks.length === item.subTasks.length) {
        for (let sIdx = 0; sIdx < item.subTasks.length; sIdx++) {
          const canonicalSubId = canonical.subTasks[sIdx].id.toUpperCase();
          if (item.subTasks[sIdx].id !== canonicalSubId) {
            item.subTasks[sIdx].id = canonicalSubId;
          }
        }
      }
    }
    result.push(item);
  }
  return result;
}

/**
 * Generic helper to merge two dictionaries of timestamped entries.
 * Normalizes all keys using normalizeCompoundKey (uppercase UUIDs).
 * If a key exists in both, the entry with the larger updatedAt wins.
 */
export function mergeTimestampedDict<T extends { updatedAt: number }>(
  local: Record<string, T> = {},
  remote: Record<string, T> = {}
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, val] of Object.entries(local || {})) {
    result[normalizeCompoundKey(key)] = val;
  }
  for (const [key, rVal] of Object.entries(remote || {})) {
    const normKey = normalizeCompoundKey(key);
    const lVal = result[normKey];
    if (lVal) {
      if (rVal.updatedAt >= lVal.updatedAt) {
        result[normKey] = rVal;
      }
    } else {
      result[normKey] = rVal;
    }
  }
  return result;
}

/**
 * Merge two timestamped flag dictionaries (completion flags / parent verified flags).
 */
export function mergeFlagDict(
  local: Record<string, SyncTimestampedFlag> = {},
  remote: Record<string, SyncTimestampedFlag> = {}
): Record<string, SyncTimestampedFlag> {
  return mergeTimestampedDict(local, remote);
}

/**
 * Merge deletion timestamps with uppercase key normalization.
 */
export function mergeDeletedItemTimestamps(
  local: Record<string, number> = {},
  remote: Record<string, number> = {}
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, ts] of Object.entries(local || {})) {
    result[id.toUpperCase()] = ts;
  }
  for (const [id, rTs] of Object.entries(remote || {})) {
    const upperId = id.toUpperCase();
    result[upperId] = Math.max(result[upperId] || 0, rTs);
  }
  return result;
}

/**
 * Merge schedule items based on ID and timestamps.
 * - Items are normalized to canonical uppercase UUIDs.
 * - Items with identical ID (case-insensitive) keep the item with newer updatedAt.
 * - Deleted items (deletedItemTimestamps >= item.updatedAt) are filtered out.
 * - Items with identical day/time/title signatures are deduplicated, keeping the newer item.
 * - Results are sorted chronologically by weekday, then start time.
 */
export function mergeScheduleItems(
  local: ScheduleItem[] = [],
  remote: ScheduleItem[] = [],
  deletedItemTimestamps: Record<string, number> = {}
): ScheduleItem[] {
  const normDeletedTimestamps = mergeDeletedItemTimestamps(deletedItemTimestamps);

  const normLocal = normalizeItemsToCanonicalIDs(local);
  const normRemote = normalizeItemsToCanonicalIDs(remote);

  const itemDict = new Map<string, ScheduleItem>();

  for (const item of normLocal) {
    const upperId = item.id.toUpperCase();
    const cleanItem: ScheduleItem = {
      ...item,
      id: upperId,
      subTasks: item.subTasks?.map((s) => ({ ...s, id: s.id.toUpperCase() })) || [],
    };
    itemDict.set(upperId, cleanItem);
  }

  for (const rItem of normRemote) {
    const upperId = rItem.id.toUpperCase();
    const cleanRItem: ScheduleItem = {
      ...rItem,
      id: upperId,
      subTasks: rItem.subTasks?.map((s) => ({ ...s, id: s.id.toUpperCase() })) || [],
    };
    const existing = itemDict.get(upperId);
    if (existing) {
      if (cleanRItem.updatedAt > existing.updatedAt) {
        itemDict.set(upperId, cleanRItem);
      }
    } else {
      itemDict.set(upperId, cleanRItem);
    }
  }

  // Filter out deleted items unless updated after deletion
  const activeItems = Array.from(itemDict.values()).filter((item) => {
    const delTs = normDeletedTimestamps[item.id] ?? 0;
    return delTs < item.updatedAt;
  });

  // Deduplicate by signature
  const dedupMap = new Map<string, ScheduleItem>();
  for (const item of activeItems) {
    const cleanTitle = item.title.trim();
    const itemSignature = `${item.targetWeekKey || 'master'}_${item.weekday}_${item.startHour}:${item.startMinute}_${item.endHour}:${item.endMinute}_${cleanTitle}`;
    const existing = dedupMap.get(itemSignature);
    if (!existing || item.updatedAt > existing.updatedAt) {
      dedupMap.set(itemSignature, item);
    }
  }

  return Array.from(dedupMap.values()).sort((a, b) => {
    if (a.weekday === b.weekday) {
      const aStart = a.startHour * 60 + a.startMinute;
      const bStart = b.startHour * 60 + b.startMinute;
      return aStart - bStart;
    }
    return a.weekday - b.weekday;
  });
}

export function mergeWeeklyOverrides(
  local: Record<string, WeeklyItemOverride> = {},
  remote: Record<string, WeeklyItemOverride> = {}
): Record<string, WeeklyItemOverride> {
  const merged = mergeTimestampedDict(local, remote);
  const result: Record<string, WeeklyItemOverride> = {};
  for (const [key, ov] of Object.entries(merged)) {
    const normBaseId = ov.baseItemId ? ov.baseItemId.toUpperCase() : '';
    const normId = normalizeCompoundKey(ov.id || key);
    let normOverridden = ov.overriddenItem;
    if (normOverridden) {
      normOverridden = {
        ...normOverridden,
        id: normOverridden.id ? normOverridden.id.toUpperCase() : '',
        subTasks: normOverridden.subTasks?.map((s) => ({
          ...s,
          id: s.id ? s.id.toUpperCase() : '',
        })) || [],
      };
    }
    result[key] = {
      ...ov,
      id: normId,
      baseItemId: normBaseId,
      overriddenItem: normOverridden,
    };
  }
  return result;
}

export function mergeItemReactions(
  local: Record<string, ItemParentReaction> = {},
  remote: Record<string, ItemParentReaction> = {}
): Record<string, ItemParentReaction> {
  const result: Record<string, ItemParentReaction> = {};

  for (const [key, val] of Object.entries(local || {})) {
    result[normalizeCompoundKey(key)] = val;
  }

  for (const [key, rReact] of Object.entries(remote || {})) {
    const normKey = normalizeCompoundKey(key);
    const lReact = result[normKey];
    if (lReact) {
      const winner = rReact.updatedAt >= lReact.updatedAt ? { ...rReact } : { ...lReact };
      winner.heartCount = Math.max(lReact.heartCount || 0, rReact.heartCount || 0);

      const combinedComments = [...(lReact.comments || [])];
      for (const c of rReact.comments || []) {
        const isDuplicate = combinedComments.some(
          (existing) =>
            existing.id === c.id ||
            (existing.text === c.text && Math.abs(existing.createdAt - c.createdAt) < 1.0)
        );
        if (!isDuplicate) {
          combinedComments.push(c);
        }
      }
      combinedComments.sort((a, b) => a.createdAt - b.createdAt);
      winner.comments = combinedComments;
      if (combinedComments.length > 0) {
        winner.comment = combinedComments[combinedComments.length - 1].text;
      }
      result[normKey] = winner;
    } else {
      result[normKey] = rReact;
    }
  }

  return result;
}

export function mergeStarTransactions(
  local: StarTransaction[] = [],
  remote: StarTransaction[] = [],
  revokedIds: string[] = []
): StarTransaction[] {
  const revokedSet = new Set(revokedIds);
  const txById = new Map<string, StarTransaction>();

  for (const tx of local) {
    if (!revokedSet.has(tx.id)) {
      txById.set(tx.id, tx);
    }
  }

  for (const rTx of remote) {
    if (revokedSet.has(rTx.id)) continue;
    const existing = txById.get(rTx.id);
    if (existing) {
      // Deterministic conflict resolution for ledger: retain older (first recorded) createdAt
      if (rTx.createdAt < existing.createdAt) {
        txById.set(rTx.id, rTx);
      }
    } else {
      txById.set(rTx.id, rTx);
    }
  }

  return Array.from(txById.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function mergeStarRedemptionRequests(
  local: StarRedemptionRequest[] = [],
  remote: StarRedemptionRequest[] = [],
  revokedIds: string[] = []
): StarRedemptionRequest[] {
  const revokedSet = new Set(revokedIds);
  const reqById = new Map<string, StarRedemptionRequest>();

  for (const req of local) {
    if (!revokedSet.has(req.id)) {
      reqById.set(req.id, req);
    }
  }

  for (const rReq of remote) {
    if (revokedSet.has(rReq.id)) continue;
    const lReq = reqById.get(rReq.id);
    if (lReq) {
      if (lReq.status !== 'pending' && rReq.status === 'pending') {
        continue; // Keep locally resolved status
      }
      if (rReq.status !== 'pending' && lReq.status === 'pending') {
        reqById.set(rReq.id, rReq);
      } else if (rReq.updatedAt >= lReq.updatedAt) {
        reqById.set(rReq.id, rReq);
      }
    } else {
      reqById.set(rReq.id, rReq);
    }
  }

  return Array.from(reqById.values())
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .slice(0, 100);
}

/**
 * Generic helper to merge preset models with ID and deletion filtering.
 */
export function mergePresets<T extends { id: string; updatedAt: number }>(
  local: T[] = [],
  remote: T[] = [],
  deletedTimestamps: Record<string, number> = {}
): T[] {
  const byId = new Map<string, T>();

  for (const preset of [...local, ...remote]) {
    const existing = byId.get(preset.id);
    if (existing) {
      if (preset.updatedAt > existing.updatedAt) {
        byId.set(preset.id, preset);
      }
    } else {
      byId.set(preset.id, preset);
    }
  }

  return Array.from(byId.values()).filter((p) => {
    const delTs = deletedTimestamps[p.id] ?? 0;
    return delTs < p.updatedAt;
  });
}

export function mergeRewardPresets(
  local: RewardPreset[] = [],
  remote: RewardPreset[] = [],
  deletedTimestamps: Record<string, number> = {}
): RewardPreset[] {
  return mergePresets(local, remote, deletedTimestamps);
}

export function mergeStarRewardPresets(
  local: StarRewardPreset[] = [],
  remote: StarRewardPreset[] = [],
  deletedTimestamps: Record<string, number> = {}
): StarRewardPreset[] {
  return mergePresets(local, remote, deletedTimestamps);
}

/**
 * Deterministically merge a remote CloudSyncSnapshot with the local CloudSyncSnapshot.
 */
export function mergeSnapshots(
  local: CloudSyncSnapshot,
  remote: CloudSyncSnapshot
): CloudSyncSnapshot {
  // 1. Merge PIN code (6-digit check and timestamp)
  let parentPinCode = local.parentPinCode;
  let parentPinUpdatedAt = local.parentPinUpdatedAt;
  if (
    remote.parentPinCode &&
    remote.parentPinCode.length === 6 &&
    remote.parentPinUpdatedAt > local.parentPinUpdatedAt
  ) {
    parentPinCode = remote.parentPinCode;
    parentPinUpdatedAt = remote.parentPinUpdatedAt;
  }

  // 2. Merge deletion timestamps with uppercase ID normalization
  const deletedItemTimestamps = mergeDeletedItemTimestamps(
    local.deletedItemTimestamps,
    remote.deletedItemTimestamps
  );

  const deletedRewardPresetTimestamps = mergeDeletedItemTimestamps(
    local.deletedRewardPresetTimestamps,
    remote.deletedRewardPresetTimestamps
  );

  const deletedStarPresetTimestamps = mergeDeletedItemTimestamps(
    local.deletedStarPresetTimestamps,
    remote.deletedStarPresetTimestamps
  );

  // 3. Revoked IDs set union
  const revokedStarTransactionIds = Array.from(
    new Set([...(local.revokedStarTransactionIds || []), ...(remote.revokedStarTransactionIds || [])])
  );
  const revokedStarRedemptionIds = Array.from(
    new Set([...(local.revokedStarRedemptionIds || []), ...(remote.revokedStarRedemptionIds || [])])
  );
  const revokedPraiseNoteIds = Array.from(
    new Set([...(local.revokedPraiseNoteIds || []), ...(remote.revokedPraiseNoteIds || [])])
  );

  // 4. Merge flags
  const completionFlags = mergeFlagDict(local.completionFlags, remote.completionFlags);
  const subTaskCompletionFlags = mergeFlagDict(
    local.subTaskCompletionFlags,
    remote.subTaskCompletionFlags
  );
  const parentVerifiedFlags = mergeFlagDict(
    local.parentVerifiedFlags,
    remote.parentVerifiedFlags
  );
  const parentVerifiedSubTaskFlags = mergeFlagDict(
    local.parentVerifiedSubTaskFlags,
    remote.parentVerifiedSubTaskFlags
  );

  // 5. Merge reactions and overrides
  const itemReactions = mergeItemReactions(local.itemReactions, remote.itemReactions);
  const weeklyOverrides = mergeWeeklyOverrides(local.weeklyOverrides, remote.weeklyOverrides);

  // 6. Merge schedule items
  const items = mergeScheduleItems(local.items, remote.items, deletedItemTimestamps);

  // 7. Merge praise notes (exclude revoked, keep top 40)
  const revokedNotesSet = new Set(revokedPraiseNoteIds);
  const noteById = new Map<string, ParentPraiseNote>();
  for (const n of [...(local.praiseNotes || []), ...(remote.praiseNotes || [])]) {
    if (!revokedNotesSet.has(n.id)) {
      noteById.set(n.id, n);
    }
  }
  const praiseNotes = Array.from(noteById.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40);

  // 8. Merge reward redemptions (keep top 50)
  const redemptionById = new Map<string, HeartRewardRedemption>();
  for (const r of [...(local.rewardRedemptions || []), ...(remote.rewardRedemptions || [])]) {
    redemptionById.set(r.id, r);
  }
  const rewardRedemptions = Array.from(redemptionById.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);

  // 9. Archived earned hearts (max)
  const archivedEarnedHearts = Math.max(
    local.archivedEarnedHearts || 0,
    remote.archivedEarnedHearts || 0
  );

  // 10. Star ledger & redemptions
  const starTransactions = mergeStarTransactions(
    local.starTransactions,
    remote.starTransactions,
    revokedStarTransactionIds
  );
  const starRedemptionRequests = mergeStarRedemptionRequests(
    local.starRedemptionRequests,
    remote.starRedemptionRequests,
    revokedStarRedemptionIds
  );

  // 11. Presets
  const rewardPresets = mergeRewardPresets(
    local.rewardPresets,
    remote.rewardPresets,
    deletedRewardPresetTimestamps
  );
  const starRewardPresets = mergeStarRewardPresets(
    local.starRewardPresets,
    remote.starRewardPresets,
    deletedStarPresetTimestamps
  );

  const updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  const updatedByRole =
    (remote.updatedAt || 0) >= (local.updatedAt || 0)
      ? remote.updatedByRole || local.updatedByRole
      : local.updatedByRole;
  const updatedByDeviceId =
    (remote.updatedAt || 0) >= (local.updatedAt || 0)
      ? remote.updatedByDeviceId || local.updatedByDeviceId
      : local.updatedByDeviceId;

  return {
    schemaVersion: 5,
    familyCode: remote.familyCode || local.familyCode || 'family-main',
    updatedAt,
    updatedByRole,
    updatedByDeviceId,
    parentPinCode,
    parentPinUpdatedAt,
    items,
    deletedItemTimestamps,
    weeklyOverrides,
    completionFlags,
    subTaskCompletionFlags,
    parentVerifiedFlags,
    parentVerifiedSubTaskFlags,
    itemReactions,
    praiseNotes,
    rewardRedemptions,
    archivedEarnedHearts,
    rewardPresets,
    deletedRewardPresetTimestamps,
    starTransactions,
    starRedemptionRequests,
    starRewardPresets,
    deletedStarPresetTimestamps,
    revokedStarTransactionIds,
    revokedStarRedemptionIds,
    revokedPraiseNoteIds,
  };
}
