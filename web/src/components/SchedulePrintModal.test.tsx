import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchedulePrintModal } from './SchedulePrintModal';
import { ScheduleStore } from '../domain/scheduleStore';

describe('SchedulePrintModal Component (Seam 2)', () => {
  let mockStore: ScheduleStore;
  const originalPrint = window.print;

  beforeEach(() => {
    localStorage.clear();
    mockStore = new ScheduleStore({ currentDate: new Date(2026, 10, 9) }); // 2026-W46 Monday
    window.print = vi.fn();
  });

  afterEach(() => {
    window.print = originalPrint;
  });

  it('renders modal with title, print options, and landscape A4 preview', () => {
    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('1페이지 시간표 인쇄')).toBeInTheDocument();
    expect(screen.getByTestId('execute-print-btn')).toBeInTheDocument();
    expect(screen.getByTestId('printable-sheet')).toBeInTheDocument();
    expect(screen.getByText('WEEKLY SCHEDULE | 주간 시간표')).toBeInTheDocument();
  });

  it('switches between Classic Mint, Subject Color, and B&W Ink Saver themes', () => {
    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    const sheet = screen.getByTestId('printable-sheet');

    // Default theme should be Classic Mint
    expect(sheet).toHaveClass('theme-classic-mint');

    // Click Subject Color theme button
    const subjectBtn = screen.getByRole('button', { name: /Subject Color/i });
    fireEvent.click(subjectBtn);
    expect(sheet).toHaveClass('theme-subject-color');

    // Click B&W Ink Saver theme button
    const bwBtn = screen.getByRole('button', { name: /B&W Ink Saver/i });
    fireEvent.click(bwBtn);
    expect(sheet).toHaveClass('theme-bw-ink-saver');
  });

  it('toggles completion stamps and praise hearts visibility in preview', () => {
    const mondayItem = mockStore.getItemsForWeekday(1)[0];
    mockStore.sendItemReaction({
      item: mondayItem,
      addHearts: 3,
      sticker: 'star',
      comment: '참 잘했어요!',
      alsoVerify: true,
    });

    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    const stampToggle = screen.getByLabelText(/완료 확인 도장 및 응원 하트 표시/i);
    // Initially false (clean template for wall)
    expect(stampToggle).not.toBeChecked();
    expect(screen.queryByTestId('preview-stamps-summary')).not.toBeInTheDocument();

    // Toggle ON
    fireEvent.click(stampToggle);
    expect(stampToggle).toBeChecked();
    expect(screen.getByTestId('preview-stamps-summary')).toBeInTheDocument();
  });

  it('toggles schedule scope between master schedule and this week adjustments', () => {
    const mondayItem = mockStore.getItemsForWeekday(1)[0];
    mockStore.updateItem(
      {
        ...mondayItem,
        title: '이번 주 특별 수업',
      },
      'thisWeek'
    );

    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    // Default scope is master schedule
    expect(screen.getAllByText(mondayItem.title)[0]).toBeInTheDocument();
    expect(screen.queryByText('이번 주 특별 수업')).not.toBeInTheDocument();

    // Click "이번 주 조정 반영" button
    const thisWeekBtn = screen.getByRole('button', { name: /이번 주 조정 반영/i });
    fireEvent.click(thisWeekBtn);

    expect(screen.getByText('이번 주 특별 수업')).toBeInTheDocument();
  });

  it('triggers window.print() when clicking execute print button', () => {
    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    const printBtn = screen.getByTestId('execute-print-btn');
    fireEvent.click(printBtn);

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking close button', () => {
    const handleClose = vi.fn();
    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={handleClose}
        store={mockStore}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /닫기/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('merges 2-slot schedules into single cells when mergeLongBlocks is true, and splits when toggled off', () => {
    // Switch to parent mode to add master item
    mockStore.verifyParentPin('160125');

    // Add a 10:30~13:30 study item on Friday (spans 10:30 and 12:00 base slots, exactly 2 slots)
    mockStore.addItem(
      {
        id: 'fri-study-1',
        title: '오전 집중 탐구',
        weekday: 5,
        startHour: 10,
        startMinute: 30,
        endHour: 13,
        endMinute: 30,
        category: 'study',
        iconName: 'book',
        subTasks: [],
        note: '',
        isNotificationEnabled: false,
        notificationLeadMinutes: [],
        updatedAt: 1000,
      },
      [5],
      'master'
    );

    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    const mergeToggle = screen.getByLabelText(/장기 일정 셀 하나로 병합하기/i);
    // By default, mergeLongBlocks is true
    expect(mergeToggle).toBeChecked();

    const assertMergedPresentation = () => {
      // Wednesday School Soccer (15:00~17:00, category: sports) should appear as 1 cell, not split
      expect(screen.getAllByText('학교 축구')).toHaveLength(1);
      expect(screen.queryByText('(~17:00)')).not.toBeInTheDocument();

      // Sunday Orchestra (16:00~17:30, category: music) should appear as 1 cell
      expect(screen.getAllByText('오케스트라 연습')).toHaveLength(1);
      expect(screen.queryByText('(~17:30)')).not.toBeInTheDocument();

      // Friday study item spanning 10:30~13:30 (category: study, spans 10:30 and 12:00 base slots)
      expect(screen.getAllByText('오전 집중 탐구')).toHaveLength(1);
      expect(screen.queryByText('(~13:30)')).not.toBeInTheDocument();
    };

    // 1. In merged state:
    assertMergedPresentation();

    // 2. Toggle OFF mergeLongBlocks
    fireEvent.click(mergeToggle);
    expect(mergeToggle).not.toBeChecked();

    // In split state: each slot receives its own block with continuation marker where applicable
    expect(screen.getAllByText('학교 축구')).toHaveLength(2);

    expect(screen.getAllByText('오케스트라 연습')).toHaveLength(2);
    expect(screen.getByText('(~17:30)')).toBeInTheDocument();

    expect(screen.getAllByText('오전 집중 탐구')).toHaveLength(2);

    // 3. Toggle back ON
    fireEvent.click(mergeToggle);
    expect(mergeToggle).toBeChecked();

    assertMergedPresentation();
  });

  it('virtually merges contiguous schedule items (same title, category, 0-min gap) into a single print block (Issue 02)', () => {
    mockStore.verifyParentPin('160125');

    // Register two contiguous Monday morning items in an empty time window:
    // 9:30~10:30 and 10:30~12:00 "수학 심화" (spans 9:30 and 10:30 base slots)
    mockStore.addItem(
      {
        id: 'math-cont-1',
        title: '수학 심화',
        weekday: 1,
        startHour: 9,
        startMinute: 30,
        endHour: 10,
        endMinute: 30,
        category: 'study',
        iconName: 'book',
        subTasks: [{ id: 'st-1', title: '개념정리' }],
        note: '1교시',
        isNotificationEnabled: false,
        notificationLeadMinutes: [],
        updatedAt: 1000,
      },
      [1],
      'master'
    );

    mockStore.addItem(
      {
        id: 'math-cont-2',
        title: '  수학 심화  ',
        weekday: 1,
        startHour: 10,
        startMinute: 30,
        endHour: 12,
        endMinute: 0,
        category: 'study',
        iconName: 'book',
        subTasks: [{ id: 'st-2', title: '문제풀이' }],
        note: '2교시',
        isNotificationEnabled: false,
        notificationLeadMinutes: [],
        updatedAt: 1005,
      },
      [1],
      'master'
    );

    render(
      <SchedulePrintModal
        isOpen={true}
        onClose={vi.fn()}
        store={mockStore}
      />
    );

    const mergeToggle = screen.getByLabelText(/장기 일정 셀 하나로 병합하기/i);
    expect(mergeToggle).toBeChecked();

    // When mergeLongBlocks is enabled (default), the two contiguous items should merge into a single "수학 심화" block
    expect(screen.getAllByText('수학 심화')).toHaveLength(1);
    expect(screen.getByText('개념정리')).toBeInTheDocument();
    expect(screen.getByText('문제풀이')).toBeInTheDocument();

    // When toggling OFF mergeLongBlocks, the preprocessed virtual 9:30~12:00 item is rendered across individual slots
    fireEvent.click(mergeToggle);
    expect(mergeToggle).not.toBeChecked();
    expect(screen.getAllByText('수학 심화')).toHaveLength(2);
  });
});
