import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayScheduleView } from './TodayScheduleView';
import { ScheduleStore } from '../domain/scheduleStore';

describe('TodayScheduleView Child Mode Checklist & Progress (Seam 3)', () => {
  let store: ScheduleStore;
  const mockPlayChime = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    mockPlayChime.mockClear();
    // Fixed test date: Monday Nov 9, 2026 (2026-W46)
    store = new ScheduleStore({ currentDate: new Date(2026, 10, 9) });
  });

  it('renders progress bar and completion statistics card', () => {
    const todayItems = store.getTodayItems();
    render(
      <TodayScheduleView
        items={todayItems}
        weekdayName="월요일"
        store={store}
        onPlayChime={mockPlayChime}
      />
    );

    expect(screen.getByTestId('progress-gauge-card')).toBeInTheDocument();
    expect(screen.getByTestId('progress-percentage-text')).toHaveTextContent('0%');
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '0%' });
  });

  it('toggles item completion and plays chime sound when clicking check button', () => {
    const todayItems = store.getTodayItems();
    const checkableItem = todayItems.find((i) => i.category === 'study' && i.subTasks.length > 0)!;
    expect(checkableItem).toBeDefined();

    render(
      <TodayScheduleView
        items={todayItems}
        weekdayName="월요일"
        store={store}
        onPlayChime={mockPlayChime}
      />
    );

    const checkBtn = screen.getByTestId(`item-check-btn-${checkableItem.id}`);
    expect(checkBtn).toBeInTheDocument();
    expect(checkBtn).toHaveAttribute('aria-checked', 'false');

    // Click to complete
    fireEvent.click(checkBtn);

    // Chime sound must be played
    expect(mockPlayChime).toHaveBeenCalledTimes(1);

    // Store state must be completed
    expect(store.isCompleted(checkableItem)).toBe(true);

    // Check button updated to checked
    expect(checkBtn).toHaveAttribute('aria-checked', 'true');

    // Progress bar must update
    const stats = store.getCompletionStats(1);
    expect(screen.getByTestId('progress-percentage-text')).toHaveTextContent(`${stats.percentage}%`);
  });

  it('toggles individual subtasks and plays chime sound', () => {
    const todayItems = store.getTodayItems();
    const itemWithSubtasks = todayItems.find((i) => i.subTasks.length >= 2)!;
    const [sub1] = itemWithSubtasks.subTasks;

    render(
      <TodayScheduleView
        items={todayItems}
        weekdayName="월요일"
        store={store}
        onPlayChime={mockPlayChime}
      />
    );

    const subCheckBtn = screen.getByTestId(`subtask-check-btn-${sub1.id}`);
    expect(subCheckBtn).toBeInTheDocument();
    expect(subCheckBtn).toHaveAttribute('aria-checked', 'false');

    // Click subtask checkbox
    fireEvent.click(subCheckBtn);

    expect(mockPlayChime).toHaveBeenCalledTimes(1);
    expect(store.isSubTaskCompleted(sub1)).toBe(true);
    expect(subCheckBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('protects parent-verified items from being unchecked and shows notice', () => {
    const todayItems = store.getTodayItems();
    const studyItem = todayItems.find((i) => i.category === 'study')!;

    // Child completes item first
    store.toggleCompletion(studyItem);
    // Parent verifies item
    store.setParentVerified(studyItem.id, true);

    render(
      <TodayScheduleView
        items={todayItems}
        weekdayName="월요일"
        store={store}
        onPlayChime={mockPlayChime}
      />
    );

    const checkBtn = screen.getByTestId(`item-check-btn-${studyItem.id}`);
    expect(checkBtn).toBeInTheDocument();
    expect(checkBtn).toHaveAttribute('data-verified', 'true');

    // Child attempts to click/uncheck verified item
    fireEvent.click(checkBtn);

    // Chime sound must NOT be played on rejected click
    expect(mockPlayChime).not.toHaveBeenCalled();

    // Item must remain completed and verified
    expect(store.isCompleted(studyItem)).toBe(true);
    expect(store.isParentVerified(studyItem)).toBe(true);

    // Protection notice must be visible
    expect(screen.getByTestId('parent-verified-notice')).toBeInTheDocument();
    expect(screen.getByTestId('parent-verified-notice')).toHaveTextContent(/부모님이 확인 완료한 숙제는 변경할 수 없어요/i);
  });

  it('renders non-checkable items (routine/free) without completion check buttons', () => {
    const todayItems = store.getTodayItems();
    const routineItem = todayItems.find((i) => i.category === 'routine')!;
    expect(routineItem).toBeDefined();

    render(
      <TodayScheduleView
        items={todayItems}
        weekdayName="월요일"
        store={store}
        onPlayChime={mockPlayChime}
      />
    );

    expect(screen.queryByTestId(`item-check-btn-${routineItem.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`item-badge-${routineItem.id}`)).toBeInTheDocument();
  });
});
