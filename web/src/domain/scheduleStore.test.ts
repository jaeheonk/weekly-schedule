import { describe, it, expect, beforeEach } from 'vitest';
import { getWeekKey, getWeekdayNumber } from './calendarUtils';
import { ScheduleStore } from './scheduleStore';
import { deterministicUUID } from './defaultSchedule';

describe('ScheduleStore & CalendarUtils (Seam 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  describe('Star Ledger, Daily Quests & Reward Shop (Seam 1 / Issue 06)', () => {
    const completeAndVerifyWeekday = (store: ScheduleStore, day: 1 | 2 | 3 | 4 | 5) => {
      const items = store.getItemsForWeekday(day).filter((it) => store.isItemCheckable(it));
      for (const item of items) {
        if (!store.isCompleted(item)) store.toggleCompletion(item);
        for (const sub of item.subTasks) {
          if (!store.isSubTaskCompleted(sub)) store.toggleSubTaskCompletion(sub, item);
        }
      }
      store.unlockParentMode();
      for (const item of items) {
        if (!store.isParentVerified(item)) store.toggleParentVerification(item);
        for (const sub of item.subTasks) {
          if (!store.isSubTaskParentVerified(sub)) store.toggleSubTaskParentVerification(sub, item);
        }
      }
    };

    it('evaluates weekday star states: weekend excluded, in-progress, and claimable when all items verified', () => {
      const nov9 = new Date(2026, 10, 9); // Monday
      const store = new ScheduleStore({ currentDate: nov9 });

      // Saturday (6) and Sunday (7) are excluded from weekday star quests
      expect(store.getWeekdayStarState(6)).toEqual({ kind: 'weekendExcluded' });
      expect(store.getWeekdayStarState(7)).toEqual({ kind: 'weekendExcluded' });

      // Monday has checkable tasks -> inProgress initially
      const mondayInitialState = store.getWeekdayStarState(1);
      expect(mondayInitialState.kind).toBe('inProgress');
      if (mondayInitialState.kind === 'inProgress') {
        expect(mondayInitialState.completed).toBe(0);
        expect(mondayInitialState.verified).toBe(0);
        expect(mondayInitialState.total).toBeGreaterThan(0);
      }

      // Complete all Monday items and subtasks
      const monItems = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
      for (const item of monItems) {
        if (!store.isCompleted(item)) store.toggleCompletion(item);
        for (const sub of item.subTasks) {
          if (!store.isSubTaskCompleted(sub)) store.toggleSubTaskCompletion(sub, item);
        }
      }

      // Not yet verified by parent -> still inProgress
      const partialState = store.getWeekdayStarState(1);
      expect(partialState.kind).toBe('inProgress');
      if (partialState.kind === 'inProgress') {
        expect(partialState.completed).toBe(monItems.length);
        expect(partialState.verified).toBe(0);
      }

      // Parent verifies all Monday items and subtasks
      store.unlockParentMode();
      for (const item of monItems) {
        if (!store.isParentVerified(item)) store.toggleParentVerification(item);
        for (const sub of item.subTasks) {
          if (!store.isSubTaskParentVerified(sub)) store.toggleSubTaskParentVerification(sub, item);
        }
      }

      // Now Monday should be claimable!
      const claimableState = store.getWeekdayStarState(1);
      expect(claimableState).toEqual({ kind: 'claimable', total: monItems.length });
    });

    it('awards daily star (+1) when claimable, prevents duplicate awards, and marks state awarded', () => {
      const nov9 = new Date(2026, 10, 9); // Monday
      const store = new ScheduleStore({ currentDate: nov9 });

      // Complete and verify all Monday items
      completeAndVerifyWeekday(store, 1);

      expect(store.getAvailableStars()).toBe(0);
      expect(store.isDailyStarAwarded(1)).toBe(false);

      // Award daily star
      const awardResult = store.awardDailyStar(1);
      expect(awardResult).toBe(true);

      // Ledger calculations
      expect(store.getAvailableStars()).toBe(1);
      expect(store.getTotalEarnedStars()).toBe(1);
      expect(store.getTotalSpentStars()).toBe(0);
      expect(store.getThisWeekEarnedStars()).toBe(1);
      expect(store.isDailyStarAwarded(1)).toBe(true);

      const stateAfterAward = store.getWeekdayStarState(1);
      expect(stateAfterAward.kind).toBe('awarded');

      // Duplicate award attempts must be rejected
      expect(store.awardDailyStar(1)).toBe(false);
      expect(store.getAvailableStars()).toBe(1);
    });

    it('automatically grants weekly all-clear bonus (+2⭐) when all 5 weekdays (Mon-Fri) are awarded', () => {
      const nov9 = new Date(2026, 10, 9); // Monday
      const store = new ScheduleStore({ currentDate: nov9 });

      // Complete and verify Mon(1) to Thu(4)
      for (const d of [1, 2, 3, 4] as const) {
        completeAndVerifyWeekday(store, d);
        expect(store.awardDailyStar(d)).toBe(true);
      }

      expect(store.getAwardedDailyStarCount()).toBe(4);
      expect(store.isWeeklyBonusAwarded()).toBe(false);
      expect(store.getAvailableStars()).toBe(4);

      // Complete and verify Friday (5)
      completeAndVerifyWeekday(store, 5);

      // Awarding the 5th day triggers automatic +2 bonus!
      expect(store.awardDailyStar(5)).toBe(true);
      expect(store.getAwardedDailyStarCount()).toBe(5);
      expect(store.isWeeklyBonusAwarded()).toBe(true);

      // Total stars = 5 daily + 2 bonus = 7 stars
      expect(store.getAvailableStars()).toBe(7);
      expect(store.getTotalEarnedStars()).toBe(7);
      expect(store.getThisWeekEarnedStars()).toBe(7);

      // Celebration context captures bonus
      const celebration = store.getCelebrationContext();
      expect(celebration).toBeDefined();
      expect(celebration?.earnedDailyStar).toBe(1);
      expect(celebration?.earnedWeeklyBonus).toBe(2);
      expect(celebration?.totalAvailableStars).toBe(7);
    });

    it('handles reward presets, redemption requests, and parent approvals with atomic heart conversion', () => {
      const store = new ScheduleStore();

      // Check default presets exist
      const presets = store.getStarRewardPresets();
      expect(presets.length).toBeGreaterThanOrEqual(2);
      const heartPreset = presets.find((p) => p.actionType === 'convertToHearts')!;
      const robuxPreset = presets.find((p) => p.starCost === 10)!;

      expect(heartPreset).toBeDefined();
      expect(heartPreset.starCost).toBe(1);
      expect(heartPreset.grantedHearts).toBe(5);
      expect(robuxPreset).toBeDefined();
      expect(robuxPreset.starCost).toBe(10);

      // Initial star balance = 0 -> request fails
      expect(store.requestStarRedemption(heartPreset)).toBe(false);

      // Give 2 stars directly via awardDailyStar on Mon and Tue
      completeAndVerifyWeekday(store, 1);
      completeAndVerifyWeekday(store, 2);
      expect(store.awardDailyStar(1)).toBe(true);
      expect(store.awardDailyStar(2)).toBe(true);

      expect(store.getAvailableStars()).toBe(2);
      expect(store.getRequestableStars()).toBe(2);
      expect(store.getReservedPendingStars()).toBe(0);

      // Child requests 1 heartPreset (1 star)
      store.lockParentMode();
      const requestSuccess = store.requestStarRedemption(heartPreset);
      expect(requestSuccess).toBe(true);

      // Reserved pending stars = 1, available = 2 (not deducted until approved), requestable = 1
      expect(store.getReservedPendingStars()).toBe(1);
      expect(store.getAvailableStars()).toBe(2);
      expect(store.getRequestableStars()).toBe(1);
      expect(store.getPendingStarRedemptionCount()).toBe(1);

      const pendingReq = store.getStarRedemptionRequests()[0];
      expect(pendingReq.status).toBe('pending');
      expect(pendingReq.rewardTitle).toBe(heartPreset.title);

      // Initial hearts before approval
      const initialHearts = store.getAvailableHearts();

      // Parent approves the redemption
      store.unlockParentMode();
      const approveSuccess = store.approveStarRedemption(pendingReq);
      expect(approveSuccess).toBe(true);

      // Now available stars deducted to 1, spent = 1, reserved = 0
      expect(store.getAvailableStars()).toBe(1);
      expect(store.getTotalSpentStars()).toBe(1);
      expect(store.getReservedPendingStars()).toBe(0);
      expect(store.getPendingStarRedemptionCount()).toBe(0);

      // Hearts increased by 5 atomically!
      expect(store.getAvailableHearts()).toBe(initialHearts + 5);

      // Star ledger records the spend transaction
      const txs = store.getStarTransactions();
      const spendTx = txs.find((t) => t.kind === 'rewardRedemption');
      expect(spendTx).toBeDefined();
      expect(spendTx?.delta).toBe(-1);
    });

    it('allows rejecting pending requests without deducting stars, and supports immediate parent redemption', () => {
      const store = new ScheduleStore();

      // Give 1 star on Monday
      completeAndVerifyWeekday(store, 1);
      expect(store.awardDailyStar(1)).toBe(true);
      expect(store.getAvailableStars()).toBe(1);

      const heartPreset = store.getStarRewardPresets().find((p) => p.actionType === 'convertToHearts')!;

      // Child requests
      store.lockParentMode();
      store.requestStarRedemption(heartPreset);
      expect(store.getReservedPendingStars()).toBe(1);

      // Parent rejects
      const req = store.getStarRedemptionRequests()[0];
      store.rejectStarRedemption(req);

      expect(store.getReservedPendingStars()).toBe(0);
      expect(store.getAvailableStars()).toBe(1); // not deducted
      expect(store.getStarRedemptionRequests()[0].status).toBe('rejected');

      // Parent redeems immediately
      store.unlockParentMode();
      const immediateResult = store.redeemStarRewardImmediately(heartPreset);
      expect(immediateResult).toBe(true);
      expect(store.getAvailableStars()).toBe(0);
      expect(store.getTotalSpentStars()).toBe(1);
    });
  });

  describe('Heart Reward System (Seam 1 / Issue 01)', () => {
    it('initializes with 8 default reward presets matching native iOS definitions', () => {
      const store = new ScheduleStore();
      const presets = store.getRewardPresets();
      expect(presets).toHaveLength(8);
      expect(presets[0]).toMatchObject({
        id: '00000000-0000-0000-0000-000000000101',
        emoji: '🎮',
        title: '자유 놀이 / 게임 30분',
        hearts: 10,
        tag: '놀이',
      });
      expect(presets[1]).toMatchObject({
        id: '00000000-0000-0000-0000-000000000102',
        emoji: '🍦',
        title: '달콤한 간식 / 아이스크림',
        hearts: 5,
        tag: '간식',
      });
      expect(presets[7]).toMatchObject({
        id: '00000000-0000-0000-0000-000000000108',
        emoji: '🍳',
        title: '오늘 저녁 메뉴 고르기',
        hearts: 10,
        tag: '특별',
      });
    });

    it('computes totalEarnedHearts, totalSpentHearts, and availableHearts accurately', () => {
      const store = new ScheduleStore();
      expect(store.getTotalEarnedHearts()).toBe(0);
      expect(store.getTotalSpentHearts()).toBe(0);
      expect(store.getAvailableHearts()).toBe(0);

      // Add praise note with 15 hearts
      store.sendFamilyPraise({
        hearts: 15,
        sticker: 'heart',
        message: '멋진 하루야!',
      });
      expect(store.getTotalEarnedHearts()).toBe(15);
      expect(store.getAvailableHearts()).toBe(15);
      expect(store.getTotalSpentHearts()).toBe(0);
    });

    it('executes heart reward redemption, updates ledger, emits toast, and notifies subscribers', () => {
      const store = new ScheduleStore();
      store.sendFamilyPraise({
        hearts: 25,
        sticker: 'heart',
        message: '칭찬 하트 25개',
      });

      let notified = false;
      store.subscribe(() => {
        notified = true;
      });

      let toastEmitted: { message: string; status: string } | null = null;
      store.onToast((message, status) => {
        toastEmitted = { message, status };
      });

      const success = store.redeemReward('자유 놀이 / 게임 30분', 10);
      expect(success).toBe(true);
      expect(notified).toBe(true);
      expect(store.getAvailableHearts()).toBe(15);
      expect(store.getTotalSpentHearts()).toBe(10);

      const redemptions = store.getRewardRedemptions();
      expect(redemptions).toHaveLength(1);
      expect(redemptions[0].title).toBe('자유 놀이 / 게임 30분');
      expect(redemptions[0].hearts).toBe(10);
      expect(redemptions[0].redeemedByRole).toBe('아이');

      expect(toastEmitted).toEqual({
        message: '🎁 [자유 놀이 / 게임 30분] 교환 완료! 하트 10개가 차감되었어요.',
        status: 'success',
      });
    });

    it('falls back to default title "보상 교환" when whitespace or empty title is passed', () => {
      const store = new ScheduleStore();
      store.sendFamilyPraise({
        hearts: 10,
        sticker: 'heart',
        message: '칭찬 하트',
      });

      expect(store.redeemReward('   ', 5)).toBe(true);
      const redemptions = store.getRewardRedemptions();
      expect(redemptions[0].title).toBe('보상 교환');
    });

    it('rejects redemption if requested hearts exceed available balance or is non-positive', () => {
      const store = new ScheduleStore();
      store.sendFamilyPraise({
        hearts: 10,
        sticker: 'heart',
        message: '칭찬 하트',
      });

      // Overdraft
      expect(store.redeemReward('장난감 선물', 15)).toBe(false);
      expect(store.getAvailableHearts()).toBe(10);
      expect(store.getRewardRedemptions()).toHaveLength(0);

      // Non-positive
      expect(store.redeemReward('간식', 0)).toBe(false);
      expect(store.redeemReward('간식', -5)).toBe(false);
      expect(store.getAvailableHearts()).toBe(10);
    });

    it('caps redemption history to a 50-item ring buffer', () => {
      const store = new ScheduleStore();
      store.sendFamilyPraise({
        hearts: 100,
        sticker: 'heart',
        message: '충분한 하트',
      });

      for (let i = 1; i <= 55; i++) {
        store.redeemReward(`보상 #${i}`, 1);
      }

      const redemptions = store.getRewardRedemptions();
      expect(redemptions).toHaveLength(50);
      // Newest should be #55, oldest in ring buffer should be #6
      expect(redemptions[0].title).toBe('보상 #55');
      expect(redemptions[49].title).toBe('보상 #6');
      expect(store.getTotalSpentHearts()).toBe(50);
      expect(store.getAvailableHearts()).toBe(50);
    });

    it('refunds and cancels reward redemption, restores available balance, emits toast, and notifies subscribers', () => {
      const store = new ScheduleStore();
      let notifyCount = 0;
      store.subscribe(() => {
        notifyCount += 1;
      });

      const toasts: Array<{ message: string; status?: string }> = [];
      store.onToast((msg, status) => {
        toasts.push({ message: msg, status });
      });

      store.sendFamilyPraise({
        hearts: 30,
        sticker: 'heart',
        message: '하트 30개 충전',
      });

      expect(store.getAvailableHearts()).toBe(30);

      // Redeem two rewards
      expect(store.redeemReward('아이스크림', 5)).toBe(true);
      expect(store.redeemReward('게임 30분', 10)).toBe(true);

      expect(store.getAvailableHearts()).toBe(15);
      expect(store.getTotalSpentHearts()).toBe(15);

      const redemptions = store.getRewardRedemptions();
      expect(redemptions).toHaveLength(2);
      const gameRedemption = redemptions[0]; // '게임 30분' (newest)
      const iceCreamRedemption = redemptions[1]; // '아이스크림'

      const initialNotifyCount = notifyCount;
      const initialToastCount = toasts.length;

      // In child mode, refund attempt is rejected
      expect(store.isParentMode()).toBe(false);
      expect(store.refundRewardRedemption(gameRedemption.id)).toBe(false);
      expect(store.getAvailableHearts()).toBe(15);
      expect(notifyCount).toBe(initialNotifyCount);
      expect(toasts.length).toBe(initialToastCount);

      // In parent mode, refund succeeds
      store.unlockParentMode();
      const parentNotifyCount = notifyCount;
      const parentToastCount = toasts.length;

      const refundSuccess = store.refundRewardRedemption(gameRedemption.id);
      expect(refundSuccess).toBe(true);

      // Remaining redemptions should only have iceCreamRedemption
      const remainingRedemptions = store.getRewardRedemptions();
      expect(remainingRedemptions).toHaveLength(1);
      expect(remainingRedemptions[0].id).toBe(iceCreamRedemption.id);

      // Hearts balance restored
      expect(store.getTotalSpentHearts()).toBe(5);
      expect(store.getAvailableHearts()).toBe(25);

      // Notification and toast verification
      expect(notifyCount).toBe(parentNotifyCount + 1);
      expect(toasts.length).toBe(parentToastCount + 1);
      expect(toasts[toasts.length - 1].message).toBe(
        '↩️ [게임 30분] 교환이 취소되어 하트 10개가 복구되었어요.'
      );
      expect(toasts[toasts.length - 1].status).toBe('success');

      // Attempting to refund non-existent redemption returns false
      expect(store.refundRewardRedemption('non-existent-id')).toBe(false);
      expect(store.getAvailableHearts()).toBe(25);
    });

    it('manages custom reward presets: add, update, delete with tombstone tracking, and reset to defaults (Issue 04)', () => {
      const store = new ScheduleStore();
      let notifyCount = 0;
      store.subscribe(() => {
        notifyCount += 1;
      });

      const toasts: Array<{ message: string; status?: string }> = [];
      store.onToast((msg, status) => {
        toasts.push({ message: msg, status });
      });

      // 1. Initial defaults
      const initialPresets = store.getRewardPresets();
      expect(initialPresets).toHaveLength(8);
      expect(initialPresets[0].title).toBe('자유 놀이 / 게임 30분');

      // 2. Add custom preset
      const prevNotifyCount = notifyCount;
      const created = store.addRewardPreset({
        emoji: '🍕',
        title: '금요일 피자 파티',
        hearts: 25,
        tag: '외식',
      });

      expect(created.id).toBeDefined();
      expect(created.emoji).toBe('🍕');
      expect(created.title).toBe('금요일 피자 파티');
      expect(created.hearts).toBe(25);
      expect(created.tag).toBe('외식');
      expect(created.updatedAt).toBeGreaterThan(0);
      expect(notifyCount).toBe(prevNotifyCount + 1);

      const presetsAfterAdd = store.getRewardPresets();
      expect(presetsAfterAdd).toHaveLength(9);
      expect(presetsAfterAdd.find((p) => p.id === created.id)).toBeDefined();
      expect(toasts[toasts.length - 1].message).toContain('추천 보상이 추가되었어요');

      // 3. Update preset
      const updateNotifyCount = notifyCount;
      const updateOk = store.updateRewardPreset(created.id, {
        title: '주말 피자 뷔페',
        hearts: 30,
      });
      expect(updateOk).toBe(true);
      expect(notifyCount).toBe(updateNotifyCount + 1);

      const presetsAfterUpdate = store.getRewardPresets();
      const updatedItem = presetsAfterUpdate.find((p) => p.id === created.id);
      expect(updatedItem).toBeDefined();
      expect(updatedItem?.title).toBe('주말 피자 뷔페');
      expect(updatedItem?.hearts).toBe(30);
      expect(updatedItem?.emoji).toBe('🍕');
      expect(toasts[toasts.length - 1].message).toContain('추천 보상이 수정되었어요');

      // 4. Delete preset with tombstone
      const deleteNotifyCount = notifyCount;
      const deleteOk = store.deleteRewardPreset(created.id);
      expect(deleteOk).toBe(true);
      expect(notifyCount).toBe(deleteNotifyCount + 1);

      const presetsAfterDelete = store.getRewardPresets();
      expect(presetsAfterDelete).toHaveLength(8);
      expect(presetsAfterDelete.find((p) => p.id === created.id)).toBeUndefined();
      expect(toasts[toasts.length - 1].message).toContain('추천 보상이 삭제되었어요');

      // Snapshot verification for tombstone
      const snapshot = store.makeCurrentSnapshot();
      expect(snapshot.deletedRewardPresetTimestamps[created.id]).toBeGreaterThan(0);
      expect(snapshot.rewardPresets.find((p) => p.id === created.id)).toBeUndefined();

      // 5. Delete an initial default preset as well
      const firstDefaultId = initialPresets[0].id;
      store.deleteRewardPreset(firstDefaultId);
      expect(store.getRewardPresets()).toHaveLength(7);
      expect(store.getRewardPresets().find((p) => p.id === firstDefaultId)).toBeUndefined();

      // Verify that reloaded store respects the deletion tombstone
      const reloadedStore = new ScheduleStore();
      expect(reloadedStore.getRewardPresets()).toHaveLength(7);
      expect(reloadedStore.getRewardPresets().find((p) => p.id === firstDefaultId)).toBeUndefined();

      // 6. Reset to defaults
      const resetNotifyCount = notifyCount;
      store.resetRewardPresetsToDefault();
      expect(notifyCount).toBe(resetNotifyCount + 1);
      expect(store.getRewardPresets()).toHaveLength(8);
      expect(store.getRewardPresets().find((p) => p.id === firstDefaultId)).toBeDefined();
      expect(toasts[toasts.length - 1].message).toContain('초기 기본값으로 복원');

      const reloadedAfterReset = new ScheduleStore();
      expect(reloadedAfterReset.getRewardPresets()).toHaveLength(8);
    });
  });

  describe('Daily Schedule Selected Weekday & Adjustment Count (Issue 01)', () => {
    it('initializes selectedWeekday to todayWeekday, allows manual selection, and rolls over past midnight', () => {
      // Monday Nov 9, 2026 23:50
      const mondayNight = new Date(2026, 10, 9, 23, 50, 0);
      const store = new ScheduleStore({ currentDate: mondayNight });

      expect(store.getTodayWeekday()).toBe(1);
      expect(store.getSelectedWeekday()).toBe(1);

      // Select Thursday (4)
      store.setSelectedWeekday(4);
      expect(store.getSelectedWeekday()).toBe(4);

      // Periodic check on the same calendar day (Monday 23:58) keeps selectedWeekday = 4
      const mondayLate = new Date(2026, 10, 9, 23, 58, 0);
      expect(store.refreshDateAndDayChange(mondayLate)).toBe(false);
      expect(store.getSelectedWeekday()).toBe(4);

      // Rollover past midnight to Tuesday Nov 10, 2026 00:02
      const tuesdayMorning = new Date(2026, 10, 10, 0, 2, 0);
      expect(store.refreshDateAndDayChange(tuesdayMorning)).toBe(true);
      expect(store.getTodayWeekday()).toBe(2);
      expect(store.getSelectedWeekday()).toBe(2);
    });

    it('computes getAdjustmentCountForWeekday across modified, skipped, moved, and added items', () => {
      const monday = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: monday });
      store.unlockParentMode();

      expect(store.getAdjustmentCountForWeekday(1)).toBe(0);
      expect(store.getAdjustmentCountForWeekday(2)).toBe(0);

      const monItems = store.getItemsForWeekday(1);
      const itemToSkip = monItems[0];
      const itemToMove = monItems[1];
      const itemToModify = monItems[2];

      // 1. Skip item on Monday -> Monday adjustment count = 1
      store.skipItemForThisWeek(itemToSkip);
      expect(store.getAdjustmentCountForWeekday(1)).toBe(1);

      // 2. Move item from Monday (1) to Tuesday (2) -> Monday count = 2, Tuesday count = 1
      store.updateItem({ ...itemToMove, weekday: 2 }, 'thisWeek');
      expect(store.getAdjustmentCountForWeekday(1)).toBe(2);
      expect(store.getAdjustmentCountForWeekday(2)).toBe(1);

      // 3. Modify time on Monday -> Monday count = 3
      store.updateItem({ ...itemToModify, startHour: 20, endHour: 21 }, 'thisWeek');
      expect(store.getAdjustmentCountForWeekday(1)).toBe(3);

      // 4. Add temporary thisWeek item on Tuesday -> Tuesday count = 2
      store.addItem(
        {
          id: 'temp-tue-1',
          weekday: 2,
          startHour: 18,
          startMinute: 0,
          endHour: 19,
          endMinute: 0,
          title: '화요일 보강',
          note: '',
          category: 'academy',
          iconName: 'building.columns.fill',
          subTasks: [],
          isNotificationEnabled: false,
          notificationLeadMinutes: [],
          targetWeekKey: null,
          updatedAt: Date.now() / 1000,
        },
        [2],
        'thisWeek'
      );
      expect(store.getAdjustmentCountForWeekday(2)).toBe(2);
    });

    it('computes getCurrentActiveItems, getNextUpcomingItem, and isCurrentlyActive strictly for todayWeekday within [start, end)', () => {
      // Monday Nov 9, 2026 at exactly 15:00 (boundary between 14:30~15:00 and 15:00~16:00)
      const mondayAt1500 = new Date(2026, 10, 9, 15, 0, 0);
      const store = new ScheduleStore({ currentDate: mondayAt1500 });

      const activeItems = store.getCurrentActiveItems();
      expect(activeItems).toHaveLength(1);
      expect(activeItems[0].title).toBe('Vocabulary for Reading + 100 Words');
      expect(store.isCurrentlyActive(activeItems[0])).toBe(true);

      // 14:30~15:00 item has ended at 15:00 ([start, end) half-open interval)
      const endedItem = store
        .getItemsForWeekday(1)
        .find((it) => it.startHour === 14 && it.startMinute === 30)!;
      expect(store.isCurrentlyActive(endedItem)).toBe(false);

      // Next upcoming item is 16:00~17:00 바이올린
      const nextItem = store.getNextUpcomingItem();
      expect(nextItem).not.toBeNull();
      expect(nextItem?.title).toBe('바이올린');
      expect(nextItem?.startHour).toBe(16);

      // Tuesday item with the same 15:00~16:00 window is NOT active on Monday
      const tuesdaySameTimeItem = store
        .getItemsForWeekday(2)
        .find((it) => it.startHour === 15 && it.endHour === 16)!;
      expect(tuesdaySameTimeItem).toBeDefined();
      expect(store.isCurrentlyActive(tuesdaySameTimeItem)).toBe(false);

      // Late night (23:15): no active items and no upcoming items
      store.setCurrentDate(new Date(2026, 10, 9, 23, 15, 0));
      expect(store.getCurrentActiveItems()).toHaveLength(0);
      expect(store.getNextUpcomingItem()).toBeNull();
    });

    it('batch verifies all waiting items on a selected weekday with +1 Praise Heart each and resets completions for that weekday (Issue 03)', () => {
      const monday = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: monday });
      store.unlockParentMode();

      const wedCheckables = store
        .getItemsForWeekday(3)
        .filter((it) => store.isItemCheckable(it));
      expect(wedCheckables.length).toBeGreaterThanOrEqual(3);

      const [itemAlreadyVerified, itemWaiting1, itemWaiting2, itemIncomplete] = wedCheckables;

      // 1. itemAlreadyVerified: child completed + parent verified + 2 existing hearts
      store.toggleCompletion(itemAlreadyVerified);
      store.sendItemReaction({
        item: itemAlreadyVerified,
        addHearts: 2,
        sticker: 'star',
        comment: '미리 확인 완료',
        alsoVerify: true,
      });

      // 2. itemWaiting1 & itemWaiting2: child completed (waiting for parent verification)
      store.toggleCompletion(itemWaiting1);
      store.toggleCompletion(itemWaiting2);

      //Also complete 1 item on Monday (1) to ensure Wednesday reset does not affect Monday
      const monCheckable = store.getItemsForWeekday(1).find((it) => store.isItemCheckable(it))!;
      store.toggleCompletion(monCheckable);
      store.toggleParentVerification(monCheckable);

      const statsBefore = store.getCompletionStats(3);
      expect(statsBefore.completed).toBe(3);
      expect(statsBefore.verified).toBe(1);
      expect(statsBefore.waiting).toBe(2);
      expect(store.getAvailableHearts()).toBe(2);

      // Execute batch verification on Wednesday (3) with giveHeartToEach = true
      const verifiedCount = store.verifyAllWaitingItems(3, true);
      expect(verifiedCount).toBe(2);

      const statsAfterVerify = store.getCompletionStats(3);
      expect(statsAfterVerify.completed).toBe(3);
      expect(statsAfterVerify.verified).toBe(3);
      expect(statsAfterVerify.waiting).toBe(0);

      // Waiting items and their subtasks are now parent-verified and received +1 heart each
      for (const waitingItem of [itemWaiting1, itemWaiting2]) {
        expect(store.isParentVerified(waitingItem)).toBe(true);
        for (const sub of waitingItem.subTasks) {
          expect(store.isSubTaskCompleted(sub)).toBe(true);
          expect(store.isSubTaskParentVerified(sub)).toBe(true);
        }
        expect(store.getItemReaction(waitingItem)?.heartCount).toBe(1);
      }

      // Already-verified item did NOT receive an extra heart, and incomplete item stayed incomplete
      expect(store.getItemReaction(itemAlreadyVerified)?.heartCount).toBe(2);
      expect(store.isCompleted(itemIncomplete)).toBe(false);
      expect(store.isParentVerified(itemIncomplete)).toBe(false);
      expect(store.getAvailableHearts()).toBe(4);

      // Reset completions for Wednesday (3) including parent-verified items
      store.resetCompletionsForWeekday(3, true);

      const statsAfterReset = store.getCompletionStats(3);
      expect(statsAfterReset.completed).toBe(0);
      expect(statsAfterReset.verified).toBe(0);
      expect(statsAfterReset.waiting).toBe(0);

      for (const item of [itemAlreadyVerified, itemWaiting1, itemWaiting2]) {
        expect(store.isCompleted(item)).toBe(false);
        expect(store.isParentVerified(item)).toBe(false);
        for (const sub of item.subTasks) {
          expect(store.isSubTaskCompleted(sub)).toBe(false);
          expect(store.isSubTaskParentVerified(sub)).toBe(false);
        }
      }

      // Monday's completion and verification remain untouched
      expect(store.isCompleted(monCheckable)).toBe(true);
      expect(store.isParentVerified(monCheckable)).toBe(true);
    });

    it('returns both skipped Master Schedule items and Master Schedule items moved to another weekday from getExcludedMasterItemsForThisWeek with accurate reasonText (Issue 04)', () => {
      const monday = new Date(2026, 10, 9);
      const store = new ScheduleStore({ currentDate: monday });
      store.unlockParentMode();

      const monMasterItems = store
        .getMasterItems()
        .filter((it) => it.weekday === 1);
      const [itemSkipped, itemMoved, itemTimeModifiedOnly] = monMasterItems;

      // 1. Skip itemSkipped on Monday
      store.skipItemForThisWeek(itemSkipped);

      // 2. Move itemMoved from Monday (1) to Thursday (4) at 17:30 ~ 18:30
      store.updateItem(
        {
          ...itemMoved,
          weekday: 4,
          startHour: 17,
          startMinute: 30,
          endHour: 18,
          endMinute: 30,
        },
        'thisWeek'
      );

      // 3. Modify time of itemTimeModifiedOnly on the same weekday (Monday = 1) -> NOT excluded from Monday
      store.updateItem(
        {
          ...itemTimeModifiedOnly,
          startHour: 20,
          startMinute: 0,
          endHour: 21,
          endMinute: 0,
        },
        'thisWeek'
      );

      const excludedMon = store.getExcludedMasterItemsForThisWeek(1);
      expect(excludedMon).toHaveLength(2);

      const skippedEntry = excludedMon.find((e) => e.masterItem.id === itemSkipped.id);
      expect(skippedEntry).toBeDefined();
      expect(skippedEntry?.isSkipped).toBe(true);
      expect(skippedEntry?.movedToItem).toBeNull();
      expect(skippedEntry?.reasonText).toBe('이번 주 휴강·제외');

      const movedEntry = excludedMon.find((e) => e.masterItem.id === itemMoved.id);
      expect(movedEntry).toBeDefined();
      expect(movedEntry?.isSkipped).toBe(false);
      expect(movedEntry?.movedToItem?.weekday).toBe(4);
      expect(movedEntry?.reasonText).toBe('이번 주 목요일 오후 5:30(으)로 이동');

      // Reverting the moved item's override restores it to Monday and removes it from excluded list
      store.revertThisWeekOverride(itemMoved.id);
      const excludedAfterRevert = store.getExcludedMasterItemsForThisWeek(1);
      expect(excludedAfterRevert).toHaveLength(1);
      expect(excludedAfterRevert[0].masterItem.id).toBe(itemSkipped.id);
      expect(store.getItemsForWeekday(1).some((it) => it.id === itemMoved.id)).toBe(true);
      expect(store.getItemsForWeekday(4).some((it) => it.id === itemMoved.id)).toBe(false);
    });
  });
});
