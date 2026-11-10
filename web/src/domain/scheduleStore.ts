import {
  ScheduleItem,
  WeekdayNumber,
  WeekKey,
  SubTask,
  DeviceRole,
  CompletionStats,
  CATEGORIES,
  ScheduleEditScope,
  WEEKDAYS,
} from '../types/schedule';
import {
  CloudSyncSnapshot,
  SyncTimestampedFlag,
  WeeklyItemOverride,
  ReactionSticker,
  ItemParentReaction,
  ParentPraiseNote,
  HeartRewardRedemption,
  RewardPreset,
  StarTransaction,
  StarRedemptionRequest,
  StarRewardPreset,
  WeekdayStarState,
  StarCelebrationContext,
  DEFAULT_STAR_PRESETS,
  DEFAULT_REWARD_PRESETS,
} from '../types/snapshot';
import { getWeekdayNumber, getWeekKey, compareScheduleItemsByTime, formatTime } from './calendarUtils';
import { getMasterScheduleItems } from './defaultSchedule';
import { mergeSnapshots } from './snapshotMerge';
import { DEFAULT_FAMILY_CODE } from '../services/vercelBlobSync';

export const currentEpochSeconds = (): number => Date.now() / 1000;

export const SESSION_KEYS = {
  PARENT_MODE_UNLOCKED: 'weekly_schedule_parent_mode_unlocked_v1',
} as const;

export function generateEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

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
  PIN_FAILED_ATTEMPTS: 'weekly_schedule_pin_failed_attempts_v1',
  PIN_LOCKOUT_UNTIL: 'weekly_schedule_pin_lockout_until_v1',
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
  private selectedWeekday: WeekdayNumber;
  private lastObservedDateKey: string;
  private listeners: Set<StoreListener> = new Set();
  private toastListeners: Set<
    (message: string, status: 'idle' | 'syncing' | 'success' | 'error') => void
  > = new Set();

  private completedItemKeys: Set<string> = new Set();
  private completedSubTaskKeys: Set<string> = new Set();
  private parentVerifiedItemKeys: Set<string> = new Set();
  private parentVerifiedSubTaskKeys: Set<string> = new Set();
  private deviceRole: DeviceRole = 'child';

  // PIN security and Parent Mode session
  private failedPinAttempts: number = 0;
  private pinLockoutUntil: number | null = null;
  private isParentModeUnlocked: boolean = false;

  // CloudSyncSnapshot fields
  private familyCode: string = DEFAULT_FAMILY_CODE;
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
  private rewardPresets: RewardPreset[] = [...DEFAULT_REWARD_PRESETS];
  private deletedRewardPresetTimestamps: Record<string, number> = {};
  private starTransactions: StarTransaction[] = [];
  private starRedemptionRequests: StarRedemptionRequest[] = [];
  private starRewardPresets: StarRewardPreset[] = [];
  private deletedStarPresetTimestamps: Record<string, number> = {};
  private revokedStarTransactionIds: string[] = [];
  private revokedStarRedemptionIds: string[] = [];
  private revokedPraiseNoteIds: string[] = [];
  private celebrationContext: StarCelebrationContext | null = null;

  constructor(options: ScheduleStoreOptions = {}) {
    this.currentDate = options.currentDate || new Date();
    this.lastObservedDateKey = this.formatLocalDateKey(this.currentDate);
    this.selectedWeekday = getWeekdayNumber(this.currentDate);
    this.loadDeviceId();
    this.loadSyncConfig();
    this.loadInitialItems();
    this.loadCompletions();
    this.loadDeviceRole();
    this.loadPinSecurityState();
    this.loadSnapshotMeta();
  }

  private formatLocalDateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onToast(
    listener: (message: string, status: 'idle' | 'syncing' | 'success' | 'error') => void
  ): () => void {
    this.toastListeners.add(listener);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  public emitToast(
    message: string,
    status: 'idle' | 'syncing' | 'success' | 'error' = 'success'
  ): void {
    for (const listener of this.toastListeners) {
      listener(message, status);
    }
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
      // Older builds stored the Blob credential in the browser. The proxy holds it now.
      localStorage.removeItem(STORAGE_KEYS.BLOB_TOKEN);
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
    this.deviceRole = 'child';
    this.isParentModeUnlocked = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_ROLE);
      if (stored === 'parent' || stored === 'child') {
        this.deviceRole = stored;
      }
      const sessionUnlocked = sessionStorage.getItem(SESSION_KEYS.PARENT_MODE_UNLOCKED);
      if (sessionUnlocked === 'true' || this.deviceRole === 'parent') {
        this.isParentModeUnlocked = true;
      }
    } catch {
      // ignore
    }
  }

  private saveDeviceRole(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DEVICE_ROLE, this.deviceRole);
    } catch {
      // ignore
    }
  }

  public getDeviceRole(): DeviceRole {
    return this.deviceRole;
  }

  public setDeviceRole(role: DeviceRole): void {
    this.deviceRole = role;
    this.saveDeviceRole();
    if (role === 'parent') {
      this.isParentModeUnlocked = true;
      try {
        sessionStorage.setItem(SESSION_KEYS.PARENT_MODE_UNLOCKED, 'true');
      } catch {
        // ignore
      }
    } else {
      this.isParentModeUnlocked = false;
      try {
        sessionStorage.removeItem(SESSION_KEYS.PARENT_MODE_UNLOCKED);
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  private loadPinSecurityState(): void {
    try {
      const attemptsStr = localStorage.getItem(STORAGE_KEYS.PIN_FAILED_ATTEMPTS);
      if (attemptsStr) {
        this.failedPinAttempts = parseInt(attemptsStr, 10) || 0;
      }
      const lockoutStr = localStorage.getItem(STORAGE_KEYS.PIN_LOCKOUT_UNTIL);
      if (lockoutStr) {
        const lockoutUntil = parseFloat(lockoutStr);
        if (lockoutUntil && Date.now() < lockoutUntil) {
          this.pinLockoutUntil = lockoutUntil;
        } else {
          this.pinLockoutUntil = null;
          try {
            localStorage.removeItem(STORAGE_KEYS.PIN_LOCKOUT_UNTIL);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private savePinSecurityState(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PIN_FAILED_ATTEMPTS,
        this.failedPinAttempts.toString()
      );
      if (this.pinLockoutUntil !== null) {
        localStorage.setItem(
          STORAGE_KEYS.PIN_LOCKOUT_UNTIL,
          this.pinLockoutUntil.toString()
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.PIN_LOCKOUT_UNTIL);
      }
    } catch {
      // ignore
    }
  }

  public isPinLockedOut(): boolean {
    if (this.pinLockoutUntil === null) return false;
    if (Date.now() >= this.pinLockoutUntil) {
      this.pinLockoutUntil = null;
      try {
        localStorage.removeItem(STORAGE_KEYS.PIN_LOCKOUT_UNTIL);
      } catch {
        // ignore
      }
      return false;
    }
    return true;
  }

  public getRemainingLockoutSeconds(): number {
    if (!this.isPinLockedOut() || this.pinLockoutUntil === null) {
      return 0;
    }
    return Math.max(0, Math.ceil((this.pinLockoutUntil - Date.now()) / 1000));
  }

  public getFailedPinAttempts(): number {
    return this.failedPinAttempts;
  }

  public resetPinLockout(): void {
    this.failedPinAttempts = 0;
    this.pinLockoutUntil = null;
    this.savePinSecurityState();
    this.notify();
  }

  public verifyParentPin(inputPin: string): boolean {
    if (this.isPinLockedOut()) {
      return false;
    }

    const cleanInput = inputPin.replace(/\D/g, '');
    if (cleanInput.length === 6 && cleanInput === this.parentPinCode) {
      this.resetPinLockout();
      this.unlockParentMode();
      return true;
    } else {
      this.recordFailedPinAttempt();
      return false;
    }
  }

  private recordFailedPinAttempt(): void {
    this.failedPinAttempts += 1;
    if (this.failedPinAttempts >= 5 && this.failedPinAttempts % 5 === 0) {
      const lockSeconds = this.failedPinAttempts >= 10 ? 300 : 60;
      this.pinLockoutUntil = Date.now() + lockSeconds * 1000;
    }
    this.savePinSecurityState();
    this.notify();
  }

  public unlockParentMode(): void {
    this.isParentModeUnlocked = true;
    this.deviceRole = 'parent';
    try {
      sessionStorage.setItem(SESSION_KEYS.PARENT_MODE_UNLOCKED, 'true');
    } catch {
      // ignore
    }
    this.notify();
  }

  public lockParentMode(): void {
    this.isParentModeUnlocked = false;
    this.deviceRole = 'child';
    this.saveDeviceRole();
    try {
      sessionStorage.removeItem(SESSION_KEYS.PARENT_MODE_UNLOCKED);
    } catch {
      // ignore
    }
    this.notify();
  }

  public reloadFromStorage(): void {
    this.lastObservedDateKey = this.formatLocalDateKey(this.currentDate);
    this.selectedWeekday = getWeekdayNumber(this.currentDate);
    this.loadInitialItems();
    this.loadCompletions();
    this.loadDeviceRole();
    this.loadPinSecurityState();
    this.loadSnapshotMeta();
    this.notify();
  }

  public isParentMode(): boolean {
    return this.deviceRole === 'parent' || this.isParentModeUnlocked;
  }

  private loadSnapshotMeta(): void {
    this.deletedItemTimestamps = {};
    this.weeklyOverrides = {};
    this.itemReactions = {};
    this.praiseNotes = [];
    this.rewardRedemptions = [];
    this.archivedEarnedHearts = 0;
    this.rewardPresets = [...DEFAULT_REWARD_PRESETS];
    this.deletedRewardPresetTimestamps = {};
    this.starTransactions = [];
    this.starRedemptionRequests = [];
    this.starRewardPresets = [...DEFAULT_STAR_PRESETS];
    this.deletedStarPresetTimestamps = {};
    this.revokedStarTransactionIds = [];
    this.revokedStarRedemptionIds = [];
    this.revokedPraiseNoteIds = [];
    this.celebrationContext = null;

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
    if (!this.starRewardPresets || this.starRewardPresets.length === 0) {
      this.starRewardPresets = [...DEFAULT_STAR_PRESETS];
    }
    if (!this.rewardPresets || this.rewardPresets.length === 0) {
      if (Object.keys(this.deletedRewardPresetTimestamps).length === 0) {
        this.rewardPresets = [...DEFAULT_REWARD_PRESETS];
      } else {
        this.rewardPresets = [];
      }
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

  public canParentVerify(item: ScheduleItem, weekKey?: WeekKey): boolean {
    return (
      this.isItemCheckable(item) &&
      this.isCompleted(item, weekKey) &&
      !this.isParentVerified(item, weekKey)
    );
  }

  public canParentVerifySubTask(subTask: SubTask, weekKey?: WeekKey): boolean {
    return (
      this.isSubTaskCompleted(subTask, weekKey) &&
      !this.isSubTaskParentVerified(subTask, weekKey)
    );
  }

  public toggleParentVerification(item: ScheduleItem, weekKey?: WeekKey): boolean {
    if (!this.isItemCheckable(item)) return false;
    const key = this.itemKey(item.id, weekKey);
    const now = Date.now() / 1000;

    if (this.isParentVerified(item, weekKey)) {
      this.parentVerifiedFlags[key] = { isSet: false, updatedAt: now };
      for (const sub of item.subTasks) {
        const sKey = this.subTaskKey(sub.id, weekKey);
        this.parentVerifiedSubTaskFlags[sKey] = { isSet: false, updatedAt: now };
      }
      this.refreshFlagSetsFromDictionaries();
      this.saveCompletions();
      return true;
    }

    if (!this.canParentVerify(item, weekKey)) {
      return false;
    }

    this.completedItemKeys.add(key);
    this.completionFlags[key] = { isSet: true, updatedAt: now };
    this.parentVerifiedFlags[key] = { isSet: true, updatedAt: now };
    for (const sub of item.subTasks) {
      const sKey = this.subTaskKey(sub.id, weekKey);
      this.completedSubTaskKeys.add(sKey);
      this.subTaskCompletionFlags[sKey] = { isSet: true, updatedAt: now };
      this.parentVerifiedSubTaskFlags[sKey] = { isSet: true, updatedAt: now };
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
    return true;
  }

  public toggleSubTaskParentVerification(
    subTask: SubTask,
    parentItem: ScheduleItem,
    weekKey?: WeekKey
  ): boolean {
    if (!this.isItemCheckable(parentItem)) return false;
    const sKey = this.subTaskKey(subTask.id, weekKey);
    const pKey = this.itemKey(parentItem.id, weekKey);
    const now = Date.now() / 1000;

    if (this.isSubTaskParentVerified(subTask, weekKey)) {
      this.parentVerifiedSubTaskFlags[sKey] = { isSet: false, updatedAt: now };
      this.parentVerifiedFlags[pKey] = { isSet: false, updatedAt: now };
      this.refreshFlagSetsFromDictionaries();
      this.saveCompletions();
      return true;
    }

    if (!this.canParentVerifySubTask(subTask, weekKey)) {
      return false;
    }

    this.completedSubTaskKeys.add(sKey);
    this.subTaskCompletionFlags[sKey] = { isSet: true, updatedAt: now };
    this.parentVerifiedSubTaskFlags[sKey] = { isSet: true, updatedAt: now };

    if (parentItem.subTasks.length > 0) {
      const allVerified = parentItem.subTasks.every((s) => {
        const flag = this.parentVerifiedSubTaskFlags[this.subTaskKey(s.id, weekKey)];
        return flag ? flag.isSet : false;
      });
      if (allVerified) {
        this.completedItemKeys.add(pKey);
        this.completionFlags[pKey] = { isSet: true, updatedAt: now };
        this.parentVerifiedFlags[pKey] = { isSet: true, updatedAt: now };
      }
    }

    this.refreshFlagSetsFromDictionaries();
    this.saveCompletions();
    return true;
  }

  public sendItemReaction(options: {
    item: ScheduleItem;
    addHearts: number;
    sticker: ReactionSticker;
    comment?: string;
    alsoVerify?: boolean;
    weekKey?: WeekKey;
  }): void {
    const key = this.itemKey(options.item.id, options.weekKey);
    const now = Date.now() / 1000;
    const cleanComment = (options.comment || '').trim();

    const current: ItemParentReaction = this.itemReactions[key]
      ? { ...this.itemReactions[key] }
      : {
          itemKey: key,
          heartCount: 0,
          sticker: options.sticker,
          comment: '',
          comments: [],
          updatedAt: now,
        };

    current.heartCount = Math.max(
      0,
      (current.heartCount || 0) + Math.max(0, options.addHearts)
    );
    current.sticker = options.sticker;
    if (cleanComment.length > 0) {
      current.comment = cleanComment;
      const existingComments = current.comments ? [...current.comments] : [];
      existingComments.push({
        id: generateEntityId('cmt'),
        text: cleanComment,
        createdAt: now,
      });
      current.comments = existingComments;
    }
    current.updatedAt = now;
    this.itemReactions[key] = current;

    if (options.alsoVerify && !this.isParentVerified(options.item, options.weekKey)) {
      this.toggleParentVerification(options.item, options.weekKey);
    }

    this.saveSnapshotMeta();
    this.notify();
  }

  public getItemReaction(
    item: ScheduleItem,
    weekKey?: WeekKey
  ): ItemParentReaction | undefined {
    const key = this.itemKey(item.id, weekKey);
    return this.itemReactions[key];
  }

  public sendFamilyPraise(options: {
    hearts: number;
    sticker: ReactionSticker;
    message: string;
  }): void {
    const now = Date.now() / 1000;
    const cleanMsg = options.message.trim();
    const note: ParentPraiseNote = {
      id: generateEntityId('praise'),
      hearts: Math.max(0, options.hearts),
      sticker: options.sticker,
      message: cleanMsg.length > 0 ? cleanMsg : '엄마 아빠가 항상 응원해 ❤️',
      createdAt: now,
    };

    this.praiseNotes.unshift(note);
    if (this.praiseNotes.length > 40) {
      const overflow = this.praiseNotes.slice(40);
      this.archivedEarnedHearts += overflow.reduce((sum, n) => sum + n.hearts, 0);
      this.praiseNotes = this.praiseNotes.slice(0, 40);
    }
    this.saveSnapshotMeta();
    this.notify();
  }

  public getPraiseNotes(): ParentPraiseNote[] {
    return [...this.praiseNotes];
  }

  public getLatestPraiseNote(): ParentPraiseNote | undefined {
    if (this.praiseNotes.length === 0) return undefined;
    return [...this.praiseNotes].sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  public getTotalEarnedHearts(): number {
    const itemHeartSum = Object.values(this.itemReactions).reduce(
      (acc, r) => acc + (r.heartCount || 0),
      0
    );
    const noteHeartSum = this.praiseNotes.reduce((acc, n) => acc + (n.hearts || 0), 0);
    return itemHeartSum + noteHeartSum + this.archivedEarnedHearts;
  }

  public getTotalSpentHearts(): number {
    return this.rewardRedemptions.reduce((acc, r) => acc + (r.hearts || 0), 0);
  }

  public getAvailableHearts(): number {
    return Math.max(0, this.getTotalEarnedHearts() - this.getTotalSpentHearts());
  }

  public getRewardPresets(): RewardPreset[] {
    return (this.rewardPresets || []).filter((p) => {
      const delTs = this.deletedRewardPresetTimestamps[p.id] || 0;
      return delTs < p.updatedAt;
    });
  }

  public addRewardPreset(
    preset: Omit<RewardPreset, 'id' | 'updatedAt'>
  ): RewardPreset {
    const ts = currentEpochSeconds();
    const newPreset: RewardPreset = {
      ...preset,
      id: generateEntityId('preset'),
      updatedAt: ts,
    };
    delete this.deletedRewardPresetTimestamps[newPreset.id];
    this.rewardPresets.push(newPreset);
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast(`🎁 [${newPreset.title}] 추천 보상이 추가되었어요.`, 'success');
    return newPreset;
  }

  public updateRewardPreset(
    id: string,
    updates: Partial<Omit<RewardPreset, 'id' | 'updatedAt'>>
  ): boolean {
    const index = this.rewardPresets.findIndex((p) => p.id === id);
    if (index === -1) return false;
    const ts = currentEpochSeconds();
    this.rewardPresets[index] = {
      ...this.rewardPresets[index],
      ...updates,
      updatedAt: ts,
    };
    delete this.deletedRewardPresetTimestamps[id];
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast(
      `✏️ [${this.rewardPresets[index].title}] 추천 보상이 수정되었어요.`,
      'success'
    );
    return true;
  }

  public deleteRewardPreset(id: string): boolean {
    const target = this.rewardPresets.find((p) => p.id === id);
    if (!target) return false;
    const ts = currentEpochSeconds();
    this.deletedRewardPresetTimestamps[id] = ts;
    this.rewardPresets = this.rewardPresets.filter((p) => p.id !== id);
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast(`🗑️ [${target.title}] 추천 보상이 삭제되었어요.`, 'success');
    return true;
  }

  public resetRewardPresetsToDefault(): void {
    const ts = currentEpochSeconds();
    this.rewardPresets = DEFAULT_REWARD_PRESETS.map((preset) => ({
      ...preset,
      updatedAt: ts,
    }));
    this.deletedRewardPresetTimestamps = {};
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast('🔄 추천 보상이 초기 기본값으로 복원되었어요.', 'success');
  }

  public getRewardRedemptions(): HeartRewardRedemption[] {
    return [...this.rewardRedemptions];
  }

  public redeemReward(title: string, hearts: number): boolean {
    if (hearts <= 0 || this.getAvailableHearts() < hearts) {
      return false;
    }
    const cleanTitle = title.trim();
    const finalTitle = cleanTitle.length > 0 ? cleanTitle : '보상 교환';
    const ts = currentEpochSeconds();
    const redemption: HeartRewardRedemption = {
      id: generateEntityId('redemption'),
      title: finalTitle,
      hearts,
      createdAt: ts,
      redeemedByRole: this.deviceRole === 'parent' ? '부모' : '아이',
    };
    this.rewardRedemptions.unshift(redemption);
    if (this.rewardRedemptions.length > 50) {
      this.rewardRedemptions = this.rewardRedemptions.slice(0, 50);
    }
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast(
      `🎁 [${finalTitle}] 교환 완료! 하트 ${hearts}개가 차감되었어요.`,
      'success'
    );
    return true;
  }

  public refundRewardRedemption(id: string): boolean {
    if (!this.isParentMode()) {
      return false;
    }
    const index = this.rewardRedemptions.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }
    const [removed] = this.rewardRedemptions.splice(index, 1);
    this.saveSnapshotMeta();
    this.notify();
    this.emitToast(
      `↩️ [${removed.title}] 교환이 취소되어 하트 ${removed.hearts}개가 복구되었어요.`,
      'success'
    );
    return true;
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
    return this.getEffectiveItems();
  }

  public getMasterItems(): ScheduleItem[] {
    return this.items.filter((item) => !item.targetWeekKey);
  }

  public getExcludedMasterItemsForThisWeek(
    weekday: WeekdayNumber,
    weekKey?: WeekKey
  ): ScheduleItem[] {
    const wk = weekKey || this.getCurrentWeekKey();
    const result: ScheduleItem[] = [];
    for (const base of this.getMasterItems()) {
      if (base.weekday !== weekday) continue;
      const override = this.activeOverride(base.id, wk);
      if (override && override.isSkipped) {
        result.push(base);
      }
    }
    return result;
  }

  public getEffectiveItems(weekKey?: WeekKey): ScheduleItem[] {
    const wk = weekKey || this.getCurrentWeekKey();
    const result: ScheduleItem[] = [];

    for (const base of this.getMasterItems()) {
      const override = this.activeOverride(base.id, wk);
      if (override) {
        if (override.isSkipped) {
          continue;
        }
        if (override.overriddenItem) {
          result.push({
            ...override.overriddenItem,
            id: base.id,
            targetWeekKey: null,
          });
          continue;
        }
      }
      result.push(base);
    }

    // Add this-week-only additions
    const thisWeekAdditions = this.items.filter((item) => item.targetWeekKey === wk);
    result.push(...thisWeekAdditions);

    return result.sort(compareScheduleItemsByTime);
  }

  public activeOverride(baseItemId: string, weekKey?: WeekKey): WeeklyItemOverride | undefined {
    const wk = weekKey || this.getCurrentWeekKey();
    const key = `${wk}_${baseItemId}`;
    const override = this.weeklyOverrides[key];
    if (override && override.isActive) {
      return override;
    }
    return undefined;
  }

  public isAdjustedThisWeek(item: ScheduleItem, weekKey?: WeekKey): boolean {
    const wk = weekKey || this.getCurrentWeekKey();
    if (item.targetWeekKey === wk) {
      return true;
    }
    return this.activeOverride(item.id, wk) !== undefined;
  }

  public hasThisWeekOverride(itemId: string, weekKey?: WeekKey): boolean {
    return this.activeOverride(itemId, weekKey) !== undefined;
  }

  public isSkippedThisWeek(itemId: string, weekKey?: WeekKey): boolean {
    return this.activeOverride(itemId, weekKey)?.isSkipped === true;
  }

  public adjustmentBadgeText(item: ScheduleItem, weekKey?: WeekKey): string | null {
    const wk = weekKey || this.getCurrentWeekKey();
    if (item.targetWeekKey === wk) {
      return '이번 주 추가 일정';
    }
    const override = this.activeOverride(item.id, wk);
    if (!override) return null;
    if (override.isSkipped) {
      return '이번 주 휴강·제외';
    }
    const base = this.items.find((it) => it.id === item.id && !it.targetWeekKey);
    if (base) {
      const current = override.overriddenItem ?? item;
      const dayChanged = base.weekday !== current.weekday;
      const timeChanged =
        base.startHour !== current.startHour ||
        base.startMinute !== current.startMinute ||
        base.endHour !== current.endHour ||
        base.endMinute !== current.endMinute;
      const baseStartTime = formatTime(base.startHour, base.startMinute);
      const baseDayInfo = WEEKDAYS.find((w) => w.number === base.weekday);

      if (dayChanged && timeChanged) {
        return `이번 주 요일·시간 조정 (원래 ${baseDayInfo?.shortName || ''} ${baseStartTime})`;
      } else if (dayChanged) {
        return `이번 주 요일 이동 (원래 ${baseDayInfo?.fullName || ''} ${baseStartTime})`;
      } else if (timeChanged) {
        return `이번 주 시간 조정 (원래 ${baseStartTime})`;
      } else {
        return '이번 주 내용 조정됨';
      }
    }
    return '이번 주 조정됨';
  }

  public getCurrentWeekAdjustmentCount(weekKey?: WeekKey): number {
    const wk = weekKey || this.getCurrentWeekKey();
    const activeOverrideCount = Object.values(this.weeklyOverrides).filter((ov) => {
      if (ov.weekKey !== wk || !ov.isActive) return false;
      const base = this.items.find((it) => it.id === ov.baseItemId && !it.targetWeekKey);
      return Boolean(base && (ov.isSkipped || ov.overriddenItem));
    }).length;
    const addedThisWeekCount = this.items.filter((it) => it.targetWeekKey === wk).length;
    return activeOverrideCount + addedThisWeekCount;
  }

  public getAdjustmentCountForWeekday(weekday: WeekdayNumber, weekKey?: WeekKey): number {
    const wk = weekKey || this.getCurrentWeekKey();
    const adjustedOnDay = this.getItemsForWeekday(weekday, wk).filter((item) =>
      this.isAdjustedThisWeek(item, wk)
    ).length;

    let excludedFromDay = 0;
    for (const base of this.getMasterItems()) {
      if (base.weekday !== weekday) continue;
      const override = this.activeOverride(base.id, wk);
      if (!override) continue;
      if (override.isSkipped) {
        excludedFromDay++;
      } else if (override.overriddenItem && override.overriddenItem.weekday !== weekday) {
        excludedFromDay++;
      }
    }

    return adjustedOnDay + excludedFromDay;
  }

  public hasSameScheduleContent(a: ScheduleItem, b: ScheduleItem): boolean {
    const aSub = (a.subTasks || []).map((s) => s.title).join('|');
    const bSub = (b.subTasks || []).map((s) => s.title).join('|');
    const aLeads = (a.notificationLeadMinutes || []).slice().sort().join(',');
    const bLeads = (b.notificationLeadMinutes || []).slice().sort().join(',');

    return (
      a.weekday === b.weekday &&
      a.startHour === b.startHour &&
      a.startMinute === b.startMinute &&
      a.endHour === b.endHour &&
      a.endMinute === b.endMinute &&
      a.title === b.title &&
      a.note === b.note &&
      a.category === b.category &&
      a.iconName === b.iconName &&
      aSub === bSub &&
      Boolean(a.isNotificationEnabled) === Boolean(b.isNotificationEnabled) &&
      aLeads === bLeads
    );
  }

  public addItem(
    item: ScheduleItem,
    targetWeekdays: WeekdayNumber[] = [],
    scope: ScheduleEditScope = 'master'
  ): boolean {
    if (scope === 'master' && !this.isParentMode()) {
      return false;
    }
    const days = targetWeekdays.length > 0 ? targetWeekdays : [item.weekday];
    const now = Date.now() / 1000;
    const wk = scope === 'thisWeek' ? this.getCurrentWeekKey() : null;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const copyId =
        i === 0 && days.length === 1
          ? item.id || generateEntityId('item')
          : generateEntityId('item');

      const copy: ScheduleItem = {
        ...item,
        id: copyId,
        weekday: day,
        targetWeekKey: wk,
        updatedAt: now,
      };
      this.items.push(copy);
    }

    this.saveItems();
    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public updateItem(updated: ScheduleItem, scope: ScheduleEditScope = 'master'): boolean {
    if (scope === 'master' && !this.isParentMode()) {
      return false;
    }
    const now = Date.now() / 1000;
    const wk = this.getCurrentWeekKey();

    if (scope === 'thisWeek') {
      const base = this.items.find((it) => it.id === updated.id && !it.targetWeekKey);
      if (base) {
        const key = `${wk}_${base.id}`;
        const adjustedCopy: ScheduleItem = {
          ...updated,
          id: base.id,
          targetWeekKey: null,
          updatedAt: now,
        };
        if (this.hasSameScheduleContent(adjustedCopy, base)) {
          this.weeklyOverrides[key] = {
            id: key,
            weekKey: wk,
            baseItemId: base.id,
            isActive: false,
            isSkipped: false,
            overriddenItem: undefined,
            updatedAt: now,
          };
        } else {
          this.weeklyOverrides[key] = {
            id: key,
            weekKey: wk,
            baseItemId: base.id,
            isActive: true,
            isSkipped: false,
            overriddenItem: adjustedCopy,
            updatedAt: now,
          };
        }
      } else {
        const idx = this.items.findIndex((it) => it.id === updated.id);
        if (idx !== -1) {
          this.items[idx] = {
            ...updated,
            targetWeekKey: wk,
            updatedAt: now,
          };
        }
      }
    } else {
      const idx = this.items.findIndex((it) => it.id === updated.id);
      if (idx !== -1) {
        this.items[idx] = {
          ...updated,
          targetWeekKey: null,
          updatedAt: now,
        };
        const key = `${wk}_${updated.id}`;
        if (this.weeklyOverrides[key]?.isActive) {
          this.weeklyOverrides[key] = {
            id: key,
            weekKey: wk,
            baseItemId: updated.id,
            isActive: false,
            isSkipped: false,
            overriddenItem: undefined,
            updatedAt: now,
          };
        }
      }
    }

    this.saveItems();
    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public skipItemForThisWeek(item: ScheduleItem): boolean {
    if (this.isParentVerified(item) && !this.isParentMode()) {
      return false;
    }
    const wk = this.getCurrentWeekKey();
    if (item.targetWeekKey === wk) {
      return this.deleteItem(item);
    }
    const now = Date.now() / 1000;
    const key = `${wk}_${item.id}`;
    this.weeklyOverrides[key] = {
      id: key,
      weekKey: wk,
      baseItemId: item.id,
      isActive: true,
      isSkipped: true,
      overriddenItem: undefined,
      updatedAt: now,
    };
    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public revertThisWeekOverride(itemId: string): void {
    const wk = this.getCurrentWeekKey();
    const key = `${wk}_${itemId}`;
    const now = Date.now() / 1000;
    this.weeklyOverrides[key] = {
      id: key,
      weekKey: wk,
      baseItemId: itemId,
      isActive: false,
      isSkipped: false,
      overriddenItem: undefined,
      updatedAt: now,
    };
    this.saveSnapshotMeta();
    this.notify();
  }

  public resetThisWeekAdjustments(weekday?: WeekdayNumber): void {
    const wk = this.getCurrentWeekKey();
    const now = Date.now() / 1000;

    for (const [key, ov] of Object.entries(this.weeklyOverrides)) {
      if (ov.weekKey === wk && ov.isActive) {
        const baseDay = this.items.find((it) => it.id === ov.baseItemId)?.weekday;
        const modDay = ov.overriddenItem?.weekday;
        if (!weekday || baseDay === weekday || modDay === weekday) {
          this.weeklyOverrides[key] = {
            ...ov,
            isActive: false,
            isSkipped: false,
            overriddenItem: undefined,
            updatedAt: now,
          };
        }
      }
    }

    const toRemove = this.items.filter(
      (it) =>
        it.targetWeekKey === wk &&
        (!weekday || it.weekday === weekday) &&
        (!this.isParentVerified(it) || this.isParentMode())
    );
    for (const rem of toRemove) {
      this.deletedItemTimestamps[rem.id] = now;
    }
    const removeIds = new Set(toRemove.map((it) => it.id));
    this.items = this.items.filter((it) => !removeIds.has(it.id));

    this.saveItems();
    this.saveSnapshotMeta();
    this.notify();
  }

  public deleteItem(item: ScheduleItem): boolean {
    // Master items require parent mode; parent-verified items always require parent mode
    if ((!item.targetWeekKey || this.isParentVerified(item)) && !this.isParentMode()) {
      return false;
    }
    const now = Date.now() / 1000;
    const wk = this.getCurrentWeekKey();

    this.deletedItemTimestamps[item.id] = now;
    this.items = this.items.filter((it) => it.id !== item.id);

    const key = `${wk}_${item.id}`;
    if (this.weeklyOverrides[key]) {
      this.weeklyOverrides[key] = {
        id: key,
        weekKey: wk,
        baseItemId: item.id,
        isActive: false,
        isSkipped: false,
        overriddenItem: undefined,
        updatedAt: now,
      };
    }

    this.saveItems();
    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  // MARK: - ⭐ Star Ledger, Quests, & Star Reward Shop (Issue 06)

  public getStarRewardPresets(): StarRewardPreset[] {
    return this.starRewardPresets.filter((p) => {
      const delTs = this.deletedStarPresetTimestamps[p.id] || 0;
      return delTs < p.updatedAt;
    });
  }

  public getStarTransactions(): StarTransaction[] {
    const revokedSet = new Set(this.revokedStarTransactionIds);
    return this.starTransactions.filter((tx) => !revokedSet.has(tx.id));
  }

  public getStarRedemptionRequests(): StarRedemptionRequest[] {
    const revokedSet = new Set(this.revokedStarRedemptionIds);
    return this.starRedemptionRequests.filter((r) => !revokedSet.has(r.id));
  }

  public getTotalEarnedStars(): number {
    return this.getStarTransactions()
      .filter((tx) => tx.delta > 0)
      .reduce((sum, tx) => sum + tx.delta, 0);
  }

  public getTotalSpentStars(): number {
    return this.getStarTransactions()
      .filter((tx) => tx.delta < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.delta), 0);
  }

  public getAvailableStars(): number {
    return Math.max(
      0,
      this.getStarTransactions().reduce((sum, tx) => sum + tx.delta, 0)
    );
  }

  public getReservedPendingStars(): number {
    return this.getStarRedemptionRequests()
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.starCost, 0);
  }

  public getRequestableStars(): number {
    return Math.max(0, this.getAvailableStars() - this.getReservedPendingStars());
  }

  public getThisWeekEarnedStars(weekKey?: WeekKey): number {
    const wk = weekKey || this.getCurrentWeekKey();
    return this.getStarTransactions()
      .filter((tx) => tx.weekKey === wk && tx.delta > 0)
      .reduce((sum, tx) => sum + tx.delta, 0);
  }

  public getPendingStarRedemptionCount(): number {
    return this.getStarRedemptionRequests().filter((r) => r.status === 'pending').length;
  }

  public getWeekdayStarState(weekday: WeekdayNumber, weekKey?: WeekKey): WeekdayStarState {
    if (weekday === 6 || weekday === 7) {
      return { kind: 'weekendExcluded' };
    }

    const wk = weekKey || this.getCurrentWeekKey();
    const earnTxId = `star_earn_${wk}_${weekday}`;

    const existingTx = this.getStarTransactions().find(
      (tx) =>
        tx.id === earnTxId ||
        (tx.kind === 'dailyAllClear' && tx.weekKey === wk && tx.weekdayRawValue === weekday)
    );
    if (existingTx) {
      return { kind: 'awarded', transaction: existingTx };
    }

    const checkableItems = this.getItemsForWeekday(weekday, wk).filter((it) =>
      this.isItemCheckable(it)
    );
    if (checkableItems.length === 0) {
      return { kind: 'ineligibleEmpty' };
    }

    let completedCount = 0;
    let verifiedCount = 0;

    for (const item of checkableItems) {
      const itemDone =
        this.isCompleted(item, wk) &&
        item.subTasks.every((sub) => this.isSubTaskCompleted(sub, wk));
      const itemVerified =
        this.isParentVerified(item, wk) &&
        item.subTasks.every((sub) => this.isSubTaskParentVerified(sub, wk));

      if (itemDone) completedCount++;
      if (itemVerified) verifiedCount++;
    }

    const total = checkableItems.length;
    if (completedCount === total && verifiedCount === total) {
      return { kind: 'claimable', total };
    }
    return { kind: 'inProgress', completed: completedCount, verified: verifiedCount, total };
  }

  public isDailyStarAwarded(weekday: WeekdayNumber, weekKey?: WeekKey): boolean {
    return this.getWeekdayStarState(weekday, weekKey).kind === 'awarded';
  }

  public isWeeklyBonusAwarded(weekKey?: WeekKey): boolean {
    const wk = weekKey || this.getCurrentWeekKey();
    const bonusId = `star_bonus_weekly_${wk}`;
    return this.getStarTransactions().some(
      (tx) => tx.id === bonusId || (tx.kind === 'weeklyAllClearBonus' && tx.weekKey === wk)
    );
  }

  public getAwardedDailyStarCount(weekKey?: WeekKey): number {
    const wk = weekKey || this.getCurrentWeekKey();
    return ([1, 2, 3, 4, 5] as const).filter((d) => this.isDailyStarAwarded(d, wk)).length;
  }

  public awardDailyStar(weekday: WeekdayNumber, weekKey?: WeekKey): boolean {
    if (weekday === 6 || weekday === 7) return false;
    const wk = weekKey || this.getCurrentWeekKey();

    const state = this.getWeekdayStarState(weekday, wk);
    if (state.kind !== 'claimable') return false;

    const earnId = `star_earn_${wk}_${weekday}`;
    if (
      this.starTransactions.some(
        (tx) =>
          tx.id === earnId ||
          (tx.kind === 'dailyAllClear' && tx.weekKey === wk && tx.weekdayRawValue === weekday)
      )
    ) {
      return false;
    }

    const ts = currentEpochSeconds();
    const weekdayInfo = WEEKDAYS.find((w) => w.number === weekday);

    const dailyTx: StarTransaction = {
      id: earnId,
      kind: 'dailyAllClear',
      delta: 1,
      weekKey: wk,
      weekdayRawValue: weekday,
      title: `${weekdayInfo?.fullName || '평일'} 퀘스트 올클리어!`,
      note: `할 일 ${state.total}개 완료 & 부모님 확인 완료`,
      createdAt: ts,
      createdByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님' : '👦 아이',
    };

    this.starTransactions.unshift(dailyTx);

    const bonusGranted = this.evaluateAndGrantWeeklyAllClearBonusIfNeeded(wk, ts + 0.001);

    this.celebrationContext = {
      weekday,
      earnedDailyStar: 1,
      earnedWeeklyBonus: bonusGranted ? 2 : 0,
      totalAvailableStars: this.getAvailableStars(),
    };

    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public evaluateAndGrantWeeklyAllClearBonusIfNeeded(
    weekKey: string,
    timestamp: number = currentEpochSeconds()
  ): boolean {
    const bonusId = `star_bonus_weekly_${weekKey}`;
    if (this.revokedStarTransactionIds.includes(bonusId)) return false;
    if (
      this.starTransactions.some(
        (tx) => tx.id === bonusId || (tx.kind === 'weeklyAllClearBonus' && tx.weekKey === weekKey)
      )
    ) {
      return false;
    }

    const allFiveDaysEarned = ([1, 2, 3, 4, 5] as const).every((d) =>
      this.isDailyStarAwarded(d, weekKey)
    );

    if (!allFiveDaysEarned) return false;

    const bonusTx: StarTransaction = {
      id: bonusId,
      kind: 'weeklyAllClearBonus',
      delta: 2,
      weekKey,
      title: '👑 주간 평일 올클리어 보너스!',
      note: '월~금 5일 연속 스타 달성 자동 보너스 (+2⭐)',
      createdAt: timestamp,
      createdByRole: '👑 자동 보너스',
    };

    this.starTransactions.unshift(bonusTx);
    this.starTransactions.sort((a, b) => b.createdAt - a.createdAt);
    return true;
  }

  private createStarRedemptionRequest(preset: StarRewardPreset): StarRedemptionRequest {
    const ts = currentEpochSeconds();
    const reqId = generateEntityId('star_req');
    return {
      id: reqId,
      presetId: preset.id,
      emoji: preset.emoji,
      rewardTitle: preset.title,
      starCost: preset.starCost,
      actionType: preset.actionType,
      grantedHearts: preset.grantedHearts,
      status: 'pending',
      requestedAt: ts,
      requestedByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님' : '👦 아이',
      updatedAt: ts,
    };
  }

  public requestStarRedemption(preset: StarRewardPreset): boolean {
    if (preset.starCost <= 0 || this.getRequestableStars() < preset.starCost) {
      return false;
    }

    const req = this.createStarRedemptionRequest(preset);
    this.starRedemptionRequests.unshift(req);
    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public approveStarRedemption(request: StarRedemptionRequest): boolean {
    const idx = this.starRedemptionRequests.findIndex((r) => r.id === request.id);
    if (idx === -1 || this.starRedemptionRequests[idx].status !== 'pending') {
      return false;
    }
    if (this.getAvailableStars() < request.starCost) {
      return false;
    }

    const ts = currentEpochSeconds();
    const spendTxId = `star_spend_${request.id}`;

    this.starRedemptionRequests[idx] = {
      ...this.starRedemptionRequests[idx],
      status: 'approved',
      resolvedAt: ts,
      resolvedByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님' : '👦 아이',
      updatedAt: ts,
    };

    if (!this.starTransactions.some((tx) => tx.id === spendTxId)) {
      const spendTx: StarTransaction = {
        id: spendTxId,
        kind: 'rewardRedemption',
        delta: -request.starCost,
        weekKey: this.getCurrentWeekKey(),
        title: `${request.emoji} ${request.rewardTitle} 교환`,
        note:
          request.actionType === 'convertToHearts'
            ? `스타 ${request.starCost}개 → 하트 +${request.grantedHearts}개 즉시 충전`
            : `스타 ${request.starCost}개 보상 교환 승인 완료`,
        createdAt: ts,
        createdByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님' : '👦 아이',
        linkedRedemptionId: request.id,
        linkedHeartGrantCount:
          request.actionType === 'convertToHearts' ? request.grantedHearts : undefined,
      };
      this.starTransactions.unshift(spendTx);
    }

    if (request.actionType === 'convertToHearts' && request.grantedHearts > 0) {
      if (!this.praiseNotes.some((n) => n.id === request.id)) {
        const heartGrantNote: ParentPraiseNote = {
          id: request.id,
          hearts: request.grantedHearts,
          sticker: 'star',
          message: `⭐ 스타 ${request.starCost}개로 ❤️ 하트 ${request.grantedHearts}개 보너스 충전!`,
          createdAt: ts,
        };
        this.praiseNotes.unshift(heartGrantNote);
        if (this.praiseNotes.length > 40) {
          const overflow = this.praiseNotes.slice(40);
          this.archivedEarnedHearts += overflow.reduce((sum, n) => sum + n.hearts, 0);
          this.praiseNotes = this.praiseNotes.slice(0, 40);
        }
      }
    }

    this.celebrationContext = {
      earnedDailyStar: 0,
      earnedWeeklyBonus: 0,
      totalAvailableStars: this.getAvailableStars(),
      approvedRewardTitle: request.rewardTitle,
      approvedRewardEmoji: request.emoji,
    };

    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public redeemStarRewardImmediately(preset: StarRewardPreset): boolean {
    if (preset.starCost <= 0 || this.getAvailableStars() < preset.starCost) {
      return false;
    }

    const req = this.createStarRedemptionRequest(preset);
    this.starRedemptionRequests.unshift(req);
    return this.approveStarRedemption(req);
  }

  public rejectStarRedemption(request: StarRedemptionRequest): boolean {
    const idx = this.starRedemptionRequests.findIndex((r) => r.id === request.id);
    if (idx === -1 || this.starRedemptionRequests[idx].status !== 'pending') {
      return false;
    }

    const ts = currentEpochSeconds();
    this.starRedemptionRequests[idx] = {
      ...this.starRedemptionRequests[idx],
      status: 'rejected',
      resolvedAt: ts,
      resolvedByRole: this.deviceRole === 'parent' ? '👩‍👨 부모님' : '👦 아이',
      updatedAt: ts,
    };

    this.saveSnapshotMeta();
    this.notify();
    return true;
  }

  public addStarRewardPreset(
    preset: Omit<StarRewardPreset, 'id' | 'updatedAt'>
  ): StarRewardPreset {
    const newPreset: StarRewardPreset = {
      ...preset,
      id: generateEntityId('preset'),
      updatedAt: currentEpochSeconds(),
    };
    this.starRewardPresets.push(newPreset);
    this.saveSnapshotMeta();
    this.notify();
    return newPreset;
  }

  public deleteStarRewardPreset(id: string): void {
    const ts = currentEpochSeconds();
    this.deletedStarPresetTimestamps[id] = ts;
    this.starRewardPresets = this.starRewardPresets.filter((p) => p.id !== id);
    this.saveSnapshotMeta();
    this.notify();
  }

  public resetStarRewardPresetsToDefault(): void {
    this.starRewardPresets = [...DEFAULT_STAR_PRESETS];
    this.deletedStarPresetTimestamps = {};
    this.saveSnapshotMeta();
    this.notify();
  }

  public revokeStarTransaction(tx: StarTransaction | string): void {
    const id = typeof tx === 'string' ? tx : tx.id;
    if (!this.revokedStarTransactionIds.includes(id)) {
      this.revokedStarTransactionIds.push(id);
    }
    this.starTransactions = this.starTransactions.filter((t) => t.id !== id);
    this.saveSnapshotMeta();
    this.notify();
  }

  public getCelebrationContext(): StarCelebrationContext | null {
    return this.celebrationContext;
  }

  public clearCelebrationContext(): void {
    this.celebrationContext = null;
    this.notify();
  }

  public getCurrentDate(): Date {
    return this.currentDate;
  }

  public setCurrentDate(date: Date): void {
    this.applyDateUpdate(date, true);
  }

  public refreshDateAndDayChange(now: Date = new Date()): boolean {
    return this.applyDateUpdate(now, false);
  }

  private applyDateUpdate(now: Date, forceNotify: boolean): boolean {
    const nextDateKey = this.formatLocalDateKey(now);
    const dayChanged = nextDateKey !== this.lastObservedDateKey;
    const prevMinutes = this.minutesOfDay(this.currentDate);
    const nextMinutes = this.minutesOfDay(now);
    this.currentDate = now;
    if (dayChanged) {
      this.lastObservedDateKey = nextDateKey;
      this.selectedWeekday = getWeekdayNumber(now);
      this.notify();
      return true;
    }
    if (forceNotify || prevMinutes !== nextMinutes) {
      this.notify();
    }
    return false;
  }

  private minutesOfDay(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  private itemStartMinutes(item: ScheduleItem): number {
    return item.startHour * 60 + item.startMinute;
  }

  private itemEndMinutes(item: ScheduleItem): number {
    return item.endHour * 60 + item.endMinute;
  }

  public getCurrentMinutesOfDay(): number {
    return this.minutesOfDay(this.currentDate);
  }

  public isCurrentlyActive(item: ScheduleItem, weekKey?: WeekKey): boolean {
    if (item.weekday !== this.getTodayWeekday()) {
      return false;
    }
    if (weekKey && weekKey !== this.getCurrentWeekKey()) {
      return false;
    }
    const curMin = this.getCurrentMinutesOfDay();
    return curMin >= this.itemStartMinutes(item) && curMin < this.itemEndMinutes(item);
  }

  public getCurrentActiveItems(weekKey?: WeekKey): ScheduleItem[] {
    return this.getTodayItems(weekKey).filter((item) => this.isCurrentlyActive(item, weekKey));
  }

  public getNextUpcomingItem(weekKey?: WeekKey): ScheduleItem | null {
    const curMin = this.getCurrentMinutesOfDay();
    const todayItems = this.getTodayItems(weekKey);
    return todayItems.find((item) => this.itemStartMinutes(item) > curMin) || null;
  }

  public getRemainingMinutesForActive(item: ScheduleItem): number {
    return Math.max(0, this.itemEndMinutes(item) - this.getCurrentMinutesOfDay());
  }

  public getMinutesUntilStart(item: ScheduleItem): number {
    return Math.max(0, this.itemStartMinutes(item) - this.getCurrentMinutesOfDay());
  }

  public getCurrentWeekKey(): WeekKey {
    return getWeekKey(this.currentDate);
  }

  public getCurrentWeekday(): WeekdayNumber {
    return getWeekdayNumber(this.currentDate);
  }

  public getTodayWeekday(): WeekdayNumber {
    return this.getCurrentWeekday();
  }

  public getSelectedWeekday(): WeekdayNumber {
    return this.selectedWeekday;
  }

  public setSelectedWeekday(weekday: WeekdayNumber): void {
    if (this.selectedWeekday === weekday) return;
    this.selectedWeekday = weekday;
    this.notify();
  }

  public getItemsForWeekday(weekday: WeekdayNumber, weekKey?: WeekKey): ScheduleItem[] {
    return this.getEffectiveItems(weekKey)
      .filter((item) => item.weekday === weekday)
      .sort(compareScheduleItemsByTime);
  }

  public getTodayItems(weekKey?: WeekKey): ScheduleItem[] {
    const today = this.getCurrentWeekday();
    return this.getItemsForWeekday(today, weekKey);
  }
}

// Global default singleton instance
export const globalScheduleStore = new ScheduleStore();
