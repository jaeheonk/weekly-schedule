import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarCelebrationModal } from './StarCelebrationModal';

describe('StarCelebrationModal (Seam 2 / Issue 06)', () => {
  it('renders daily star celebration details and triggers dismiss', () => {
    const onClose = vi.fn();
    const onOpenStarShop = vi.fn();

    render(
      <StarCelebrationModal
        isOpen={true}
        onClose={onClose}
        onOpenStarShop={onOpenStarShop}
        context={{
          weekday: 1,
          earnedDailyStar: 1,
          earnedWeeklyBonus: 0,
          totalAvailableStars: 3,
        }}
      />
    );

    expect(screen.getByText('⭐ 오늘의 올클리어 스타 획득!')).toBeInTheDocument();
    expect(screen.getByText('일일 보상 +1')).toBeInTheDocument();
    expect(screen.getByText('3⭐')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders weekly bonus celebration when bonus is earned', () => {
    const onClose = vi.fn();
    const onOpenStarShop = vi.fn();

    render(
      <StarCelebrationModal
        isOpen={true}
        onClose={onClose}
        onOpenStarShop={onOpenStarShop}
        context={{
          weekday: 5,
          earnedDailyStar: 1,
          earnedWeeklyBonus: 2,
          totalAvailableStars: 7,
        }}
      />
    );

    expect(screen.getByText(/이번 주 평일 올클리어 달성/)).toBeInTheDocument();
    expect(screen.getByText('일일 보상 +1')).toBeInTheDocument();
    expect(screen.getByText('주간 보너스 +2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /스타 상점 가기/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenStarShop).toHaveBeenCalledTimes(1);
  });

  it('renders reward approval celebration when reward is approved', () => {
    const onClose = vi.fn();

    render(
      <StarCelebrationModal
        isOpen={true}
        onClose={onClose}
        context={{
          earnedDailyStar: 0,
          earnedWeeklyBonus: 0,
          totalAvailableStars: 2,
          approvedRewardTitle: '로블록스 로벅스 500개',
          approvedRewardEmoji: '🎮',
        }}
      />
    );

    expect(screen.getByText(/\[로블록스 로벅스 500개\] 교환 승인/)).toBeInTheDocument();
    expect(screen.getByText(/부모님의 확인으로 보상 교환이 확정되었어요/)).toBeInTheDocument();
    expect(screen.getByText('2⭐')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
