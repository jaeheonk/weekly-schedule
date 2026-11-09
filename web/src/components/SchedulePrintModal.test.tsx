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
});
