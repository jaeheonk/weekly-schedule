import { ScheduleItem, WeekdayNumber } from '../types/schedule';
import { compareScheduleItemsByTime } from './calendarUtils';

export type SchedulePrintTheme = 'classicMint' | 'subjectColor' | 'bwInkSaver';

export interface PrintConfig {
  scope: 'master' | 'thisWeek';
  theme: SchedulePrintTheme;
  documentTitle: string;
  showCompletionStamps: boolean;
  showNotesAndSubtasks: boolean;
  mergeLongBlocks: boolean;
}

export interface PrintableTimeSlot {
  hour: number;
  minute: number;
  totalMinutes: number;
  label: string;
}

export interface DayCellBlock {
  id: string;
  startSlotIndex: number;
  spanCount: number;
  slot: PrintableTimeSlot;
  nextSlotMinutes: number;
  items: ScheduleItem[];
  isHighlightedSpanBlock: boolean;
}

export interface ThemePalette {
  headerBg: string;
  headerText: string;
  timeColBg: string;
  timeColText: string;
  gridLine: string;
  spanBlockHighlight: string;
  themeClass: string;
  titleText: string;
}

const BASE_SLOTS: [number, number][] = [
  [7, 0],
  [9, 30],
  [10, 30],
  [12, 0],
  [13, 30],
  [14, 30],
  [15, 0],
  [16, 0],
  [17, 0],
  [18, 0],
  [19, 0],
  [20, 0],
  [21, 30],
  [22, 30],
];

export function pad2(num: number): string {
  return String(num).padStart(2, '0');
}

export function getItemStartMinutes(item: { startHour: number; startMinute: number }): number {
  return item.startHour * 60 + item.startMinute;
}

export function getItemEndMinutes(item: { endHour: number; endMinute: number }): number {
  return item.endHour * 60 + item.endMinute;
}

export function getItemDurationMinutes(item: {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}): number {
  return getItemEndMinutes(item) - getItemStartMinutes(item);
}

export function formatCompactTime(hour: number, minute: number): string {
  if (minute === 0) {
    return `${hour}:00`;
  }
  return `${hour}:${pad2(minute)}`;
}

export function getPrintableTimeSlots(items: ScheduleItem[]): PrintableTimeSlot[] {
  const map = new Map<number, PrintableTimeSlot>();

  for (const [h, m] of BASE_SLOTS) {
    const totalMinutes = h * 60 + m;
    map.set(totalMinutes, {
      hour: h,
      minute: m,
      totalMinutes,
      label: formatCompactTime(h, m),
    });
  }

  for (const item of items) {
    const totalMinutes = getItemStartMinutes(item);
    if (!map.has(totalMinutes)) {
      map.set(totalMinutes, {
        hour: item.startHour,
        minute: item.startMinute,
        totalMinutes,
        label: formatCompactTime(item.startHour, item.startMinute),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.totalMinutes - b.totalMinutes);
}

export function getThemeStyles(theme: SchedulePrintTheme): ThemePalette {
  switch (theme) {
    case 'classicMint':
      return {
        headerBg: '#DAE9E2',
        headerText: '#233F35',
        timeColBg: '#ECF1EF',
        timeColText: '#26332E',
        gridLine: '#C7D1CC',
        spanBlockHighlight: '#E9F4EF',
        themeClass: 'theme-classic-mint',
        titleText: '#284038',
      };
    case 'subjectColor':
      return {
        headerBg: '#233878',
        headerText: '#FFFFFF',
        timeColBg: '#F3F4F6',
        timeColText: '#1F2937',
        gridLine: '#CCD0DC',
        spanBlockHighlight: '#EAF0FA',
        themeClass: 'theme-subject-color',
        titleText: '#1E293B',
      };
    case 'bwInkSaver':
    default:
      return {
        headerBg: '#FFFFFF',
        headerText: '#111827',
        timeColBg: '#F9FAFB',
        timeColText: '#111827',
        gridLine: '#6B7280',
        spanBlockHighlight: '#F3F4F6',
        themeClass: 'theme-bw-ink-saver',
        titleText: '#111827',
      };
  }
}

export function getActiveItemsForSlot(
  items: ScheduleItem[],
  weekday: WeekdayNumber,
  slotMinutes: number,
  nextSlotMinutes: number
): ScheduleItem[] {
  return items
    .filter((item) => item.weekday === weekday)
    .filter((item) => {
      const itemStart = getItemStartMinutes(item);
      const itemEnd = getItemEndMinutes(item);
      const startsInSlot = itemStart >= slotMinutes && itemStart < nextSlotMinutes;
      const spansAcrossSlot = itemStart < slotMinutes && itemEnd > slotMinutes;
      return startsInSlot || spansAcrossSlot;
    })
    .sort((a, b) => {
      const timeDiff = compareScheduleItemsByTime(a, b);
      if (timeDiff !== 0) return timeDiff;
      return getItemEndMinutes(a) - getItemEndMinutes(b);
    });
}

export function shouldMergeAcrossSlots(
  item: ScheduleItem,
  spannedSlotCount: number,
  mergeLongBlocks: boolean
): boolean {
  if (!mergeLongBlocks || spannedSlotCount < 2) return false;
  if (spannedSlotCount >= 3) return true;
  if (item.category === 'free') return true;
  if (item.subTasks && item.subTasks.length >= 3) return true;
  const duration = getItemDurationMinutes(item);
  if (duration >= 120 && (item.weekday === 6 || item.weekday === 7)) {
    return true;
  }
  return false;
}

export function buildPrintColumnBlocks(
  weekday: WeekdayNumber,
  items: ScheduleItem[],
  slots: PrintableTimeSlot[],
  mergeLongBlocks: boolean
): DayCellBlock[] {
  const blocks: DayCellBlock[] = [];
  let idx = 0;

  while (idx < slots.length) {
    const slot = slots[idx];
    const nextMinutes = idx + 1 < slots.length ? slots[idx + 1].totalMinutes : 24 * 60;
    const currentItems = getActiveItemsForSlot(items, weekday, slot.totalMinutes, nextMinutes);

    if (currentItems.length === 1 && mergeLongBlocks) {
      const singleItem = currentItems[0];
      let span = 1;
      while (idx + span < slots.length) {
        const nextSlot = slots[idx + span];
        const afterNextMinutes =
          idx + span + 1 < slots.length ? slots[idx + span + 1].totalMinutes : 24 * 60;
        const nextActive = getActiveItemsForSlot(
          items,
          weekday,
          nextSlot.totalMinutes,
          afterNextMinutes
        );
        if (nextActive.length === 1 && nextActive[0].id === singleItem.id) {
          span++;
        } else {
          break;
        }
      }

      if (shouldMergeAcrossSlots(singleItem, span, mergeLongBlocks)) {
        const finalNextMinutes = idx + span < slots.length ? slots[idx + span].totalMinutes : 24 * 60;
        blocks.push({
          id: `${weekday}_${idx}_span${span}`,
          startSlotIndex: idx,
          spanCount: span,
          slot,
          nextSlotMinutes: finalNextMinutes,
          items: [singleItem],
          isHighlightedSpanBlock: true,
        });
        idx += span;
        continue;
      }
    }

    blocks.push({
      id: `${weekday}_${idx}`,
      startSlotIndex: idx,
      spanCount: 1,
      slot,
      nextSlotMinutes: nextMinutes,
      items: currentItems,
      isHighlightedSpanBlock: false,
    });
    idx++;
  }

  return blocks;
}

export function extractTimeRangeToken(note: string): string | null {
  if (!note) return null;
  const compact = note.replace(/\s*-\s*/g, '-').replace(/\s*~\s*/g, '-');
  const tokens = compact.split(/\s+/);
  for (const token of tokens) {
    if (token.includes(':') && token.includes('-')) {
      return token;
    }
  }
  return null;
}

export function formatPrintDisplayLines(
  item: ScheduleItem,
  isContinuation: boolean,
  nextSlotMinutes: number
): { titleText: string; subtitleText: string | null } {
  let title = item.title.trim();

  // Handle continuation
  if (isContinuation) {
    const itemEnd = getItemEndMinutes(item);
    if (itemEnd < nextSlotMinutes && item.endMinute !== 0) {
      const endStr = `(~${item.endHour}:${pad2(item.endMinute)})`;
      return { titleText: title, subtitleText: endStr };
    }
    return { titleText: title, subtitleText: null };
  }

  const cleanNote = (item.note || '').trim();
  const rangeMatch = extractTimeRangeToken(cleanNote);
  if (rangeMatch) {
    return { titleText: title, subtitleText: rangeMatch };
  }

  return { titleText: title, subtitleText: null };
}
