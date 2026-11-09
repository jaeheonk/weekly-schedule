import {
  ScheduleItem,
  WeekdayNumber,
  WeekKey,
  SubTask,
  DeviceRole,
  CompletionStats,
  CATEGORIES,
} from '../types/schedule';
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
import { getWeekdayNumber, getWeekKey, compareScheduleItemsByTime } from './calendarUtils';
import { getMasterScheduleItems } from './defaultSchedule';
import { mergeSnapshots } from './snapshotMerge';
import { DEFAULT_VERCEL_BLOB_TOKEN, DEFAULT_FAMILY_CODE } from '../services/vercelBlobSync';

export const currentEpochSeconds = (): number => Date.now() / 1000;

export const STORAGE_KEYS = {
  ITEMS: 'weekly_schedule_items',
  COMPLETED_ITEMS: 'weekly_schedule_completed_items_v1',
  COMPLETED_SUBTASKS: 'weekly_schedule_completed_subtasks_v1',
  PARENT_VERIFIED_ITEMS: 'weekly_schedule_parent_verified_items_v1',
  PARENT_VERIFIED_SUBTASKS: 'weekly_schedule_parent_verified_subtasks_v1',
  COMPLETION_FLAGS: 'weekly_schedule_completion_flags_v1',
  SUBTASK_COMPLETION_FLAGS: 'weekly_schedule_subtask_completion_flags_v1',
  PARENT_VERIFIED_FLAGS: 'weekly_schedule_parent_verified_flags_v1',
  PARENT_VERIFIED_SUBTASK_FLAGS: 'weekly_schedule_parent_verified_subtask_flags_v1',
  DEVICE_ROLE: 'weekly_schedule_device_role_v1',
  DEVICE_ID: 'weekly_schedule_device_id_v1',
  FAMILY_CODE: 'weekly_schedule_family_code_v1',
  BLOB_TOKEN: 'weekly_schedule_blob_token_v1',
  PARENT_PIN: 'weekly_schedule_parent_pin_v1',
  PARENT_PIN_UPDATED_AT: 'weekly_schedule_parent_pin_updated_at_v1',
  SNAPSHOT_STATE: 'weekly_schedule_cloud_snapshot_state_v1',
} as const;

export interface ScheduleStoreOptions {
  currentDate?: Date;
}

export type StoreListener = () => void;

export type ToggleOutcome =
  | { ok: true }
  | { ok: false; reason: 'parent_verified' | 'not_checkable' };

export class ScheduleStore {
  private items: ScheduleItem[] = [];
  private currentDate: Date;
  private listeners: Set<StoreListener> = new Set();

  private completedItemKeys: Set<string> = new Set();
  private completedSubTaskKeys: Set<string> = new Set();
  private parentVerifiedItemKeys: Set<string> = new Set();
  private parentVerifiedSubTaskKeys: Set<string> = new Set();
  private deviceRole: DeviceRole = 'child';

  // CloudSyncSnapshot fields
  private familyCode: string = DEFAULT_FAMILY_CODE;
  private blobToken: string = DEFAULT_VERCEL_BLOB_TOKEN;
  private deviceId: string = '';
  private parentPinCode: string = '160125';
  private parentPinUpdatedAt: number = 1700000000;

  private deletedItemTimestamps: Record<string, number> = {};
  private weeklyOverrides: Record<string, WeeklyItemOverride> = {};
  private completionFlags: Record<string, SyncTimestampedFlag> = {};
  private subTaskCompletionFlags: Record<string, SyncTimestampedFlag> = {};
  private parentVerifiedFlags: Record<string, SyncTimestampedFlag> = {};
  private parentVerifiedSubTaskFlags: Record<string, SyncTimestampedFlag> = {};
  private itemReactions: Record<string, ItemParentReaction> = {};
  private praiseNotes: ParentPraiseNote[] = [];
  private rewardRedemptions: HeartRewardRedemption[] = [];
  private archivedEarnedHearts: number = 0;
  private rewardPresets: RewardPreset[] = [];
  private deletedRewardPresetTimestamps: Record<string, number> = {};
  private starTransactions: StarTransaction[] = [];
  private starRedemptionRequests: StarRedemptionRequest[] = [];
  private starRewardPresets: StarRewardPreset[] = [];
  private deletedStarPresetTimestamps: Record<string, number> = {};
  private revokedStarTransactionIds: string[] = [];
  private revokedStarRedemptionIds: string[] = [];
  private revokedPraiseNoteIds: string[] = [];

  constructor(options: ScheduleStoreOptions = {}) {
    this.currentDate = options.currentDate || new Date();
    this.loadDeviceId();
    this.loadSyncConfig();
    this.loadInitialItems();
    this.loadCompletions();
    this.loadDeviceRole();
    this.loadSnapshotMeta();
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private loadDeviceId(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (stored) {
        this.deviceId = stored;
        return;
      }
    } catch {
      // ignore
    }
    const rand = Math.random().toString(36).substring(2, 10);
    this.deviceId = `web-${rand}`;
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, this.deviceId);
    } catch {
      // ignore
    }
  }

  private loadSyncConfig(): void {
    try {
      const storedFamilyCode = localStorage.getItem(STORAGE_KEYS.FAMILY_CODE);
      if (storedFamilyCode) this.familyCode = storedFamilyCode;
      const storedBlobToken = localStorage.getItem(STORAGE_KEYS.BLOB_TOKEN);
      if (storedBlobToken) this.blobToken = storedBlobToken;
      const storedPin = localStorage.getItem(STORAGE_KEYS.PARENT_PIN);
      if (storedPin) this.parentPinCode = storedPin;
      const storedPinTimestamp = localStorage.getItem(STORAGE_KEYS.PARENT_PIN_UPDATED_AT);
      if (storedPinTimestamp) this.parentPinUpdatedAt = parseFloat(storedPinTimestamp) || 1700000000;
    } catch {
      // ignore
    }
  }

  public getFamilyCode(): string {
    return this.familyCode;
  }

  public setFamilyCode(code: string): void {
    this.familyCode = code || DEFAULT_FAMILY_CODE;
    try {
      localStorage.setItem(STORAGE_KEYS.FAMILY_CODE, this.familyCode);
    } catch {
      // ignore
    }
    this.notify();
  }

  public getBlobToken(): string {
    return this.blobToken;
  }

  public setBlobToken(token: string): void {
    this.blobToken = token || DEFAULT_VERCEL_BLOB_TOKEN;
    try {
      localStorage.setItem(STORAGE_KEYS.BLOB_TOKEN, this.blobToken);
    } catch {
      // ignore
    }
    this.notify();
  }

  public getParentPinCode(): string {
    return this.parentPinCode;
  }

  public setParentPinCode(pin: string): void {
    if (pin.length === 6) {
      this.parentPinCode = pin;
      this.parentPinUpdatedAt = Date.now() / 1000;
      try {
        localStorage.setItem(STORAGE_KEYS.PARENT_PIN, this.parentPinCode);
        localStorage.setItem(
          STORAGE_KEYS.PARENT_PIN_UPDATED_AT,
          this.parentPinUpdatedAt.toString()
        );
      } catch {
        // ignore
      }
      this.notify();
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public loadInitialItems(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (stored) {
        const parsed = JSON.parse(stored) as ScheduleItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.items = parsed;
          return;
        }
      }
    } catch {
      // ignore storage parse errors and fall back to master schedule
    }

    this.items = getMasterScheduleItems();
    this.saveItems();
  }

  public saveItems(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(this.items));
    } catch {
      // localStorage may fail in private mode or quota exceeded
    }
    this.notify();
  }

  private loadKeySet(key: string): Set<string> {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return new Set(parsed);
      }
    } catch {
      // ignore storage parse errors
    }
    return new Set();
  }

  private saveKeySet(key: string, set: Set<string>): void {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {
      // ignore storage errors
    }
  }

  private loadFlagsDict(key: string): Record<string, SyncTimestampedFlag> {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as Record<string, SyncTimestampedFlag>;
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveFlagsDict(key: string, dict: Record<string, SyncTimestampedFlag>): void {
    try {
      localStorage.setItem(key, JSON.stringify(dict));
    } catch {
      // ignore
    }
  }

  private loadCompletions(): void {
    this.completionFlags = this.loadFlagsDict(STORAGE_KEYS.COMPLETION_FLAGS);
    this.subTaskCompletionFlags = this.loadFlagsDict(STORAGE_KEYS.SUBTASK_COMPLETION_FLAGS);
    this.parentVerifiedFlags = this.loadFlagsDict(STORAGE_KEYS.PARENT_VERIFIED_FLAGS);
    this.parentVerifiedSubTaskFlags = this.loadFlagsDict(STORAGE_KEYS.PARENT_VERIFIED_SUBTASK_FLAGS);

    this.completedItemKeys = this.loadKeySet(STORAGE_KEYS.COMPLETED_ITEMS);
    this.completedSubTaskKeys = this.loadKeySet(STORAGE_KEYS.COMPLETED_SUBTASKS);
    this.parentVerifiedItemKeys = this.loadKeySet(STORAGE_KEYS.PARENT_VERIFIED_ITEMS);
    this.parentVerifiedSubTaskKeys = this.loadKeySet(STORAGE_KEYS.PARENT_VERIFIED_SUBTASKS);

    // If flags are empty but keys exist (initial upgrade), populate flags from keys
    const now = Date.now() / 1000;
    if (Object.keys(this.completionFlags).length === 0 && this.completedItemKeys.size > 0) {
      for (const k of this.completedItemKeys) {
        this.completionFlags[k] = { isSet: true, updatedAt: now };
      }
    }
    if (Object.keys(this.subTaskCompletionFlags).length === 0 && this.completedSubTaskKeys.size > 0) {
      for (const k of this.completedSubTaskKeys) {
        this.subTaskCompletionFlags[k] = { isSet: true, updatedAt: now };
      }
    }
    if (Object.keys(this.parentVerifiedFlags).length === 0 && this.parentVerifiedItemKeys.size > 0) {
      for (const k of this.parentVerifiedItemKeys) {
        this.parentVerifiedFlags[k] = { isSet: true, updatedAt: now };
      }
    }
    if (
      Object.keys(this.parentVerifiedSubTaskFlags).length === 0 &&
      this.parentVerifiedSubTaskKeys.size > 0
    ) {
      for (const k of this.parentVerifiedSubTaskKeys) {
        this.parentVerifiedSubTaskFlags[k] = { isSet: true, updatedAt: now };
      }
    }

    this.refreshFlagSetsFromDictionaries();
  }

  private refreshFlagSetsFromDictionaries(): void {
    this.completedItemKeys = new Set(
      Object.entries(this.completionFlags)
        .filter(([_, f]) => f.isSet)
        .map(([k]) => k)
    );
    this.completedSubTaskKeys = new Set(
      Object.entries(this.subTaskCompletionFlags)
        .filter(([_, f]) => f.isSet)
        .map(([k]) => k)
    );
    this.parentVerifiedItemKeys = new Set(
      Object.entries(this.parentVerifiedFlags)
        .filter(([_, f]) => f.isSet)
        .map(([k]) => k)
    );
    this.parentVerifiedSubTaskKeys = new Set(
      Object.entries(this.parentVerifiedSubTaskFlags)
        .filter(([_, f]) => f.isSet)
        .map(([k]) => k)
    );

    // Items verified by parent must also count as completed
    for (const key of this.parentVerifiedItemKeys) {
      this.completedItemKeys.add(key);
    }
    for (const key of this.parentVerifiedSubTaskKeys) {
      this.completedSubTaskKeys.add(key);
    }
  }

  private saveCompletions(): void {
    this.saveKeySet(STORAGE_KEYS.COMPLETED_ITEMS, this.completedItemKeys);
    this.saveKeySet(STORAGE_KEYS.COMPLETED_SUBTASKS, this.completedSubTaskKeys);
    this.saveKeySet(STORAGE_KEYS.PARENT_VERIFIED_ITEMS, this.parentVerifiedItemKeys);
    this.saveKeySet(STORAGE_KEYS.PARENT_VERIFIED_SUBTASKS, this.parentVerifiedSubTaskKeys);

    this.saveFlagsDict(STORAGE_KEYS.COMPLETION_FLAGS, this.completionFlags);
    this.saveFlagsDict(STORAGE_KEYS.SUBTASK_COMPLETION_FLAGS, this.subTaskCompletionFlags);
    this.saveFlagsDict(STORAGE_KEYS.PARENT_VERIFIED_FLAGS, this.parentVerifiedFlags);
    this.saveFlagsDict(
      STORAGE_KEYS.PARENT_VERIFIED_SUBTASK_FLAGS,
      this.parentVerifiedSubTaskFlags
    );

    this.notify();
  }

  private loadDeviceRole(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ROLE);
      if (stored === 'parent' || stored === 'child') {
        this.deviceRole = stored;
      }
    } catch {
      // ignore
    }
  }

  public getDeviceRole(): DeviceRole {
    return this.deviceRole;
  }

  public setDeviceRole(role: DeviceRole): void {
    this.deviceRole = role;
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ROLE, role);
    } catch {
      // ignore
    }
    this.notify();
  }

  private loadSnapshotMeta(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SNAPSHOT_STATE);
      if (stored) {
        const meta = JSON.parse(stored);
        if (meta.deletedItemTimestamps) this.deletedItemTimestamps = meta.deletedItemTimestamps;
        if (meta.weeklyOverrides) this.weeklyOverrides = meta.weeklyOverrides;
        if (meta.itemReactions) this.itemReactions = meta.itemReactions;
        if (meta.praiseNotes) this.praiseNotes = meta.praiseNotes;
        if (meta.rewardRedemptions) this.rewardRedemptions = meta.rewardRedemptions;
        if (typeof meta.archivedEarnedHearts === 'number')
          this.archivedEarnedHearts = meta.archivedEarnedHearts;
        if (meta.rewardPresets) this.rewardPresets = meta.rewardPresets;
        if (meta.deletedRewardPresetTimestamps)
          this.deletedRewardPresetTimestamps = meta.deletedRewardPresetTimestamps;
        if (meta.starTransactions) this.starTransactions = meta.starTransactions;
        if (meta.starRedemptionRequests)
          this.starRedemptionRequests = meta.starRedemptionRequests;
        if (meta.starRewardPresets) this.starRewardPresets = meta.starRewardPresets;
        if (meta.deletedStarPresetTimestamps)
          this.deletedStarPresetTimestamps = meta.deletedStarPresetTimestamps;
        if (meta.revokedStarTransactionIds)
          this.revokedStarTransactionIds = meta.revokedStarTransactionIds;
        if (meta.revokedStarRedemptionIds)
          this.revokedStarRedemptionIds = meta.revokedStarRedemptionIds;
        if (meta.revokedPraiseNoteIds) this.revokedPraiseNoteIds = meta.revokedPraiseNoteIds;
      }
    } catch {
      // ignore
    }
  }

  private saveSnapshotMeta(): void {
    try {
      const meta = {
        deletedItemTimestamps: this.deletedItemTimestamps,
        weeklyOverrides: this.weeklyOverrides,
        itemReactions: this.itemReactions,
        praiseNotes: this.praiseNotes,
        rewardRedemptions: this.rewardRedemptions,
        archivedEarnedHearts: this.archivedEarnedHearts,
        rewardPresets: this.rewardPresets,
        deletedRewardPresetTimestamps: this.deletedRewardPresetTimestamps,
        starTransactions: this.starTransactions,
        starRedemptionRequests: this.starRedemptionRequests,
        starRewardPresets: this.starRewardPresets,
        deletedStarPresetTimestamps: this.deletedStarPresetTimestamps,
        revokedStarTransactionIds: this.revokedStarTransactionIds,
        revokedStarRedemptionIds: this.revokedStarRedemptionIds,
        revokedPraiseNoteIds: this.revokedPraiseNoteIds,
      };
      localStorage.setItem(STORAGE_KEYS.SNAPSHOT_STATE, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }

  public makeCurrentSnapshot(): CloudSyncSnapshot {
    const now = Date.now() / 1000;
    return {
      schemaVersion: 5,
      familyCode: this.familyCode,
      updatedAt: now,
      updatedByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님 웹' : '👦 아이 웹',
      updatedByDeviceId: this.deviceId,
      parentPinCode: this.parentPinCode,
      parentPinUpdatedAt: this.parentPinUpdatedAt,
      items: this.items,
      deletedItemTimestamps: this.deletedItemTimestamps,
      weeklyOverrides: this.weeklyOverrides,
      completionFlags: this.completionFlags,
      subTaskCompletionFlags: this.subTaskCompletionFlags,
      parentVerifiedFlags: this.parentVerifiedFlags,
      parentVerifiedSubTaskFlags: this.parentVerifiedSubTaskFlags,
      itemReactions: this.itemReactions,
      praiseNotes: this.praiseNotes,
      rewardRedemptions: this.rewardRedemptions,
      archivedEarnedHearts: this.archivedEarnedHearts,
      rewardPresets: this.rewardPresets,
      deletedRewardPresetTimestamps: this.deletedRewardPresetTimestamps,
      starTransactions: this.starTransactions,
      starRedemptionRequests: this.starRedemptionRequests,
      starRewardPresets: this.starRewardPresets,
      deletedStarPresetTimestamps: this.deletedStarPresetTimestamps,
      revokedStarTransactionIds: this.revokedStarTransactionIds,
      revokedStarRedemptionIds: this.revokedStarRedemptionIds,
      revokedPraiseNoteIds: this.revokedPraiseNoteIds,
    };
  }

  public applyMergedRemoteSnapshot(remote: CloudSyncSnapshot): void {
    const current = this.makeCurrentSnapshot();
    const merged = mergeSnapshots(current, remote);

    this.items = merged.items;
    this.deletedItemTimestamps = merged.deletedItemTimestamps;
    this.weeklyOverrides = merged.weeklyOverrides;
    this.completionFlags = merged.completionFlags;
    this.subTaskCompletionFlags = merged.subTaskCompletionFlags;
    this.parentVerifiedFlags = merged.parentVerifiedFlags;
    this.parentVerifiedSubTaskFlags = merged.parentVerifiedSubTaskFlags;
    this.itemReactions = merged.itemReactions;
    this.praiseNotes = merged.praiseNotes;
    this.rewardRedemptions = merged.rewardRedemptions;
    this.archivedEarnedHearts = merged.archivedEarnedHearts;
    this.rewardPresets = merged.rewardPresets;
    this.deletedRewardPresetTimestamps = merged.deletedRewardPresetTimestamps;
    this.starTransactions = merged.starTransactions;
    this.starRedemptionRequests = merged.starRedemptionRequests;
    this.starRewardPresets = merged.starRewardPresets;
    this.deletedStarPresetTimestamps = merged.deletedStarPresetTimestamps;
    this.revokedStarTransactionIds = merged.revokedStarTransactionIds;
    this.revokedStarRedemptionIds = merged.revokedStarRedemptionIds;
    this.revokedPraiseNoteIds = merged.revokedPraiseNoteIds;

    this.parentPinCode = merged.parentPinCode;
    this.parentPinUpdatedAt = merged.parentPinUpdatedAt;
    try {
      localStorage.setItem(STORAGE_KEYS.PARENT_PIN, this.parentPinCode);
      localStorage.setItem(
        STORAGE_KEYS.PARENT_PIN_UPDATED_AT,
        this.parentPinUpdatedAt.toString()
      );
    } catch {
      // ignore
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveItems();
    this.saveCompletions();
    this.saveSnapshotMeta();
    this.notify();
  }

  public scopedKey(id: string, weekKey?: WeekKey): string {
    const wk = weekKey || this.getCurrentWeekKey();
    return `${wk}_${id}`;
  }

  public itemKey(itemId: string, weekKey?: WeekKey): string {
    return this.scopedKey(itemId, weekKey);
  }

  public subTaskKey(subTaskId: string, weekKey?: WeekKey): string {
    return this.scopedKey(subTaskId, weekKey);
  }

  public isItemCheckable(item: ScheduleItem): boolean {
    const categoryInfo = CATEGORIES[item.category];
    return categoryInfo ? categoryInfo.isCheckable : true;
  }

  public isCompleted(item: ScheduleItem, weekKey?: WeekKey): boolean {
    if (!this.isItemCheckable(item)) return false;
    const key = this.itemKey(item.id, weekKey);
    return this.completedItemKeys.has(key) || this.parentVerifiedItemKeys.has(key);
  }

  public isSubTaskCompleted(subTask: SubTask, weekKey?: WeekKey): boolean {
    const key = this.subTaskKey(subTask.id, weekKey);
    return this.completedSubTaskKeys.has(key) || this.parentVerifiedSubTaskKeys.has(key);
  }

  public isParentVerified(item: ScheduleItem, weekKey?: WeekKey): boolean {
    if (!this.isItemCheckable(item)) return false;
    const key = this.itemKey(item.id, weekKey);
    return this.parentVerifiedItemKeys.has(key);
  }

  public isSubTaskParentVerified(subTask: SubTask, weekKey?: WeekKey): boolean {
    const key = this.subTaskKey(subTask.id, weekKey);
    return this.parentVerifiedSubTaskKeys.has(key);
  }

  public toggleCompletionWithResult(item: ScheduleItem, weekKey?: WeekKey): ToggleOutcome {
    if (!this.isItemCheckable(item)) {
      return { ok: false, reason: 'not_checkable' };
    }

    const key = this.itemKey(item.id, weekKey);

    // If parent verified, child cannot uncheck it
    if (this.isParentVerified(item, weekKey) && this.deviceRole === 'child') {
      return { ok: false, reason: 'parent_verified' };
    }

    const now = Date.now() / 1000;
    const isNowCompleted = !this.isCompleted(item, weekKey);

    this.completionFlags[key] = { isSet: isNowCompleted, updatedAt: now };

    if (!isNowCompleted) {
      if (this.parentVerifiedFlags[key]) {
        this.parentVerifiedFlags[key] = { isSet: false, updatedAt: now };
      }
      for (const sub of item.subTasks) {
        const sKey = this.subTaskKey(sub.id, weekKey);
        this.subTaskCompletionFlags[sKey] = { isSet: false, updatedAt: now };
        if (this.parentVerifiedSubTaskFlags[sKey]) {
          this.parentVerifiedSubTaskFlags[sKey] = { isSet: false, updatedAt: now };
        }
      }
    } else {
      for (const sub of item.subTasks) {
        const sKey = this.subTaskKey(sub.id, weekKey);
        this.subTaskCompletionFlags[sKey] = { isSet: true, updatedAt: now };
      }
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
    return { ok: true };
  }

  public toggleCompletion(item: ScheduleItem, weekKey?: WeekKey): boolean {
    return this.toggleCompletionWithResult(item, weekKey).ok;
  }

  public toggleSubTaskCompletionWithResult(
    subTask: SubTask,
    parentItem: ScheduleItem,
    weekKey?: WeekKey
  ): ToggleOutcome {
    if (!this.isItemCheckable(parentItem)) {
      return { ok: false, reason: 'not_checkable' };
    }

    const sKey = this.subTaskKey(subTask.id, weekKey);
    const pKey = this.itemKey(parentItem.id, weekKey);

    // If parent verified, child cannot uncheck it
    if (
      (this.isSubTaskParentVerified(subTask, weekKey) || this.isParentVerified(parentItem, weekKey)) &&
      this.deviceRole === 'child'
    ) {
      return { ok: false, reason: 'parent_verified' };
    }

    const now = Date.now() / 1000;
    const isNowCompleted = !this.isSubTaskCompleted(subTask, weekKey);

    this.subTaskCompletionFlags[sKey] = { isSet: isNowCompleted, updatedAt: now };
    if (!isNowCompleted && this.parentVerifiedSubTaskFlags[sKey]) {
      this.parentVerifiedSubTaskFlags[sKey] = { isSet: false, updatedAt: now };
    }

    if (parentItem.subTasks.length > 0) {
      const allDone = parentItem.subTasks.every((s) => {
        const flag = this.subTaskCompletionFlags[this.subTaskKey(s.id, weekKey)];
        return flag ? flag.isSet : false;
      });
      this.completionFlags[pKey] = { isSet: allDone, updatedAt: now };
      if (!allDone && this.parentVerifiedFlags[pKey]) {
        this.parentVerifiedFlags[pKey] = { isSet: false, updatedAt: now };
      }
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
    return { ok: true };
  }

  public toggleSubTaskCompletion(
    subTask: SubTask,
    parentItem: ScheduleItem,
    weekKey?: WeekKey
  ): boolean {
    return this.toggleSubTaskCompletionWithResult(subTask, parentItem, weekKey).ok;
  }

  public setParentVerified(itemId: string, verified: boolean, weekKey?: WeekKey): void {
    const key = this.itemKey(itemId, weekKey);
    const now = Date.now() / 1000;

    this.parentVerifiedFlags[key] = { isSet: verified, updatedAt: now };
    if (verified) {
      this.completionFlags[key] = { isSet: true, updatedAt: now };
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
  }

  public setParentVerifiedSubTask(subTaskId: string, verified: boolean, weekKey?: WeekKey): void {
    const key = this.subTaskKey(subTaskId, weekKey);
    const now = Date.now() / 1000;

    this.parentVerifiedSubTaskFlags[key] = { isSet: verified, updatedAt: now };
    if (verified) {
      this.subTaskCompletionFlags[key] = { isSet: true, updatedAt: now };
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
  }

  public getCompletionStats(
    target: WeekdayNumber | ScheduleItem[],
    weekKey?: WeekKey
  ): CompletionStats {
    const candidateItems = Array.isArray(target) ? target : this.getItemsForWeekday(target);
    const checkableItems = candidateItems.filter((item) => this.isItemCheckable(item));
    const total = checkableItems.length;
    const completed = checkableItems.filter((item) => this.isCompleted(item, weekKey)).length;
    const verified = checkableItems.filter((item) => this.isParentVerified(item, weekKey)).length;
    const waiting = Math.max(0, completed - verified);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      completed,
      verified,
      waiting,
      total,
      percentage,
    };
  }

  public getItems(): ScheduleItem[] {
    return [...this.items];
  }

  public getCurrentDate(): Date {
    return this.currentDate;
  }

  public setCurrentDate(date: Date): void {
    this.currentDate = date;
    this.notify();
  }

  public getCurrentWeekKey(): WeekKey {
    return getWeekKey(this.currentDate);
  }

  public getCurrentWeekday(): WeekdayNumber {
    return getWeekdayNumber(this.currentDate);
  }

  public getItemsForWeekday(weekday: WeekdayNumber): ScheduleItem[] {
    return this.items
      .filter((item) => item.weekday === weekday)
      .sort(compareScheduleItemsByTime);
  }

  public getTodayItems(): ScheduleItem[] {
    const today = this.getCurrentWeekday();
    return this.getItemsForWeekday(today);
  }
}

// Global default singleton instance
export const globalScheduleStore = new ScheduleStore();
