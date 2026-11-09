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
});
