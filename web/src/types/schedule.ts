export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * ISO-8601 WeekKey string format: "YYYY-Ww" or "YYYY-Www" (e.g. "2026-W46")
 */
export type WeekKey = string;

export interface WeekdayInfo {
  number: WeekdayNumber;
  shortName: string; // "월", "화", ...
  fullName: string;  // "월요일", "화요일", ...
  isWeekend: boolean;
}

export const WEEKDAYS: WeekdayInfo[] = [
  { number: 1, shortName: '월', fullName: '월요일', isWeekend: false },
  { number: 2, shortName: '화', fullName: '화요일', isWeekend: false },
  { number: 3, shortName: '수', fullName: '수요일', isWeekend: false },
  { number: 4, shortName: '목', fullName: '목요일', isWeekend: false },
  { number: 5, shortName: '금', fullName: '금요일', isWeekend: false },
  { number: 6, shortName: '토', fullName: '토요일', isWeekend: true },
  { number: 7, shortName: '일', fullName: '일요일', isWeekend: true },
];

export type ScheduleCategoryType = 'study' | 'academy' | 'music' | 'sports' | 'routine' | 'free';

export interface CategoryInfo {
  type: ScheduleCategoryType;
  title: string;
  color: string;
  softBackgroundColor: string;
  isCheckable: boolean;
  defaultIcon: string;
}

export const CATEGORIES: Record<ScheduleCategoryType, CategoryInfo> = {
  study: {
    type: 'study',
    title: '공부·숙제',
    color: '#3878F5',
    softBackgroundColor: 'rgba(56, 120, 245, 0.12)',
    isCheckable: true,
    defaultIcon: 'book',
  },
  academy: {
    type: 'academy',
    title: '수업·학교',
    color: '#8C52EB',
    softBackgroundColor: 'rgba(140, 82, 235, 0.12)',
    isCheckable: true,
    defaultIcon: 'graduation-cap',
  },
  music: {
    type: 'music',
    title: '악기·음악',
    color: '#F38029',
    softBackgroundColor: 'rgba(243, 128, 41, 0.12)',
    isCheckable: true,
    defaultIcon: 'music',
  },
  sports: {
    type: 'sports',
    title: '운동·체육',
    color: '#29B873',
    softBackgroundColor: 'rgba(41, 184, 115, 0.12)',
    isCheckable: true,
    defaultIcon: 'activity',
  },
  routine: {
    type: 'routine',
    title: '생활·습관',
    color: '#E65C8C',
    softBackgroundColor: 'rgba(230, 92, 140, 0.12)',
    isCheckable: false,
    defaultIcon: 'sparkles',
  },
  free: {
    type: 'free',
    title: '자유·여가',
    color: '#1FB0C2',
    softBackgroundColor: 'rgba(31, 176, 194, 0.12)',
    isCheckable: false,
    defaultIcon: 'smile',
  },
};

export interface SubTask {
  id: string;
  title: string;
}

export interface ScheduleItem {
  id: string;
  weekday: WeekdayNumber;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  title: string;
  note: string;
  category: ScheduleCategoryType;
  iconName: string;
  subTasks: SubTask[];
  isNotificationEnabled: boolean;
  notificationLeadMinutes: number[];
  targetWeekKey?: WeekKey | null;
  updatedAt: number; // Unix epoch seconds
}

export type DeviceRole = 'child' | 'parent';

export type ScheduleEditScope = 'master' | 'thisWeek';

export interface CompletionStats {
  completed: number;
  verified: number;
  waiting: number;
  total: number;
  percentage: number;
}

export interface DayExcludedScheduleInfo {
  id: string;
  masterItem: ScheduleItem;
  isSkipped: boolean;
  movedToItem: ScheduleItem | null;
  reasonText: string;
}
