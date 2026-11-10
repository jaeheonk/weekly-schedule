import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParentPinModal } from './ParentPinModal';
import { ScheduleStore } from '../domain/scheduleStore';

describe('ParentPinModal (Seam 2)', () => {
  let store: ScheduleStore;
  const handleSuccess = vi.fn();
  const handleClose = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    store = new ScheduleStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders modal with title, dots, keypad and close button when open', () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );

    expect(screen.getByText('부모님 6자리 마스터 PIN 입력')).toBeInTheDocument();
    expect(screen.getByTestId('pin-dots-container')).toBeInTheDocument();

    // Verify 10 keypad number buttons (0-9) and delete button
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByTestId(`keypad-btn-${i}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('keypad-btn-delete')).toBeInTheDocument();
  });

  it('enters digits via keypad and successfully unlocks on correct PIN (160125)', async () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );

    const pin = ['1', '6', '0', '1', '2', '5'];
    for (const digit of pin) {
      fireEvent.click(screen.getByTestId(`keypad-btn-${digit}`));
    }

    expect(handleSuccess).toHaveBeenCalledTimes(1);
    expect(store.isParentMode()).toBe(true);
  });

  it('displays error and remaining attempts on incorrect PIN', () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );

    const wrongPin = ['1', '1', '1', '1', '1', '1'];
    for (const digit of wrongPin) {
      fireEvent.click(screen.getByTestId(`keypad-btn-${digit}`));
    }

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('pin-error-message')).toHaveTextContent(/남은 기회 4회/);
    expect(store.getFailedPinAttempts()).toBe(1);
  });

  it('handles delete button to remove last entered digit', () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );

    fireEvent.click(screen.getByTestId('keypad-btn-1'));
    fireEvent.click(screen.getByTestId('keypad-btn-2'));

    const dots = screen.getAllByTestId('pin-dot');
    expect(dots[0]).toHaveAttribute('data-filled', 'true');
    expect(dots[1]).toHaveAttribute('data-filled', 'true');
    expect(dots[2]).toHaveAttribute('data-filled', 'false');

    // Click delete
    fireEvent.click(screen.getByTestId('keypad-btn-delete'));
    expect(dots[1]).toHaveAttribute('data-filled', 'false');
  });

  it('locks out for 60 seconds after 5 consecutive failures and displays live countdown', () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );

    // Fail 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      for (let d = 0; d < 6; d++) {
        fireEvent.click(screen.getByTestId('keypad-btn-0'));
      }
    }

    expect(store.isPinLockedOut()).toBe(true);
    expect(screen.getByTestId('lockout-view')).toBeInTheDocument();
    expect(screen.getByText(/비밀번호를 5회 연속 잘못 입력하여/)).toBeInTheDocument();

    const countdownText = screen.getByTestId('lockout-countdown');
    expect(countdownText).toBeInTheDocument();
    expect(countdownText.textContent).toMatch(/\d+초/);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ParentPinModal
        isOpen={false}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders custom reason and description when reason prop is provided', () => {
    render(
      <ParentPinModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        store={store}
        reason="보상 교환 승인"
      />
    );

    expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('보상 교환 승인');
    expect(screen.getByText(/보상 교환 승인을 위해/)).toBeInTheDocument();
  });
});
