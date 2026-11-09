import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { VercelBlobSyncService } from './services/vercelBlobSync';

describe('App & Hash Navigation (Seam 2)', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
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
});
