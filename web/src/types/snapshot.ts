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

export interface StickerOption {
  key: ReactionSticker;
  emoji: string;
  label: string;
}

export const STICKER_OPTIONS: StickerOption[] = [
  { key: 'heart', emoji: '❤️', label: '사랑해 하트' },
  { key: 'star', emoji: '⭐', label: '최고예요' },
  { key: 'thumbsUp', emoji: '👍', label: '엄지척 멋져요' },
  { key: 'clap', emoji: '👏', label: '참 잘했어요' },
  { key: 'fire', emoji: '🔥', label: '끝까지 화이팅' },
  { key: 'crown', emoji: '👑', label: '오늘의 챔피언' },
];

export const STICKER_EMOJIS: Record<ReactionSticker, string> = {
  heart: '❤️',
  star: '⭐',
  thumbsUp: '👍',
  clap: '👏',
  fire: '🔥',
  crown: '👑',
};

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

export type WeekdayStarState =
  | { kind: 'weekendExcluded' }
  | { kind: 'ineligibleEmpty' }
  | { kind: 'inProgress'; completed: number; verified: number; total: number }
  | { kind: 'claimable'; total: number }
  | { kind: 'awarded'; transaction: StarTransaction };

export interface StarCelebrationContext {
  weekday?: number;
  earnedDailyStar: number;
  earnedWeeklyBonus: number;
  totalAvailableStars: number;
  approvedRewardTitle?: string;
  approvedRewardEmoji?: string;
}

export const DEFAULT_STAR_PRESETS: StarRewardPreset[] = [
  {
    id: '00000000-0000-0000-0000-000000000201',
    emoji: '💝',
    title: '하트 5개 보너스 상자',
    subtitle: '스타 1개로 하트 5개를 즉시 충전해요!',
    starCost: 1,
    actionType: 'convertToHearts',
    grantedHearts: 5,
    badgeTag: '즉시 충전',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    emoji: '🎮',
    title: '로블록스 로벅스 500개',
    subtitle: '열심히 모은 스타 10개로 교환하는 스페셜 보상!',
    starCost: 10,
    actionType: 'customVoucher',
    grantedHearts: 0,
    badgeTag: '스페셜 목표',
    updatedAt: 1700000000,
  },
];

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
