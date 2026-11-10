import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { VercelBlobSyncService } from './services/vercelBlobSync';
import { globalScheduleStore } from './domain/scheduleStore';

describe('App & Hash Navigation (Seam 2)', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
    sessionStorage.clear();
    globalScheduleStore.reloadFromStorage();
    vi.spyOn(VercelBlobSyncService.prototype, 'fetchLatestSnapshot').mockResolvedValue({
      latest: null,
      snapshot: null,
      allBlobs: [],
    });
    vi.spyOn(VercelBlobSyncService.prototype, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state.json',
      pathname: 'state.json',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders navigation header with brand title and date badge', () => {
    render(<App syncOnMount={false} />);
    expect(screen.getByRole('heading', { level: 1, name: '주간 시간표' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /오늘의 할 일/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /주간 시간표/i })).toBeInTheDocument();
  });

  it('renders today schedule items by default', () => {
    render(<App syncOnMount={false} />);
    // Today view header should be visible
    expect(screen.getByTestId('today-view')).toBeInTheDocument();
    // Default items should be rendered
    expect(screen.getAllByText('코딱지').length).toBeGreaterThan(0);
  });

  it('switches between Today and Weekly grid views via hash routing tabs', () => {
    render(<App syncOnMount={false} />);

    // Click Weekly view tab
    const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });
    fireEvent.click(weeklyTab);

    expect(window.location.hash).toBe('#weekly');
    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

    // Check all 7 weekday headers exist in weekly grid
    ['월', '화', '수', '목', '금', '토', '일'].forEach((day) => {
      expect(screen.getByTestId(`weekly-col-${day}`)).toBeInTheDocument();
    });

    // Click Today view tab
    const todayTab = screen.getByRole('button', { name: /오늘의 할 일/i });
    fireEvent.click(todayTab);

    expect(window.location.hash).toBe('#today');
    expect(screen.getByTestId('today-view')).toBeInTheDocument();
  });

  it('responds to browser window hashchange events', () => {
    render(<App syncOnMount={false} />);

    // Simulate direct hash navigation to #weekly
    window.location.hash = '#weekly';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

    // Simulate back button to #today
    window.location.hash = '#today';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(screen.getByTestId('today-view')).toBeInTheDocument();
  });

  it('allows child to check off an item on Today view and updates progress bar percentage', () => {
    render(<App syncOnMount={false} />);

    // Gauge should initially show 0% (or whatever initial completed items)
    expect(screen.getByTestId('progress-gauge-card')).toBeInTheDocument();

    // Find the first checkable item's check button
    const checkBtns = screen.getAllByRole('button', { name: /다 했어요|완료됨/i });
    expect(checkBtns.length).toBeGreaterThan(0);

    const firstCheckBtn = checkBtns[0];
    const initialChecked = firstCheckBtn.getAttribute('aria-checked');
    expect(initialChecked).toBe('false');

    // Click check button
    fireEvent.click(firstCheckBtn);

    // Should now be checked
    expect(firstCheckBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('renders header sync button and triggers sync toast on click', async () => {
    render(<App syncOnMount={false} />);

    const syncBtn = screen.getByTestId('header-sync-button');
    expect(syncBtn).toBeInTheDocument();
    expect(syncBtn).toHaveAttribute('title', '클라우드 동기화 (⌘R)');

    await waitFor(() => {
      expect(syncBtn).not.toBeDisabled();
    });

    // Click sync button
    fireEvent.click(syncBtn);

    // Toast banner appears
    const toast = await screen.findByTestId('sync-toast');
    expect(toast).toBeInTheDocument();
  });

  describe('Parent Mode PIN Authentication & Stamps Integration (Seam 4 / Issue 04)', () => {
    it('opens Parent PIN modal, switches to parent mode upon entering correct PIN, stamps item and locks back', async () => {
      render(<App syncOnMount={false} />);

      // Child completes the first checkable item
      const checkBtns = screen.getAllByRole('button', { name: /다 했어요|완료됨/i });
      expect(checkBtns.length).toBeGreaterThan(0);
      fireEvent.click(checkBtns[0]);

      // Initially in child mode, switch button is in header
      const modeSwitchBtn = screen.getByTestId('mode-switch-button');
      expect(modeSwitchBtn).toBeInTheDocument();

      // Click to open PIN modal
      fireEvent.click(modeSwitchBtn);

      const modal = screen.getByTestId('parent-pin-modal');
      expect(modal).toBeInTheDocument();

      // Enter correct PIN: 160125
      const digits = ['1', '6', '0', '1', '2', '5'];
      for (const d of digits) {
        fireEvent.click(screen.getByTestId(`keypad-btn-${d}`));
      }

      // Modal closes, header shows parent mode indicator and lock button
      await waitFor(() => {
        expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('parent-mode-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('mode-lock-button')).toBeInTheDocument();

      // Today view now shows stamp buttons
      const stampBtns = screen.getAllByTestId(/^item-parent-stamp-btn-/);
      expect(stampBtns.length).toBeGreaterThan(0);

      // Stamp the first item
      fireEvent.click(stampBtns[0]);
      expect(stampBtns[0]).toHaveTextContent(/참 잘했어요 도장 날인됨/);

      // Send cheer heart to first item
      const praiseBtns = screen.getAllByTestId(/^item-praise-btn-/);
      expect(praiseBtns.length).toBeGreaterThan(0);
      fireEvent.click(praiseBtns[0]);

      // Praise modal opens
      expect(screen.getByTestId('praise-heart-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('heart-preset-5'));
      fireEvent.click(screen.getByTestId('send-praise-btn'));

      // Praise modal closes, header hearts badge shows +5
      await waitFor(() => {
        expect(screen.queryByTestId('praise-heart-modal')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('5');

      // Click lock button to return to child mode
      const lockBtn = screen.getByTestId('mode-lock-button');
      fireEvent.click(lockBtn);

      expect(screen.getByTestId('mode-switch-button')).toBeInTheDocument();
      expect(screen.queryByTestId('parent-mode-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Master Schedule Editing & Weekly Override Integration (Seam 4 / Issue 05)', () => {
    it('allows parent to create master schedule item, override this week, and automatically revert next week', async () => {
      // Set to 2026-W46 Monday
      globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
      globalScheduleStore.unlockParentMode();

      render(<App syncOnMount={false} />);

      // 1. Add new master schedule item via today view (today-add-schedule-btn defaults to thisWeek per Issue 03, so select master scope)
      const addBtn = screen.getByTestId('today-add-schedule-btn');
      fireEvent.click(addBtn);

      const modal = screen.getByTestId('schedule-edit-modal');
      expect(modal).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('scope-master-radio'));

      const titleInput = screen.getByTestId('schedule-title-input');
      fireEvent.change(titleInput, { target: { value: '창의 로봇 코딩' } });

      const startHourSelect = screen.getByTestId('start-hour-select');
      fireEvent.change(startHourSelect, { target: { value: '17' } });

      const endHourSelect = screen.getByTestId('end-hour-select');
      fireEvent.change(endHourSelect, { target: { value: '18' } });

      const saveBtn = screen.getByTestId('save-schedule-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('schedule-edit-modal')).not.toBeInTheDocument();
      });

      // Item should now appear in today view
      expect(screen.getByText('창의 로봇 코딩')).toBeInTheDocument();

      // 2. Click edit button on the new item and adjust for this week only
      const createdItem = globalScheduleStore.getTodayItems().find((it) => it.title === '창의 로봇 코딩')!;
      expect(createdItem).toBeDefined();

      const editBtn = screen.getByTestId(`item-edit-btn-${createdItem.id}`);
      fireEvent.click(editBtn);

      expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();

      // Choose 'thisWeek' scope
      fireEvent.click(screen.getByTestId('scope-this-week-radio'));

      // Change time to 19:00 ~ 20:00
      fireEvent.change(screen.getByTestId('start-hour-select'), { target: { value: '19' } });
      fireEvent.change(screen.getByTestId('end-hour-select'), { target: { value: '20' } });

      fireEvent.click(screen.getByTestId('save-schedule-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('schedule-edit-modal')).not.toBeInTheDocument();
      });

      // Item should now display adjustment badge
      const badge = screen.getByTestId(`item-adjustment-badge-${createdItem.id}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/이번 주 시간 조정/);

      // Switch to Weekly view
      const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });
      fireEvent.click(weeklyTab);

      // Adjustment banner and badge visible in weekly view
      expect(screen.getByTestId('weekly-adjustments-banner')).toBeInTheDocument();
      expect(screen.getByTestId(`weekly-adjustment-badge-${createdItem.id}`)).toBeInTheDocument();

      // 3. Week key transition to next week (2026-W47)
      globalScheduleStore.setCurrentDate(new Date(2026, 10, 16));

      // Overrides from W46 should NOT apply to W47; returns automatically to master time (17:00)
      const w47Item = globalScheduleStore.getEffectiveItems().find((it) => it.id === createdItem.id);
      expect(w47Item).toBeDefined();
      expect(w47Item?.startHour).toBe(17);
      expect(globalScheduleStore.isAdjustedThisWeek(w47Item!)).toBe(false);
      expect(globalScheduleStore.getCurrentWeekAdjustmentCount()).toBe(0);
    });

    describe('Star Ledger, Hash Routing & Reward Shop Integration (Seam 3 / Issue 06)', () => {
      it('navigates to #stars shop via header badge and tab, and displays star balance', async () => {
        render(<App syncOnMount={false} />);

        // Header star badge exists
        const headerBadge = screen.getByTestId('header-stars-badge');
        expect(headerBadge).toBeInTheDocument();
        expect(headerBadge).toHaveTextContent('0');

        // Click Star Shop tab in navigation
        const starTab = screen.getByTestId('nav-tab-stars');
        fireEvent.click(starTab);

        expect(window.location.hash).toBe('#stars');
        expect(screen.getByTestId('star-reward-shop-view')).toBeInTheDocument();
        expect(screen.getByTestId('star-balance-hero-card')).toBeInTheDocument();
      });

      it('awards daily star upon completing all tasks and triggers celebration modal', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9)); // Monday
        globalScheduleStore.unlockParentMode();

        render(<App syncOnMount={false} />);

        // Complete and verify all Monday items
        const monItems = globalScheduleStore.getTodayItems().filter((it) => globalScheduleStore.isItemCheckable(it));
        for (const item of monItems) {
          if (!globalScheduleStore.isCompleted(item)) globalScheduleStore.toggleCompletion(item);
          if (!globalScheduleStore.isParentVerified(item)) globalScheduleStore.toggleParentVerification(item);
          for (const sub of item.subTasks) {
            if (!globalScheduleStore.isSubTaskCompleted(sub)) globalScheduleStore.toggleSubTaskCompletion(sub, item);
            if (!globalScheduleStore.isSubTaskParentVerified(sub)) globalScheduleStore.toggleSubTaskParentVerification(sub, item);
          }
        }

        // Stamp board claim button should be visible
        const claimBtn = await screen.findByTestId('claim-daily-star-button');
        expect(claimBtn).toBeInTheDocument();

        fireEvent.click(claimBtn);

        // Celebration modal should pop up!
        const celebration = await screen.findByTestId('star-celebration-modal');
        expect(celebration).toBeInTheDocument();
        expect(screen.getByText('⭐ 오늘의 올클리어 스타 획득!')).toBeInTheDocument();

        // Dismiss modal by clicking 확인
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        expect(screen.queryByTestId('star-celebration-modal')).not.toBeInTheDocument();

        // Header star badge updated to 1
        expect(screen.getByTestId('header-stars-badge')).toHaveTextContent('1');
      });
    });

    describe('A4 Landscape Print Engine & Modal Navigation Integration (Seam 4 / Issue 07)', () => {
      it('opens print preview modal when clicking header print button and sets hash to #print', () => {
        render(<App syncOnMount={false} />);

        const printBtn = screen.getByTestId('header-print-button');
        expect(printBtn).toBeInTheDocument();

        fireEvent.click(printBtn);

        expect(window.location.hash).toBe('#print');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('1페이지 시간표 인쇄')).toBeInTheDocument();
        expect(screen.getByTestId('printable-sheet')).toBeInTheDocument();

        // Close modal
        const closeBtn = screen.getByRole('button', { name: /닫기/i });
        fireEvent.click(closeBtn);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(window.location.hash).toBe('#today');
      });

      it('opens print preview modal directly when window hash changes to #print', () => {
        render(<App syncOnMount={false} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // Change hash to #print
        window.location.hash = '#print';
        fireEvent(window, new HashChangeEvent('hashchange'));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('1페이지 시간표 인쇄')).toBeInTheDocument();
      });

      it('opens print preview modal from WeeklyGridView print button', () => {
        render(<App syncOnMount={false} />);

        // Switch to weekly view
        const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });
        fireEvent.click(weeklyTab);

        const weeklyPrintBtn = screen.getByTestId('weekly-print-btn');
        expect(weeklyPrintBtn).toBeInTheDocument();

        fireEvent.click(weeklyPrintBtn);

        expect(window.location.hash).toBe('#print');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    describe('Heart Reward Exchange Integration (Seam 3 / Issue 01)', () => {
      it('opens reward exchange modal on clicking header heart badge and completes exchange end-to-end', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.sendFamilyPraise({
          hearts: 20,
          sticker: 'heart',
          message: '수고했어!',
        });

        render(<App syncOnMount={false} />);

        const heartBadge = screen.getByTestId('header-hearts-badge');
        expect(heartBadge).toHaveTextContent('20');

        // Click header badge to open modal
        fireEvent.click(heartBadge);

        expect(screen.getByTestId('reward-exchange-modal')).toBeInTheDocument();
        expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('20');

        // Select preset #1 (자유 놀이 / 게임 30분, 10개)
        const presetCard = screen.getByTestId('preset-card-00000000-0000-0000-0000-000000000101');
        fireEvent.click(presetCard);

        // Click redeem submit button in child mode -> opens PIN modal
        const submitBtn = screen.getByTestId('redeem-submit-btn');
        fireEvent.click(submitBtn);

        const pinModal = screen.getByTestId('parent-pin-modal');
        expect(pinModal).toBeInTheDocument();
        expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('보상 교환 승인');

        // Enter correct 6-digit PIN: 160125
        const pin = ['1', '6', '0', '1', '2', '5'];
        for (const digit of pin) {
          fireEvent.click(screen.getByTestId(`keypad-btn-${digit}`));
        }

        // Modal should close
        await waitFor(() => {
          expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
        });

        // Header badge should now display 10 hearts
        expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('10');

        // Toast message confirming completion should appear
        const toast = await screen.findByTestId('sync-toast');
        expect(toast).toHaveTextContent('자유 놀이 / 게임 30분');
        expect(toast).toHaveTextContent('하트 10개가 차감되었어요');
      });

      it('in parent mode, redeems reward immediately without requiring PIN in App', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();
        globalScheduleStore.sendFamilyPraise({
          hearts: 20,
          sticker: 'heart',
          message: '수고했어!',
        });

        render(<App syncOnMount={false} />);

        // Click header badge to open modal
        fireEvent.click(screen.getByTestId('header-hearts-badge'));

        // Select preset #1
        fireEvent.click(screen.getByTestId('preset-card-00000000-0000-0000-0000-000000000101'));

        // Click redeem submit button
        fireEvent.click(screen.getByTestId('redeem-submit-btn'));

        // No PIN modal appears, reward exchange modal closes immediately
        expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
        await waitFor(() => {
          expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('10');
      });

      it('allows parent to view redemption history in RewardExchangeModal and refund a redemption to restore balance end-to-end', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();
        globalScheduleStore.sendFamilyPraise({
          hearts: 30,
          sticker: 'heart',
          message: '수고했어!',
        });
        globalScheduleStore.redeemReward('게임 30분', 10);

        render(<App syncOnMount={false} />);

        // Initially 20 available hearts in header badge
        expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('20');

        // Click header badge to open modal
        fireEvent.click(screen.getByTestId('header-hearts-badge'));

        const redemptions = globalScheduleStore.getRewardRedemptions();
        expect(redemptions).toHaveLength(1);

        // Redemption history item is visible
        const historyItem = screen.getByTestId(`redemption-item-${redemptions[0].id}`);
        expect(historyItem).toBeInTheDocument();
        expect(screen.getByTestId(`redemption-title-${redemptions[0].id}`)).toHaveTextContent('게임 30분');
        expect(screen.getByTestId(`redemption-hearts-${redemptions[0].id}`)).toHaveTextContent('-10개');

        // Click refund button
        const refundBtn = screen.getByTestId(`refund-btn-${redemptions[0].id}`);
        fireEvent.click(refundBtn);

        // Confirm dialog appears
        expect(screen.getByTestId('refund-confirm-dialog')).toBeInTheDocument();

        // Click confirm refund
        fireEvent.click(screen.getByTestId('confirm-refund-btn'));

        // Dialog closes, item is removed, and empty state is rendered
        await waitFor(() => {
          expect(screen.queryByTestId('refund-confirm-dialog')).not.toBeInTheDocument();
        });
        expect(screen.queryByTestId(`redemption-item-${redemptions[0].id}`)).not.toBeInTheDocument();
        expect(screen.getByTestId('redemption-history-empty')).toBeInTheDocument();

        // Balance restored in both modal hero and header badge to 30
        expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('30');
        expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('30');

        // Toast appears
        const toast = await screen.findByTestId('sync-toast');
        expect(toast).toHaveTextContent('게임 30분');
        expect(toast).toHaveTextContent('하트 10개가 복구되었어요');
      });

      it('allows parent to manage reward presets from RewardExchangeModal and immediately reflects changes end-to-end (Issue 04)', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();
        globalScheduleStore.sendFamilyPraise({
          hearts: 50,
          sticker: 'heart',
          message: '수고했어!',
        });

        render(<App syncOnMount={false} />);

        // Open RewardExchangeModal from header badge
        fireEvent.click(screen.getByTestId('header-hearts-badge'));
        expect(screen.getByTestId('reward-exchange-modal')).toBeInTheDocument();

        // Initially 8 presets
        expect(screen.getAllByTestId(/^preset-card-/)).toHaveLength(8);

        // Click "추천 보상 관리" button
        fireEvent.click(screen.getByTestId('manage-presets-btn'));

        // Preset management modal opens
        expect(screen.getByTestId('preset-manage-modal')).toBeInTheDocument();

        // Add a new custom preset (🍕 가족 피자 파티, 25 hearts)
        fireEvent.click(screen.getByTestId('add-preset-btn'));
        expect(screen.getByTestId('preset-form-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('emoji-option-🍕'));
        fireEvent.change(screen.getByTestId('preset-title-input'), {
          target: { value: '가족 피자 파티' },
        });
        fireEvent.change(screen.getByTestId('preset-hearts-input'), {
          target: { value: '25' },
        });
        fireEvent.click(screen.getByTestId('save-preset-btn'));

        // Close manage modal
        fireEvent.click(screen.getByTestId('close-preset-manage-modal-btn'));
        expect(screen.queryByTestId('preset-manage-modal')).not.toBeInTheDocument();

        // Exchange modal reflects the new preset (now 9 cards)
        expect(screen.getAllByTestId(/^preset-card-/)).toHaveLength(9);
        expect(screen.getByText('가족 피자 파티')).toBeInTheDocument();

        // Select the newly added preset
        const newPresetCard = screen.getByText('가족 피자 파티').closest('button');
        fireEvent.click(newPresetCard!);

        // Form fields update
        expect(screen.getByTestId('reward-title-input')).toHaveValue('가족 피자 파티');
        expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('25');

        // Redeem the newly added preset
        fireEvent.click(screen.getByTestId('redeem-submit-btn'));

        // Modal closes, header badge updates from 50 to 25
        await waitFor(() => {
          expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
        });
        expect(screen.getByTestId('header-hearts-badge')).toHaveTextContent('25');
      });

      it('opens RewardExchangeModal from TodayScheduleView hero card "하트 보상 교환" button (Issue 05)', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();
        globalScheduleStore.sendFamilyPraise({
          hearts: 10,
          sticker: 'star',
          message: '잘했어!',
        });

        render(<App syncOnMount={false} />);

        // Today view hero card has "하트 보상 교환" button
        const todayExchangeBtn = screen.getByTestId('today-hero-reward-exchange-btn');
        expect(todayExchangeBtn).toBeInTheDocument();
        expect(todayExchangeBtn).toHaveTextContent('하트 보상 교환');

        // Click exchange button
        fireEvent.click(todayExchangeBtn);

        // Modal opens immediately
        expect(screen.getByTestId('reward-exchange-modal')).toBeInTheDocument();
        expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('10');

        // Close modal
        fireEvent.click(screen.getByTestId('close-reward-modal-btn'));
        await waitFor(() => {
          expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
        });
        // Still on Today view
        expect(screen.getByTestId('today-view')).toBeInTheDocument();
      });

      it('opens RewardExchangeModal from StarRewardShopView banner without leaving Star Shop view (Issue 05)', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();
        globalScheduleStore.sendFamilyPraise({
          hearts: 15,
          sticker: 'heart',
          message: '멋져요!',
        });

        render(<App syncOnMount={false} />);

        // Switch to Star Reward Shop tab
        fireEvent.click(screen.getByTestId('nav-tab-stars'));
        expect(screen.getByTestId('star-reward-shop-view')).toBeInTheDocument();

        // Banner has "하트 보상 교환하기" shortcut button
        const bannerLink = screen.getByTestId('star-shop-heart-exchange-link');
        expect(bannerLink).toBeInTheDocument();
        expect(bannerLink).toHaveTextContent('하트 보상 교환하기');

        // Click banner shortcut
        fireEvent.click(bannerLink);

        // Reward exchange modal opens over Star Reward Shop view
        expect(screen.getByTestId('reward-exchange-modal')).toBeInTheDocument();
        expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('15');

        // Close modal
        fireEvent.click(screen.getByTestId('close-reward-modal-btn'));
        await waitFor(() => {
          expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
        });

        // User remains seamlessly in Star Reward Shop view
        expect(screen.getByTestId('star-reward-shop-view')).toBeInTheDocument();
      });
    });

    describe('Selected Weekday Session Persistence & Midnight Rollover (Issue 01)', () => {
      it('preserves selectedWeekday when switching between Today, Weekly, and Star Shop tabs, and rolls over past midnight on window focus', () => {
        vi.useFakeTimers();
        try {
          // Monday Nov 9, 2026 23:55
          const mondayLate = new Date(2026, 10, 9, 23, 55, 0);
          vi.setSystemTime(mondayLate);
          globalScheduleStore.setCurrentDate(mondayLate);

          render(<App syncOnMount={false} />);

          expect(globalScheduleStore.getSelectedWeekday()).toBe(1);
          expect(screen.getByTestId('weekday-btn-1')).toHaveAttribute('data-selected', 'true');

          // Select Thursday (4)
          fireEvent.click(screen.getByTestId('weekday-btn-4'));
          expect(globalScheduleStore.getSelectedWeekday()).toBe(4);
          expect(screen.getByTestId('weekday-btn-4')).toHaveAttribute('data-selected', 'true');

          // Navigate to Weekly Schedule tab (#weekly) and back to Today (#today)
          fireEvent.click(screen.getByRole('button', { name: /주간 시간표/i }));
          expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

          fireEvent.click(screen.getByRole('button', { name: /오늘의 할 일/i }));
          expect(screen.getByTestId('today-view')).toBeInTheDocument();
          expect(globalScheduleStore.getSelectedWeekday()).toBe(4);
          expect(screen.getByTestId('weekday-btn-4')).toHaveAttribute('data-selected', 'true');

          // Navigate to Star Shop tab (#stars) and back to Today (#today)
          fireEvent.click(screen.getByTestId('nav-tab-stars'));
          expect(screen.getByTestId('star-reward-shop-view')).toBeInTheDocument();

          fireEvent.click(screen.getByRole('button', { name: /오늘의 할 일/i }));
          expect(globalScheduleStore.getSelectedWeekday()).toBe(4);
          expect(screen.getByTestId('weekday-btn-4')).toHaveAttribute('data-selected', 'true');

          // Advance system time past midnight to Tuesday Nov 10, 2026 00:05 and trigger window focus
          vi.setSystemTime(new Date(2026, 10, 10, 0, 5, 0));
          fireEvent.focus(window);

          expect(globalScheduleStore.getTodayWeekday()).toBe(2);
          expect(globalScheduleStore.getSelectedWeekday()).toBe(2);
          expect(screen.getByTestId('weekday-btn-2')).toHaveAttribute('data-selected', 'true');
        } finally {
          vi.useRealTimers();
        }
      });

      it('opens ScheduleEditModal defaulted to selectedWeekday and thisWeek scope from Today view "+ 이번 주 추가" and empty state "이번 주 일정 추가하기" (Issue 03)', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9)); // Monday
        globalScheduleStore.unlockParentMode();

        render(<App syncOnMount={false} />);

        // Select Wednesday (3)
        fireEvent.click(screen.getByTestId('weekday-btn-3'));
        expect(globalScheduleStore.getSelectedWeekday()).toBe(3);

        // Filter to a category with 0 items on Wednesday ('free') and click "이번 주 일정 추가하기"
        fireEvent.click(screen.getByTestId('category-chip-free'));
        expect(screen.getByTestId('today-empty-state')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('empty-day-add-schedule-btn'));

        const modal = screen.getByTestId('schedule-edit-modal');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveTextContent('이번 주에만 한시적으로 적용됩니다');

        // Reset filter to '전체', save a temporary item on Wednesday without changing weekday or scope
        fireEvent.change(screen.getByTestId('schedule-title-input'), {
          target: { value: '수요일 특별 자유시간' },
        });
        fireEvent.click(screen.getByTestId('save-schedule-btn'));

        await waitFor(() => {
          expect(screen.queryByTestId('schedule-edit-modal')).not.toBeInTheDocument();
        });

        // Switch category filter back to '전체' -> new item was added to Wednesday (3) with thisWeek scope!
        fireEvent.click(screen.getByTestId('category-chip-all'));
        const createdWedItem = globalScheduleStore
          .getItemsForWeekday(3)
          .find((it) => it.title === '수요일 특별 자유시간');
        expect(createdWedItem).toBeDefined();
        expect(createdWedItem?.weekday).toBe(3);
        expect(createdWedItem?.targetWeekKey).toBe(globalScheduleStore.getCurrentWeekKey());
      });

      it('gates protected Today Schedule actions in Child Mode behind the 6-digit PIN modal with reason badges and immediately opens the requested modal or executes the action upon authentication (Issue 05)', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9)); // Monday
        expect(globalScheduleStore.isParentMode()).toBe(false);

        // Complete all Monday items and verify all except the first so we can test batch verify and star claiming in Child Mode
        const monCheckables = globalScheduleStore
          .getItemsForWeekday(1)
          .filter((it) => globalScheduleStore.isItemCheckable(it));
        for (const item of monCheckables) {
          globalScheduleStore.toggleCompletion(item);
        }
        globalScheduleStore.unlockParentMode();
        for (const item of monCheckables.slice(1)) {
          globalScheduleStore.toggleParentVerification(item);
        }
        globalScheduleStore.lockParentMode();
        expect(globalScheduleStore.isParentMode()).toBe(false);

        render(<App syncOnMount={false} />);

        const enterPin = () => {
          for (const d of ['1', '6', '0', '1', '2', '5']) {
            fireEvent.click(screen.getByTestId(`keypad-btn-${d}`));
          }
        };

        // 1. In Child Mode, click "+ 이번 주 추가" -> opens PIN modal with "이번 주 일정 추가"
        fireEvent.click(screen.getByTestId('today-add-schedule-btn'));
        expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
        expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('이번 주 일정 추가');
        expect(screen.queryByTestId('schedule-edit-modal')).not.toBeInTheDocument();

        // Cancel PIN modal -> edit modal does not open
        fireEvent.click(screen.getByTestId('pin-modal-close-btn'));
        expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('schedule-edit-modal')).not.toBeInTheDocument();

        // Click "+ 이번 주 추가" again and enter PIN -> switches to Parent Mode and immediately opens ScheduleEditModal!
        fireEvent.click(screen.getByTestId('today-add-schedule-btn'));
        enterPin();
        expect(screen.getByTestId('parent-mode-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '취소' }));

        // 2. Lock back to Child Mode and click hero "응원 보내기" -> opens PIN modal with "응원 하트 보내기", then immediately opens PraiseHeartModal on valid PIN
        fireEvent.click(screen.getByTestId('mode-lock-button'));
        expect(globalScheduleStore.isParentMode()).toBe(false);

        fireEvent.click(screen.getByTestId('send-family-praise-btn'));
        expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
        expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('응원 하트 보내기');
        expect(screen.queryByTestId('praise-heart-modal')).not.toBeInTheDocument();

        enterPin();
        expect(screen.getByTestId('praise-heart-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('praise-modal-close-btn'));

        // 3. Lock back to Child Mode and click "모두 확인 + ❤️" -> opens PIN modal with "일괄 확인 및 하트 지급", then verifies the remaining item
        fireEvent.click(screen.getByTestId('mode-lock-button'));
        fireEvent.click(screen.getByTestId('verify-all-waiting-btn'));
        expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('일괄 확인 및 하트 지급');
        enterPin();
        expect(globalScheduleStore.isParentVerified(monCheckables[0])).toBe(true);

        // 4. Lock back to Child Mode and click claim daily star button -> opens PIN modal with "올클리어 스타 수여", then awards +1 star immediately on valid PIN
        fireEvent.click(screen.getByTestId('mode-lock-button'));
        const claimStarBtn = await screen.findByTestId('claim-daily-star-button');
        fireEvent.click(claimStarBtn);
        expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
        expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('올클리어 스타 수여');
        enterPin();
        expect(await screen.findByTestId('star-celebration-modal')).toBeInTheDocument();
      });
    });

    describe('Weekly View Scope Modes & Modal Propagation (Issue 02)', () => {
      it('propagates active weekly view scope to ScheduleEditModal and SchedulePrintModal', async () => {
        globalScheduleStore.setCurrentDate(new Date(2026, 10, 9));
        globalScheduleStore.unlockParentMode();

        render(<App syncOnMount={false} />);

        // Switch to Weekly Schedule tab
        const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });
        fireEvent.click(weeklyTab);
        expect(screen.getByTestId('weekly-view')).toBeInTheDocument();

        // 1. In default thisWeek scope, "+ 새 일정 추가" opens ScheduleEditModal preset to thisWeek scope
        const addBtn = screen.getByTestId('weekly-add-item-btn');
        fireEvent.click(addBtn);

        expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();
        const thisWeekRadio = screen.getByTestId('scope-this-week-radio');
        expect(thisWeekRadio).toHaveClass('bg-white');
        fireEvent.click(screen.getByRole('button', { name: '취소' }));

        // 2. In default thisWeek scope, "A4 1페이지 인쇄" opens SchedulePrintModal with thisWeek scope active
        const printBtn = screen.getByTestId('weekly-print-btn');
        fireEvent.click(printBtn);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        const printThisWeekBtn = screen.getByTestId('print-scope-thisweek-btn');
        expect(printThisWeekBtn).toHaveClass('bg-amber-600');
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));

        // 3. Switch Weekly View to master scope
        const masterScopeBtn = screen.getByTestId('weekly-scope-master-btn');
        fireEvent.click(masterScopeBtn);

        // 4. In master scope, "+ 새 일정 추가" opens ScheduleEditModal preset to master scope
        fireEvent.click(screen.getByTestId('weekly-add-item-btn'));
        expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();
        const masterRadio = screen.getByTestId('scope-master-radio');
        expect(masterRadio).toHaveClass('bg-white');
        fireEvent.click(screen.getByRole('button', { name: '취소' }));

        // 5. In master scope, "A4 1페이지 인쇄" opens SchedulePrintModal with master scope active
        fireEvent.click(screen.getByTestId('weekly-print-btn'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        const printMasterBtn = screen.getByTestId('print-scope-master-btn');
        expect(printMasterBtn).toHaveClass('bg-blue-600');
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));

        // 6. In master scope, clicking a schedule card opens ScheduleEditModal with master scope
        const mondayItem = globalScheduleStore.getItemsForWeekday(1)[0];
        const editCardBtn = screen.getByTestId(`weekly-edit-item-btn-${mondayItem.id}`);
        fireEvent.click(editCardBtn);
        expect(screen.getByTestId('schedule-edit-modal')).toBeInTheDocument();
        expect(screen.getByTestId('scope-master-radio')).toHaveClass('bg-white');
        fireEvent.click(screen.getByRole('button', { name: '취소' }));

        // 7. Temporary addition in this week is filtered out when in master scope
        globalScheduleStore.addItem(
          {
            id: 'temp-app-item-fri',
            title: '금요일 특별 세미나',
            category: 'study',
            weekday: 5,
            startHour: 15,
            startMinute: 0,
            endHour: 16,
            endMinute: 0,
            note: '',
            iconName: 'book.fill',
            subTasks: [],
            isNotificationEnabled: true,
            notificationLeadMinutes: [10],
            targetWeekKey: null,
            updatedAt: Date.now() / 1000,
          },
          [5],
          'thisWeek'
        );

        // Currently in master scope -> temporary addition is hidden
        expect(screen.queryByText('금요일 특별 세미나')).not.toBeInTheDocument();

        // Switch to thisWeek scope -> temporary addition appears
        fireEvent.click(screen.getByTestId('weekly-scope-thisweek-btn'));
        expect(screen.getByText('금요일 특별 세미나')).toBeInTheDocument();
      });
    });
  });
});
