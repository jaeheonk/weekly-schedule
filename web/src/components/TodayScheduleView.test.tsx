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

  describe('Live Status Hero Card & Real-Time Active Timeline (Issue 02)', () => {
    it('keeps hero card pinned to actual today stats/date/slogan and integrates reward exchange, send praise, and family praise banner inside the hero card even when browsing another weekday', () => {
      // Monday Nov 9, 2026 14:40
      store.setCurrentDate(new Date(2026, 10, 9, 14, 40, 0));
      store.unlockParentMode();
      const mockOpenReward = vi.fn();
      const mockOpenPraise = vi.fn();

      // Complete 1 item on actual today (Monday = 1) and verify it
      const monCheckables = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
      store.toggleCompletion(monCheckables[0]);
      store.toggleParentVerification(monCheckables[0]);
      const monStats = store.getCompletionStats(1);

      // Add a family praise note (+7 hearts)
      store.sendFamilyPraise({
        hearts: 7,
        sticker: 'star',
        message: '오늘도 화이팅! 엄마 아빠가 응원해 🌟',
      });

      render(
        <TodayScheduleView
          store={store}
          onPlayChime={mockPlayChime}
          onOpenRewardExchange={mockOpenReward}
          onOpenPraiseModal={mockOpenPraise}
        />
      );

      const heroCard = screen.getByTestId('progress-gauge-card');
      expect(heroCard).toHaveTextContent('11월 9일 월요일');
      expect(screen.getByTestId('progress-percentage-text')).toHaveTextContent(
        `${monStats.percentage}%`
      );
      expect(screen.getByTestId('stats-completed-badge')).toHaveTextContent(
        `다 했어요 ${monStats.completed}/${monStats.total}`
      );
      expect(screen.getByTestId('stats-verified-badge')).toHaveTextContent(
        `부모확인 ${monStats.verified}/${monStats.total}`
      );

      // Reward exchange button, send praise button, and family praise banner are integrated inside heroCard
      const exchangeBtn = screen.getByTestId('today-hero-reward-exchange-btn');
      const sendPraiseBtn = screen.getByTestId('send-family-praise-btn');
      const praiseBanner = screen.getByTestId('family-praise-banner');
      expect(heroCard).toContainElement(exchangeBtn);
      expect(heroCard).toContainElement(sendPraiseBtn);
      expect(heroCard).toContainElement(praiseBanner);
      expect(exchangeBtn).toHaveTextContent('7');
      expect(praiseBanner).toHaveTextContent('오늘도 화이팅! 엄마 아빠가 응원해 🌟');

      // Switch to Thursday (4) and complete a Thursday item via UI
      fireEvent.click(screen.getByTestId('weekday-btn-4'));
      expect(store.getSelectedWeekday()).toBe(4);
      const thuCheckable = store.getItemsForWeekday(4).find((it) => store.isItemCheckable(it))!;
      fireEvent.click(screen.getByTestId(`item-check-btn-${thuCheckable.id}`));

      // Hero card MUST still show Monday (actual today) date, percentage, completed/verified counts, and slogan
      expect(heroCard).toHaveTextContent('11월 9일 월요일');
      expect(screen.getByTestId('progress-percentage-text')).toHaveTextContent(
        `${monStats.percentage}%`
      );
      expect(screen.getByTestId('stats-completed-badge')).toHaveTextContent(
        `다 했어요 ${monStats.completed}/${monStats.total}`
      );
      expect(screen.getByTestId('stats-verified-badge')).toHaveTextContent(
        `부모확인 ${monStats.verified}/${monStats.total}`
      );
      expect(heroCard).toHaveTextContent('차근차근 멋지게 해내고 있어요! 👏');
    });

    it('displays real-time "지금 하는 일" and "다음 일정" in hero card with time range and completion status, and switches back to today and focuses the item when clicked from another weekday', () => {
      // Monday Nov 9, 2026 at 15:20:
      // Active item: 15:00~16:00 "Vocabulary for Reading + 100 Words"
      // Next item:   16:00~17:00 "바이올린"
      store.setCurrentDate(new Date(2026, 10, 9, 15, 20, 0));

      const activeItem = store.getCurrentActiveItems()[0];
      const nextItem = store.getNextUpcomingItem()!;
      expect(activeItem.title).toBe('Vocabulary for Reading + 100 Words');
      expect(nextItem.title).toBe('바이올린');

      // Mark active item as completed by child
      store.toggleCompletion(activeItem);

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      const heroCard = screen.getByTestId('progress-gauge-card');
      const activeRow = screen.getByTestId('hero-current-active-item');
      const nextRow = screen.getByTestId('hero-next-upcoming-item');

      expect(heroCard).toContainElement(activeRow);
      expect(heroCard).toContainElement(nextRow);

      // Verify "지금 하는 일" content: label, title, time range (오후 3시 ~ 오후 4시), and completion status
      expect(activeRow).toHaveTextContent('지금 하는 일');
      expect(activeRow).toHaveTextContent('Vocabulary for Reading + 100 Words');
      expect(activeRow).toHaveTextContent('오후 3시 ~ 오후 4시');
      expect(activeRow).toHaveTextContent('다 했어요 완료');

      // Verify "다음 일정" content: label, title, time range (오후 4시 ~ 오후 5시)
      expect(nextRow).toHaveTextContent('다음 일정');
      expect(nextRow).toHaveTextContent('바이올린');
      expect(nextRow).toHaveTextContent('오후 4시 ~ 오후 5시');

      // Switch to Friday (5)
      fireEvent.click(screen.getByTestId('weekday-btn-5'));
      expect(store.getSelectedWeekday()).toBe(5);
      expect(screen.queryByTestId(`schedule-card-${activeItem.id}`)).not.toBeInTheDocument();

      // Hero card still shows Monday's active and next items while viewing Friday
      expect(screen.getByTestId('hero-current-active-item')).toHaveTextContent(
        'Vocabulary for Reading + 100 Words'
      );
      expect(screen.getByTestId('hero-next-upcoming-item')).toHaveTextContent('바이올린');

      // Click "지금 하는 일" in hero card while viewing Friday -> switches to Monday (1) and focuses activeItem card
      fireEvent.click(screen.getByTestId('hero-current-active-item'));
      expect(store.getSelectedWeekday()).toBe(1);
      const activeCard = screen.getByTestId(`schedule-card-${activeItem.id}`);
      expect(activeCard).toBeInTheDocument();
      expect(activeCard).toHaveAttribute('data-focused', 'true');
      expect(document.activeElement).toBe(activeCard);

      // Switch to Wednesday (3), then click "다음 일정" in hero card -> switches to Monday (1) and focuses nextItem card
      fireEvent.click(screen.getByTestId('weekday-btn-3'));
      expect(store.getSelectedWeekday()).toBe(3);

      fireEvent.click(screen.getByTestId('hero-next-upcoming-item'));
      expect(store.getSelectedWeekday()).toBe(1);
      const nextCard = screen.getByTestId(`schedule-card-${nextItem.id}`);
      expect(nextCard).toBeInTheDocument();
      expect(nextCard).toHaveAttribute('data-focused', 'true');
      expect(document.activeElement).toBe(nextCard);
    });

    it('renders live "진행중" badge and active highlight border on timeline cards only when selectedWeekday === todayWeekday and within the item time range', () => {
      // Monday Nov 9, 2026 at 15:20
      store.setCurrentDate(new Date(2026, 10, 9, 15, 20, 0));

      const monActiveItem = store.getCurrentActiveItems()[0];
      const monInactiveItem = store.getNextUpcomingItem()!;
      const tueSameTimeItem = store
        .getItemsForWeekday(2)
        .find((it) => it.startHour === 15 && it.endHour === 16)!;

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      // Viewing actual today (Monday = 1):
      const activeCard = screen.getByTestId(`schedule-card-${monActiveItem.id}`);
      expect(activeCard).toHaveAttribute('data-active', 'true');
      expect(activeCard.className).toContain('ring-2');
      const activeBadge = screen.getByTestId(`item-active-badge-${monActiveItem.id}`);
      expect(activeBadge).toBeInTheDocument();
      expect(activeBadge).toHaveTextContent('진행중');

      // Non-active item on Monday does NOT have "진행중" badge or active highlight
      const inactiveCard = screen.getByTestId(`schedule-card-${monInactiveItem.id}`);
      expect(inactiveCard).toHaveAttribute('data-active', 'false');
      expect(screen.queryByTestId(`item-active-badge-${monInactiveItem.id}`)).not.toBeInTheDocument();

      // Switch to Tuesday (2) which also has a 15:00~16:00 item:
      fireEvent.click(screen.getByTestId('weekday-btn-2'));
      expect(store.getSelectedWeekday()).toBe(2);

      const tueCard = screen.getByTestId(`schedule-card-${tueSameTimeItem.id}`);
      expect(tueCard).toHaveAttribute('data-active', 'false');
      expect(tueCard.className).not.toContain('ring-2');
      expect(screen.queryByTestId(`item-active-badge-${tueSameTimeItem.id}`)).not.toBeInTheDocument();
      expect(screen.queryByText('진행중')).not.toBeInTheDocument();
    });
  });
});
