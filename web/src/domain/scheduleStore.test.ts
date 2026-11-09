import { describe, it, expect, beforeEach } from 'vitest';
import { getWeekKey, getWeekdayNumber } from './calendarUtils';
import { ScheduleStore } from './scheduleStore';
import { deterministicUUID } from './defaultSchedule';

describe('ScheduleStore & CalendarUtils (Seam 1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('CalendarUtils', () => {
    it('calculates ISO-8601 week key matching Swift format (unpadded week number)', () => {
      // 2026-11-09 is a Monday in Week 46 of 2026
      const nov9 = new Date(2026, 10, 9);
      expect(getWeekKey(nov9)).toBe('2026-W46');

      // 2026-01-26 is a Monday in Week 5 of 2026 (must be unpadded '2026-W5' matching Swift)
      const jan26 = new Date(2026, 0, 26);
      expect(getWeekKey(jan26)).toBe('2026-W5');
    });

    it('maps JavaScript date day to Monday=1 ... Sunday=7', () => {
      const monday = new Date(2026, 10, 9); // Monday
      const sunday = new Date(2026, 10, 15); // Sunday
      expect(getWeekdayNumber(monday)).toBe(1);
      expect(getWeekdayNumber(sunday)).toBe(7);
    });
  });

  describe('Deterministic UUID (RFC 4122 v4 via SHA-256)', () => {
    it('generates deterministic UUIDs 100% identical to Swift DefaultScheduleData', () => {
      // Exact seed test from Swift: deterministicUUID(seed: "weekly-schedule-default-v2-1|7:0|코딱지")
      const seed = 'weekly-schedule-default-v2-1|7:0|코딱지';
      const uuid = deterministicUUID(seed);
      expect(uuid).toBe('5d829e4e-6ac8-438d-b00d-8d5207eb2254');
    });
  });

  describe('Master Schedule Loading', () => {
    it('loads Master Schedule when local storage has no cached items', () => {
      const store = new ScheduleStore();
      const items = store.getItems();
      expect(items.length).toBeGreaterThan(30);

      // Verify every item has required fields
      for (const item of items) {
        expect(item.id).toBeDefined();
        expect(item.title).toBeTruthy();
        expect(item.weekday).toBeGreaterThanOrEqual(1);
        expect(item.weekday).toBeLessThanOrEqual(7);
        expect(item.startHour).toBeGreaterThanOrEqual(0);
        expect(item.endHour).toBeGreaterThanOrEqual(0);
        expect(item.category).toBeDefined();
      }
    });

    it('filters items for specific weekday sorted by start time', () => {
      const store = new ScheduleStore();
      const mondayItems = store.getItemsForWeekday(1);

      expect(mondayItems.length).toBeGreaterThan(0);
      expect(mondayItems.every((item) => item.weekday === 1)).toBe(true);

      // Verify chronological ordering
      for (let i = 0; i < mondayItems.length - 1; i++) {
        const curr = mondayItems[i].startHour * 60 + mondayItems[i].startMinute;
        const next = mondayItems[i + 1].startHour * 60 + mondayItems[i + 1].startMinute;
        expect(curr).toBeLessThanOrEqual(next);
      }
    });

    it('returns today items based on current date', () => {
      const testDate = new Date(2026, 10, 9); // Monday
      const store = new ScheduleStore({ currentDate: testDate });
      const todayItems = store.getTodayItems();

      expect(todayItems.length).toBeGreaterThan(0);
      expect(todayItems.every((item) => item.weekday === 1)).toBe(true);
    });
  });

  describe('Child Mode Checklist & Completion Tracking (Seam 1)', () => {
    it('allows child to toggle completion of checkable items and synchronizes subtasks', () => {
      const testDate = new Date(2026, 10, 9); // 2026-W46, Monday
      const store = new ScheduleStore({ currentDate: testDate });
      const checkableItem = store.getTodayItems().find((item) => item.subTasks.length > 0 && item.category === 'study')!;

      expect(checkableItem).toBeDefined();
      expect(store.isCompleted(checkableItem)).toBe(false);

      // Child checks the item
      const toggleResult = store.toggleCompletion(checkableItem);
      expect(toggleResult).toBe(true);
      expect(store.isCompleted(checkableItem)).toBe(true);

      // All subtasks of this item should also be marked completed
      for (const sub of checkableItem.subTasks) {
        expect(store.isSubTaskCompleted(sub)).toBe(true);
      }

      // Unchecking the item unchecks the item and its subtasks
      store.toggleCompletion(checkableItem);
      expect(store.isCompleted(checkableItem)).toBe(false);
      for (const sub of checkableItem.subTasks) {
        expect(store.isSubTaskCompleted(sub)).toBe(false);
      }
    });

    it('toggling subtasks individually updates parent item completion status', () => {
      const testDate = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: testDate });
      const itemWithSubtasks = store.getTodayItems().find((item) => item.subTasks.length >= 2)!;
      expect(itemWithSubtasks).toBeDefined();

      const [sub1, sub2] = itemWithSubtasks.subTasks;

      // Checking sub1 does not complete parent item yet
      store.toggleSubTaskCompletion(sub1, itemWithSubtasks);
      expect(store.isSubTaskCompleted(sub1)).toBe(true);
      expect(store.isCompleted(itemWithSubtasks)).toBe(false);

      // If item has 2 subtasks, checking sub2 completes the parent item
      if (itemWithSubtasks.subTasks.length === 2) {
        store.toggleSubTaskCompletion(sub2, itemWithSubtasks);
        expect(store.isSubTaskCompleted(sub2)).toBe(true);
        expect(store.isCompleted(itemWithSubtasks)).toBe(true);

        // Unchecking sub1 unchecks parent item
        store.toggleSubTaskCompletion(sub1, itemWithSubtasks);
        expect(store.isSubTaskCompleted(sub1)).toBe(false);
        expect(store.isCompleted(itemWithSubtasks)).toBe(false);
      }
    });

    it('protects parent-verified items and subtasks from being unchecked in Child Mode', () => {
      const testDate = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: testDate });
      const item = store.getTodayItems().find((i) => i.category === 'study' && i.subTasks.length > 0)!;

      // Child marks it completed
      store.toggleCompletion(item);
      expect(store.isCompleted(item)).toBe(true);

      // Parent stamps verification
      store.setParentVerified(item.id, true);
      expect(store.isParentVerified(item)).toBe(true);

      // Child attempts to uncheck the verified item - must be rejected
      const uncheckResult = store.toggleCompletion(item);
      expect(uncheckResult).toBe(false);
      expect(store.isCompleted(item)).toBe(true);

      // Child attempts to uncheck subtask of verified item - must be rejected
      const sub = item.subTasks[0];
      const subUncheckResult = store.toggleSubTaskCompletion(sub, item);
      expect(subUncheckResult).toBe(false);
      expect(store.isSubTaskCompleted(sub)).toBe(true);
    });

    it('ignores completion toggle for non-checkable categories like routine or free', () => {
      const testDate = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: testDate });
      const routineItem = store.getTodayItems().find((i) => i.category === 'routine')!;
      expect(routineItem).toBeDefined();

      const result = store.toggleCompletion(routineItem);
      expect(result).toBe(false);
      expect(store.isCompleted(routineItem)).toBe(false);
    });

    it('calculates completion statistics and progress percentage accurately', () => {
      const testDate = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: testDate });
      const mondayCheckable = store.getTodayItems().filter((i) => i.category !== 'routine' && i.category !== 'free');
      const total = mondayCheckable.length;
      expect(total).toBeGreaterThan(0);

      const initialStats = store.getCompletionStats(1);
      expect(initialStats.total).toBe(total);
      expect(initialStats.completed).toBe(0);
      expect(initialStats.percentage).toBe(0);

      // Complete one item
      store.toggleCompletion(mondayCheckable[0]);
      const statsAfterOne = store.getCompletionStats(1);
      expect(statsAfterOne.completed).toBe(1);
      expect(statsAfterOne.percentage).toBe(Math.round((1 / total) * 100));

      // Verify parent verification stat
      store.setParentVerified(mondayCheckable[0].id, true);
      const statsAfterVerify = store.getCompletionStats(1);
      expect(statsAfterVerify.verified).toBe(1);
      expect(statsAfterVerify.waiting).toBe(0);
    });

    it('persists completions to localStorage across store instances', () => {
      const testDate = new Date(2026, 10, 9);
      const store1 = new ScheduleStore({ currentDate: testDate });
      const item = store1.getTodayItems().find((i) => i.category === 'study')!;

      store1.toggleCompletion(item);
      expect(store1.isCompleted(item)).toBe(true);

      // Create new store instance loading from the same localStorage
      const store2 = new ScheduleStore({ currentDate: testDate });
      expect(store2.isCompleted(item)).toBe(true);
    });
  });

  describe('CloudSyncSnapshot Generation & Merging (Seam 2)', () => {
    it('makeCurrentSnapshot creates valid CloudSyncSnapshot schemaVersion 5', () => {
      const store = new ScheduleStore();
      const snapshot = store.makeCurrentSnapshot();

      expect(snapshot.schemaVersion).toBe(5);
      expect(snapshot.familyCode).toBe('family-main');
      expect(snapshot.parentPinCode).toBe('160125');
      expect(snapshot.items.length).toBeGreaterThan(0);
      expect(typeof snapshot.updatedAt).toBe('number');
      expect(snapshot.updatedByDeviceId).toBeTruthy();
    });

    it('records timestamped flags when toggling item completion', () => {
      const store = new ScheduleStore();
      const item = store.getTodayItems().find((i) => store.isItemCheckable(i))!;
      expect(item).toBeDefined();

      store.toggleCompletion(item);
      const snapshot = store.makeCurrentSnapshot();
      const key = store.itemKey(item.id);

      expect(snapshot.completionFlags[key]).toBeDefined();
      expect(snapshot.completionFlags[key].isSet).toBe(true);
      expect(snapshot.completionFlags[key].updatedAt).toBeGreaterThan(0);
    });

    it('applyMergedRemoteSnapshot integrates remote modifications and updates state', () => {
      const store = new ScheduleStore();
      const item = store.getTodayItems().find((i) => store.isItemCheckable(i))!;
      const key = store.itemKey(item.id);

      expect(store.isCompleted(item)).toBe(false);

      const remoteSnapshot = store.makeCurrentSnapshot();
      remoteSnapshot.completionFlags[key] = {
        isSet: true,
        updatedAt: Date.now() / 1000 + 10,
      };
      remoteSnapshot.parentPinCode = '654321';
      remoteSnapshot.parentPinUpdatedAt = Date.now() / 1000 + 10;

      store.applyMergedRemoteSnapshot(remoteSnapshot);

      expect(store.isCompleted(item)).toBe(true);
      expect(store.getParentPinCode()).toBe('654321');
    });
  });

  describe('Parent PIN, Lockout, Stamps & Praise Hearts (Seam 1 / Issue 04)', () => {
    it('verifies correct 6-digit master PIN and switches to parent mode', () => {
      const store = new ScheduleStore();
      expect(store.isParentMode()).toBe(false);
      expect(store.getDeviceRole()).toBe('child');

      const ok = store.verifyParentPin('160125');
      expect(ok).toBe(true);
      expect(store.isParentMode()).toBe(true);
      expect(store.getDeviceRole()).toBe('parent');
      expect(store.getFailedPinAttempts()).toBe(0);

      // Lock parent mode back to child mode
      store.lockParentMode();
      expect(store.isParentMode()).toBe(false);
      expect(store.getDeviceRole()).toBe('child');
    });

    it('enforces 60-second lockout after 5 consecutive incorrect PIN attempts', () => {
      const store = new ScheduleStore();

      for (let i = 1; i <= 4; i++) {
        expect(store.verifyParentPin('000000')).toBe(false);
        expect(store.getFailedPinAttempts()).toBe(i);
        expect(store.isPinLockedOut()).toBe(false);
        expect(store.getRemainingLockoutSeconds()).toBe(0);
      }

      // 5th failed attempt triggers lockout
      const fifthAttempt = store.verifyParentPin('000000');
      expect(fifthAttempt).toBe(false);
      expect(store.getFailedPinAttempts()).toBe(5);
      expect(store.isPinLockedOut()).toBe(true);
      expect(store.getRemainingLockoutSeconds()).toBeGreaterThanOrEqual(58);
      expect(store.getRemainingLockoutSeconds()).toBeLessThanOrEqual(60);

      // While locked out, even the correct PIN must be rejected
      expect(store.verifyParentPin('160125')).toBe(false);

      // Resetting lockout restores normal verification
      store.resetPinLockout();
      expect(store.isPinLockedOut()).toBe(false);
      expect(store.getRemainingLockoutSeconds()).toBe(0);
      expect(store.getFailedPinAttempts()).toBe(0);
      expect(store.verifyParentPin('160125')).toBe(true);
    });

    it('allows parent mode to toggle parent verification stamp on items and subtasks', () => {
      const store = new ScheduleStore();
      const itemWithSubTasks = store
        .getTodayItems()
        .find((i) => store.isItemCheckable(i) && i.subTasks.length >= 2)!;
      expect(itemWithSubTasks).toBeDefined();

      // Child completes the item
      store.toggleCompletion(itemWithSubTasks);
      expect(store.isCompleted(itemWithSubTasks)).toBe(true);
      expect(store.isParentVerified(itemWithSubTasks)).toBe(false);

      // Parent mode stamps the item
      store.toggleParentVerification(itemWithSubTasks);
      expect(store.isParentVerified(itemWithSubTasks)).toBe(true);
      for (const sub of itemWithSubTasks.subTasks) {
        expect(store.isSubTaskParentVerified(sub)).toBe(true);
      }

      // Parent can cancel the stamp
      store.toggleParentVerification(itemWithSubTasks);
      expect(store.isParentVerified(itemWithSubTasks)).toBe(false);
      for (const sub of itemWithSubTasks.subTasks) {
        expect(store.isSubTaskParentVerified(sub)).toBe(false);
      }

      // Parent stamps individual subtask
      const sub1 = itemWithSubTasks.subTasks[0];
      const sub2 = itemWithSubTasks.subTasks[1];
      store.toggleSubTaskParentVerification(sub1, itemWithSubTasks);
      expect(store.isSubTaskParentVerified(sub1)).toBe(true);
      expect(store.isSubTaskParentVerified(sub2)).toBe(false);
      expect(store.isParentVerified(itemWithSubTasks)).toBe(false);

      // Once all subtasks are parent-verified, the parent item is also verified
      for (const sub of itemWithSubTasks.subTasks.slice(1)) {
        store.toggleSubTaskParentVerification(sub, itemWithSubTasks);
      }
      expect(store.isParentVerified(itemWithSubTasks)).toBe(true);
    });

    it('manages item reactions, comments, and family praise notes with available hearts', () => {
      const store = new ScheduleStore();
      const item = store.getTodayItems().find((i) => store.isItemCheckable(i))!;
      const initialHearts = store.getAvailableHearts();

      // Child completes the item
      store.toggleCompletion(item);

      // Send heart +3 and comment to specific item
      store.sendItemReaction({
        item,
        addHearts: 3,
        sticker: 'heart',
        comment: '오늘 스스로 숙제 잘했네! ❤️',
        alsoVerify: true,
      });

      const reaction = store.getItemReaction(item);
      expect(reaction).toBeDefined();
      expect(reaction?.heartCount).toBe(3);
      expect(reaction?.sticker).toBe('heart');
      expect(reaction?.comment).toBe('오늘 스스로 숙제 잘했네! ❤️');
      expect(reaction?.comments?.length).toBe(1);
      expect(store.isParentVerified(item)).toBe(true);
      expect(store.getAvailableHearts()).toBe(initialHearts + 3);

      // Send additional reaction to the same item with 0 hearts (message only)
      store.sendItemReaction({
        item,
        addHearts: 0,
        sticker: 'thumbsUp',
        comment: '앞으로도 화이팅!',
      });
      const reaction2 = store.getItemReaction(item);
      expect(reaction2?.heartCount).toBe(3);
      expect(reaction2?.sticker).toBe('thumbsUp');
      expect(reaction2?.comments?.length).toBe(2);
      expect(store.getAvailableHearts()).toBe(initialHearts + 3);

      // Send general family praise banner
      store.sendFamilyPraise({
        hearts: 5,
        sticker: 'crown',
        message: '오늘 하루 최고였어 👑',
      });
      const praises = store.getPraiseNotes();
      expect(praises.length).toBeGreaterThan(0);
      expect(praises[0].hearts).toBe(5);
      expect(praises[0].sticker).toBe('crown');
      expect(praises[0].message).toBe('오늘 하루 최고였어 👑');
      expect(store.getAvailableHearts()).toBe(initialHearts + 8);
    });
  });

  describe('Master Schedule CRUD & Weekly Override Engine (Seam 1 / Issue 05)', () => {
    it('allows parent to add new master schedule items across multiple weekdays', () => {
      const store = new ScheduleStore();
      store.unlockParentMode();

      const newItem = {
        id: 'new-piano-lesson',
        weekday: 1 as const,
        startHour: 17,
        startMinute: 0,
        endHour: 18,
        endMinute: 0,
        title: '피아노 학원',
        note: '체르니 30번 연습',
        category: 'music' as const,
        iconName: 'music',
        subTasks: [{ id: 'sub-p1', title: '스케일 연습' }, { id: 'sub-p2', title: '체르니' }],
        isNotificationEnabled: true,
        notificationLeadMinutes: [15],
        updatedAt: Date.now() / 1000,
      };

      // Add to Monday (1) and Wednesday (3)
      store.addItem(newItem, [1, 3], 'master');

      const mondayItems = store.getItemsForWeekday(1);
      const wednesdayItems = store.getItemsForWeekday(3);

      const addedMonday = mondayItems.find((it) => it.title === '피아노 학원');
      const addedWed = wednesdayItems.find((it) => it.title === '피아노 학원');

      expect(addedMonday).toBeDefined();
      expect(addedWed).toBeDefined();
      expect(addedMonday?.id).not.toBe(addedWed?.id); // Should have unique IDs
      expect(addedMonday?.subTasks.length).toBe(2);
      expect(addedMonday?.category).toBe('music');
      expect(store.isAdjustedThisWeek(addedMonday!)).toBe(false);
    });

    it('allows adding this-week-only schedule additions that do not appear in other weeks', () => {
      const nov9 = new Date(2026, 10, 9); // Week 46, Monday
      const store = new ScheduleStore({ currentDate: nov9 });
      store.unlockParentMode();

      const tempItem = {
        id: 'temp-hospital-visit',
        weekday: 1 as const,
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        title: '안과 정기 검진',
        note: '시력 측정',
        category: 'routine' as const,
        iconName: 'sparkles',
        subTasks: [],
        isNotificationEnabled: true,
        notificationLeadMinutes: [15],
        updatedAt: Date.now() / 1000,
      };

      store.addItem(tempItem, [1], 'thisWeek');

      // In current week (2026-W46)
      const week46Monday = store.getItemsForWeekday(1);
      const foundIn46 = week46Monday.find((it) => it.title === '안과 정기 검진');
      expect(foundIn46).toBeDefined();
      expect(store.isAdjustedThisWeek(foundIn46!)).toBe(true);
      expect(store.adjustmentBadgeText(foundIn46!)).toBe('이번 주 추가 일정');

      // Change week to next week (2026-W47)
      const nov16 = new Date(2026, 10, 16); // Week 47
      store.setCurrentDate(nov16);
      const week47Monday = store.getItemsForWeekday(1);
      const foundIn47 = week47Monday.find((it) => it.title === '안과 정기 검진');
      expect(foundIn47).toBeUndefined(); // Temporary addition must disappear in other weeks
    });

    it('allows updating master schedule permanently or overriding only for the current week', () => {
      const nov9 = new Date(2026, 10, 9); // Week 46, Monday
      const store = new ScheduleStore({ currentDate: nov9 });
      store.unlockParentMode();

      const baseMonday = store.getItemsForWeekday(1)[0];
      expect(baseMonday).toBeDefined();
      const originalTitle = baseMonday.title;
      const originalStartHour = baseMonday.startHour;

      // 1. Temporary Weekly Override: Move from 15:00 Monday to 17:00 Wednesday for this week only
      const modifiedForThisWeek = {
        ...baseMonday,
        weekday: 3 as const,
        startHour: 17,
        startMinute: 30,
        endHour: 18,
        endMinute: 30,
        note: '이번 주만 수요일 5시 반으로 이동',
      };

      store.updateItem(modifiedForThisWeek, 'thisWeek');

      // Monday in 2026-W46 should NOT have this item anymore
      const w46Monday = store.getItemsForWeekday(1);
      expect(w46Monday.some((it) => it.id === baseMonday.id)).toBe(false);

      // Wednesday in 2026-W46 SHOULD have this item with adjusted badge
      const w46Wed = store.getItemsForWeekday(3);
      const adjustedWed = w46Wed.find((it) => it.id === baseMonday.id);
      expect(adjustedWed).toBeDefined();
      expect(adjustedWed?.startHour).toBe(17);
      expect(adjustedWed?.startMinute).toBe(30);
      expect(store.isAdjustedThisWeek(adjustedWed!)).toBe(true);
      expect(store.adjustmentBadgeText(adjustedWed!)).toContain('이번 주 요일·시간 조정');

      // Switch to next week (2026-W47): Must automatically revert back to original Monday master schedule!
      const nov16 = new Date(2026, 10, 16);
      store.setCurrentDate(nov16);
      const w47Monday = store.getItemsForWeekday(1);
      const revertedMonday = w47Monday.find((it) => it.id === baseMonday.id);
      expect(revertedMonday).toBeDefined();
      expect(revertedMonday?.weekday).toBe(1);
      expect(revertedMonday?.startHour).toBe(originalStartHour);
      expect(store.isAdjustedThisWeek(revertedMonday!)).toBe(false);

      // 2. Permanent Master Update: Change title for everyone
      store.updateItem({ ...baseMonday, title: `${originalTitle} [업데이트]` }, 'master');
      const updatedMaster = store.getItemsForWeekday(1).find((it) => it.id === baseMonday.id);
      expect(updatedMaster?.title).toBe(`${originalTitle} [업데이트]`);
    });

    it('allows skipping (cancelling) an item for this week only and restoring it', () => {
      const nov9 = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: nov9 });
      store.unlockParentMode();

      const baseItem = store.getItemsForWeekday(1)[0];
      expect(baseItem).toBeDefined();

      // Skip for this week
      const skipSuccess = store.skipItemForThisWeek(baseItem);
      expect(skipSuccess).toBe(true);
      expect(store.isSkippedThisWeek(baseItem.id)).toBe(true);

      // Should not be in effective items for this week
      const w46Items = store.getItemsForWeekday(1);
      expect(w46Items.some((it) => it.id === baseItem.id)).toBe(false);

      // Revert this week override
      store.revertThisWeekOverride(baseItem.id);
      expect(store.isSkippedThisWeek(baseItem.id)).toBe(false);
      const w46ItemsAfterRevert = store.getItemsForWeekday(1);
      expect(w46ItemsAfterRevert.some((it) => it.id === baseItem.id)).toBe(true);
    });

    it('resets all adjustments for a given weekday or the entire week', () => {
      const nov9 = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: nov9 });
      store.unlockParentMode();

      const item1 = store.getItemsForWeekday(1)[0];
      const item2 = store.getItemsForWeekday(1)[1];

      store.skipItemForThisWeek(item1);
      store.updateItem({ ...item2, startHour: 20 }, 'thisWeek');

      expect(store.getCurrentWeekAdjustmentCount()).toBe(2);

      // Reset adjustments for Monday (1)
      store.resetThisWeekAdjustments(1);
      expect(store.getCurrentWeekAdjustmentCount()).toBe(0);
      expect(store.isSkippedThisWeek(item1.id)).toBe(false);
      expect(store.getItemsForWeekday(1).find((it) => it.id === item2.id)?.startHour).toBe(item2.startHour);
    });

    it('prevents non-parent from deleting or modifying master schedule items, but allows parent', () => {
      const store = new ScheduleStore();
      const checkable = store.getItemsForWeekday(1).find((it) => store.isItemCheckable(it))!;

      // Complete and parent-verify item
      store.toggleCompletion(checkable);
      store.unlockParentMode();
      store.toggleParentVerification(checkable);
      store.lockParentMode(); // back to child mode

      // Child attempts to skip or delete master item
      expect(store.skipItemForThisWeek(checkable)).toBe(false);
      expect(store.deleteItem(checkable)).toBe(false);
      expect(store.addItem(checkable, [1], 'master')).toBe(false);
      expect(store.updateItem(checkable, 'master')).toBe(false);

      // Parent unlocks and succeeds
      store.unlockParentMode();
      expect(store.deleteItem(checkable)).toBe(true);
      expect(store.getItems().some((it) => it.id === checkable.id)).toBe(false);
    });
  });
});
