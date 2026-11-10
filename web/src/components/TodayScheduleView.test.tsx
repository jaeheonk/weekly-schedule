import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TodayScheduleView } from './TodayScheduleView';
import { ScheduleStore } from '../domain/scheduleStore';

describe('TodayScheduleView Child Mode Checklist & Progress (Seam 3)', () => {
  let store: ScheduleStore;
  const mockPlayChime = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
      expect(mockOpenEdit).toHaveBeenCalledWith(null, 1, 'thisWeek');

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

  describe('Category Filter Bar, Day Section Header & Batch Actions (Issue 03)', () => {
    it('renders CategoryFilterBar with "전체" and all 6 categories (icons, colors, item counts for selectedWeekday), filters Daily Schedule on chip click, and opens add modal with selectedWeekday + thisWeek scope from "+ 이번 주 추가" and empty state "이번 주 일정 추가하기"', () => {
      store.unlockParentMode();
      const mockOpenEdit = vi.fn();

      render(
        <TodayScheduleView
          store={store}
          onPlayChime={mockPlayChime}
          onOpenEditModal={mockOpenEdit}
        />
      );

      // Select Wednesday (3)
      fireEvent.click(screen.getByTestId('weekday-btn-3'));
      expect(store.getSelectedWeekday()).toBe(3);

      const wedItems = store.getItemsForWeekday(3);
      const wedStudyItems = wedItems.filter((it) => it.category === 'study');
      const wedMusicItems = wedItems.filter((it) => it.category === 'music');
      const wedFreeItems = wedItems.filter((it) => it.category === 'free');

      const filterBar = screen.getByTestId('category-filter-bar');
      expect(filterBar).toBeInTheDocument();

      // Verify "전체" chip and all 6 category chips with counts for Wednesday
      const allChip = screen.getByTestId('category-chip-all');
      expect(allChip).toHaveTextContent('전체');
      expect(screen.getByTestId('category-count-all')).toHaveTextContent(String(wedItems.length));
      expect(allChip).toHaveAttribute('data-selected', 'true');

      for (const catKey of ['study', 'academy', 'music', 'sports', 'routine', 'free'] as const) {
        const chip = screen.getByTestId(`category-chip-${catKey}`);
        expect(chip).toBeInTheDocument();
        expect(chip).toHaveAttribute('data-color');
        const expectedCount = wedItems.filter((it) => it.category === catKey).length;
        expect(screen.getByTestId(`category-count-${catKey}`)).toHaveTextContent(
          String(expectedCount)
        );
      }

      // Filter by 'music' on Wednesday -> only music items are rendered
      fireEvent.click(screen.getByTestId('category-chip-music'));
      expect(screen.getByTestId('category-chip-music')).toHaveAttribute('data-selected', 'true');
      for (const item of wedMusicItems) {
        expect(screen.getByTestId(`schedule-card-${item.id}`)).toBeInTheDocument();
      }
      for (const item of wedStudyItems) {
        expect(screen.queryByTestId(`schedule-card-${item.id}`)).not.toBeInTheDocument();
      }

      // Clicking "+ 이번 주 추가" opens modal with selectedWeekday = 3 and scope = 'thisWeek'
      const topAddBtn = screen.getByTestId('today-add-schedule-btn');
      expect(topAddBtn).toHaveTextContent('+ 이번 주 추가');
      fireEvent.click(topAddBtn);
      expect(mockOpenEdit).toHaveBeenLastCalledWith(null, 3, 'thisWeek');

      // Filter by 'free' on Wednesday (0 items on Wednesday) -> shows empty day state card
      expect(wedFreeItems).toHaveLength(0);
      fireEvent.click(screen.getByTestId('category-chip-free'));
      const emptyState = screen.getByTestId('today-empty-state');
      expect(emptyState).toBeInTheDocument();

      // Clicking "이번 주 일정 추가하기" in empty state opens modal with selectedWeekday = 3 and scope = 'thisWeek'
      const emptyAddBtn = screen.getByTestId('empty-day-add-schedule-btn');
      expect(emptyAddBtn).toHaveTextContent('이번 주 일정 추가하기');
      fireEvent.click(emptyAddBtn);
      expect(mockOpenEdit).toHaveBeenCalledTimes(2);
      expect(mockOpenEdit).toHaveBeenLastCalledWith(null, 3, 'thisWeek');

      // Clicking "전체" chip restores all Wednesday items
      fireEvent.click(allChip);
      expect(allChip).toHaveAttribute('data-selected', 'true');
      for (const item of wedItems) {
        expect(screen.getByTestId(`schedule-card-${item.id}`)).toBeInTheDocument();
      }
    });

    it('renders selected day section header with weekday fullName, "TODAY" badge only on actual today, "이번주 조정 N건" badge, per-day completion/verification stats, batch verification banner ("모두 확인 + ❤️"), and completion reset button ("초기화")', () => {
      // Monday Nov 9, 2026 is actual today (1)
      store.unlockParentMode();

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      const dayHeader = screen.getByTestId('day-section-header');
      expect(dayHeader).toBeInTheDocument();

      // 1. On Monday (actual today): shows "월요일" and "TODAY" badge, no adjustments yet, 0/N stats, no reset button, no waiting banner
      const monStats = store.getCompletionStats(1);
      expect(screen.getByTestId('selected-day-title')).toHaveTextContent('월요일');
      expect(screen.getByTestId('selected-day-today-badge')).toHaveTextContent('TODAY');
      expect(screen.queryByTestId('selected-day-adjustment-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('selected-day-completed-stat')).toHaveTextContent(
        `아이 0/${monStats.total}`
      );
      expect(screen.getByTestId('selected-day-verified-stat')).toHaveTextContent(
        `부모확인 0/${monStats.total}`
      );
      expect(screen.queryByTestId('selected-day-reset-completions-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('day-waiting-verification-banner')).not.toBeInTheDocument();

      // 2. Switch to Wednesday (3)
      fireEvent.click(screen.getByTestId('weekday-btn-3'));
      expect(store.getSelectedWeekday()).toBe(3);

      // Header shows "수요일", hides "TODAY" badge
      expect(screen.getByTestId('selected-day-title')).toHaveTextContent('수요일');
      expect(screen.queryByTestId('selected-day-today-badge')).not.toBeInTheDocument();

      // Create 2 Weekly Overrides on Wednesday (1 time adjustment + 1 skip) -> "이번주 조정 2건" badge appears
      const wedItems = store.getItemsForWeekday(3);
      act(() => {
        store.updateItem({ ...wedItems[0], startHour: 20, endHour: 21 }, 'thisWeek');
        store.skipItemForThisWeek(wedItems[1]);
      });
      expect(screen.getByTestId('selected-day-adjustment-badge')).toHaveTextContent(
        '이번주 조정 2건'
      );

      // 3. Complete 2 checkable items on Wednesday -> stats update, "초기화" button and waiting banner appear
      const wedCheckables = store
        .getItemsForWeekday(3)
        .filter((it) => store.isItemCheckable(it));
      const [waitItem1, waitItem2] = wedCheckables;

      fireEvent.click(screen.getByTestId(`item-check-btn-${waitItem1.id}`));
      fireEvent.click(screen.getByTestId(`item-check-btn-${waitItem2.id}`));

      const wedStatsAfterCheck = store.getCompletionStats(3);
      expect(screen.getByTestId('selected-day-completed-stat')).toHaveTextContent(
        `아이 2/${wedStatsAfterCheck.total}`
      );
      expect(screen.getByTestId('selected-day-verified-stat')).toHaveTextContent(
        `부모확인 0/${wedStatsAfterCheck.total}`
      );

      // Actual today hero card stats remain 0/monStats.total (separated from Wednesday!)
      expect(screen.getByTestId('stats-completed-badge')).toHaveTextContent(
        `다 했어요 0/${monStats.total}`
      );

      // "초기화" button is now visible
      const resetBtn = screen.getByTestId('selected-day-reset-completions-btn');
      expect(resetBtn).toBeInTheDocument();
      expect(resetBtn).toHaveTextContent('초기화');

      // Orange waiting banner is visible with count = 2 and "모두 확인 + ❤️" button
      const waitingBanner = screen.getByTestId('day-waiting-verification-banner');
      expect(waitingBanner).toBeInTheDocument();
      expect(waitingBanner).toHaveTextContent(
        "아이가 '다 했어요' 체크한 숙제 2개가 부모님 확인을 기다리고 있어요!"
      );
      const verifyAllBtn = screen.getByTestId('verify-all-waiting-btn');
      expect(verifyAllBtn).toHaveTextContent('모두 확인 + ❤️');

      // 4. Click "모두 확인 + ❤️" -> stamps both items (and their subtasks) and awards +1 heart to each
      const heartsBefore = store.getAvailableHearts();
      fireEvent.click(verifyAllBtn);

      expect(store.isParentVerified(waitItem1)).toBe(true);
      expect(store.isParentVerified(waitItem2)).toBe(true);
      for (const sub of [...waitItem1.subTasks, ...waitItem2.subTasks]) {
        expect(store.isSubTaskParentVerified(sub)).toBe(true);
      }
      expect(store.getAvailableHearts()).toBe(heartsBefore + 2);
      expect(screen.getByTestId('selected-day-verified-stat')).toHaveTextContent(
        `부모확인 2/${wedStatsAfterCheck.total}`
      );
      expect(screen.queryByTestId('day-waiting-verification-banner')).not.toBeInTheDocument();

      // 5. Click "초기화" -> clears all completions and parent verifications on Wednesday
      fireEvent.click(screen.getByTestId('selected-day-reset-completions-btn'));
      expect(store.isCompleted(waitItem1)).toBe(false);
      expect(store.isParentVerified(waitItem1)).toBe(false);
      expect(store.isCompleted(waitItem2)).toBe(false);
      expect(store.isParentVerified(waitItem2)).toBe(false);
      expect(screen.getByTestId('selected-day-completed-stat')).toHaveTextContent(
        `아이 0/${wedStatsAfterCheck.total}`
      );
      expect(screen.getByTestId('selected-day-verified-stat')).toHaveTextContent(
        `부모확인 0/${wedStatsAfterCheck.total}`
      );
      expect(screen.queryByTestId('selected-day-reset-completions-btn')).not.toBeInTheDocument();
    });
  });

  describe('Weekly Override Summary, Inline Revert & Excluded/Moved Master Items Restore (Issue 04)', () => {
    it('renders Weekly Override summary banner in selected day header when current week has adjustments, and allows resetting only the selected day or the entire week via confirmation dialog', () => {
      // Monday Nov 9, 2026 (2026-W46)
      store.unlockParentMode();

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      // Initially 0 adjustments in the week -> summary banner is hidden
      expect(screen.queryByTestId('day-weekly-override-banner')).not.toBeInTheDocument();

      // Create 1 time adjustment on Monday (1) and 1 skip on Wednesday (3)
      const monItems = store.getItemsForWeekday(1);
      const wedItems = store.getItemsForWeekday(3);
      const monAdjustedItem = monItems[0];
      const wedSkippedItem = wedItems[0];

      act(() => {
        store.updateItem({ ...monAdjustedItem, startHour: 20, endHour: 21 }, 'thisWeek');
        store.skipItemForThisWeek(wedSkippedItem);
      });

      expect(store.getCurrentWeekAdjustmentCount()).toBe(2);
      expect(store.getAdjustmentCountForWeekday(1)).toBe(1);
      expect(store.getAdjustmentCountForWeekday(2)).toBe(0);
      expect(store.getAdjustmentCountForWeekday(3)).toBe(1);

      // On Monday (1 adjustment on selected day): banner shows "월요일 일정 1개가 이번 주만 임시 조정되었어요"
      const banner = screen.getByTestId('day-weekly-override-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('월요일 일정 1개가 이번 주만 임시 조정되었어요');

      // Switch to Tuesday (0 adjustments on Tuesday, 2 in the week): banner still appears showing total week count!
      fireEvent.click(screen.getByTestId('weekday-btn-2'));
      expect(store.getSelectedWeekday()).toBe(2);
      expect(screen.getByTestId('day-weekly-override-banner')).toHaveTextContent(
        '이번 주 총 2개의 스케줄이 임시 조정되어 있어요'
      );

      // Switch back to Monday (1) and click "원래대로" button on the banner
      fireEvent.click(screen.getByTestId('weekday-btn-1'));
      const openResetDialogBtn = screen.getByTestId('open-reset-adjustments-dialog-btn');
      expect(openResetDialogBtn).toHaveTextContent('원래대로');
      fireEvent.click(openResetDialogBtn);

      // Confirmation dialog opens with both options ("월요일 조정만 원래대로 되돌리기" and "이번 주 전체(월~일) 조정 모두 원래대로 되돌리기")
      const dialog = screen.getByTestId('reset-adjustments-confirm-dialog');
      expect(dialog).toBeInTheDocument();
      const resetSelectedDayBtn = screen.getByTestId('confirm-reset-selected-day-adjustments-btn');
      const resetAllWeekBtn = screen.getByTestId('confirm-reset-all-week-adjustments-btn');
      expect(resetSelectedDayBtn).toHaveTextContent('월요일 조정만 원래대로 되돌리기');
      expect(resetAllWeekBtn).toHaveTextContent('이번 주 전체(월~일) 조정 모두 원래대로 되돌리기');

      // Choose "월요일 조정만 원래대로 되돌리기"
      fireEvent.click(resetSelectedDayBtn);
      expect(screen.queryByTestId('reset-adjustments-confirm-dialog')).not.toBeInTheDocument();

      // Monday's adjustment is reverted, while Wednesday's skip remains active!
      expect(store.getAdjustmentCountForWeekday(1)).toBe(0);
      expect(store.isAdjustedThisWeek(store.getItemsForWeekday(1)[0])).toBe(false);
      expect(store.getAdjustmentCountForWeekday(3)).toBe(1);
      expect(store.isSkippedThisWeek(wedSkippedItem.id)).toBe(true);
      expect(store.getCurrentWeekAdjustmentCount()).toBe(1);

      // Now on Monday (0 adjustments on Monday, 1 on Wednesday): open dialog again and choose "이번 주 전체(월~일) 조정 모두 원래대로 되돌리기"
      expect(screen.getByTestId('day-weekly-override-banner')).toHaveTextContent(
        '이번 주 총 1개의 스케줄이 임시 조정되어 있어요'
      );
      fireEvent.click(screen.getByTestId('open-reset-adjustments-dialog-btn'));
      expect(
        screen.queryByTestId('confirm-reset-selected-day-adjustments-btn')
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('confirm-reset-all-week-adjustments-btn'));

      // All weekly adjustments across Mon-Sun are now cleared and banner disappears
      expect(store.getCurrentWeekAdjustmentCount()).toBe(0);
      expect(store.isSkippedThisWeek(wedSkippedItem.id)).toBe(false);
      expect(screen.queryByTestId('day-weekly-override-banner')).not.toBeInTheDocument();
    });

    it('renders adjustment reason badge and inline "원래대로" button on overridden Master Schedule cards (and hides inline revert on temporary this-week additions), reverting only that item on click', () => {
      store.unlockParentMode();

      const monItems = store.getItemsForWeekday(1);
      const timeAdjustedMaster = monItems[0];
      const movedFromWedMaster = store.getItemsForWeekday(3)[0];

      // 1. Modify time of Monday master item
      store.updateItem({ ...timeAdjustedMaster, startHour: 20, endHour: 21 }, 'thisWeek');

      // 2. Move Wednesday master item onto Monday (with time change)
      store.updateItem(
        { ...movedFromWedMaster, weekday: 1, startHour: 21, endHour: 22 },
        'thisWeek'
      );

      // 3. Add a temporary this-week-only item on Monday
      store.addItem(
        {
          id: 'temp-mon-special',
          weekday: 1,
          startHour: 18,
          startMinute: 0,
          endHour: 19,
          endMinute: 0,
          title: '이번 주 특별 보강',
          note: '',
          category: 'study',
          iconName: 'book',
          subTasks: [],
          isNotificationEnabled: false,
          notificationLeadMinutes: [],
          targetWeekKey: null,
          updatedAt: Date.now() / 1000,
        },
        [1],
        'thisWeek'
      );

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      // Time-adjusted master item has badge + inline "원래대로" button
      expect(
        screen.getByTestId(`item-adjustment-badge-${timeAdjustedMaster.id}`)
      ).toHaveTextContent(/이번 주 시간 조정/);
      const revertTimeBtn = screen.getByTestId(`item-revert-override-btn-${timeAdjustedMaster.id}`);
      expect(revertTimeBtn).toBeInTheDocument();
      expect(revertTimeBtn).toHaveTextContent('원래대로');

      // Day+time-adjusted master item moved from Wednesday has badge + inline "원래대로" button
      expect(
        screen.getByTestId(`item-adjustment-badge-${movedFromWedMaster.id}`)
      ).toHaveTextContent(/이번 주 요일·시간 조정/);
      const revertMovedBtn = screen.getByTestId(
        `item-revert-override-btn-${movedFromWedMaster.id}`
      );
      expect(revertMovedBtn).toBeInTheDocument();

      // Temporary this-week addition has "이번 주 추가 일정" badge but NO inline override revert button
      expect(screen.getByTestId('item-adjustment-badge-temp-mon-special')).toHaveTextContent(
        '이번 주 추가 일정'
      );
      expect(
        screen.queryByTestId('item-revert-override-btn-temp-mon-special')
      ).not.toBeInTheDocument();

      // Click inline "원래대로" on the moved item -> returns to Wednesday immediately while keeping timeAdjustedMaster adjusted
      fireEvent.click(revertMovedBtn);
      expect(
        screen.queryByTestId(`schedule-card-${movedFromWedMaster.id}`)
      ).not.toBeInTheDocument();
      expect(store.getItemsForWeekday(3).some((it) => it.id === movedFromWedMaster.id)).toBe(true);
      expect(store.hasThisWeekOverride(timeAdjustedMaster.id)).toBe(true);

      // Click inline "원래대로" on timeAdjustedMaster -> reverts its time back to original Master Schedule time
      fireEvent.click(revertTimeBtn);
      expect(store.hasThisWeekOverride(timeAdjustedMaster.id)).toBe(false);
      expect(
        screen.queryByTestId(`item-adjustment-badge-${timeAdjustedMaster.id}`)
      ).not.toBeInTheDocument();
    });

    it('renders excluded/moved Master Schedule items section with both skipped items ("이번 주 휴강·제외") and items moved to another weekday ("이번 주 {요일} {시간}(으)로 이동"), restores each via "원래대로 복구", and still displays the section below empty state when 0 active items remain', () => {
      store.unlockParentMode();

      // Use Sunday (7) or Monday (1): let's select Monday (1) and skip/move its items
      const monItems = store.getItemsForWeekday(1);
      const itemToSkip = monItems[0];
      const itemToMove = monItems[1];

      // Skip itemToSkip
      store.skipItemForThisWeek(itemToSkip);

      // Move itemToMove from Monday (1) to Friday (5) at 16:30 ~ 17:30
      store.updateItem(
        {
          ...itemToMove,
          weekday: 5,
          startHour: 16,
          startMinute: 30,
          endHour: 17,
          endMinute: 30,
        },
        'thisWeek'
      );

      render(<TodayScheduleView store={store} onPlayChime={mockPlayChime} />);

      const excludedSection = screen.getByTestId('today-skipped-items-section');
      expect(excludedSection).toBeInTheDocument();
      expect(excludedSection).toHaveTextContent('이번 주 휴강·요일 이동된 원래 일정 (2개)');

      // 1. Skipped item displays "이번 주 휴강·제외" badge and original time range
      const skippedRow = screen.getByTestId(`excluded-item-row-${itemToSkip.id}`);
      expect(skippedRow).toHaveTextContent(itemToSkip.title);
      expect(screen.getByTestId(`excluded-item-reason-${itemToSkip.id}`)).toHaveTextContent(
        '이번 주 휴강·제외'
      );
      expect(skippedRow).toHaveTextContent('원래 시간:');

      // 2. Moved item displays "이번 주 금요일 오후 4:30(으)로 이동" badge and original time range
      const movedRow = screen.getByTestId(`excluded-item-row-${itemToMove.id}`);
      expect(movedRow).toHaveTextContent(itemToMove.title);
      expect(screen.getByTestId(`excluded-item-reason-${itemToMove.id}`)).toHaveTextContent(
        '이번 주 금요일 오후 4:30(으)로 이동'
      );
      expect(movedRow).toHaveTextContent('원래 시간:');

      // 3. Skip all remaining Monday items so Monday has 0 active items -> both empty state card AND excluded items section are displayed!
      act(() => {
        for (const rem of store.getItemsForWeekday(1)) {
          store.skipItemForThisWeek(rem);
        }
      });

      expect(store.getItemsForWeekday(1)).toHaveLength(0);
      expect(screen.getByTestId('today-empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('today-skipped-items-section')).toBeInTheDocument();

      // 4. Click "원래대로 복구" on the moved item -> restores it back to Monday's active timeline
      const restoreMovedBtn = screen.getByTestId(`restore-skipped-btn-${itemToMove.id}`);
      expect(restoreMovedBtn).toHaveTextContent('원래대로 복구');
      fireEvent.click(restoreMovedBtn);

      expect(screen.queryByTestId('today-empty-state')).not.toBeInTheDocument();
      expect(screen.getByTestId(`schedule-card-${itemToMove.id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`excluded-item-row-${itemToMove.id}`)).not.toBeInTheDocument();
    });
  });

  describe('Child Mode Protected Parent Actions & Immediate PIN Execution (Issue 05)', () => {
    const enterValidPin = () => {
      for (const digit of ['1', '6', '0', '1', '2', '5']) {
        fireEvent.click(screen.getByTestId(`keypad-btn-${digit}`));
      }
    };

    it('exposes all protected parent action buttons in Child Mode with lock indicators and prompts for 6-digit PIN with specific reason badges, discarding pending action on cancel and executing immediately on valid PIN', () => {
      // Ensure we start in Child Mode on Monday Nov 9, 2026
      expect(store.isParentMode()).toBe(false);
      const mockOpenPraise = vi.fn();
      const mockOpenEdit = vi.fn();

      const monCheckables = store
        .getItemsForWeekday(1)
        .filter((it) => store.isItemCheckable(it));
      const [checkableItem, skippedItem] = monCheckables;

      // Prepare state so all protected buttons are applicable:
      // 1. Complete 1 checkable item (waiting for parent verification & eligible for completion reset)
      store.toggleCompletion(checkableItem);
      // 2. Time-adjust checkableItem for this week (triggers weekly override banner & inline revert button)
      store.updateItem({ ...checkableItem, startHour: 20, endHour: 21 }, 'thisWeek');
      // 3. Skip skippedItem for this week (triggers excluded items section restore button)
      store.skipItemForThisWeek(skippedItem);

      render(
        <TodayScheduleView
          store={store}
          onPlayChime={mockPlayChime}
          onOpenPraiseModal={mockOpenPraise}
          onOpenEditModal={mockOpenEdit}
        />
      );

      // Verify all protected buttons are visible in Child Mode!
      const sendFamilyPraiseBtn = screen.getByTestId('send-family-praise-btn');
      const topAddBtn = screen.getByTestId('today-add-schedule-btn');
      const resetCompletionsBtn = screen.getByTestId('selected-day-reset-completions-btn');
      const openResetAdjustmentsBtn = screen.getByTestId('open-reset-adjustments-dialog-btn');
      const verifyAllWaitingBtn = screen.getByTestId('verify-all-waiting-btn');
      const inlineRevertBtn = screen.getByTestId(`item-revert-override-btn-${checkableItem.id}`);
      const itemEditBtn = screen.getByTestId(`item-edit-btn-${checkableItem.id}`);
      const itemPraiseBtn = screen.getByTestId(`item-praise-btn-${checkableItem.id}`);
      const restoreSkippedBtn = screen.getByTestId(`restore-skipped-btn-${skippedItem.id}`);

      expect(sendFamilyPraiseBtn).toBeInTheDocument();
      expect(topAddBtn).toBeInTheDocument();
      expect(resetCompletionsBtn).toBeInTheDocument();
      expect(openResetAdjustmentsBtn).toBeInTheDocument();
      expect(verifyAllWaitingBtn).toBeInTheDocument();
      expect(inlineRevertBtn).toBeInTheDocument();
      expect(itemEditBtn).toBeInTheDocument();
      expect(itemPraiseBtn).toBeInTheDocument();
      expect(restoreSkippedBtn).toBeInTheDocument();

      // 1. Click "모두 확인 + ❤️" in Child Mode -> opens PIN modal with reason "일괄 확인 및 하트 지급"
      const initialHearts = store.getAvailableHearts();
      fireEvent.click(verifyAllWaitingBtn);
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('일괄 확인 및 하트 지급');
      expect(store.isParentVerified(checkableItem)).toBe(false);

      // Cancel PIN modal -> action is NOT executed and discarded
      fireEvent.click(screen.getByTestId('pin-modal-close-btn'));
      expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
      expect(store.isParentMode()).toBe(false);
      expect(store.isParentVerified(checkableItem)).toBe(false);
      expect(store.getAvailableHearts()).toBe(initialHearts);

      // Click "모두 확인 + ❤️" again and enter valid PIN -> switches to Parent Mode & immediately verifies + awards heart!
      fireEvent.click(verifyAllWaitingBtn);
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('일괄 확인 및 하트 지급');
      enterValidPin();
      expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
      expect(store.isParentMode()).toBe(true);
      expect(store.isParentVerified(checkableItem)).toBe(true);
      expect(store.getAvailableHearts()).toBe(initialHearts + 1);

      // 2. Lock back to Child Mode and test "초기화" ("완료 체크 초기화")
      act(() => {
        store.lockParentMode();
      });
      expect(store.isParentMode()).toBe(false);

      fireEvent.click(screen.getByTestId('selected-day-reset-completions-btn'));
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('완료 체크 초기화');
      expect(store.isCompleted(checkableItem)).toBe(true);

      enterValidPin();
      expect(store.isParentMode()).toBe(true);
      expect(store.isCompleted(checkableItem)).toBe(false);
      expect(store.isParentVerified(checkableItem)).toBe(false);

      // 3. Lock back to Child Mode and test inline "원래대로" ("이번 주 조정 복구")
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId(`item-revert-override-btn-${checkableItem.id}`));
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('이번 주 조정 복구');
      expect(store.hasThisWeekOverride(checkableItem.id)).toBe(true);

      enterValidPin();
      expect(store.hasThisWeekOverride(checkableItem.id)).toBe(false);

      // 4. Lock back to Child Mode and test banner "원래대로" ("이번 주 조정 복구") -> opens reset dialog immediately after PIN
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId('open-reset-adjustments-dialog-btn'));
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('이번 주 조정 복구');
      expect(screen.queryByTestId('reset-adjustments-confirm-dialog')).not.toBeInTheDocument();

      enterValidPin();
      expect(screen.getByTestId('reset-adjustments-confirm-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('cancel-reset-adjustments-dialog-btn'));

      // 5. Lock back to Child Mode and test excluded item "원래대로 복구" ("제외 일정 복구")
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId(`restore-skipped-btn-${skippedItem.id}`));
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('제외 일정 복구');
      expect(store.isSkippedThisWeek(skippedItem.id)).toBe(true);

      enterValidPin();
      expect(store.isSkippedThisWeek(skippedItem.id)).toBe(false);

      // 6. Lock back to Child Mode and test hero "응원 보내기" & card "응원하기" ("응원 하트 보내기")
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId('send-family-praise-btn'));
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('응원 하트 보내기');
      expect(mockOpenPraise).not.toHaveBeenCalled();

      enterValidPin();
      expect(mockOpenPraise).toHaveBeenCalledTimes(1);
      expect(mockOpenPraise).toHaveBeenLastCalledWith(null);

      act(() => {
        store.lockParentMode();
      });
      const currentCheckable = store.getItemsForWeekday(1).find((it) => it.id === checkableItem.id)!;
      fireEvent.click(screen.getByTestId(`item-praise-btn-${checkableItem.id}`));
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('응원 하트 보내기');
      enterValidPin();
      expect(mockOpenPraise).toHaveBeenCalledTimes(2);
      expect(mockOpenPraise).toHaveBeenLastCalledWith(currentCheckable);

      // 7. Lock back to Child Mode and test card "수정" ("일정 수정") & "+ 이번 주 추가" / empty state "이번 주 일정 추가하기" ("이번 주 일정 추가")
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId(`item-edit-btn-${checkableItem.id}`));
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('일정 수정');
      expect(mockOpenEdit).not.toHaveBeenCalled();
      enterValidPin();
      expect(mockOpenEdit).toHaveBeenCalledTimes(1);
      expect(mockOpenEdit).toHaveBeenLastCalledWith(currentCheckable);

      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId('today-add-schedule-btn'));
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('이번 주 일정 추가');
      enterValidPin();
      expect(mockOpenEdit).toHaveBeenCalledTimes(2);
      expect(mockOpenEdit).toHaveBeenLastCalledWith(null, 1, 'thisWeek');

      // Switch to Wednesday (3), filter by 'free' (0 items) to show empty state in Child Mode
      act(() => {
        store.lockParentMode();
      });
      fireEvent.click(screen.getByTestId('weekday-btn-3'));
      fireEvent.click(screen.getByTestId('category-chip-free'));
      const emptyAddBtn = screen.getByTestId('empty-day-add-schedule-btn');
      expect(emptyAddBtn).toBeInTheDocument();

      fireEvent.click(emptyAddBtn);
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('이번 주 일정 추가');
      enterValidPin();
      expect(mockOpenEdit).toHaveBeenCalledTimes(3);
      expect(mockOpenEdit).toHaveBeenLastCalledWith(null, 3, 'thisWeek');
    });
  });
});
