import { describe, it, expect } from 'vitest';
import {
  getPrintableTimeSlots,
  buildPrintColumnBlocks,
  getThemeStyles,
  formatPrintDisplayLines,
  shouldMergeAcrossSlots,
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
});
