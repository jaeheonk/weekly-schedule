import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RewardPresetManageModal } from './RewardPresetManageModal';
import { ScheduleStore } from '../domain/scheduleStore';

describe('RewardPresetManageModal (Seam 2 / Issue 04)', () => {
  let store: ScheduleStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store = new ScheduleStore();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RewardPresetManageModal isOpen={false} onClose={vi.fn()} store={store} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders preset list with emoji, title, tag, and heart cost when opened', () => {
    render(
      <RewardPresetManageModal isOpen={true} onClose={vi.fn()} store={store} />
    );

    expect(screen.getByTestId('preset-manage-modal')).toBeInTheDocument();
    expect(screen.getByText('추천 보상 관리')).toBeInTheDocument();

    const presets = store.getRewardPresets();
    expect(presets).toHaveLength(8);

    presets.forEach((preset) => {
      const item = screen.getByTestId(`preset-manage-item-${preset.id}`);
      expect(item).toBeInTheDocument();
      expect(item).toHaveTextContent(preset.emoji);
      expect(item).toHaveTextContent(preset.title);
      expect(item).toHaveTextContent(preset.tag);
      expect(item).toHaveTextContent(`${preset.hearts}개`);
      expect(screen.getByTestId(`edit-preset-btn-${preset.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`delete-preset-btn-${preset.id}`)).toBeInTheDocument();
    });
  });

  it('deletes a preset when delete button is clicked', () => {
    render(
      <RewardPresetManageModal isOpen={true} onClose={vi.fn()} store={store} />
    );

    const presets = store.getRewardPresets();
    const target = presets[0];

    fireEvent.click(screen.getByTestId(`delete-preset-btn-${target.id}`));

    expect(screen.queryByTestId(`preset-manage-item-${target.id}`)).not.toBeInTheDocument();
    expect(store.getRewardPresets()).toHaveLength(7);
  });

  it('opens add preset sub-modal with 16-emoji palette, fills form, and adds new preset', () => {
    render(
      <RewardPresetManageModal isOpen={true} onClose={vi.fn()} store={store} />
    );

    // Click "새 보상 추가"
    fireEvent.click(screen.getByTestId('add-preset-btn'));

    expect(screen.getByTestId('preset-form-modal')).toBeInTheDocument();
    expect(screen.getByText('새 추천 보상 추가')).toBeInTheDocument();

    // Verify 16 emoji palette grid is present
    const palette = screen.getByTestId('emoji-palette-grid');
    expect(palette).toBeInTheDocument();

    const expected16Emojis = [
      '🎮', '🍦', '🧸', '🎡', '💰', '🎬', '🛌', '🍳',
      '📚', '🍕', '🚴', '🎨', '🧩', '🧁', '🎳', '🎁',
    ];
    expected16Emojis.forEach((emoji) => {
      expect(screen.getByTestId(`emoji-option-${emoji}`)).toBeInTheDocument();
    });

    // Select 🍕 emoji
    fireEvent.click(screen.getByTestId('emoji-option-🍕'));
    expect(screen.getByTestId('selected-emoji-preview')).toHaveTextContent('🍕');

    // Fill title
    const titleInput = screen.getByTestId('preset-title-input');
    fireEvent.change(titleInput, { target: { value: '맛있는 피자 파티' } });

    // Fill hearts count
    const heartsInput = screen.getByTestId('preset-hearts-input');
    fireEvent.change(heartsInput, { target: { value: '25' } });

    // Fill or select tag
    const tagInput = screen.getByTestId('preset-tag-input');
    fireEvent.change(tagInput, { target: { value: '외식' } });

    // Submit form
    fireEvent.click(screen.getByTestId('save-preset-btn'));

    // Modal closes and new item appears in list
    expect(screen.queryByTestId('preset-form-modal')).not.toBeInTheDocument();

    const updatedPresets = store.getRewardPresets();
    expect(updatedPresets).toHaveLength(9);
    const newPreset = updatedPresets.find((p) => p.title === '맛있는 피자 파티');
    expect(newPreset).toBeDefined();
    expect(newPreset?.emoji).toBe('🍕');
    expect(newPreset?.hearts).toBe(25);
    expect(newPreset?.tag).toBe('외식');

    expect(screen.getByTestId(`preset-manage-item-${newPreset!.id}`)).toBeInTheDocument();
  });

  it('opens edit preset sub-modal, modifies values, and saves changes', () => {
    render(
      <RewardPresetManageModal isOpen={true} onClose={vi.fn()} store={store} />
    );

    const presets = store.getRewardPresets();
    const target = presets[0];

    // Click edit on first preset
    fireEvent.click(screen.getByTestId(`edit-preset-btn-${target.id}`));

    expect(screen.getByTestId('preset-form-modal')).toBeInTheDocument();
    expect(screen.getByText('추천 보상 수정')).toBeInTheDocument();

    // Verify initial values in form
    const titleInput = screen.getByTestId('preset-title-input') as HTMLInputElement;
    expect(titleInput.value).toBe(target.title);

    const heartsInput = screen.getByTestId('preset-hearts-input') as HTMLInputElement;
    expect(Number(heartsInput.value)).toBe(target.hearts);

    // Modify emoji to 📚 and title and hearts
    fireEvent.click(screen.getByTestId('emoji-option-📚'));
    fireEvent.change(titleInput, { target: { value: '원하는 책 1권 구매' } });
    fireEvent.change(heartsInput, { target: { value: '18' } });

    // Save changes
    fireEvent.click(screen.getByTestId('save-preset-btn'));

    expect(screen.queryByTestId('preset-form-modal')).not.toBeInTheDocument();

    const updated = store.getRewardPresets().find((p) => p.id === target.id);
    expect(updated?.emoji).toBe('📚');
    expect(updated?.title).toBe('원하는 책 1권 구매');
    expect(updated?.hearts).toBe(18);

    const item = screen.getByTestId(`preset-manage-item-${target.id}`);
    expect(item).toHaveTextContent('📚');
    expect(item).toHaveTextContent('원하는 책 1권 구매');
    expect(item).toHaveTextContent('18개');
  });

  it('prompts confirmation dialog and resets to 8 default presets on confirm', () => {
    // Delete 2 presets first
    const initial = store.getRewardPresets();
    store.deleteRewardPreset(initial[0].id);
    store.deleteRewardPreset(initial[1].id);
    expect(store.getRewardPresets()).toHaveLength(6);

    render(
      <RewardPresetManageModal isOpen={true} onClose={vi.fn()} store={store} />
    );

    expect(screen.getAllByTestId(/^preset-manage-item-/)).toHaveLength(6);

    // Click "기본값 복원"
    fireEvent.click(screen.getByTestId('reset-presets-btn'));

    expect(screen.getByTestId('reset-presets-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('기본값으로 복원할까요?')).toBeInTheDocument();

    // Cancel first
    fireEvent.click(screen.getByTestId('cancel-reset-presets-btn'));
    expect(screen.queryByTestId('reset-presets-confirm-dialog')).not.toBeInTheDocument();
    expect(store.getRewardPresets()).toHaveLength(6);

    // Click again and confirm
    fireEvent.click(screen.getByTestId('reset-presets-btn'));
    fireEvent.click(screen.getByTestId('confirm-reset-presets-btn'));

    expect(screen.queryByTestId('reset-presets-confirm-dialog')).not.toBeInTheDocument();
    expect(store.getRewardPresets()).toHaveLength(8);
    expect(screen.getAllByTestId(/^preset-manage-item-/)).toHaveLength(8);
  });

  it('closes on close button click or Escape key', () => {
    const handleClose = vi.fn();
    render(
      <RewardPresetManageModal isOpen={true} onClose={handleClose} store={store} />
    );

    fireEvent.click(screen.getByTestId('close-preset-manage-modal-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
