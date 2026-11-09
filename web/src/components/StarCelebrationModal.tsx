import React from 'react';
import { Sparkles, Star, Crown } from 'lucide-react';
import { StarCelebrationContext } from '../types/snapshot';

export interface StarCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStarShop?: () => void;
  context: StarCelebrationContext | null;
}

export const StarCelebrationModal: React.FC<StarCelebrationModalProps> = ({
  isOpen,
  onClose,
  onOpenStarShop,
  context,
}) => {
  if (!isOpen || !context) return null;

  const isRewardApproval = !!context.approvedRewardTitle;
  const isWeeklyBonus = context.earnedWeeklyBonus > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="star-celebration-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-amber-200 animate-in zoom-in-95 duration-200 flex flex-col items-center">
        {/* Glow Ring with Badge */}
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-300 via-yellow-200 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-300/50 animate-bounce">
            <span className="text-5xl">
              {isRewardApproval
                ? context.approvedRewardEmoji || '🎁'
                : isWeeklyBonus
                ? '👑'
                : '⭐'}
            </span>
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-amber-500">
            <Sparkles className="w-4 h-4 fill-amber-400 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-slate-900 mb-1.5">
          {isRewardApproval ? (
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              🎁 [{context.approvedRewardTitle}] 교환 승인!
            </span>
          ) : isWeeklyBonus ? (
            <span className="bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
              🎉 이번 주 평일 올클리어 달성!
            </span>
          ) : (
            '⭐ 오늘의 올클리어 스타 획득!'
          )}
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 font-medium mb-4 leading-relaxed">
          {isRewardApproval
            ? '부모님의 확인으로 보상 교환이 확정되었어요! 멋진 하루를 보내세요.'
            : isWeeklyBonus
            ? '평일 스타 +1개와 주간 올클리어 자동 보너스 +2개를 한꺼번에 받았어요!'
            : '오늘 해야 할 일을 모두 끝내고 부모님 확인까지 완벽히 마쳤어요!'}
        </p>

        {/* Reward Chips */}
        {!isRewardApproval && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {context.earnedDailyStar > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-black">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>일일 보상 +{context.earnedDailyStar}</span>
              </div>
            )}

            {isWeeklyBonus && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-800 text-xs font-black">
                <Crown className="w-3.5 h-3.5 text-purple-600" />
                <span>주간 보너스 +{context.earnedWeeklyBonus}</span>
              </div>
            )}
          </div>
        )}

        {/* Balance Display */}
        <div className="text-xs font-bold text-slate-500 mb-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60 w-full">
          현재 보유 스타:{' '}
          <span className="text-amber-600 font-extrabold text-sm">
            {context.totalAvailableStars}⭐
          </span>
        </div>

        {/* Action Buttons */}
        {isRewardApproval ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all active:scale-95"
          >
            확인
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              확인
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStarShop?.();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>스타 상점 가기</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
