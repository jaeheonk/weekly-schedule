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

  describe('Redemption History & Refunds (Seam 2 / Issue 03)', () => {
    it('displays friendly empty state when there are no recent redemptions', () => {
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      expect(screen.getByTestId('redemption-history-section')).toBeInTheDocument();
      expect(screen.getByTestId('redemption-history-empty')).toBeInTheDocument();
      expect(screen.getByTestId('redemption-history-empty')).toHaveTextContent(
        '아직 교환한 보상 내역이 없어요'
      );
    });

    it('renders redemption history items with title, heart cost, timestamp, and role badge', () => {
      store.sendFamilyPraise({
        hearts: 50,
        sticker: 'heart',
        message: '하트 충전',
      });
      // Redeem in child mode
      store.redeemReward('아이스크림', 5);

      // Redeem in parent mode
      store.unlockParentMode();
      store.redeemReward('주말 나들이', 30);

      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      expect(screen.queryByTestId('redemption-history-empty')).not.toBeInTheDocument();

      const redemptions = store.getRewardRedemptions();
      expect(redemptions).toHaveLength(2);

      // Check newest item (주말 나들이)
      const outingItem = screen.getByTestId(`redemption-item-${redemptions[0].id}`);
      expect(outingItem).toBeInTheDocument();
      expect(screen.getByTestId(`redemption-title-${redemptions[0].id}`)).toHaveTextContent('주말 나들이');
      expect(screen.getByTestId(`redemption-hearts-${redemptions[0].id}`)).toHaveTextContent('-30개');
      expect(screen.getByTestId(`redemption-role-${redemptions[0].id}`)).toHaveTextContent('부모');

      // Check older item (아이스크림)
      const iceItem = screen.getByTestId(`redemption-item-${redemptions[1].id}`);
      expect(iceItem).toBeInTheDocument();
      expect(screen.getByTestId(`redemption-title-${redemptions[1].id}`)).toHaveTextContent('아이스크림');
      expect(screen.getByTestId(`redemption-hearts-${redemptions[1].id}`)).toHaveTextContent('-5개');
      expect(screen.getByTestId(`redemption-role-${redemptions[1].id}`)).toHaveTextContent('아이');
    });

    it('does not display refund button in child mode', () => {
      store.sendFamilyPraise({
        hearts: 50,
        sticker: 'heart',
        message: '하트 충전',
      });
      store.redeemReward('아이스크림', 5);

      const redemptions = store.getRewardRedemptions();
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      expect(screen.queryByTestId(`refund-btn-${redemptions[0].id}`)).not.toBeInTheDocument();
    });

    it('displays refund button in parent mode, prompts confirmation modal, and cancels if rejected', () => {
      store.unlockParentMode();
      store.sendFamilyPraise({
        hearts: 50,
        sticker: 'heart',
        message: '하트 충전',
      });
      store.redeemReward('게임 30분', 10);

      const redemptions = store.getRewardRedemptions();
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      const refundBtn = screen.getByTestId(`refund-btn-${redemptions[0].id}`);
      expect(refundBtn).toBeInTheDocument();

      // Click refund button -> opens confirmation dialog
      fireEvent.click(refundBtn);
      const confirmDialog = screen.getByTestId('refund-confirm-dialog');
      expect(confirmDialog).toBeInTheDocument();
      expect(confirmDialog).toHaveTextContent('게임 30분');
      expect(confirmDialog).toHaveTextContent('하트 10개');

      // Click cancel in confirmation dialog
      const cancelBtn = screen.getByTestId('cancel-refund-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('refund-confirm-dialog')).not.toBeInTheDocument();
      // Redemption should still exist
      expect(store.getRewardRedemptions()).toHaveLength(1);
      expect(screen.getByTestId(`redemption-item-${redemptions[0].id}`)).toBeInTheDocument();
    });

    it('executes refund upon confirmation in parent mode, updates available balance and removes item from list', () => {
      store.unlockParentMode();
      store.sendFamilyPraise({
        hearts: 50,
        sticker: 'heart',
        message: '하트 충전',
      });
      store.redeemReward('선물 교환', 20);

      const toasts: string[] = [];
      store.onToast((msg) => toasts.push(msg));

      const redemptions = store.getRewardRedemptions();
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('30');
      expect(screen.getByTestId('total-spent-hearts')).toHaveTextContent('20');

      // Click refund button
      fireEvent.click(screen.getByTestId(`refund-btn-${redemptions[0].id}`));

      // Confirm refund
      const confirmBtn = screen.getByTestId('confirm-refund-btn');
      fireEvent.click(confirmBtn);

      // Confirmation dialog should close
      expect(screen.queryByTestId('refund-confirm-dialog')).not.toBeInTheDocument();

      // Item should be removed and empty state shown
      expect(screen.queryByTestId(`redemption-item-${redemptions[0].id}`)).not.toBeInTheDocument();
      expect(screen.getByTestId('redemption-history-empty')).toBeInTheDocument();

      // Hero balance card should reflect restored hearts
      expect(screen.getByTestId('available-hearts-value')).toHaveTextContent('50');
      expect(screen.getByTestId('total-spent-hearts')).toHaveTextContent('0');

      // Toast emitted
      expect(toasts).toContain('↩️ [선물 교환] 교환이 취소되어 하트 20개가 복구되었어요.');
    });
  });

  describe('Preset Management & PIN Authorization (Seam 2 / Issue 04)', () => {
    it('renders "추천 보상 관리" button in the preset recommendations header', () => {
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      const manageBtn = screen.getByTestId('manage-presets-btn');
      expect(manageBtn).toBeInTheDocument();
      expect(manageBtn).toHaveTextContent('추천 보상 관리');
    });

    it('in child mode, clicking "추천 보상 관리" opens PIN modal and launches manage modal after valid PIN', () => {
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      // Click "추천 보상 관리"
      fireEvent.click(screen.getByTestId('manage-presets-btn'));

      // PIN modal opens
      expect(screen.getByTestId('parent-pin-modal')).toBeInTheDocument();
      expect(screen.getByTestId('pin-reason-badge')).toHaveTextContent('추천 보상 관리 승인');
      expect(screen.queryByTestId('preset-manage-modal')).not.toBeInTheDocument();

      // Enter default PIN: 160125 via keypad
      const correctPin = ['1', '6', '0', '1', '2', '5'];
      for (const d of correctPin) {
        fireEvent.click(screen.getByTestId(`keypad-btn-${d}`));
      }

      // PIN modal closes and preset manage modal opens
      expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('preset-manage-modal')).toBeInTheDocument();
    });

    it('in parent mode, clicking "추천 보상 관리" opens preset manage modal immediately without PIN', () => {
      store.unlockParentMode();
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      fireEvent.click(screen.getByTestId('manage-presets-btn'));

      // No PIN modal; manage modal is immediately opened
      expect(screen.queryByTestId('parent-pin-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('preset-manage-modal')).toBeInTheDocument();
    });

    it('preset modifications from manage modal immediately update preset cards in exchange modal', () => {
      store.unlockParentMode();
      render(<RewardExchangeModal isOpen={true} onClose={vi.fn()} store={store} />);

      // Initially 8 preset cards
      expect(screen.getAllByTestId(/^preset-card-/)).toHaveLength(8);

      // Open manage modal
      fireEvent.click(screen.getByTestId('manage-presets-btn'));

      // Add a new preset
      fireEvent.click(screen.getByTestId('add-preset-btn'));
      fireEvent.click(screen.getByTestId('emoji-option-🍕'));
      fireEvent.change(screen.getByTestId('preset-title-input'), {
        target: { value: '금요일 피자 파티' },
      });
      fireEvent.change(screen.getByTestId('preset-hearts-input'), {
        target: { value: '25' },
      });
      fireEvent.click(screen.getByTestId('save-preset-btn'));

      // Close manage modal
      fireEvent.click(screen.getByTestId('close-preset-manage-modal-btn'));

      // Now 9 preset cards in exchange modal, including the new pizza party preset
      const cards = screen.getAllByTestId(/^preset-card-/);
      expect(cards).toHaveLength(9);
      expect(screen.getByText('금요일 피자 파티')).toBeInTheDocument();
      expect(screen.getByText('25개')).toBeInTheDocument();

      // Click on newly added preset card
      const newCard = screen.getByText('금요일 피자 파티').closest('button');
      expect(newCard).toBeInTheDocument();
      fireEvent.click(newCard!);

      // Form inputs populate with new preset data
      expect(screen.getByTestId('reward-title-input')).toHaveValue('금요일 피자 파티');
      expect(screen.getByTestId('hearts-to-spend-value')).toHaveTextContent('25');
    });
  });
});
