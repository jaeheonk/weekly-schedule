import { ScheduleItem } from './schedule';

export interface VercelBlobItem {
  url: string;
  pathname: string;
  size?: number;
  uploadedAt?: string;
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

export const DEFAULT_REWARD_PRESETS: RewardPreset[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    emoji: '🎮',
    title: '자유 놀이 / 게임 30분',
    hearts: 10,
    tag: '놀이',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    emoji: '🍦',
    title: '달콤한 간식 / 아이스크림',
    hearts: 5,
    tag: '간식',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    emoji: '🧸',
    title: '문구 / 장난감 선물',
    hearts: 20,
    tag: '선물',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    emoji: '🎡',
    title: '주말 특별 가족 나들이',
    hearts: 30,
    tag: '나들이',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    emoji: '💰',
    title: '용돈 2,000원 교환',
    hearts: 10,
    tag: '용돈',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000106',
    emoji: '🎬',
    title: '영화 / 만화 시청 1편',
    hearts: 15,
    tag: '미디어',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000107',
    emoji: '🛌',
    title: '30분 늦게 자기 쿠폰',
    hearts: 15,
    tag: '쿠폰',
    updatedAt: 1700000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000108',
    emoji: '🍳',
    title: '오늘 저녁 메뉴 고르기',
    hearts: 10,
    tag: '특별',
    updatedAt: 1700000000,
  },
];

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
