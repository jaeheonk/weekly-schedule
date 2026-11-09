import React, { useState, useEffect } from 'react';
import {
  Star,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { WeekdayNumber, WEEKDAYS } from '../types/schedule';
import { WeekdayStarState } from '../types/snapshot';

export interface WeeklyStarStampBoardCardProps {
  store?: ScheduleStore;
  onTapWeekdaySlot?: (weekday: WeekdayNumber) => void;
  onTapStarShop?: () => void;
  onRequestAwardStar?: (weekday: WeekdayNumber) => void;
  initiallyExpanded?: boolean;
  showsShopButton?: boolean;
  selectedWeekday?: WeekdayNumber;
}

export const WeeklyStarStampBoardCard: React.FC<WeeklyStarStampBoardCardProps> = ({
  store = globalScheduleStore,
  onTapWeekdaySlot,
  onTapStarShop,
  onRequestAwardStar,
  initiallyExpanded = false,
  showsShopButton = true,
  selectedWeekday,
}) => {
  const [, setRenderVersion] = useState(0);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [store]);

  const earnedCount = store.getAwardedDailyStarCount();
  const bonusAwarded = store.isWeeklyBonusAwarded();
  const availableStars = store.getAvailableStars();
  const pendingCount = store.getPendingStarRedemptionCount();
  const currentToday = store.getCurrentWeekday();
  const effectiveSelectedDay = selectedWeekday || currentToday;

  const weekdaysList: WeekdayNumber[] = [1, 2, 3, 4, 5];

  // Find claimable target (selected weekday first, then today, then first claimable weekday)
  const getClaimableTarget = (): { day: WeekdayNumber; total: number } | null => {
    const selState = store.getWeekdayStarState(effectiveSelectedDay);
    if (selState.kind === 'claimable') {
      return { day: effectiveSelectedDay, total: selState.total };
    }
    const todayState = store.getWeekdayStarState(currentToday);
    if (todayState.kind === 'claimable') {
      return { day: currentToday, total: todayState.total };
    }
    for (const d of weekdaysList) {
      const state = store.getWeekdayStarState(d);
      if (state.kind === 'claimable') {
        return { day: d, total: state.total };
      }
    }
    return null;
  };

  const claimableTarget = getClaimableTarget();

  const renderSlotBackground = (state: WeekdayStarState): string => {
    switch (state.kind) {
      case 'awarded':
        return 'bg-amber-100/80 border-amber-300 text-amber-700';
      case 'claimable':
        return 'bg-gradient-to-br from-amber-400 to-rose-400 text-white shadow-md animate-pulse border-amber-300';
      case 'inProgress':
        return 'bg-slate-100 border-slate-200 text-slate-600';
      default:
        return 'bg-slate-50 border-slate-200/50 text-slate-400';
    }
  };

  return (
    <div
      data-testid="weekly-star-stamp-board"
      className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs ${
        claimableTarget
          ? 'border-pink-300 ring-2 ring-pink-100'
          : bonusAwarded
          ? 'border-amber-300'
          : 'border-slate-200'
      } p-3 sm:p-3.5`}
    >
      {/* Top Compact Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left group cursor-pointer select-none"
          aria-expanded={isExpanded}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-xs">
            <Star className="w-3.5 h-3.5 fill-white" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs sm:text-sm text-slate-800">평일 스타</span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
              {earnedCount}/5
            </span>
          </div>

          {/* Mini Stamp Strip when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-1 ml-1 sm:ml-2">
              {weekdaysList.map((d) => {
                const state = store.getWeekdayStarState(d);
                const dayInfo = WEEKDAYS.find((w) => w.number === d);
                return (
                  <div
                    key={d}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      state.kind === 'awarded'
                        ? 'bg-amber-400 text-white'
                        : state.kind === 'claimable'
                        ? 'bg-gradient-to-r from-amber-400 to-rose-400 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {state.kind === 'awarded' ? (
                      '★'
                    ) : state.kind === 'claimable' ? (
                      '✨'
                    ) : (
                      dayInfo?.shortName
                    )}
                  </div>
                );
              })}

              <div
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  bonusAwarded
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-purple-50 text-purple-600 border border-purple-200/60'
                }`}
              >
                {bonusAwarded ? '👑' : '+2'}
              </div>
            </div>
          )}

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 ml-1" />
          )}
        </button>

        {showsShopButton && onTapStarShop && (
          <button
            type="button"
            data-testid="stamp-board-shop-button"
            onClick={onTapStarShop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
          >
            <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
            <span>스타 상점 {availableStars}개</span>
            {pendingCount > 0 ? (
              <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] font-extrabold rounded-full">
                {pendingCount}
              </span>
            ) : (
              <ChevronRight className="w-3 h-3 text-white/80" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Stamp Slots */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {weekdaysList.map((d) => {
              const state = store.getWeekdayStarState(d);
              const dayInfo = WEEKDAYS.find((w) => w.number === d);
              const isSelected = effectiveSelectedDay === d;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onTapWeekdaySlot?.(d)}
                  className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl border transition-all ${renderSlotBackground(
                    state
                  )} ${isSelected ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`}
                >
                  <span className="text-[10px] font-extrabold mb-0.5">{dayInfo?.shortName}</span>
                  {state.kind === 'awarded' ? (
                    <div className="flex flex-col items-center">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span className="text-[9px] font-black text-amber-600">+1⭐</span>
                    </div>
                  ) : state.kind === 'claimable' ? (
                    <div className="flex flex-col items-center">
                      <Sparkles className="w-4 h-4 text-white" />
                      <span className="text-[9px] font-black text-white">수여대기</span>
                    </div>
                  ) : state.kind === 'inProgress' ? (
                    <div className="flex flex-col items-center">
                      <Star className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[9px] font-semibold text-slate-500">
                        {state.completed}/{state.total}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Star className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[9px] text-slate-400">-</span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* 6th Slot: Weekly All-Clear Bonus */}
            <button
              type="button"
              onClick={onTapStarShop}
              className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl border transition-all ${
                bonusAwarded
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white border-purple-400 shadow-sm'
                  : 'bg-purple-50/60 border-purple-200/80 text-purple-700'
              }`}
            >
              <span className="text-[10px] font-extrabold mb-0.5">주간</span>
              {bonusAwarded ? (
                <div className="flex flex-col items-center">
                  <Crown className="w-4 h-4 text-yellow-300" />
                  <span className="text-[9px] font-black text-yellow-200">+2⭐ 달성</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Crown className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[9px] font-bold text-purple-600">+2⭐</span>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progressive Disclosure: Action Banner when claimable */}
      {claimableTarget && (
        <div
          data-testid="claimable-star-banner"
          className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md animate-in fade-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-yellow-200" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold truncate">
                {WEEKDAYS.find((w) => w.number === claimableTarget.day)?.fullName}의 모든 할 일이
                완료되었어요!
              </p>
              <p className="text-[11px] text-white/90">
                오늘의 올클리어 스타(+1⭐)를 수여할까요?
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="claim-daily-star-button"
            onClick={() => onRequestAwardStar?.(claimableTarget.day)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white text-orange-600 hover:bg-orange-50 font-black text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            스타 수여하기 (+1⭐)
          </button>
        </div>
      )}
    </div>
  );
};
