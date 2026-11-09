import { ScheduleCategoryType, ScheduleItem, SubTask, WeekdayNumber } from '../types/schedule';

export const BASELINE_TIMESTAMP = 1_700_000_000;

/**
 * Pure synchronous SHA-256 byte digest computation for browser/Node.
 * Exactly matches Swift's CryptoKit.SHA256.hash(data: Data(seed.utf8)).
 */
function sha256First16Bytes(seed: string): Uint8Array {
  const utf8 = unescape(encodeURIComponent(seed));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const byteLength = utf8.length;
  words[byteLength >> 2] |= 0x80 << (24 - (byteLength % 4) * 8);
  words[(((byteLength + 8) >> 6) << 4) + 15] = byteLength * 8;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Int32Array(64);
  const totalWords = words.length;

  for (let i = 0; i < totalWords; i += 16) {
    for (let j = 0; j < 16; j++) w[j] = words[i + j] | 0;
    for (let j = 16; j < 64; j++) {
      const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^
                 ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^
                 (w[j - 15] >>> 3);
      const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^
                 ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^
                 (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const bytes = new Uint8Array(16);
  const hashes = [h0, h1, h2, h3];
  for (let j = 0; j < 4; j++) {
    bytes[j * 4] = (hashes[j] >>> 24) & 0xff;
    bytes[j * 4 + 1] = (hashes[j] >>> 16) & 0xff;
    bytes[j * 4 + 2] = (hashes[j] >>> 8) & 0xff;
    bytes[j * 4 + 3] = hashes[j] & 0xff;
  }
  return bytes;
}

/**
 * Creates a deterministic UUID from a seed string.
 * Uses SHA-256 and conforms to RFC 4122 v4 variant 1 format, identically to Swift DefaultScheduleData.swift.
 */
export function deterministicUUID(seed: string): string {
  const bytes = sha256First16Bytes(seed);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  const str = hex.join('');
  return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20, 32)}`;
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

/**
 * 기본 시간표(Master Schedule) 항목들을 생성합니다.
 * Swift DefaultScheduleData.makeDefaultItems()와 100% 동일한 결정론적 ID를 가집니다.
 */
export function getMasterScheduleItems(): ScheduleItem[] {
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

// Backwards-compatible alias
export const getDefaultScheduleItems = getMasterScheduleItems;
