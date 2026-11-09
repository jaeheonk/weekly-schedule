import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRewardShopView } from './StarRewardShopView';
import { ScheduleStore } from '../domain/scheduleStore';

describe('StarRewardShopView (Seam 2 / Issue 06)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    const nov9 = new Date(2026, 10, 9); // Monday
    store = new ScheduleStore({ currentDate: nov9 });
  });

  it('renders hero balance card with available stars, hearts, and Robux goal progress', () => {
    render(<StarRewardShopView store={store} />);

    expect(screen.getByTestId('star-balance-hero-card')).toBeInTheDocument();
    expect(screen.getByText('보유 중인 스타')).toBeInTheDocument();
    expect(screen.getAllByText(/로블록스 로벅스 500개/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('보상 교환소')).toBeInTheDocument();
    expect(screen.getByText('스타 원장 내역')).toBeInTheDocument();
  });

  it('allows child to submit reward redemption request when stars are available', () => {
    // Give 2 stars to store
    const items = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
    for (const item of items) store.toggleCompletion(item);
    store.unlockParentMode();
    for (const item of items) store.toggleParentVerification(item);
    store.awardDailyStar(1);
    store.lockParentMode();

    render(<StarRewardShopView store={store} />);

    // Heart box preset costs 1 star
    const requestBtn = screen.getByTestId('request-redemption-00000000-0000-0000-0000-000000000201');
    expect(requestBtn).toBeEnabled();
    expect(requestBtn).toHaveTextContent('교환 신청하기');

    fireEvent.click(requestBtn);

    // Request becomes pending
    expect(screen.getByText(/부모님 승인 대기 중인 교환 신청/)).toBeInTheDocument();
    expect(store.getPendingStarRedemptionCount()).toBe(1);
  });

  it('allows parent to approve pending request and updates ledger and hearts', () => {
    // Give 1 star and child requests heart bonus
    const items = store.getItemsForWeekday(1).filter((it) => store.isItemCheckable(it));
    for (const item of items) store.toggleCompletion(item);
    store.unlockParentMode();
    for (const item of items) store.toggleParentVerification(item);
    store.awardDailyStar(1);

    const heartPreset = store.getStarRewardPresets().find((p) => p.actionType === 'convertToHearts')!;
    store.requestStarRedemption(heartPreset);
    expect(store.getPendingStarRedemptionCount()).toBe(1);

    // Render in parent mode
    store.unlockParentMode();
    render(<StarRewardShopView store={store} />);

    const approveBtn = screen.getByTestId('approve-redemption-button');
    expect(approveBtn).toBeInTheDocument();
    fireEvent.click(approveBtn);

    // Pending count drops to 0
    expect(store.getPendingStarRedemptionCount()).toBe(0);
    expect(store.getAvailableStars()).toBe(0);
    expect(store.getTotalSpentStars()).toBe(1);
    expect(store.getAvailableHearts()).toBe(5);

    // Switch to ledger tab to see recorded transaction
    const ledgerTab = screen.getByRole('tab', { name: /스타 원장 내역/ });
    fireEvent.click(ledgerTab);

    expect(screen.getByText(/하트 5개 보너스 상자 교환/)).toBeInTheDocument();
    expect(screen.getByText('-1⭐')).toBeInTheDocument();
  });
});
