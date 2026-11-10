import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyStarStampBoardCard } from './WeeklyStarStampBoardCard';
import { ScheduleStore } from '../domain/scheduleStore';

describe('WeeklyStarStampBoardCard (Seam 2 / Issue 06)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    const nov9 = new Date(2026, 10, 9); // Monday
    store = new ScheduleStore({ currentDate: nov9 });
  });

  it('renders star count and weekday stamp indicators', () => {
    render(
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={vi.fn()}
        onTapStarShop={vi.fn()}
        onRequestAwardStar={vi.fn()}
        initiallyExpanded={true}
      />
    );

    expect(screen.getByText('평일 스타')).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
    expect(screen.getByText('월')).toBeInTheDocument();
    expect(screen.getByText('금')).toBeInTheDocument();
    expect(screen.getByText('스타 상점 0개')).toBeInTheDocument();
  });

  it('displays claimable action banner and triggers award star callback when tasks are verified', () => {
    // Complete and verify Monday
    const items = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
    for (const item of items) {
      store.toggleCompletion(item);
    }
    store.unlockParentMode();
    for (const item of items) {
      store.toggleParentVerification(item);
    }

    const onRequestAwardStar = vi.fn();
    render(
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={vi.fn()}
        onTapStarShop={vi.fn()}
        onRequestAwardStar={onRequestAwardStar}
      />
    );

    // Banner should be visible for Monday
    const banner = screen.getByTestId('claimable-star-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('월요일');

    const awardButton = screen.getByTestId('claim-daily-star-button');
    fireEvent.click(awardButton);
    expect(onRequestAwardStar).toHaveBeenCalledWith(1);
  });

  it('navigates to star shop when clicking the shop button', () => {
    const onTapStarShop = vi.fn();
    render(
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={vi.fn()}
        onTapStarShop={onTapStarShop}
        onRequestAwardStar={vi.fn()}
      />
    );

    const shopButton = screen.getByTestId('stamp-board-shop-button');
    fireEvent.click(shopButton);
    expect(onTapStarShop).toHaveBeenCalledTimes(1);
  });

  it('switches selectedWeekday when tapping a weekday slot, highlights the selected slot, and prioritizes selectedWeekday for claimable banner', () => {
    // Complete and verify both Monday (1) and Wednesday (3)
    store.unlockParentMode();
    for (const day of [1, 3] as const) {
      const items = store.getItemsForWeekday(day).filter((it) => store.isItemCheckable(it));
      for (const item of items) {
        store.toggleCompletion(item);
        store.toggleParentVerification(item);
      }
    }

    const onTapWeekdaySlot = vi.fn();
    render(
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={onTapWeekdaySlot}
        onTapStarShop={vi.fn()}
        onRequestAwardStar={vi.fn()}
        initiallyExpanded={true}
      />
    );

    // Initially Monday (1) is selected and claimable banner targets 월요일
    expect(store.getSelectedWeekday()).toBe(1);
    expect(screen.getByTestId('stamp-slot-1')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('claimable-star-banner')).toHaveTextContent('월요일');

    // Tap Wednesday (3) slot
    fireEvent.click(screen.getByTestId('stamp-slot-3'));
    expect(onTapWeekdaySlot).toHaveBeenCalledWith(3);
    expect(store.getSelectedWeekday()).toBe(3);
    expect(screen.getByTestId('stamp-slot-3')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('stamp-slot-3').className).toContain('ring-2');

    // Claimable banner now prioritizes Wednesday (수요일)
    expect(screen.getByTestId('claimable-star-banner')).toHaveTextContent('수요일');
  });

  it('shows weekend exclusion notice when Saturday or Sunday is selected and board is expanded', () => {
    store.setSelectedWeekday(6); // Saturday

    render(
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={vi.fn()}
        onTapStarShop={vi.fn()}
        onRequestAwardStar={vi.fn()}
        initiallyExpanded={true}
      />
    );

    const notice = screen.getByTestId('stamp-board-weekend-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      '주말(토·일)은 자유 일정으로 평일 스타 적립 대상에서 제외돼요.'
    );
  });
});
