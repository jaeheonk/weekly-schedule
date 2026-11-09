import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyGridView } from './WeeklyGridView';
import { ScheduleStore } from '../domain/scheduleStore';

describe('WeeklyGridView & Weekly Overrides Display (Seam 3)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    store = new ScheduleStore({ currentDate: new Date(2026, 10, 9) }); // 2026-W46 Monday
  });

  it('renders weekly columns with days and item cards', () => {
    render(<WeeklyGridView currentWeekday={1} store={store} />);

    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-col-월')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-col-일')).toBeInTheDocument();
  });

  it('displays adjustment badge on items modified for this week', () => {
    const mondayItem = store.getItemsForWeekday(1)[0];
    store.updateItem({ ...mondayItem, startHour: 19 }, 'thisWeek');

    render(<WeeklyGridView currentWeekday={1} store={store} />);

    const badge = screen.getByTestId(`weekly-adjustment-badge-${mondayItem.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/이번 주 시간 조정/i);
  });

  it('displays skipped items on their day column with skipped badge', () => {
    const mondayItem = store.getItemsForWeekday(1)[0];
    store.skipItemForThisWeek(mondayItem);

    render(<WeeklyGridView currentWeekday={1} store={store} />);

    const skippedCard = screen.getByTestId(`weekly-skipped-card-${mondayItem.id}`);
    expect(skippedCard).toBeInTheDocument();
    expect(screen.getByTestId(`weekly-adjustment-badge-${mondayItem.id}`)).toHaveTextContent(/이번 주 휴강·제외/);
  });

  it('displays reset button when adjustments exist in parent mode and resets them', () => {
    store.unlockParentMode();
    const mondayItem = store.getItemsForWeekday(1)[0];
    store.updateItem({ ...mondayItem, startHour: 19 }, 'thisWeek');

    expect(store.getCurrentWeekAdjustmentCount()).toBe(1);

    render(<WeeklyGridView currentWeekday={1} store={store} />);

    const resetBanner = screen.getByTestId('weekly-adjustments-banner');
    expect(resetBanner).toBeInTheDocument();
    expect(resetBanner).toHaveTextContent('1건');

    const resetBtn = screen.getByTestId('reset-weekly-adjustments-btn');
    fireEvent.click(resetBtn);

    expect(store.getCurrentWeekAdjustmentCount()).toBe(0);
  });

  it('triggers onOpenEditModal when parent clicks add item or item card in parent mode', () => {
    store.unlockParentMode();
    const mockOpenEdit = vi.fn();
    const mondayItem = store.getItemsForWeekday(1)[0];

    render(
      <WeeklyGridView
        currentWeekday={1}
        store={store}
        onOpenEditModal={mockOpenEdit}
      />
    );

    // Header add button
    const addBtn = screen.getByTestId('weekly-add-item-btn');
    fireEvent.click(addBtn);
    expect(mockOpenEdit).toHaveBeenCalledWith(null, 1);

    // Edit item button on card
    const editBtn = screen.getByTestId(`weekly-edit-item-btn-${mondayItem.id}`);
    fireEvent.click(editBtn);
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday);
  });
});
