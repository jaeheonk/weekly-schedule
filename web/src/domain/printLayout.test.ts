import { describe, it, expect } from 'vitest';
import {
  getPrintableTimeSlots,
  buildPrintColumnBlocks,
  getThemeStyles,
  formatPrintDisplayLines,
  shouldMergeAcrossSlots,
  mergeContiguousScheduleItems,
  canMergeContiguous,
} from './printLayout';
import { ScheduleItem } from '../types/schedule';

describe('printLayout domain helper (Seam 1)', () => {
  const dummyItem: ScheduleItem = {
    id: 'test-1',
    title: '수학 학원',
    weekday: 1, // 월요일
    startHour: 15,
    startMinute: 0,
    endHour: 16,
    endMinute: 30,
    category: 'study',
    iconName: 'book',
    subTasks: [],
    note: '숙제 지참',
    isNotificationEnabled: false,
    notificationLeadMinutes: [],
    updatedAt: 1000,
  };

  it('generates sorted unique printable time slots including base slots and item start times', () => {
    const customItem: ScheduleItem = {
      ...dummyItem,
      startHour: 8,
      startMinute: 15,
      endHour: 9,
      endMinute: 0,
    };

    const slots = getPrintableTimeSlots([customItem]);
    expect(slots.length).toBeGreaterThanOrEqual(14);

    // 8:15 custom slot must be included and sorted before 9:30
    const customSlot = slots.find((s) => s.hour === 8 && s.minute === 15);
    expect(customSlot).toBeDefined();
    expect(customSlot?.label).toBe('8:15');

    // slots must be in chronological order
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].totalMinutes).toBeGreaterThan(slots[i - 1].totalMinutes);
    }
  });

  it('provides distinct theme palettes for classicMint, subjectColor, and bwInkSaver', () => {
    const mint = getThemeStyles('classicMint');
    expect(mint.headerBg).toBe('#DAE9E2');
    expect(mint.themeClass).toBe('theme-classic-mint');

    const subject = getThemeStyles('subjectColor');
    expect(subject.headerBg).toBe('#233878');
    expect(subject.themeClass).toBe('theme-subject-color');

    const bw = getThemeStyles('bwInkSaver');
    expect(bw.headerBg).toBe('#FFFFFF');
    expect(bw.themeClass).toBe('theme-bw-ink-saver');
  });

  it('merges consecutive slots for long blocks when mergeLongBlocks is true', () => {
    const longFreeItem: ScheduleItem = {
      id: 'free-1',
      title: '신나는 주말 자유시간',
      weekday: 7, // 일요일
      startHour: 20,
      startMinute: 0,
      endHour: 22,
      endMinute: 30,
      category: 'free',
      iconName: 'smile',
      subTasks: [],
      note: '20:00 - 22:30 자유시간',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1000,
    };

    const slots = getPrintableTimeSlots([longFreeItem]);
    const blocks = buildPrintColumnBlocks(7, [longFreeItem], slots, true);

    const mergedBlock = blocks.find((b) => b.items.some((it) => it.id === 'free-1'));
    expect(mergedBlock).toBeDefined();
    expect(mergedBlock?.spanCount).toBeGreaterThanOrEqual(2);
    expect(mergedBlock?.isHighlightedSpanBlock).toBe(true);
  });

  it('does not merge consecutive slots when mergeLongBlocks is false', () => {
    const longFreeItem: ScheduleItem = {
      id: 'free-1',
      title: '신나는 주말 자유시간',
      weekday: 7,
      startHour: 20,
      startMinute: 0,
      endHour: 22,
      endMinute: 30,
      category: 'free',
      iconName: 'smile',
      subTasks: [],
      note: '20:00 - 22:30',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1000,
    };

    const slots = getPrintableTimeSlots([longFreeItem]);
    const blocks = buildPrintColumnBlocks(7, [longFreeItem], slots, false);

    const mergedBlocks = blocks.filter((b) => b.items.some((it) => it.id === 'free-1'));
    for (const b of mergedBlocks) {
      expect(b.spanCount).toBe(1);
      expect(b.isHighlightedSpanBlock).toBe(false);
    }
  });

  it('formats display lines extracting time range tokens and handling continuation', () => {
    const itemWithTimeNote: ScheduleItem = {
      ...dummyItem,
      note: '15:00 - 16:30 학원 수업',
    };

    const formatted = formatPrintDisplayLines(itemWithTimeNote, false, 17 * 60);
    expect(formatted.titleText).toBe('수학 학원');
    expect(formatted.subtitleText).toBe('15:00-16:30');

    const continuation = formatPrintDisplayLines(itemWithTimeNote, true, 17 * 60);
    expect(continuation.titleText).toBe('수학 학원');
    expect(continuation.subtitleText).toBe('(~16:30)');
  });

  describe('Spanned Time Block Relaxed Merging (Issue 01)', () => {
    const wedSoccerItem: ScheduleItem = {
      id: 'soccer-1',
      title: '학교 축구',
      weekday: 3, // 수요일
      startHour: 15,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      category: 'sports',
      iconName: 'activity',
      subTasks: [],
      note: '',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1000,
    };

    const bedTimeItem: ScheduleItem = {
      id: 'bedtime-1',
      title: '취침',
      weekday: 2, // 화요일
      startHour: 22,
      startMinute: 0,
      endHour: 23,
      endMinute: 0,
      category: 'routine',
      iconName: 'moon',
      subTasks: [],
      note: '',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1000,
    };

    it('shouldMergeAcrossSlots returns true for any 2-slot item when mergeLongBlocks is true without heuristic restrictions', () => {
      // 2 slots, regular subject (exercise), weekday, no subtasks
      expect(shouldMergeAcrossSlots(wedSoccerItem, 2, true)).toBe(true);

      // 2 slots, routine/bedtime, 60 minutes
      expect(shouldMergeAcrossSlots(bedTimeItem, 2, true)).toBe(true);

      // 2 slots, study category
      expect(shouldMergeAcrossSlots(dummyItem, 2, true)).toBe(true);

      // 1 slot should never merge
      expect(shouldMergeAcrossSlots(wedSoccerItem, 1, true)).toBe(false);

      // mergeLongBlocks = false should never merge
      expect(shouldMergeAcrossSlots(wedSoccerItem, 2, false)).toBe(false);
    });

    it('merges weekday 2-slot schedule (e.g. Wednesday School Soccer 15:00~17:00) into a single DayCellBlock without continuation fragments', () => {
      // Tuesday item starting at 16:00 introduces an intermediate slot boundary at 16:00
      const tuesdayItem: ScheduleItem = {
        id: 'tue-1',
        title: '피아노 레슨',
        weekday: 2,
        startHour: 16,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        category: 'music',
        iconName: 'music',
        subTasks: [],
        note: '',
        isNotificationEnabled: false,
        notificationLeadMinutes: [],
        updatedAt: 1000,
      };

      const allItems = [wedSoccerItem, tuesdayItem];
      const slots = getPrintableTimeSlots(allItems);

      // Wednesday blocks with mergeLongBlocks = true
      const wedBlocks = buildPrintColumnBlocks(3, allItems, slots, true);

      // School Soccer must appear exactly ONCE as a merged block spanning 2 slots
      const soccerBlocks = wedBlocks.filter((b) => b.items.some((it) => it.id === 'soccer-1'));
      expect(soccerBlocks).toHaveLength(1);

      const block = soccerBlocks[0];
      expect(block.spanCount).toBe(2);
      expect(block.isHighlightedSpanBlock).toBe(true);
      expect(block.slot.hour).toBe(15);
      expect(block.slot.minute).toBe(0);

      // No separate continuation block with (~17:00)
      const continuationFormat = formatPrintDisplayLines(
        block.items[0],
        block.items[0].startHour * 60 + block.items[0].startMinute < block.slot.totalMinutes,
        block.nextSlotMinutes
      );
      expect(continuationFormat.subtitleText).toBeNull();
    });
  });

  describe('Merged Contiguous Schedule Helper (Issue 02)', () => {
    const itemA: ScheduleItem = {
      id: 'math-1',
      title: '수학 숙제',
      weekday: 1, // 월요일
      startHour: 14,
      startMinute: 0,
      endHour: 15,
      endMinute: 0,
      category: 'study',
      iconName: 'book',
      subTasks: [{ id: 'sub-1', title: '문제집 10p' }],
      note: '교재 1권',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1000,
    };

    const itemB: ScheduleItem = {
      id: 'math-2',
      title: '  수학 숙제  ', // with whitespace to test trim
      weekday: 1, // 월요일
      startHour: 15,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      category: 'study',
      iconName: 'book',
      subTasks: [{ id: 'sub-2', title: '오답노트 작성' }],
      note: '교재 2권',
      isNotificationEnabled: false,
      notificationLeadMinutes: [],
      updatedAt: 1005,
    };

    it('canMergeContiguous predicate validates 0-min gap, matching title, and matching category', () => {
      expect(canMergeContiguous(itemA, itemB)).toBe(true);

      const nonContiguous = { ...itemB, startMinute: 5 };
      expect(canMergeContiguous(itemA, nonContiguous)).toBe(false);

      const diffTitle = { ...itemB, title: '다른 과목' };
      expect(canMergeContiguous(itemA, diffTitle)).toBe(false);

      const diffCat = { ...itemB, category: 'free' as const };
      expect(canMergeContiguous(itemA, diffCat)).toBe(false);
    });

    it('merges two contiguous schedule items into a single virtual item spanning start to end', () => {
      const merged = mergeContiguousScheduleItems([itemA, itemB]);

      expect(merged).toHaveLength(1);
      const item = merged[0];
      expect(item.id).toBe('math-1');
      expect(item.title).toBe('수학 숙제');
      expect(item.category).toBe('study');
      expect(item.weekday).toBe(1);
      expect(item.startHour).toBe(14);
      expect(item.startMinute).toBe(0);
      expect(item.endHour).toBe(16);
      expect(item.endMinute).toBe(0);
      expect(item.note).toBe('교재 1권\n교재 2권');
      expect(item.subTasks).toEqual([
        { id: 'sub-1', title: '문제집 10p' },
        { id: 'sub-2', title: '오답노트 작성' },
      ]);
    });

    it('cumulatively merges 3 or more contiguous items into a single multi-hour block', () => {
      const item1: ScheduleItem = {
        ...itemA,
        id: 'c-1',
        startHour: 13,
        startMinute: 0,
        endHour: 14,
        endMinute: 0,
        note: '1단계',
      };
      const item2: ScheduleItem = {
        ...itemA,
        id: 'c-2',
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        note: '',
      };
      const item3: ScheduleItem = {
        ...itemA,
        id: 'c-3',
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        note: '3단계',
      };

      const merged = mergeContiguousScheduleItems([item1, item2, item3]);
      expect(merged).toHaveLength(1);
      expect(merged[0].startHour).toBe(13);
      expect(merged[0].startMinute).toBe(0);
      expect(merged[0].endHour).toBe(16);
      expect(merged[0].endMinute).toBe(0);
      expect(merged[0].note).toBe('1단계\n3단계');
    });

    it('does not merge items if there is a time gap (even 5 minutes)', () => {
      const gappedItemB: ScheduleItem = {
        ...itemB,
        startHour: 15,
        startMinute: 5,
        endHour: 16,
        endMinute: 5,
      };

      const merged = mergeContiguousScheduleItems([itemA, gappedItemB]);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('math-1');
      expect(merged[1].id).toBe('math-2');
    });

    it('does not merge items if titles differ (ignoring leading/trailing whitespace)', () => {
      const diffTitleItem: ScheduleItem = {
        ...itemB,
        title: '영어 숙제',
      };

      const merged = mergeContiguousScheduleItems([itemA, diffTitleItem]);
      expect(merged).toHaveLength(2);
      expect(merged[0].title).toBe('수학 숙제');
      expect(merged[1].title).toBe('영어 숙제');
    });

    it('does not merge items if categories differ even if titles and times align', () => {
      const diffCatItem: ScheduleItem = {
        ...itemB,
        category: 'free',
      };

      const merged = mergeContiguousScheduleItems([itemA, diffCatItem]);
      expect(merged).toHaveLength(2);
      expect(merged[0].category).toBe('study');
      expect(merged[1].category).toBe('free');
    });

    it('does not merge items on different weekdays', () => {
      const tuesdayItem: ScheduleItem = {
        ...itemB,
        weekday: 2, // 화요일
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
      };

      const merged = mergeContiguousScheduleItems([itemA, tuesdayItem]);
      expect(merged).toHaveLength(2);
      expect(merged.find((i) => i.weekday === 1)).toBeDefined();
      expect(merged.find((i) => i.weekday === 2)).toBeDefined();
    });
  });
});
