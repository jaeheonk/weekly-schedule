import { describe, it, expect } from 'vitest';
import {
  getPrintableTimeSlots,
  buildPrintColumnBlocks,
  getThemeStyles,
  formatPrintDisplayLines,
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
});
