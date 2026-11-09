import { ScheduleItem, WeekdayNumber } from '../types/schedule';
import { getWeekKey, getWeekdayNumber, formatTime, formatTimeRange, compareScheduleItemsByTime } from './calendarUtils';
import { getDefaultScheduleItems } from './defaultSchedule';

export { getWeekKey, getWeekdayNumber, formatTime, formatTimeRange, compareScheduleItemsByTime };

export const STORAGE_KEYS = {
  ITEMS: 'weekly_schedule_items',
  WEEKLY_OVERRIDES: 'weekly_schedule_weekly_overrides',
  COMPLETED_KEYS: 'weekly_schedule_completed_keys',
  PARENT_PIN: 'weekly_schedule_parent_pin',
  DEVICE_ROLE: 'weekly_schedule_device_role',
};

export interface ScheduleStoreOptions {
  currentDate?: Date;
}

export type StoreListener = () => void;

export class ScheduleStore {
  private items: ScheduleItem[] = [];
  private currentDate: Date;
  private listeners: Set<StoreListener> = new Set();

  constructor(options: ScheduleStoreOptions = {}) {
    this.currentDate = options.currentDate || new Date();
    this.loadInitialItems();
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
      // ignore storage parse errors and fall back to default
    }

    this.items = getDefaultScheduleItems();
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

  public getCurrentWeekKey(): string {
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
