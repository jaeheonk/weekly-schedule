import { describe, it, expect } from 'vitest';
import {
  mergeFlagDict,
  mergeScheduleItems,
  mergeSnapshots,
  mergeStarTransactions,
  mergeStarRedemptionRequests,
  normalizeCompoundKey,
  normalizeItemsToCanonicalIDs,
} from './snapshotMerge';
import { CloudSyncSnapshot, SyncTimestampedFlag, StarTransaction, StarRedemptionRequest } from '../types/snapshot';
import { ScheduleItem } from '../types/schedule';

describe('snapshotMerge domain logic', () => {
  describe('normalizeCompoundKey', () => {
    it('uppercases UUID in compound key with week prefix', () => {
      expect(normalizeCompoundKey('2026-W46_702bed2e-2564-46a4-9d0b-1da23793f519')).toBe(
        '2026-W46_702BED2E-2564-46A4-9D0B-1DA23793F519'
      );
    });

    it('uppercases standalone UUID', () => {
      expect(normalizeCompoundKey('702bed2e-2564-46a4-9d0b-1da23793f519')).toBe(
        '702BED2E-2564-46A4-9D0B-1DA23793F519'
      );
    });

    it('preserves non-UUID plain keys', () => {
      expect(normalizeCompoundKey('key1')).toBe('key1');
    });
  });

  describe('mergeFlagDict', () => {
    it('remote with newer updatedAt overrides older local flag', () => {
      const local: Record<string, SyncTimestampedFlag> = {
        key1: { isSet: false, updatedAt: 100 },
      };
      const remote: Record<string, SyncTimestampedFlag> = {
        key1: { isSet: true, updatedAt: 200 },
      };

      const merged = mergeFlagDict(local, remote);
      expect(merged.key1).toEqual({ isSet: true, updatedAt: 200 });
    });

    it('local with newer updatedAt is preserved over older remote flag', () => {
      const local: Record<string, SyncTimestampedFlag> = {
        key1: { isSet: true, updatedAt: 300 },
      };
      const remote: Record<string, SyncTimestampedFlag> = {
        key1: { isSet: false, updatedAt: 200 },
      };

      const merged = mergeFlagDict(local, remote);
      expect(merged.key1).toEqual({ isSet: true, updatedAt: 300 });
    });

    it('adds new keys from remote and preserves unique local keys', () => {
      const local: Record<string, SyncTimestampedFlag> = {
        keyA: { isSet: true, updatedAt: 100 },
      };
      const remote: Record<string, SyncTimestampedFlag> = {
        keyB: { isSet: true, updatedAt: 150 },
      };

      const merged = mergeFlagDict(local, remote);
      expect(merged.keyA).toEqual({ isSet: true, updatedAt: 100 });
      expect(merged.keyB).toEqual({ isSet: true, updatedAt: 150 });
    });

    it('normalizes compound keys with lowercase UUID to uppercase and collapses duplicates', () => {
      const local: Record<string, SyncTimestampedFlag> = {
        '2026-W46_702bed2e-2564-46a4-9d0b-1da23793f519': { isSet: true, updatedAt: 100 },
      };
      const remote: Record<string, SyncTimestampedFlag> = {
        '2026-W46_702BED2E-2564-46A4-9D0B-1DA23793F519': { isSet: false, updatedAt: 200 },
      };

      const merged = mergeFlagDict(local, remote);
      const keys = Object.keys(merged);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe('2026-W46_702BED2E-2564-46A4-9D0B-1DA23793F519');
      expect(merged['2026-W46_702BED2E-2564-46A4-9D0B-1DA23793F519']).toEqual({
        isSet: false,
        updatedAt: 200,
      });
    });
  });

  describe('mergeScheduleItems', () => {
    const baseItem: ScheduleItem = {
      id: 'uuid-1',
      weekday: 1,
      startHour: 9,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
      title: '수학 숙제',
      note: '',
      category: 'study',
      iconName: 'book',
      subTasks: [],
      isNotificationEnabled: true,
      notificationLeadMinutes: [0],
      updatedAt: 100,
    };

    it('newer remote item replaces older local item', () => {
      const local = [baseItem];
      const remote = [{ ...baseItem, title: '수학 심화 문제풀이', updatedAt: 200 }];
      const deletedTs: Record<string, number> = {};

      const merged = mergeScheduleItems(local, remote, deletedTs);
      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('수학 심화 문제풀이');
      expect(merged[0].updatedAt).toBe(200);
    });

    it('deletes item if deletedItemTimestamps is greater than item.updatedAt', () => {
      const local = [baseItem];
      const remote: ScheduleItem[] = [];
      const deletedTs: Record<string, number> = { 'uuid-1': 150 };

      const merged = mergeScheduleItems(local, remote, deletedTs);
      expect(merged).toHaveLength(0);
    });

    it('keeps item if item was updated after deletion timestamp', () => {
      const local = [{ ...baseItem, updatedAt: 200 }];
      const remote: ScheduleItem[] = [];
      const deletedTs: Record<string, number> = { 'uuid-1': 150 };

      const merged = mergeScheduleItems(local, remote, deletedTs);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('UUID-1');
    });

    it('deduplicates items with same signature and sorts by weekday and time', () => {
      const item1: ScheduleItem = {
        ...baseItem,
        id: 'dup-1',
        weekday: 2,
        startHour: 14,
        updatedAt: 100,
      };
      const item2: ScheduleItem = {
        ...baseItem,
        id: 'dup-2',
        weekday: 2,
        startHour: 14,
        updatedAt: 200,
      };
      const morningItem: ScheduleItem = {
        ...baseItem,
        id: 'morning-1',
        weekday: 1,
        startHour: 8,
        updatedAt: 100,
      };

      const merged = mergeScheduleItems([item1, morningItem], [item2], {});
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('MORNING-1'); // weekday 1, 8:00
      expect(merged[1].id).toBe('DUP-2');     // newer duplicate kept
    });

    it('deduplicates items with lowercase and uppercase IDs, keeping newer user-modified item', () => {
      // Default Faye lesson (21:30~22:30, lowercase ID, baseline timestamp)
      const staleDefault: ScheduleItem = {
        ...baseItem,
        id: '702bed2e-2564-46a4-9d0b-1da23793f519',
        weekday: 1,
        startHour: 21,
        startMinute: 30,
        endHour: 22,
        endMinute: 30,
        title: 'Faye 수업',
        updatedAt: 1700000000,
      };
      // User-modified Faye lesson from iOS (21:30~22:00, uppercase ID, newer timestamp)
      const userModified: ScheduleItem = {
        ...baseItem,
        id: '702BED2E-2564-46A4-9D0B-1DA23793F519',
        weekday: 1,
        startHour: 21,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        title: 'Faye 수업',
        updatedAt: 1792310546,
      };

      // Both in remote list (as found in contaminated cloud snapshot)
      const merged = mergeScheduleItems([], [staleDefault, userModified], {});
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('702BED2E-2564-46A4-9D0B-1DA23793F519');
      expect(merged[0].startHour).toBe(21);
      expect(merged[0].startMinute).toBe(30);
      expect(merged[0].endHour).toBe(22);
      expect(merged[0].endMinute).toBe(0);
      expect(merged[0].updatedAt).toBe(1792310546);
    });

    it('deduplicates bedtime items when user modified time from 22:30 to 22:00', () => {
      const staleBedtime: ScheduleItem = {
        ...baseItem,
        id: '041bb64b-c8af-4655-9703-4a40fc1b8e8e',
        weekday: 1,
        startHour: 22,
        startMinute: 30,
        endHour: 23,
        endMinute: 0,
        title: '취침',
        updatedAt: 1700000000,
      };
      const userBedtime: ScheduleItem = {
        ...baseItem,
        id: '041BB64B-C8AF-4655-9703-4A40FC1B8E8E',
        weekday: 1,
        startHour: 22,
        startMinute: 0,
        endHour: 22,
        endMinute: 30,
        title: '취침',
        updatedAt: 1792310592,
      };

      const merged = mergeScheduleItems([staleBedtime], [userBedtime], {});
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('041BB64B-C8AF-4655-9703-4A40FC1B8E8E');
      expect(merged[0].startHour).toBe(22);
      expect(merged[0].startMinute).toBe(0);
      expect(merged[0].endHour).toBe(22);
      expect(merged[0].endMinute).toBe(30);
    });
  });

  describe('normalizeItemsToCanonicalIDs', () => {
    const sampleItem: ScheduleItem = {
      id: 'legacy-id',
      weekday: 1,
      startHour: 7,
      startMinute: 0,
      endHour: 7,
      endMinute: 30,
      title: '코딱지',
      note: '',
      category: 'routine',
      iconName: 'sun',
      subTasks: [],
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 100,
    };

    it('normalizes legacy random UUID to canonical deterministic uppercase ID for default master schedules', () => {
      const legacyItem: ScheduleItem = {
        ...sampleItem,
        id: 'random-legacy-uuid-1234',
        title: '코딱지',
      };
      const normalized = normalizeItemsToCanonicalIDs([legacyItem]);
      expect(normalized[0].id).toBe('5D829E4E-6AC8-438D-B00D-8D5207EB2254');
    });

    it('does not overwrite ID for week-specific additions', () => {
      const thisWeekAddition: ScheduleItem = {
        ...sampleItem,
        id: 'custom-addition-id',
        targetWeekKey: '2026-W46',
        title: '코딱지',
      };
      const normalized = normalizeItemsToCanonicalIDs([thisWeekAddition]);
      expect(normalized[0].id).toBe('CUSTOM-ADDITION-ID');
      expect(normalized[0].targetWeekKey).toBe('2026-W46');
    });
  });

  describe('mergeStarTransactions', () => {
    it('unions transactions and retains older createdAt for duplicate ledger entry IDs', () => {
      const txLocal: StarTransaction = {
        id: 'star_earn_2026-W42_1',
        kind: 'dailyAllClear',
        delta: 1,
        weekKey: '2026-W42',
        weekdayRawValue: 1,
        title: '월요일 올클리어',
        note: '',
        createdAt: 200,
        createdByRole: '부모님',
      };
      const txRemote: StarTransaction = {
        ...txLocal,
        createdAt: 100, // Earlier recorded entry
      };

      const merged = mergeStarTransactions([txLocal], [txRemote], []);
      expect(merged).toHaveLength(1);
      expect(merged[0].createdAt).toBe(100);
    });

    it('filters out revoked transaction IDs', () => {
      const tx: StarTransaction = {
        id: 'star_revoked_1',
        kind: 'dailyAllClear',
        delta: 1,
        weekKey: '2026-W42',
        title: '취소된 스타',
        note: '',
        createdAt: 100,
        createdByRole: '부모님',
      };

      const merged = mergeStarTransactions([tx], [], ['star_revoked_1']);
      expect(merged).toHaveLength(0);
    });
  });

  describe('mergeStarRedemptionRequests', () => {
    it('does not revert approved/rejected status back to pending', () => {
      const local: StarRedemptionRequest = {
        id: 'req-1',
        presetId: 'preset-1',
        emoji: '🎮',
        rewardTitle: '게임 30분',
        starCost: 1,
        actionType: 'convertToHearts',
        grantedHearts: 5,
        status: 'approved',
        requestedAt: 100,
        requestedByRole: '아이',
        updatedAt: 150,
      };

      const remote: StarRedemptionRequest = {
        ...local,
        status: 'pending',
        updatedAt: 160,
      };

      const merged = mergeStarRedemptionRequests([local], [remote], []);
      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('approved');
    });
  });

  describe('mergeSnapshots', () => {
    const makeEmptySnapshot = (override: Partial<CloudSyncSnapshot> = {}): CloudSyncSnapshot => ({
      schemaVersion: 5,
      familyCode: 'family-main',
      updatedAt: 100,
      updatedByRole: '아이',
      updatedByDeviceId: 'device-1',
      parentPinCode: '160125',
      parentPinUpdatedAt: 100,
      items: [],
      deletedItemTimestamps: {},
      weeklyOverrides: {},
      completionFlags: {},
      subTaskCompletionFlags: {},
      parentVerifiedFlags: {},
      parentVerifiedSubTaskFlags: {},
      itemReactions: {},
      praiseNotes: [],
      rewardRedemptions: [],
      archivedEarnedHearts: 0,
      rewardPresets: [],
      deletedRewardPresetTimestamps: {},
      starTransactions: [],
      starRedemptionRequests: [],
      starRewardPresets: [],
      deletedStarPresetTimestamps: {},
      revokedStarTransactionIds: [],
      revokedStarRedemptionIds: [],
      revokedPraiseNoteIds: [],
      ...override,
    });

    it('merges parent PIN code if remote PIN is 6 digits and newer', () => {
      const local = makeEmptySnapshot({
        parentPinCode: '111111',
        parentPinUpdatedAt: 100,
      });
      const remote = makeEmptySnapshot({
        parentPinCode: '999999',
        parentPinUpdatedAt: 200,
      });

      const merged = mergeSnapshots(local, remote);
      expect(merged.parentPinCode).toBe('999999');
      expect(merged.parentPinUpdatedAt).toBe(200);
    });

    it('preserves item reactions heart counts and unions comments', () => {
      const local = makeEmptySnapshot({
        itemReactions: {
          item_1: {
            itemKey: 'item_1',
            heartCount: 3,
            sticker: 'heart',
            comment: '잘했어요',
            comments: [{ id: 'c1', text: '잘했어요', createdAt: 100 }],
            updatedAt: 100,
          },
        },
      });

      const remote = makeEmptySnapshot({
        itemReactions: {
          item_1: {
            itemKey: 'item_1',
            heartCount: 5,
            sticker: 'crown',
            comment: '최고야!',
            comments: [{ id: 'c2', text: '최고야!', createdAt: 150 }],
            updatedAt: 150,
          },
        },
      });

      const merged = mergeSnapshots(local, remote);
      expect(merged.itemReactions.item_1.heartCount).toBe(5);
      expect(merged.itemReactions.item_1.sticker).toBe('crown');
      expect(merged.itemReactions.item_1.comments).toHaveLength(2);
      expect(merged.itemReactions.item_1.comment).toBe('최고야!');
    });
  });
});
