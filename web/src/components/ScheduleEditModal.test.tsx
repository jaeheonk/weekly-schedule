import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScheduleEditModal } from './ScheduleEditModal';
import { ScheduleStore } from '../domain/scheduleStore';

describe('ScheduleEditModal (Seam 2)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store = new ScheduleStore({ currentDate: new Date(2026, 10, 9) }); // 2026-W46 Monday
    store.unlockParentMode();
  });

  it('renders add mode with default fields and allows creating a new master schedule item', () => {
    const handleClose = vi.fn();
    render(
      <ScheduleEditModal
        isOpen={true}
        onClose={handleClose}
        store={store}
        defaultWeekday={1}
      />
    );

    expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();
    expect(screen.getByText('새 일정 등록')).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByTestId('schedule-title-input');
    fireEvent.change(titleInput, { target: { value: '영어 리딩 클럽' } });

    // Select category 'academy'
    const categoryBtn = screen.getByTestId('category-btn-academy');
    fireEvent.click(categoryBtn);

    // Select start and end times
    const startHourSelect = screen.getByTestId('start-hour-select');
    const startMinSelect = screen.getByTestId('start-minute-select');
    fireEvent.change(startHourSelect, { target: { value: '16' } });
    fireEvent.change(startMinSelect, { target: { value: '30' } });

    const endHourSelect = screen.getByTestId('end-hour-select');
    const endMinSelect = screen.getByTestId('end-minute-select');
    fireEvent.change(endHourSelect, { target: { value: '17' } });
    fireEvent.change(endMinSelect, { target: { value: '30' } });

    // Add a subtask
    const subtaskInput = screen.getByTestId('new-subtask-input');
    fireEvent.change(subtaskInput, { target: { value: 'Chapter 4 읽기' } });
    const addSubtaskBtn = screen.getByTestId('add-subtask-btn');
    fireEvent.click(addSubtaskBtn);

    expect(screen.getByText('Chapter 4 읽기')).toBeInTheDocument();

    // Submit form
    const saveBtn = screen.getByTestId('save-schedule-btn');
    fireEvent.click(saveBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    const mondayItems = store.getItemsForWeekday(1);
    const created = mondayItems.find((it) => it.title === '영어 리딩 클럽');
    expect(created).toBeDefined();
    expect(created?.category).toBe('academy');
    expect(created?.startHour).toBe(16);
    expect(created?.startMinute).toBe(30);
    expect(created?.endHour).toBe(17);
    expect(created?.endMinute).toBe(30);
    expect(created?.subTasks.length).toBe(1);
  });

  it('populates fields in edit mode and allows saving as a this-week override', () => {
    const existingItem = store.getItemsForWeekday(1)[0];
    const handleClose = vi.fn();

    render(
      <ScheduleEditModal
        isOpen={true}
        onClose={handleClose}
        initialItem={existingItem}
        store={store}
      />
    );

    expect(screen.getByText(/기본 시간표 편집|이번 주 조정/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(existingItem.title)).toBeInTheDocument();

    // Switch scope to 'thisWeek'
    const thisWeekRadio = screen.getByTestId('scope-this-week-radio');
    fireEvent.click(thisWeekRadio);

    // Change start hour to 18
    const startHourSelect = screen.getByTestId('start-hour-select');
    fireEvent.change(startHourSelect, { target: { value: '18' } });

    // Save
    const saveBtn = screen.getByTestId('save-schedule-btn');
    fireEvent.click(saveBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    // Verify this week override
    expect(store.isAdjustedThisWeek(existingItem)).toBe(true);
    expect(store.adjustmentBadgeText(existingItem)).toContain('이번 주 시간 조정');
  });

  it('allows skipping (cancelling) this week directly from edit modal', () => {
    const existingItem = store.getItemsForWeekday(1)[0];
    const handleClose = vi.fn();

    render(
      <ScheduleEditModal
        isOpen={true}
        onClose={handleClose}
        initialItem={existingItem}
        store={store}
      />
    );

    const skipBtn = screen.getByTestId('skip-this-week-btn');
    fireEvent.click(skipBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(store.isSkippedThisWeek(existingItem.id)).toBe(true);
  });

  it('shows restore button when item has an active override and restores it', () => {
    const existingItem = store.getItemsForWeekday(1)[0];
    store.skipItemForThisWeek(existingItem);
    expect(store.isSkippedThisWeek(existingItem.id)).toBe(true);

    const handleClose = vi.fn();
    render(
      <ScheduleEditModal
        isOpen={true}
        onClose={handleClose}
        initialItem={existingItem}
        store={store}
      />
    );

    const restoreBtn = screen.getByTestId('revert-override-btn');
    expect(restoreBtn).toBeInTheDocument();
    fireEvent.click(restoreBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(store.isSkippedThisWeek(existingItem.id)).toBe(false);
  });

  it('allows permanently deleting master schedule item', () => {
    const existingItem = store.getItemsForWeekday(1)[0];
    const handleClose = vi.fn();

    render(
      <ScheduleEditModal
        isOpen={true}
        onClose={handleClose}
        initialItem={existingItem}
        store={store}
      />
    );

    const deleteBtn = screen.getByTestId('delete-schedule-btn');
    fireEvent.click(deleteBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(store.getItems().some((it) => it.id === existingItem.id)).toBe(false);
  });
});
