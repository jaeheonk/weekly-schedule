import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RewardExchangeModal } from './RewardExchangeModal';
import { ScheduleStore } from '../domain/scheduleStore';
import * as soundEffects from '../services/soundEffects';

vi.mock('../services/soundEffects', () => ({
  playCompletionChime: vi.fn(),
}));

describe('RewardExchangeModal (Seam 2 / Issue 01)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    store = new ScheduleStore();
  });

  it('does not render dialog when isOpen is false', () => {
    render(<RewardExchangeModal isOpen={false} onClose={vi.fn()} store={store} />);
    expect(screen.queryByTestId('reward-exchange-modal')).not.toBeInTheDocument();
  });

  it('renders balance hero card with available, earned, spent hearts and child mode badge', () => {
    store.sendFamilyPraise({
      hearts: 20,
      sticker: 'heart',
      message: '잘했어!',
    });

    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    expect(screen.getByTestId('reward-exchange-modal')).toBeInTheDocument();
    expect(screen.getByTestId('balance-hero-card')).toBeInTheDocument();
    expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('20');
    expect(screen.getByTestId('total-earned-hearts')).toHaveTextContent('20');
    expect(screen.getByTestId('total-spent-hearts')).toHaveTextContent('0');
    expect(screen.getByTestId('user-mode-badge')).toHaveTextContent('아이 모드');
  });

  it('renders parent mode badge when parent mode is active', () => {
    store.unlockParentMode();
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);
    expect(screen.getByTestId('user-mode-badge')).toHaveTextContent('부모 모드');
  });

  it('renders the 8 default reward presets with correct emojis, titles, and heart costs', () => {
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const presetCards = screen.getAllByTestId(/^preset-card-/);
    expect(presetCards).toHaveLength(8);

    expect(screen.getByText('자유 놀이 / 게임 30분')).toBeInTheDocument();
    expect(screen.getByText('달콤한 간식 / 아이스크림')).toBeInTheDocument();
    expect(screen.getByText('문구 / 장난감 선물')).toBeInTheDocument();
    expect(screen.getByText('주말 특별 가족 나들이')).toBeInTheDocument();
    expect(screen.getByText('용돈 2,000원 교환')).toBeInTheDocument();
    expect(screen.getByText('영화 / 만화 시청 1편')).toBeInTheDocument();
    expect(screen.getByText('30분 늦게 자기 쿠폰')).toBeInTheDocument();
    expect(screen.getByText('오늘 저녁 메뉴 고르기')).toBeInTheDocument();
  });

  it('auto-fills reward title and required hearts when a preset card is tapped', () => {
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const titleInput = screen.getByTestId('reward-title-input') as HTMLInputElement;
    const snackPreset = screen.getByTestId('preset-card-00000000-0000-0000-0000-000000000102');

    fireEvent.click(snackPreset);

    expect(titleInput.value).toBe('달콤한 간식 / 아이스크림');
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('5');
  });

  it('allows custom text input for custom reward titles', () => {
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const titleInput = screen.getByTestId('reward-title-input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '포켓몬 카드 1팩' } });

    expect(titleInput.value).toBe('포켓몬 카드 1팩');
  });

  it('adjusts hearts count using stepper (-/+) buttons and quick chips (+5, +10, +15, +20)', () => {
    store.sendFamilyPraise({
      hearts: 50,
      sticker: 'heart',
      message: '충분한 하트',
    });

    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    // Click quick chip +15
    fireEvent.click(screen.getByTestId('quick-chip-15'));
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('15');

    // Click stepper plus
    fireEvent.click(screen.getByTestId('stepper-plus-btn'));
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('16');

    // Click stepper minus
    fireEvent.click(screen.getByTestId('stepper-minus-btn'));
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('15');

    // Click quick chip +20
    fireEvent.click(screen.getByTestId('quick-chip-20'));
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('20');
  });

  it('controls hearts via continuous range slider and All-in chip with live remaining preview', () => {
    store.sendFamilyPraise({
      hearts: 50,
      sticker: 'heart',
      message: '하트 50개',
    });

    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const slider = screen.getByTestId('heart-range-slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '50');

    // Change slider value to 25
    fireEvent.change(slider, { target: { value: '25' } });
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('25');
    expect(screen.getByTestId('remaining-hearts-preview')).toHaveTextContent('25개');

    // Click "All-in" chip
    const allInChip = screen.getByTestId('quick-chip-all-in');
    expect(allInChip).toBeInTheDocument();
    expect(allInChip).toHaveTextContent(/전액/);

    fireEvent.click(allInChip);
    expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('50');
    expect(screen.getByTestId('remaining-hearts-preview')).toHaveTextContent('0개');
  });

  it('disables submit button and shows warning if amount is 0 or exceeds available balance via input', () => {
    store.sendFamilyPraise({
      hearts: 20,
      sticker: 'heart',
      message: '하트 20개',
    });

    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const numberInput = screen.getByTestId('hearts-number-input');
    const submitBtn = screen.getByTestId('redeem-submit-btn');

    // Input 0
    fireEvent.change(numberInput, { target: { value: '0' } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('overdraft-warning')).toBeInTheDocument();

    // Input 25 (exceeds 20)
    fireEvent.change(numberInput, { target: { value: '25' } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('overdraft-warning')).toHaveTextContent(/부족합니다|초과/);
  });

  it('in child mode, prompts for 6-digit Master PIN with reason "보상 교환 승인" and approves upon correct PIN', async () => {
    store.sendFamilyPraise({
      hearts: 30,
      sticker: 'heart',
      message: '칭찬 하트',
    });

    const onClose = vi.fn();
    render(<RewardExchangeModal isOpen={true} onClose={onClose} store={store} />);

    // Select preset
    const gamePreset = screen.getByTestId('preset-card-00000000-0000-0000-0000-000000000101');
    fireEvent.click(gamePreset);

    const submitBtn = screen.getByTestId('redeem-submit-btn');
    fireEvent.click(submitBtn);

    // PIN modal should be open with reason "보상 교환 승인"
    const pinModal = screen.getByTestId('parent-pin-modal');
    expect(pinModal).toBeInTheDocument();
    expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('보상 교환 승인');
    expect(store.getAvailableHearts()).toBe(30); // Not redeemed yet

    // Wrong PIN: 111111
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId('keypad-btn-1'));
    }
    expect(screen.getByTestId('pin-error-message')).toBeInTheDocument();
    expect(store.getAvailableHearts()).toBe(30); // Still not redeemed

    // Correct PIN: 160125
    const correctPin = ['1', '6', '0', '1', '2', '5'];
    for (const d of correctPin) {
      fireEvent.click(screen.getByTestId(`keypad-btn-${d}`));
    }

    // Modal closes and redemption completes
    expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
    expect(store.getAvailableHearts()).toBe(20);
    expect(store.getRewardRedemptions()).toHaveLength(1);
    expect(soundEffects.playCompletionChime).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('in parent mode, redeems immediately without prompting for PIN', () => {
    store.unlockParentMode();
    store.sendFamilyPraise({
      hearts: 30,
      sticker: 'heart',
      message: '칭찬 하트',
    });

    const onClose = vi.fn();
    render(<RewardExchangeModal isOpen={true} onClose={onClose} store={store} />);

    const gamePreset = screen.getByTestId('preset-card-00000000-0000-0000-0000-000000000101');
    fireEvent.click(gamePreset);

    const submitBtn = screen.getByTestId('redeem-submit-btn');
    fireEvent.click(submitBtn);

    expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
    expect(store.getAvailableHearts()).toBe(20);
    expect(store.getRewardRedemptions()).toHaveLength(1);
    expect(soundEffects.playCompletionChime).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit button and shows warning if hearts to spend exceed available balance', () => {
    // 0 hearts available
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    const submitBtn = screen.getByTestId('redeem-submit-btn');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('overdraft-warning')).toHaveTextContent('부족합니다');
  });

  it('disables stepper plus, range slider, and all-in chip when available balance is 0', () => {
    // 0 hearts available
    render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

    expect(screen.getByTestId('stepper-plus-btn')).toBeDisabled();
    expect(screen.getByTestId('heart-range-slider')).toBeDisabled();
    expect(screen.getByTestId('quick-chip-all-in')).toBeDisabled();
  });
});
