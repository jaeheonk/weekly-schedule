import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PraiseHeartModal } from './PraiseHeartModal';
import { ScheduleStore } from '../domain/scheduleStore';
import { ScheduleItem } from '../types/schedule';

describe('PraiseHeartModal (Seam 3)', () => {
  let store: ScheduleStore;
  const handleClose = vi.fn();
  let testItem: ScheduleItem;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    store = new ScheduleStore();
    testItem = store.getTodayItems().find((i) => store.isItemCheckable(i))!;
  });

  it('renders modal with sticker presets, heart count options and comment field for schedule item', () => {
    render(
      <PraiseHeartModal
        isOpen={true}
        onClose={handleClose}
        targetItem={testItem}
        store={store}
      />
    );

    expect(screen.getByText('숙제 칭찬 & 메시지 남기기')).toBeInTheDocument();
    expect(screen.getByText(testItem.title)).toBeInTheDocument();

    // 6 sticker buttons
    expect(screen.getByTestId('sticker-btn-heart')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-btn-star')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-btn-thumbsUp')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-btn-clap')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-btn-fire')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-btn-crown')).toBeInTheDocument();

    // Heart count presets (+1, +3, +5, +10)
    expect(screen.getByTestId('heart-preset-1')).toBeInTheDocument();
    expect(screen.getByTestId('heart-preset-3')).toBeInTheDocument();
    expect(screen.getByTestId('heart-preset-5')).toBeInTheDocument();
    expect(screen.getByTestId('heart-preset-10')).toBeInTheDocument();

    // Also verify checkbox toggle
    expect(screen.getByTestId('also-verify-toggle')).toBeInTheDocument();

    // Send button
    expect(screen.getByTestId('send-praise-btn')).toBeInTheDocument();
  });

  it('selects +5 hearts, sticker, and quick comment then sends reaction to item', () => {
    // Child completes the item first
    store.toggleCompletion(testItem);

    render(
      <PraiseHeartModal
        isOpen={true}
        onClose={handleClose}
        targetItem={testItem}
        store={store}
      />
    );

    // Select crown sticker
    fireEvent.click(screen.getByTestId('sticker-btn-crown'));

    // Select +5 hearts
    fireEvent.click(screen.getByTestId('heart-preset-5'));

    // Click quick comment preset
    const presetBtn = screen.getByText('오늘의 숙제 챔피언! 정말 사랑해 👑');
    fireEvent.click(presetBtn);

    // Toggle also-verify
    const verifyToggle = screen.getByTestId('also-verify-toggle');
    fireEvent.click(verifyToggle);

    // Send
    fireEvent.click(screen.getByTestId('send-praise-btn'));

    expect(handleClose).toHaveBeenCalledTimes(1);

    const reaction = store.getItemReaction(testItem);
    expect(reaction).toBeDefined();
    expect(reaction?.heartCount).toBe(5);
    expect(reaction?.sticker).toBe('crown');
    expect(reaction?.comment).toBe('오늘의 숙제 챔피언! 정말 사랑해 👑');
    expect(store.isParentVerified(testItem)).toBe(true);
  });

  it('renders family banner cheer modal when targetItem is null and sends general praise', () => {
    render(
      <PraiseHeartModal
        isOpen={true}
        onClose={handleClose}
        targetItem={null}
        store={store}
      />
    );

    expect(screen.getByText('아이에게 응원 메시지 보내기')).toBeInTheDocument();
    expect(screen.queryByTestId('also-verify-toggle')).not.toBeInTheDocument();

    // Select +10 hearts
    fireEvent.click(screen.getByTestId('heart-preset-10'));

    // Type comment
    const input = screen.getByTestId('praise-comment-input');
    fireEvent.change(input, { target: { value: '이번 주도 화이팅하자!' } });

    // Send
    fireEvent.click(screen.getByTestId('send-praise-btn'));

    expect(handleClose).toHaveBeenCalledTimes(1);
    const notes = store.getPraiseNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].hearts).toBe(10);
    expect(notes[0].message).toBe('이번 주도 화이팅하자!');
  });

  it('disables send button when 0 hearts selected and comment is empty', () => {
    render(
      <PraiseHeartModal
        isOpen={true}
        onClose={handleClose}
        targetItem={testItem}
        store={store}
      />
    );

    // Select 0 hearts
    fireEvent.click(screen.getByTestId('heart-preset-0'));

    const sendBtn = screen.getByTestId('send-praise-btn');
    expect(sendBtn).toBeDisabled();

    // Entering text enables the send button
    const input = screen.getByTestId('praise-comment-input');
    fireEvent.change(input, { target: { value: '메시지만 전송' } });
    expect(sendBtn).not.toBeDisabled();
  });
});
