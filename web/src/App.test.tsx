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
    vi.spyOn(VercelBlobSyncService.prototype, 'fetchLatestBlobMetadata').mockResolvedValue({
      latest: null,
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
});
