import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navigation } from './Navigation';

describe('Navigation Header Component', () => {
  const defaultProps = {
    activeTab: 'today' as const,
    onSelectTab: vi.fn(),
    currentDate: new Date('2026-11-10T12:00:00Z'),
    isSyncing: false,
    onSync: vi.fn(),
    onOpenPrint: vi.fn(),
    isParentMode: false,
    onOpenParentPin: vi.fn(),
    onLockParentMode: vi.fn(),
    onOpenRewardExchange: vi.fn(),
    availableHearts: 18,
    availableStars: 1,
    pendingStarRedemptions: 0,
  };

  it('renders brand title and weekly schedule subtext', () => {
    render(<Navigation {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1, name: '주간 시간표' })).toBeInTheDocument();
    expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
  });

  it('renders date and week key chips for both desktop and mobile views', () => {
    render(<Navigation {...defaultProps} />);
    // Date formatted string and week key appear in desktop and mobile chips
    const weekKeyElements = screen.getAllByText('2026-W46');
    expect(weekKeyElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders hearts, stars badges and mode switcher button', () => {
    render(<Navigation {...defaultProps} />);
    const heartBadge = screen.getByTestId('header-hearts-badge');
    expect(heartBadge).toBeInTheDocument();
    expect(heartBadge).toHaveTextContent('18');

    const starBadge = screen.getByTestId('header-stars-badge');
    expect(starBadge).toBeInTheDocument();
    expect(starBadge).toHaveTextContent('1');

    const modeBtn = screen.getByTestId('mode-switch-button');
    expect(modeBtn).toBeInTheDocument();
    expect(modeBtn).toHaveTextContent('부모 모드');
  });

  it('hides print button on mobile viewport via hidden sm:flex', () => {
    render(<Navigation {...defaultProps} />);
    const printBtn = screen.getByTestId('header-print-button');
    expect(printBtn).toBeInTheDocument();
    expect(printBtn.className).toContain('hidden');
    expect(printBtn.className).toContain('sm:flex');
  });

  it('renders parent mode indicator and lock button when in parent mode', () => {
    render(<Navigation {...defaultProps} isParentMode={true} />);
    expect(screen.getByTestId('parent-mode-indicator')).toHaveTextContent('부모 모드');
    const lockBtn = screen.getByTestId('mode-lock-button');
    expect(lockBtn).toBeInTheDocument();

    fireEvent.click(lockBtn);
    expect(defaultProps.onLockParentMode).toHaveBeenCalled();
  });

  it('renders responsive 2-tab navigation grid without a Star Shop tab and handles tab clicks', () => {
    const onSelectTab = vi.fn();
    render(<Navigation {...defaultProps} onSelectTab={onSelectTab} />);

    const nav = screen.getByRole('navigation', { name: '메인 내비게이션' });
    expect(nav.className).toContain('grid');
    expect(nav.className).toContain('grid-cols-2');
    expect(screen.queryByTestId('nav-tab-stars')).not.toBeInTheDocument();
    expect(nav.querySelectorAll('button')).toHaveLength(2);

    const todayTab = screen.getByRole('button', { name: /오늘의 할 일/i });
    const weeklyTab = screen.getByRole('button', { name: /주간 시간표/i });

    fireEvent.click(weeklyTab);
    expect(onSelectTab).toHaveBeenCalledWith('weekly');

    fireEvent.click(todayTab);
    expect(onSelectTab).toHaveBeenCalledWith('today');
  });

  it('opens the Star Shop modal (not a tab) when the header star badge is tapped', () => {
    const onSelectTab = vi.fn();
    const onOpenStarShop = vi.fn();
    render(
      <Navigation {...defaultProps} onSelectTab={onSelectTab} onOpenStarShop={onOpenStarShop} />
    );

    fireEvent.click(screen.getByTestId('header-stars-badge'));
    expect(onOpenStarShop).toHaveBeenCalledTimes(1);
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});
