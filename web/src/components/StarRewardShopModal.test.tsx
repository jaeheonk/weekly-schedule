import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRewardShopModal } from './StarRewardShopModal';
import { ScheduleStore } from '../domain/scheduleStore';

describe('StarRewardShopModal (iOS StarRewardShopSheet parity)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store = new ScheduleStore({ currentDate: new Date(2026, 10, 9) });
  });

  it('renders nothing when closed', () => {
    render(<StarRewardShopModal isOpen={false} onClose={vi.fn()} store={store} />);
    expect(screen.queryByTestId('star-shop-modal')).not.toBeInTheDocument();
  });

  it('renders the star shop content inside a dialog with a title and close button', () => {
    const onClose = vi.fn();
    render(<StarRewardShopModal isOpen onClose={onClose} store={store} />);

    const modal = screen.getByTestId('star-shop-modal');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: '스타 보상 상점' })).toBeInTheDocument();
    expect(screen.getByTestId('star-reward-shop-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-star-shop-modal-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click and Escape, but not when clicking inside the sheet', () => {
    const onClose = vi.fn();
    render(<StarRewardShopModal isOpen onClose={onClose} store={store} />);

    fireEvent.click(screen.getByTestId('star-balance-hero-card'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('star-shop-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while another dialog (e.g. parent PIN) is stacked on top', () => {
    const onClose = vi.fn();
    render(
      <>
        <StarRewardShopModal isOpen onClose={onClose} store={store} />
        <div role="dialog" aria-modal="true" data-testid="stacked-dialog" />
      </>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('forwards the heart exchange shortcut to the heart shop', () => {
    const onOpenRewardExchange = vi.fn();
    render(
      <StarRewardShopModal
        isOpen
        onClose={vi.fn()}
        onOpenRewardExchange={onOpenRewardExchange}
        store={store}
      />
    );

    fireEvent.click(screen.getByTestId('star-shop-heart-balance-badge'));
    expect(onOpenRewardExchange).toHaveBeenCalledTimes(1);
  });
});
