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
});
