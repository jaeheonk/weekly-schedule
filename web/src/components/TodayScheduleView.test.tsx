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

  describe('Parent Mode Controls & Praise Hearts (Seam 4 / Issue 04)', () => {
    it('renders family praise banner when store has praise notes', () => {
      store.sendFamilyPraise({
        hearts: 3,
        sticker: 'heart',
        message: '오늘도 약속 지킨 우리 아이 최고! ⭐',
      });

      render(
        <TodayScheduleView
          items={store.getTodayItems()}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
        />
      );

      const banner = screen.getByTestId('family-praise-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('오늘도 약속 지킨 우리 아이 최고! ⭐');
      expect(banner).toHaveTextContent('+3');
    });

    it('renders parent stamp buttons and praise trigger in parent mode', () => {
      store.unlockParentMode();
      const mockOpenPraise = vi.fn();
      const todayItems = store.getTodayItems();
      const checkable = todayItems.find((i) => store.isItemCheckable(i) && i.subTasks.length > 0)!;

      // Child completes the item first
      store.toggleCompletion(checkable);

      render(
        <TodayScheduleView
          items={todayItems}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
          onOpenPraiseModal={mockOpenPraise}
        />
      );

      // Top action button in parent mode
      expect(screen.getByTestId('send-family-praise-btn')).toBeInTheDocument();

      // Parent stamp button on checkable item
      const stampBtn = screen.getByTestId(`item-parent-stamp-btn-${checkable.id}`);
      expect(stampBtn).toBeInTheDocument();

      // Click stamp button stamps the item
      fireEvent.click(stampBtn);
      expect(store.isParentVerified(checkable)).toBe(true);

      // Parent praise button triggers callback
      const praiseBtn = screen.getByTestId(`item-praise-btn-${checkable.id}`);
      expect(praiseBtn).toBeInTheDocument();
      fireEvent.click(praiseBtn);
      expect(mockOpenPraise).toHaveBeenCalledWith(checkable);
    });

    it('renders reaction badge with sticker, hearts, and comment on schedule card', () => {
      const todayItems = store.getTodayItems();
      const checkable = todayItems.find((i) => store.isItemCheckable(i))!;

      store.sendItemReaction({
        item: checkable,
        addHearts: 5,
        sticker: 'crown',
        comment: '오늘의 숙제 챔피언! 👑',
      });

      render(
        <TodayScheduleView
          items={todayItems}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
        />
      );

      const reactionBadge = screen.getByTestId(`item-reaction-badge-${checkable.id}`);
      expect(reactionBadge).toBeInTheDocument();
      expect(reactionBadge).toHaveTextContent('+5');
      expect(reactionBadge).toHaveTextContent('오늘의 숙제 챔피언! 👑');
    });

    it('renders adjustment badges, parent edit buttons, and skipped items section (Issue 05)', () => {
      store.unlockParentMode();
      const mockOpenEdit = vi.fn();
      const todayItems = store.getTodayItems();
      const item1 = todayItems[0];
      const item2 = todayItems[1];

      // Modify item1 time for this week
      store.updateItem({ ...item1, startHour: 19 }, 'thisWeek');

      // Skip item2 for this week
      store.skipItemForThisWeek(item2);

      const effectiveItems = store.getTodayItems();
      expect(effectiveItems.some((it) => it.id === item2.id)).toBe(false);

      render(
        <TodayScheduleView
          items={effectiveItems}
          weekdayName="월요일"
          store={store}
          onOpenEditModal={mockOpenEdit}
        />
      );

      // Adjustment badge on modified item1
      const badge = screen.getByTestId(`item-adjustment-badge-${item1.id}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/이번 주 시간 조정/i);

      // Edit button on item1
      const editBtn = screen.getByTestId(`item-edit-btn-${item1.id}`);
      fireEvent.click(editBtn);
      const modifiedItem1 = effectiveItems.find((it) => it.id === item1.id);
      expect(mockOpenEdit).toHaveBeenCalledWith(modifiedItem1);

      // Top action add schedule button
      const addBtn = screen.getByTestId('today-add-schedule-btn');
      fireEvent.click(addBtn);
      expect(mockOpenEdit).toHaveBeenCalledWith(null);

      // Skipped item2 rendered in skipped items section
      expect(screen.getByTestId('today-skipped-items-section')).toBeInTheDocument();
      const restoreBtn = screen.getByTestId(`restore-skipped-btn-${item2.id}`);
      expect(restoreBtn).toBeInTheDocument();

      // Click restore
      fireEvent.click(restoreBtn);
      expect(store.isSkippedThisWeek(item2.id)).toBe(false);
    });

    it('renders "하트 보상 교환" button in hero card and calls onOpenRewardExchange when clicked', () => {
      const mockOpenReward = vi.fn();
      store.sendFamilyPraise({
        hearts: 15,
        sticker: 'heart',
        message: '응원 하트!',
      });
      expect(store.getAvailableHearts()).toBe(15);

      render(
        <TodayScheduleView
          items={store.getTodayItems()}
          weekdayName="월요일"
          store={store}
          onOpenRewardExchange={mockOpenReward}
        />
      );

      // Hero card contains the exchange button
      const heroCard = screen.getByTestId('progress-gauge-card');
      const exchangeBtn = screen.getByTestId('today-hero-reward-exchange-btn');
      expect(heroCard).toContainElement(exchangeBtn);
      expect(exchangeBtn).toHaveTextContent('하트 보상 교환');
      expect(exchangeBtn).toHaveTextContent('15');

      // Clicking triggers callback
      fireEvent.click(exchangeBtn);
      expect(mockOpenReward).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mon-Sun Weekday Selector Bar & Stamp Board Sync (Issue 01)', () => {
    it('renders 7-column Mon-Sun weekday selector bar with 3-tier labels, weekend colors, and status indicators', () => {
      // Monday Nov 9, 2026 is actual today (1)
      store.unlockParentMode();

      // 1. Monday (1): actual today -> top label "오늘", award star -> bottom status "star-awarded"
      const monItems = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
      for (const item of monItems) {
        store.toggleCompletion(item);
        store.toggleParentVerification(item);
      }
      store.awardDailyStar(1);

      // 2. Tuesday (2): all verified -> claimable -> top label "수여", bottom status "star-claimable"
      const tueItems = store.getItemsForWeekday(2).filter((it) => store.isItemCheckable(it));
      for (const item of tueItems) {
        store.toggleCompletion(item);
        store.toggleParentVerification(item);
      }

      // 3. Wednesday (3): all child completed (unverified) -> bottom status "all-completed", plus 1 adjustment -> top label "조정"
      const wedItems = store.getItemsForWeekday(3).filter((it) => store.isItemCheckable(it));
      for (const item of wedItems) {
        store.toggleCompletion(item);
      }
      store.updateItem({ ...wedItems[0], startHour: 20, endHour: 21 }, 'thisWeek');

      // 4. Thursday (4): 1 item completed -> bottom status "in-progress"
      const thuItems = store.getItemsForWeekday(4).filter((it) => store.isItemCheckable(it));
      store.toggleCompletion(thuItems[0]);

      // 5. Saturday (6): all checkable items parent-verified (weekend excluded from stars) -> bottom status "all-verified"
      const satItems = store.getItemsForWeekday(6).filter((it) => store.isItemCheckable(it));
      for (const item of satItems) {
        store.toggleCompletion(item);
        store.toggleParentVerification(item);
      }

      render(
        <TodayScheduleView
          items={store.getTodayItems()}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
        />
      );

      const selectorBar = screen.getByTestId('weekday-selector-bar');
      expect(selectorBar).toBeInTheDocument();
      expect(selectorBar.className).toContain('grid-cols-7');

      // All 7 weekday buttons exist
      for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
        expect(screen.getByTestId(`weekday-btn-${d}`)).toBeInTheDocument();
      }

      // Top micro-labels
      expect(screen.getByTestId('weekday-top-label-1')).toHaveTextContent('오늘');
      expect(screen.getByTestId('weekday-top-label-2')).toHaveTextContent('수여');
      expect(screen.getByTestId('weekday-top-label-3')).toHaveTextContent('조정');

      // Weekend text colors when unselected
      expect(screen.getByTestId('weekday-short-name-6').className).toContain('text-blue-600');
      expect(screen.getByTestId('weekday-short-name-7').className).toMatch(/text-(red|rose)-/);

      // Selected day (1) has white text
      expect(screen.getByTestId('weekday-short-name-1').className).toContain('text-white');

      // Bottom status indicators
      expect(screen.getByTestId('weekday-status-indicator-1')).toHaveAttribute(
        'data-status',
        'star-awarded'
      );
      expect(screen.getByTestId('weekday-status-indicator-2')).toHaveAttribute(
        'data-status',
        'star-claimable'
      );
      expect(screen.getByTestId('weekday-status-indicator-3')).toHaveAttribute(
        'data-status',
        'all-completed'
      );
      expect(screen.getByTestId('weekday-status-indicator-4')).toHaveAttribute(
        'data-status',
        'in-progress'
      );
      expect(screen.getByTestId('weekday-status-indicator-6')).toHaveAttribute(
        'data-status',
        'all-verified'
      );
    });

    it('switches Daily Schedule items when selecting another weekday, shows "오늘" button, and synchronizes with WeeklyStarStampBoardCard', () => {
      render(
        <TodayScheduleView
          items={store.getTodayItems()}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
        />
      );

      // Initially on Monday (today): "오늘" back button is hidden
      expect(screen.queryByTestId('back-to-today-btn')).not.toBeInTheDocument();

      // Switch to Friday (5) via WeekdaySelectorBar
      fireEvent.click(screen.getByTestId('weekday-btn-5'));
      expect(store.getSelectedWeekday()).toBe(5);

      // "오늘" button is now visible
      const backToTodayBtn = screen.getByTestId('back-to-today-btn');
      expect(backToTodayBtn).toBeInTheDocument();
      expect(backToTodayBtn).toHaveTextContent('오늘');

      // Expand WeeklyStarStampBoardCard and verify Friday slot is highlighted
      fireEvent.click(screen.getByText('평일 스타'));
      expect(screen.getByTestId('stamp-slot-5')).toHaveAttribute('data-selected', 'true');

      // Tap Wednesday (3) slot in WeeklyStarStampBoardCard -> switches selectedWeekday to 3
      fireEvent.click(screen.getByTestId('stamp-slot-3'));
      expect(store.getSelectedWeekday()).toBe(3);
      expect(screen.getByTestId('weekday-btn-3')).toHaveAttribute('data-selected', 'true');

      // Tap Sunday (7) in WeekdaySelectorBar -> shows weekend exclusion notice in expanded stamp board
      fireEvent.click(screen.getByTestId('weekday-btn-7'));
      expect(store.getSelectedWeekday()).toBe(7);
      expect(screen.getByTestId('stamp-board-weekend-notice')).toHaveTextContent(
        '주말(토·일)은 자유 일정으로 평일 스타 적립 대상에서 제외돼요.'
      );

      // Click "오늘" button -> returns immediately to Monday (1)
      fireEvent.click(screen.getByTestId('back-to-today-btn'));
      expect(store.getSelectedWeekday()).toBe(1);
      expect(screen.queryByTestId('back-to-today-btn')).not.toBeInTheDocument();
    });

    it('allows completing items/subtasks, stamping parent verification, and sending Praise Hearts on non-today weekdays including weekends', () => {
      store.unlockParentMode();
      const mockOpenPraise = vi.fn();

      render(
        <TodayScheduleView
          items={store.getTodayItems()}
          weekdayName="월요일"
          store={store}
          onPlayChime={mockPlayChime}
          onOpenPraiseModal={mockOpenPraise}
        />
      );

      // Switch to Saturday (6)
      fireEvent.click(screen.getByTestId('weekday-btn-6'));
      expect(store.getSelectedWeekday()).toBe(6);

      const satCheckable = store
        .getItemsForWeekday(6)
        .find((it) => store.isItemCheckable(it))!;
      expect(satCheckable).toBeDefined();

      // Complete item on Saturday
      const checkBtn = screen.getByTestId(`item-check-btn-${satCheckable.id}`);
      fireEvent.click(checkBtn);
      expect(store.isCompleted(satCheckable)).toBe(true);
      expect(mockPlayChime).toHaveBeenCalledTimes(1);

      // Stamp parent verification on Saturday
      const stampBtn = screen.getByTestId(`item-parent-stamp-btn-${satCheckable.id}`);
      fireEvent.click(stampBtn);
      expect(store.isParentVerified(satCheckable)).toBe(true);

      // Unstamp parent verification on Saturday
      fireEvent.click(stampBtn);
      expect(store.isParentVerified(satCheckable)).toBe(false);

      // Send Praise Heart on Saturday item
      const praiseBtn = screen.getByTestId(`item-praise-btn-${satCheckable.id}`);
      fireEvent.click(praiseBtn);
      expect(mockOpenPraise).toHaveBeenCalledWith(satCheckable);
    });
  });
});
