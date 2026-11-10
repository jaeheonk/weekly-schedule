import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    expect(resetBtn).toHaveTextContent('이번주 조정 초기화');
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
    expect(mockOpenEdit).toHaveBeenCalledWith(null, 1, 'thisWeek');

    // Edit item button on card
    const editBtn = screen.getByTestId(`weekly-edit-item-btn-${mondayItem.id}`);
    fireEvent.click(editBtn);
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday, 'thisWeek');

    // Clicking the card body itself also triggers onOpenEditModal
    mockOpenEdit.mockClear();
    const mondayCard = editBtn.closest('.group') as HTMLElement;
    expect(mondayCard).toBeInTheDocument();
    fireEvent.click(mondayCard);
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday, 'thisWeek');
  });

  it('renders scope switcher bar with initial thisWeek scope and toggles to master scope', () => {
    render(<WeeklyGridView currentWeekday={1} store={store} />);

    const masterBtn = screen.getByTestId('weekly-scope-master-btn');
    const thisWeekBtn = screen.getByTestId('weekly-scope-thisweek-btn');

    expect(masterBtn).toBeInTheDocument();
    expect(thisWeekBtn).toBeInTheDocument();
    expect(masterBtn).toHaveTextContent(/전체 기본 시간표/);
    expect(thisWeekBtn).toHaveTextContent(/이번 주 적용 시간표/);

    // Initial sub-banner in thisWeek scope
    const subBanner = screen.getByTestId('weekly-scope-subbanner');
    expect(subBanner).toHaveTextContent(/이번 주에만 일시 조정된 시간표입니다/);

    // Switch to Master Scope
    fireEvent.click(masterBtn);
    expect(subBanner).toHaveTextContent(/칸을 탭하면 매주 반복되는 전체 기본 스케줄이 영구적으로 변경됩니다/);

    // Switch back to This Week Scope
    fireEvent.click(thisWeekBtn);
    expect(subBanner).toHaveTextContent(/이번 주에만 일시 조정된 시간표입니다/);
  });

  it('in master scope: hides temporary additions and dashed cards, but shows skipped strikethrough & modified badges', () => {
    store.unlockParentMode();
    const mondayItem = store.getItemsForWeekday(1)[0];
    const tuesdayItem = store.getItemsForWeekday(2)[0];

    // Skip Monday item for this week
    store.skipItemForThisWeek(mondayItem);

    // Update Tuesday item for this week
    store.updateItem({ ...tuesdayItem, startHour: 19 }, 'thisWeek');

    // Add this-week-only item on Wednesday
    store.addItem(
      {
        id: 'this-week-only-wed',
        title: '수요일 특별 특강',
        category: 'study',
        weekday: 3,
        startHour: 16,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        note: '',
        iconName: 'book.fill',
        subTasks: [],
        isNotificationEnabled: true,
        notificationLeadMinutes: [10],
        targetWeekKey: null,
        updatedAt: Date.now() / 1000,
      },
      [3],
      'thisWeek'
    );

    render(<WeeklyGridView currentWeekday={1} store={store} />);

    // 1. In default thisWeek scope:
    // Temporary item is visible
    expect(screen.getByText('수요일 특별 특강')).toBeInTheDocument();
    // Monday skipped item is shown as dashed card
    expect(screen.getByTestId(`weekly-skipped-card-${mondayItem.id}`)).toBeInTheDocument();

    // 2. Switch to master scope
    const masterBtn = screen.getByTestId('weekly-scope-master-btn');
    fireEvent.click(masterBtn);

    // Temporary addition is NOT visible in master scope
    expect(screen.queryByText('수요일 특별 특강')).not.toBeInTheDocument();
    // Monday dashed card is NOT shown in master scope
    expect(screen.queryByTestId(`weekly-skipped-card-${mondayItem.id}`)).not.toBeInTheDocument();

    // Monday master item is still in grid, but marked as skipped
    const mondayCardBadge = screen.getByTestId(`weekly-adjustment-badge-${mondayItem.id}`);
    expect(mondayCardBadge).toHaveTextContent('이번 주 휴강');
    expect(mondayCardBadge).toHaveClass('bg-amber-500');

    // Monday item title has line-through
    const mondayCol = screen.getByTestId('weekly-col-월');
    expect(within(mondayCol).getByText(mondayItem.title)).toHaveClass('line-through');

    // Tuesday master item is marked as adjusted with orange badge and orange border highlight
    const tuesdayCardBadge = screen.getByTestId(`weekly-adjustment-badge-${tuesdayItem.id}`);
    expect(tuesdayCardBadge).toHaveTextContent('이번 주 조정됨');
    expect(tuesdayCardBadge).toHaveClass('bg-amber-500');
    const tuesdayCard = tuesdayCardBadge.closest('.group') as HTMLElement;
    expect(tuesdayCard.style.borderColor).toBe('rgb(245, 158, 11)');

    // Monday skipped card does NOT receive orange border highlight
    const mondayCard = mondayCardBadge.closest('.group') as HTMLElement;
    expect(mondayCard.style.borderColor).not.toBe('rgb(245, 158, 11)');
  });

  it('in child mode: allows scope switching but hides add/edit buttons and reset button', () => {
    // Lock store to Child Mode
    store.lockParentMode();

    const mondayItem = store.getItemsForWeekday(1)[0];
    store.updateItem({ ...mondayItem, startHour: 19 }, 'thisWeek');

    render(<WeeklyGridView currentWeekday={1} store={store} />);

    // Scope switcher is visible and functional
    const masterBtn = screen.getByTestId('weekly-scope-master-btn');
    const thisWeekBtn = screen.getByTestId('weekly-scope-thisweek-btn');
    expect(masterBtn).toBeInTheDocument();
    expect(thisWeekBtn).toBeInTheDocument();

    fireEvent.click(masterBtn);
    expect(screen.getByTestId('weekly-scope-subbanner')).toHaveTextContent(/전체 기본 스케줄이 영구적으로 변경됩니다/);

    // Administrative controls are hidden
    expect(screen.queryByTestId('weekly-add-item-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`weekly-edit-item-btn-${mondayItem.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reset-weekly-adjustments-btn')).not.toBeInTheDocument();
  });

  it('passes active scope to onOpenEditModal and onOpenPrint', () => {
    store.unlockParentMode();
    const mockOpenEdit = vi.fn();
    const mockOpenPrint = vi.fn();
    const mondayItem = store.getItemsForWeekday(1)[0];

    render(
      <WeeklyGridView
        currentWeekday={1}
        store={store}
        onOpenEditModal={mockOpenEdit}
        onOpenPrint={mockOpenPrint}
      />
    );

    // In default thisWeek scope:
    fireEvent.click(screen.getByTestId('weekly-print-btn'));
    expect(mockOpenPrint).toHaveBeenCalledWith('thisWeek');

    // Switch to master scope
    fireEvent.click(screen.getByTestId('weekly-scope-master-btn'));

    // Print in master scope
    fireEvent.click(screen.getByTestId('weekly-print-btn'));
    expect(mockOpenPrint).toHaveBeenCalledWith('master');

    // Add item in master scope
    fireEvent.click(screen.getByTestId('weekly-add-item-btn'));
    expect(mockOpenEdit).toHaveBeenCalledWith(null, 1, 'master');

    // Edit item in master scope
    fireEvent.click(screen.getByTestId(`weekly-edit-item-btn-${mondayItem.id}`));
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday, 'master');
  });

  it('triggers onOpenEditModal with thisWeek scope when parent clicks dashed card or its edit button', () => {
    store.unlockParentMode();
    const mockOpenEdit = vi.fn();
    const mondayItem = store.getItemsForWeekday(1)[0];
    store.skipItemForThisWeek(mondayItem);

    render(
      <WeeklyGridView
        currentWeekday={1}
        store={store}
        onOpenEditModal={mockOpenEdit}
      />
    );

    // Edit button on dashed card
    const skippedCard = screen.getByTestId(`weekly-skipped-card-${mondayItem.id}`);
    const editBtn = within(skippedCard).getByTestId(`weekly-edit-item-btn-${mondayItem.id}`);
    fireEvent.click(editBtn);
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday, 'thisWeek');

    // Clicking dashed card body directly
    mockOpenEdit.mockClear();
    fireEvent.click(skippedCard);
    expect(mockOpenEdit).toHaveBeenCalledWith(mondayItem, mondayItem.weekday, 'thisWeek');
  });
});
