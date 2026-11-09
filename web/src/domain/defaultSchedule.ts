import { ScheduleCategoryType, ScheduleItem, SubTask, WeekdayNumber } from '../types/schedule';

export const BASELINE_TIMESTAMP = 1_700_000_000;

/**
 * Creates a deterministic UUID from a seed string (FNV-1a / Murmur derived).
 */
export function deterministicUUID(seed: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  // Generate 16 bytes hex from seeds
  const hexPart = (n: number) => ('00000000' + (n >>> 0).toString(16)).slice(-8);
  const raw = hexPart(h1) + hexPart(h2) + hexPart(Math.imul(h1, 31)) + hexPart(Math.imul(h2, 37));

  // Format as UUID v4 variant
  const p1 = raw.slice(0, 8);
  const p2 = raw.slice(8, 12);
  const p3 = '4' + raw.slice(13, 16);
  const p4 = '8' + raw.slice(17, 20);
  const p5 = raw.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export function inferCategoryAndIcon(title: string): { category: ScheduleCategoryType; iconName: string } {
  const lower = title.toLowerCase();

  // 악기/음악
  if (lower.includes('바이올린') || lower.includes('오케스트라') || lower.includes('피아노') || lower.includes('악기')) {
    if (lower.includes('오케스트라')) return { category: 'music', iconName: 'music' };
    return { category: 'music', iconName: 'music' };
  }

  // 운동/체육
  if (lower.includes('수영')) return { category: 'sports', iconName: 'activity' };
  if (lower.includes('축구') || lower.includes('농구') || lower.includes('운동') || lower.includes('체육')) {
    return { category: 'sports', iconName: 'activity' };
  }

  // 생활/식사/취침
  if (lower.includes('취침') || lower.includes('잠')) return { category: 'routine', iconName: 'moon' };
  if (lower.includes('저녁') || lower.includes('아침') || lower.includes('점심') || lower.includes('식사') || lower.includes('간식')) {
    return { category: 'routine', iconName: 'utensils' };
  }
  if (lower.includes('코딱지') || lower.includes('기상')) return { category: 'routine', iconName: 'sun' };
  if (lower.includes('하교') || lower.includes('집 도착') || lower.includes('교회')) {
    return { category: 'routine', iconName: 'home' };
  }

  // 자유/여가
  if (lower.includes('자유시간') || lower.includes('자유') || lower.includes('휴식') || lower.includes('게임')) {
    return { category: 'free', iconName: 'gamepad' };
  }

  // 수업/학교/학원
  if (lower.includes('학교')) return { category: 'academy', iconName: 'building' };
  if (lower.includes('코딩')) return { category: 'academy', iconName: 'laptop' };
  if (lower.includes('faye') || lower.includes('수업') || lower.includes('학원')) {
    return { category: 'academy', iconName: 'users' };
  }

  // 공부/숙제
  if (lower.includes('과외')) return { category: 'study', iconName: 'users' };
  if (lower.includes('도서관') || lower.includes('책') || lower.includes('사전') || lower.includes('독서')) {
    return { category: 'study', iconName: 'book-open' };
  }
  if (lower.includes('수학')) return { category: 'study', iconName: 'calculator' };

  return { category: 'study', iconName: 'file-text' };
}

interface RawScheduleDef {
  weekday: WeekdayNumber;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  title: string;
  note?: string;
  category?: ScheduleCategoryType;
  iconName?: string;
  subTasks?: string[];
  isNotificationEnabled?: boolean;
  notificationLeadMinutes?: number[];
}

const DEFAULT_RAW_SCHEDULES: RawScheduleDef[] = [
  // 월요일 (Monday)
  { weekday: 1, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 1, startHour: 13, startMinute: 30, endHour: 14, endMinute: 30, title: '학교' },
  { weekday: 1, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0, title: '바이올린', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  {
    weekday: 1, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0,
    title: 'Vocabulary for Reading + 100 Words',
    subTasks: ['Vocabulary for Reading', '100 Words'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  { weekday: 1, startHour: 16, startMinute: 0, endHour: 17, endMinute: 0, title: '바이올린' },
  { weekday: 1, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, title: '한국책 읽기 30분' },
  { weekday: 1, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '수영', note: '수영 가방 챙기기', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 1, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0, title: '저녁' },
  { weekday: 1, startHour: 20, startMinute: 0, endHour: 21, endMinute: 30, title: '국어똑', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 1, startHour: 21, startMinute: 30, endHour: 22, endMinute: 30, title: 'Faye 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 1, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 화요일 (Tuesday)
  { weekday: 2, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 2, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0, title: '하교' },
  { weekday: 2, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, title: '축구 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  {
    weekday: 2, startHour: 16, startMinute: 0, endHour: 17, endMinute: 0,
    title: '씻고 간식 · 바이올린',
    subTasks: ['씻고 간식 먹기', '바이올린 연습']
  },
  { weekday: 2, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, title: '영어수학', isNotificationEnabled: true, notificationLeadMinutes: [0] },
  { weekday: 2, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '저녁' },
  {
    weekday: 2, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0,
    title: '한국책 30분 읽고 그래픽 오거나이저 쓰기',
    subTasks: ['한국책 30분 읽기', '그래픽 오거나이저 쓰기'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  {
    weekday: 2, startHour: 20, startMinute: 0, endHour: 21, endMinute: 30,
    title: '100 Words + 수학 과외',
    subTasks: ['100 Words', '수학 과외'],
    isNotificationEnabled: true, notificationLeadMinutes: [15, 0]
  },
  { weekday: 2, startHour: 21, startMinute: 30, endHour: 22, endMinute: 30, title: 'Faye 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 2, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 수요일 (Wednesday)
  { weekday: 3, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  {
    weekday: 3, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0,
    title: '영어수학 + 100 Words',
    subTasks: ['영어수학', '100 Words'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  { weekday: 3, startHour: 15, startMinute: 0, endHour: 17, endMinute: 0, title: '학교 축구', note: '3:00 PM ~ 5:00 PM', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 3, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, title: '수학숙제', isNotificationEnabled: true, notificationLeadMinutes: [0] },
  { weekday: 3, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '저녁' },
  { weekday: 3, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0, title: '바이올린', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  {
    weekday: 3, startHour: 20, startMinute: 0, endHour: 21, endMinute: 30,
    title: '한국책 읽기 30분 + 영어책 읽기 30분',
    subTasks: ['한국책 읽기 30분', '영어책 읽기 30분'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  { weekday: 3, startHour: 21, startMinute: 30, endHour: 22, endMinute: 30, title: 'Faye 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 3, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 목요일 (Thursday)
  { weekday: 4, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 4, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0, title: '바이올린', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 4, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, title: '수학숙제' },
  { weekday: 4, startHour: 16, startMinute: 0, endHour: 17, endMinute: 0, title: '100 Words' },
  { weekday: 4, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, title: '농구', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 4, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '저녁' },
  {
    weekday: 4, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0,
    title: '한국책 읽기 30분 + 영어책 읽기 30분',
    subTasks: ['한국책 읽기 30분', '영어책 읽기 30분'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  { weekday: 4, startHour: 20, startMinute: 0, endHour: 21, endMinute: 30, title: '수학과외', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 4, startHour: 21, startMinute: 30, endHour: 22, endMinute: 30, title: 'Faye 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 4, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 금요일 (Friday)
  { weekday: 5, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 5, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0, title: '100 Words' },
  {
    weekday: 5, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0,
    title: '한국책 30분 읽고 그래픽 오거나이저 쓰기',
    subTasks: ['한국책 30분 읽기', '그래픽 오거나이저 쓰기']
  },
  {
    weekday: 5, startHour: 16, startMinute: 0, endHour: 17, endMinute: 0,
    title: 'Vocabulary for Reading + 100 Words (Unit 6-10)',
    note: 'Unit 6-10',
    subTasks: ['Vocabulary for Reading', '100 Words (Unit 6-10)']
  },
  { weekday: 5, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, title: '수영', note: '수영 가방 챙기기', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 5, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '저녁' },
  { weekday: 5, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0, title: '수학숙제', isNotificationEnabled: true, notificationLeadMinutes: [0] },
  { weekday: 5, startHour: 20, startMinute: 0, endHour: 21, endMinute: 30, title: '인물사전' },
  { weekday: 5, startHour: 21, startMinute: 30, endHour: 22, endMinute: 30, title: 'Faye 수업', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 5, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 토요일 (Saturday)
  { weekday: 6, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 6, startHour: 10, startMinute: 30, endHour: 11, endMinute: 20, title: '바이올린', note: '10:30 - 11:20', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  {
    weekday: 6, startHour: 12, startMinute: 0, endHour: 22, endMinute: 30,
    title: '토요일 주간 미션 & 도서관',
    note: '1. 밀린 숙제하기 / 2. 도서관 가기 / 3. 영어수학 / 4. 수학숙제',
    category: 'study',
    iconName: 'file-text',
    subTasks: [
      '1. 밀린 숙제하기',
      '2. 도서관 가기 - 도서 반납',
      '2. 도서관 가기 - 리스트에 있는 책 빌리기',
      '3. 영어수학',
      '4. 수학숙제'
    ],
    isNotificationEnabled: true,
    notificationLeadMinutes: [0]
  },
  { weekday: 6, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },

  // 일요일 (Sunday)
  { weekday: 7, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30, title: '코딱지', note: '아침 기상 및 루틴' },
  { weekday: 7, startHour: 9, startMinute: 30, endHour: 10, endMinute: 10, title: '코딩', note: '9:30 - 10:10', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 7, startHour: 13, startMinute: 30, endHour: 14, endMinute: 30, title: '교회 끝' },
  { weekday: 7, startHour: 14, startMinute: 30, endHour: 15, endMinute: 0, title: '집 도착' },
  {
    weekday: 7, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0,
    title: '한국책 30분 읽고 그래픽 오거나이저 쓰기',
    subTasks: ['한국책 30분 읽기', '그래픽 오거나이저 쓰기'],
    isNotificationEnabled: true, notificationLeadMinutes: [0]
  },
  { weekday: 7, startHour: 16, startMinute: 0, endHour: 17, endMinute: 30, title: '오케스트라 연습', note: '16:00 - 17:30', isNotificationEnabled: true, notificationLeadMinutes: [15, 0] },
  { weekday: 7, startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, title: '저녁' },
  { weekday: 7, startHour: 19, startMinute: 0, endHour: 20, endMinute: 0, title: '인명사전' },
  { weekday: 7, startHour: 20, startMinute: 0, endHour: 22, endMinute: 0, title: '자유시간', note: '20:00 - 22:00 신나는 자유시간!', isNotificationEnabled: true, notificationLeadMinutes: [0] },
  { weekday: 7, startHour: 22, startMinute: 30, endHour: 23, endMinute: 0, title: '취침', isNotificationEnabled: true, notificationLeadMinutes: [0] },
];

export function getDefaultScheduleItems(): ScheduleItem[] {
  return DEFAULT_RAW_SCHEDULES.map((raw) => {
    const cleanTitle = raw.title.trim();
    const startSig = `${raw.weekday}|${raw.startHour}:${raw.startMinute}|${cleanTitle}`;
    const id = deterministicUUID(`weekly-schedule-default-v2-${startSig}`);
    const inferred = inferCategoryAndIcon(raw.title);

    const subTasks: SubTask[] = (raw.subTasks || []).map((subTitle, idx) => ({
      id: deterministicUUID(`weekly-schedule-sub-v2-${startSig}-${idx}-${subTitle}`),
      title: subTitle,
    }));

    return {
      id,
      weekday: raw.weekday,
      startHour: raw.startHour,
      startMinute: raw.startMinute,
      endHour: raw.endHour,
      endMinute: raw.endMinute,
      title: raw.title,
      note: raw.note || '',
      category: raw.category || inferred.category,
      iconName: raw.iconName || inferred.iconName,
      subTasks,
      isNotificationEnabled: raw.isNotificationEnabled ?? false,
      notificationLeadMinutes: raw.notificationLeadMinutes || [15, 0],
      targetWeekKey: null,
      updatedAt: BASELINE_TIMESTAMP,
    };
  });
}
