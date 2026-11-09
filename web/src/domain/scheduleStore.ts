import {
  ScheduleItem,
  WeekdayNumber,
  WeekKey,
  SubTask,
  DeviceRole,
  CompletionStats,
  CATEGORIES,
} from '../types/schedule';
import { getWeekdayNumber, getWeekKey, compareScheduleItemsByTime } from './calendarUtils';
import { getMasterScheduleItems } from './defaultSchedule';

export const STORAGE_KEYS = {
  ITEMS: 'weekly_schedule_items',
  COMPLETED_ITEMS: 'weekly_schedule_completed_items_v1',
  COMPLETED_SUBTASKS: 'weekly_schedule_completed_subtasks_v1',
  PARENT_VERIFIED_ITEMS: 'weekly_schedule_parent_verified_items_v1',
  PARENT_VERIFIED_SUBTASKS: 'weekly_schedule_parent_verified_subtasks_v1',
  DEVICE_ROLE: 'weekly_schedule_device_role_v1',
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

  constructor(options: ScheduleStoreOptions = {}) {
    this.currentDate = options.currentDate || new Date();
    this.loadInitialItems();
    this.loadCompletions();
    this.loadDeviceRole();
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

  private loadCompletions(): void {
    this.completedItemKeys = this.loadKeySet(STORAGE_KEYS.COMPLETED_ITEMS);
    this.completedSubTaskKeys = this.loadKeySet(STORAGE_KEYS.COMPLETED_SUBTASKS);
    this.parentVerifiedItemKeys = this.loadKeySet(STORAGE_KEYS.PARENT_VERIFIED_ITEMS);
    this.parentVerifiedSubTaskKeys = this.loadKeySet(STORAGE_KEYS.PARENT_VERIFIED_SUBTASKS);
  }

  private saveCompletions(): void {
    this.saveKeySet(STORAGE_KEYS.COMPLETED_ITEMS, this.completedItemKeys);
    this.saveKeySet(STORAGE_KEYS.COMPLETED_SUBTASKS, this.completedSubTaskKeys);
    this.saveKeySet(STORAGE_KEYS.PARENT_VERIFIED_ITEMS, this.parentVerifiedItemKeys);
    this.saveKeySet(STORAGE_KEYS.PARENT_VERIFIED_SUBTASKS, this.parentVerifiedSubTaskKeys);
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

    if (this.isCompleted(item, weekKey)) {
      this.completedItemKeys.delete(key);
      this.parentVerifiedItemKeys.delete(key);
      for (const sub of item.subTasks) {
        const sKey = this.subTaskKey(sub.id, weekKey);
        this.completedSubTaskKeys.delete(sKey);
        this.parentVerifiedSubTaskKeys.delete(sKey);
      }
    } else {
      this.completedItemKeys.add(key);
      for (const sub of item.subTasks) {
        const sKey = this.subTaskKey(sub.id, weekKey);
        this.completedSubTaskKeys.add(sKey);
      }
    }

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

    if (this.isSubTaskCompleted(subTask, weekKey)) {
      this.completedSubTaskKeys.delete(sKey);
      this.parentVerifiedSubTaskKeys.delete(sKey);
    } else {
      this.completedSubTaskKeys.add(sKey);
    }

    if (parentItem.subTasks.length > 0) {
      const allDone = parentItem.subTasks.every((s) => this.isSubTaskCompleted(s, weekKey));
      if (allDone) {
        this.completedItemKeys.add(pKey);
      } else {
        this.completedItemKeys.delete(pKey);
        this.parentVerifiedItemKeys.delete(pKey);
      }
    }

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
    if (verified) {
      this.parentVerifiedItemKeys.add(key);
      this.completedItemKeys.add(key);
    } else {
      this.parentVerifiedItemKeys.delete(key);
    }
    this.saveCompletions();
  }

  public setParentVerifiedSubTask(subTaskId: string, verified: boolean, weekKey?: WeekKey): void {
    const key = this.subTaskKey(subTaskId, weekKey);
    if (verified) {
      this.parentVerifiedSubTaskKeys.add(key);
      this.completedSubTaskKeys.add(key);
    } else {
      this.parentVerifiedSubTaskKeys.delete(key);
    }
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
