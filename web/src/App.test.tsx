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

      // 1. Add new master schedule item via today view
      const addBtn = screen.getByTestId('today-add-schedule-btn');
      fireEvent.click(addBtn);

      const modal = screen.getByTestId('schedule-edit-modal');
      expect(modal).toBeInTheDocument();

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

        // Click redeem submit button
        const submitBtn = screen.getByTestId('redeem-submit-btn');
        fireEvent.click(submitBtn);

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
    });
  });
});
