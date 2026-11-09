import { ScheduleItem } from './schedule';

export interface VercelBlobItem {
  url: string;
  pathname: string;
  size?: number;
  uploadedAt?: string;
}

export interface VercelBlobListResponse {
  hasMore?: boolean;
  blobs: VercelBlobItem[];
}

export interface VercelBlobPutResponse {
  url: string;
  pathname: string;
}

export interface SyncTimestampedFlag {
  isSet: boolean;
  updatedAt: number; // Unix epoch seconds
}

export interface WeeklyItemOverride {
  id: string; // `${weekKey}_${baseItemId}`
  weekKey: string;
  baseItemId: string;
  isActive: boolean;
  isSkipped: boolean;
  overriddenItem?: ScheduleItem;
  updatedAt: number;
}

export type ReactionSticker = 'heart' | 'star' | 'thumbsUp' | 'clap' | 'fire' | 'crown';

export interface ScheduleItemComment {
  id: string;
  text: string;
  createdAt: number;
}

export interface ItemParentReaction {
  itemKey: string;
  heartCount: number;
  sticker: ReactionSticker;
  comment: string;
  comments?: ScheduleItemComment[];
  updatedAt: number;
}

export interface ParentPraiseNote {
  id: string;
  hearts: number;
  sticker: ReactionSticker;
  message: string;
  createdAt: number;
}

export interface HeartRewardRedemption {
  id: string;
  title: string;
  hearts: number;
  createdAt: number;
  redeemedByRole: string;
}

export interface RewardPreset {
  id: string;
  emoji: string;
  title: string;
  hearts: number;
  tag: string;
  updatedAt: number;
}

export type StarTransactionKind = 'dailyAllClear' | 'weeklyAllClearBonus' | 'rewardRedemption';

export interface StarTransaction {
  id: string;
  kind: StarTransactionKind;
  delta: number;
  weekKey: string;
  weekdayRawValue?: number;
  title: string;
  note: string;
  createdAt: number;
  createdByRole: string;
  linkedRedemptionId?: string;
  linkedHeartGrantCount?: number;
}

export type StarRewardActionType = 'convertToHearts' | 'customVoucher';

export interface StarRewardPreset {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  starCost: number;
  actionType: StarRewardActionType;
  grantedHearts: number;
  badgeTag: string;
  updatedAt: number;
}

export type StarRedemptionStatus = 'pending' | 'approved' | 'rejected';

export interface StarRedemptionRequest {
  id: string;
  presetId: string;
  emoji: string;
  rewardTitle: string;
  starCost: number;
  actionType: StarRewardActionType;
  grantedHearts: number;
  status: StarRedemptionStatus;
  requestedAt: number;
  requestedByRole: string;
  resolvedAt?: number;
  resolvedByRole?: string;
  updatedAt: number;
}

export interface CloudSyncSnapshot {
  schemaVersion: number;
  familyCode: string;
  updatedAt: number;
  updatedByRole: string;
  updatedByDeviceId: string;
  parentPinCode: string;
  parentPinUpdatedAt: number;
  items: ScheduleItem[];
  deletedItemTimestamps: Record<string, number>;
  weeklyOverrides: Record<string, WeeklyItemOverride>;
  completionFlags: Record<string, SyncTimestampedFlag>;
  subTaskCompletionFlags: Record<string, SyncTimestampedFlag>;
  parentVerifiedFlags: Record<string, SyncTimestampedFlag>;
  parentVerifiedSubTaskFlags: Record<string, SyncTimestampedFlag>;
  itemReactions: Record<string, ItemParentReaction>;
  praiseNotes: ParentPraiseNote[];
  rewardRedemptions: HeartRewardRedemption[];
  archivedEarnedHearts: number;
  rewardPresets: RewardPreset[];
  deletedRewardPresetTimestamps: Record<string, number>;
  starTransactions: StarTransaction[];
  starRedemptionRequests: StarRedemptionRequest[];
  starRewardPresets: StarRewardPreset[];
  deletedStarPresetTimestamps: Record<string, number>;
  revokedStarTransactionIds: string[];
  revokedStarRedemptionIds: string[];
  revokedPraiseNoteIds: string[];
}
