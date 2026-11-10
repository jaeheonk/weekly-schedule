import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  ListChecks,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
  Award,
  Sparkles,
  Lock,
  X,
  Heart,
  Edit3,
  Plus,
  RotateCcw,
  Ban,
  Star,
  LayoutGrid,
  BookOpen,
  GraduationCap,
  Music,
  Activity,
  Smile,
} from 'lucide-react';
import {
  ScheduleItem,
  CATEGORIES,
  SubTask,
  WeekdayNumber,
  WEEKDAYS,
  ScheduleCategoryType,
  ScheduleEditScope,
} from '../types/schedule';
import { STICKER_EMOJIS } from '../types/snapshot';
import { formatTimeRange } from '../domain/calendarUtils';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { playCompletionChime } from '../services/soundEffects';
import { WeeklyStarStampBoardCard } from './WeeklyStarStampBoardCard';
import { ParentPinModal } from './ParentPinModal';

export interface TodayScheduleViewProps {
  items?: ScheduleItem[];
  weekdayName?: string;
  store?: ScheduleStore;
  onPlayChime?: () => void;
  onOpenPraiseModal?: (item?: ScheduleItem | null) => void;
  onOpenEditModal?: (
    item?: ScheduleItem | null,
    weekday?: WeekdayNumber,
    scope?: ScheduleEditScope
  ) => void;
  onOpenParentPin?: (day?: WeekdayNumber) => void;
  onRequestParentAuth?: (reason: string, action: () => void) => void;
  onOpenRewardExchange?: () => void;
}

const CATEGORY_ORDER: ScheduleCategoryType[] = [
  'study',
  'academy',
  'music',
  'sports',
  'routine',
  'free',
];

const renderCategoryIcon = (catKey: ScheduleCategoryType, className = 'w-3.5 h-3.5') => {
  switch (catKey) {
    case 'study':
      return <BookOpen className={className} />;
    case 'academy':
      return <GraduationCap className={className} />;
    case 'music':
      return <Music className={className} />;
    case 'sports':
      return <Activity className={className} />;
    case 'routine':
      return <Sparkles className={className} />;
    case 'free':
      return <Smile className={className} />;
  }
};

export const TodayScheduleView: React.FC<TodayScheduleViewProps> = ({
  weekdayName,
  store = globalScheduleStore,
  onPlayChime = playCompletionChime,
  onOpenPraiseModal,
  onOpenEditModal,
  onOpenParentPin,
  onRequestParentAuth,
  onOpenRewardExchange,
}) => {
  const [, setRenderVersion] = useState(0);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<ScheduleCategoryType | null>(null);
  const [showingResetAdjustmentsDialog, setShowingResetAdjustmentsDialog] =
    useState<boolean>(false);
  const [pinPrompt, setPinPrompt] = useState<{
    reason: string;
    onConfirm: () => void;
  } | null>(null);

  const performParentAction = (reason: string, action: () => void) => {
    if (store.isParentMode()) {
      action();
      return;
    }
    if (onRequestParentAuth) {
      onRequestParentAuth(reason, action);
      return;
    }
    setPinPrompt({ reason, onConfirm: action });
  };

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [store]);

  useEffect(() => {
    const checkDateChange = () => {
      store.refreshDateAndDayChange();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        store.refreshDateAndDayChange();
      }
    };
    const intervalId = setInterval(checkDateChange, 30_000);
    window.addEventListener('focus', checkDateChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkDateChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [store]);

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
  };

  useEffect(() => {
    if (!noticeMessage) return;
    const timer = setTimeout(() => {
      setNoticeMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  const currentDate = store.getCurrentDate();
  const todayWeekday = store.getTodayWeekday();
  const selectedWeekday = store.getSelectedWeekday();
  const todayWeekdayInfo = WEEKDAYS.find((w) => w.number === todayWeekday);
  const effectiveTodayName = weekdayName || todayWeekdayInfo?.fullName || '오늘';
  const todayDateTitle = `${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일 ${effectiveTodayName}`;
  const dayItems = store.getItemsForWeekday(selectedWeekday);
  const displayedItems = selectedCategoryFilter
    ? dayItems.filter((item) => item.category === selectedCategoryFilter)
    : dayItems;
  const stats = store.getCompletionStats(todayWeekday);
  const selectedDayStats = store.getCompletionStats(selectedWeekday);
  const selectedDayInfo = WEEKDAYS.find((w) => w.number === selectedWeekday);
  const selectedDayFullName = selectedDayInfo?.fullName || '요일';
  const selectedDayAdjustmentCount = store.getAdjustmentCountForWeekday(selectedWeekday);
  const weekAdjustmentCount = store.getCurrentWeekAdjustmentCount();
  const isParentMode = store.isParentMode();
  const availableHearts = store.getAvailableHearts();
  const latestPraise = store.getLatestPraiseNote();
  const currentActiveItems = store.getCurrentActiveItems();
  const currentActiveItem = currentActiveItems[0] || null;
  const nextUpcomingItem = store.getNextUpcomingItem();
  const excludedDayInfos = store.getExcludedMasterItemsForThisWeek(selectedWeekday);

  const focusScheduleCard = (itemId: string) => {
    const el = document.getElementById(`schedule-card-${itemId}`);
    if (el) {
      el.focus();
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  useEffect(() => {
    if (!focusedItemId || selectedWeekday !== todayWeekday) return;
    focusScheduleCard(focusedItemId);
  }, [focusedItemId, selectedWeekday, todayWeekday]);

  const handleJumpToTodayItem = (item: ScheduleItem) => {
    store.setSelectedWeekday(todayWeekday);
    setFocusedItemId(item.id);
    focusScheduleCard(item.id);
  };

  const getHeroItemStatusLabel = (item: ScheduleItem, isCurrent: boolean): string => {
    if (store.isParentVerified(item)) return '부모 확인 완료';
    if (store.isCompleted(item)) return '다 했어요 완료';
    return isCurrent ? '진행 중' : '예정';
  };

  const handleItemToggle = (item: ScheduleItem) => {
    const wasCompleted = store.isCompleted(item);
    const result = store.toggleCompletionWithResult(item);

    if (!result.ok) {
      if (result.reason === 'parent_verified') {
        showNotice('부모님이 확인 완료한 숙제는 변경할 수 없어요 🔒');
      }
      return;
    }

    if (!wasCompleted) {
      onPlayChime();
    }
  };

  const handleSubTaskToggle = (sub: SubTask, parentItem: ScheduleItem) => {
    const wasDone = store.isSubTaskCompleted(sub);
    const result = store.toggleSubTaskCompletionWithResult(sub, parentItem);

    if (!result.ok) {
      if (result.reason === 'parent_verified') {
        showNotice('부모님이 확인 완료한 숙제는 변경할 수 없어요 🔒');
      }
      return;
    }

    if (!wasDone) {
      onPlayChime();
    }
  };

  const handleParentStampClick = (item: ScheduleItem) => {
    if (store.isParentVerified(item)) {
      store.toggleParentVerification(item);
    } else if (!store.canParentVerify(item)) {
      showNotice('아이가 먼저 완료 체크한 숙제만 도장을 찍을 수 있어요 ✍️');
    } else {
      store.toggleParentVerification(item);
    }
  };

  const handleSubTaskParentStampClick = (sub: SubTask, parentItem: ScheduleItem) => {
    if (store.isSubTaskParentVerified(sub)) {
      store.toggleSubTaskParentVerification(sub, parentItem);
    } else if (!store.canParentVerifySubTask(sub)) {
      showNotice('아이가 먼저 완료 체크한 세부 항목만 도장을 찍을 수 있어요 ✍️');
    } else {
      store.toggleSubTaskParentVerification(sub, parentItem);
    }
  };

  const getSlogan = () => {
    if (stats.total === 0) return '오늘 등록된 할 일이 없어요 😊';
    if (stats.percentage === 100) return '와! 오늘 할 일을 모두 완료했어요! 🎉';
    if (stats.percentage >= 60) return '조금만 더 힘내면 오늘 할 일 올클리어! ✨';
    if (stats.percentage > 0) return '차근차근 멋지게 해내고 있어요! 👏';
    return '오늘도 즐겁고 힘차게 시작해 볼까요? 🚀';
  };

  return (
    <div data-testid="today-view" className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Toast Notice Banner for Protected Parent Verification */}
      {noticeMessage && (
        <div
          data-testid="parent-verified-notice"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700/60 backdrop-blur-md animate-in fade-in slide-in-from-top duration-300"
        >
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold tracking-tight">{noticeMessage}</span>
          <button
            onClick={() => setNoticeMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Live Status Hero Card (Pinned to Actual Today) */}
      <div
        data-testid="progress-gauge-card"
        className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-indigo-500/10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                data-testid="hero-today-date"
                className="text-xs font-bold bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white"
              >
                {todayDateTitle}
              </span>
              <span className="text-xs text-blue-100 font-medium">일일 체크리스트</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="today-hero-reward-exchange-btn"
                onClick={onOpenRewardExchange}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-xs font-bold border border-white/25 shadow-xs transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
                title="하트 보상 교환 모달 열기"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-300 text-rose-300" />
                <span>하트 보상 교환</span>
                {availableHearts > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none">
                    {availableHearts}
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="send-family-praise-btn"
                data-locked={!isParentMode}
                onClick={() =>
                  performParentAction('응원 하트 보내기', () => onOpenPraiseModal?.(null))
                }
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-500/90 hover:bg-pink-500 text-white text-xs font-bold border border-pink-300/40 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {isParentMode ? (
                  <Heart className="w-3.5 h-3.5 fill-white text-white" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-white" />
                )}
                <span>응원 보내기</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs font-bold bg-white/15 px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span data-testid="progress-percentage-text">{stats.percentage}%</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">{getSlogan()}</h2>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-black/20 h-3 rounded-full overflow-hidden p-0.5">
              <div
                data-testid="progress-bar-fill"
                className="h-full bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-medium text-blue-100 pt-1">
              <div className="flex items-center gap-3">
                <span data-testid="stats-completed-badge" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    다 했어요 {stats.completed}/{stats.total}
                  </span>
                </span>
                <span data-testid="stats-verified-badge" className="flex items-center gap-1 text-emerald-200">
                  <Award className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    부모확인 {stats.verified}/{stats.total}
                  </span>
                </span>
              </div>

              <span>남은 할 일 {Math.max(0, stats.total - stats.completed)}개</span>
            </div>
          </div>

          {/* Latest Family Praise Banner inside Hero Card */}
          {latestPraise && (
            <div
              data-testid="family-praise-banner"
              className="bg-white/15 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 text-white border border-white/20 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  {STICKER_EMOJIS[latestPraise.sticker] || '❤️'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-extrabold bg-white/25 px-2 py-0.5 rounded-full uppercase tracking-wider text-yellow-200">
                      부모님의 응원 카드
                    </span>
                    {latestPraise.hearts > 0 && (
                      <span className="text-xs font-black text-amber-200 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 fill-amber-200" />
                        <span>+{latestPraise.hearts}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold truncate text-white">
                    {latestPraise.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Real-Time Current Active & Next Upcoming Items for Actual Today */}
          <div className="pt-2 border-t border-white/20 space-y-2">
            {currentActiveItem && (
              <button
                type="button"
                data-testid="hero-current-active-item"
                onClick={() => handleJumpToTodayItem(currentActiveItem)}
                className="w-full text-left rounded-2xl bg-white/15 hover:bg-white/25 p-3 border border-white/20 transition-all active:scale-[0.99] cursor-pointer space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-extrabold bg-white/25 px-2.5 py-0.5 rounded-full text-white">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>지금 하는 일</span>
                    </span>
                    <span className="text-blue-100 font-semibold">
                      {formatTimeRange(
                        currentActiveItem.startHour,
                        currentActiveItem.startMinute,
                        currentActiveItem.endHour,
                        currentActiveItem.endMinute
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      data-testid="hero-current-active-status"
                      className={`px-2 py-0.5 rounded-full font-extrabold text-[11px] ${
                        store.isParentVerified(currentActiveItem)
                          ? 'bg-emerald-500 text-white'
                          : store.isCompleted(currentActiveItem)
                          ? 'bg-amber-300 text-indigo-950'
                          : 'bg-black/25 text-white'
                      }`}
                    >
                      {getHeroItemStatusLabel(currentActiveItem, true)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-black/25 text-[11px] font-bold text-white">
                      {store.getRemainingMinutesForActive(currentActiveItem)}분 남음
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm sm:text-base font-black text-white truncate">
                    {currentActiveItem.title}
                  </span>
                </div>
              </button>
            )}

            {nextUpcomingItem ? (
              <button
                type="button"
                data-testid="hero-next-upcoming-item"
                onClick={() => handleJumpToTodayItem(nextUpcomingItem)}
                className="w-full text-left rounded-2xl bg-black/20 hover:bg-black/30 px-3 py-2.5 border border-white/15 transition-all active:scale-[0.99] cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-extrabold bg-white/20 px-2 py-0.5 rounded-full text-white shrink-0">
                    다음 일정
                  </span>
                  <span className="font-bold text-white truncate">{nextUpcomingItem.title}</span>
                  <span className="text-blue-100 font-medium shrink-0">
                    {formatTimeRange(
                      nextUpcomingItem.startHour,
                      nextUpcomingItem.startMinute,
                      nextUpcomingItem.endHour,
                      nextUpcomingItem.endMinute
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-white/15 text-[11px] font-bold text-white">
                    {getHeroItemStatusLabel(nextUpcomingItem, false)}
                  </span>
                  <span className="font-extrabold text-amber-300">
                    {store.getMinutesUntilStart(nextUpcomingItem)}분 뒤
                  </span>
                </div>
              </button>
            ) : (
              !currentActiveItem && (
                <div
                  data-testid="hero-no-upcoming-items"
                  className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-blue-100 py-1"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                  <span>오늘 예정된 시간표가 모두 끝났어요! 푹 쉬세요 🌙</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Top Action Bar ("오늘" Return Button + Protected Quick Actions) */}
      <div className="flex items-center justify-end gap-2">
        {selectedWeekday !== todayWeekday && (
          <button
            type="button"
            data-testid="back-to-today-btn"
            onClick={() => store.setSelectedWeekday(todayWeekday)}
            className="flex items-center gap-1 px-3.5 py-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs border border-blue-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <span>오늘</span>
          </button>
        )}
        <button
          type="button"
          data-testid="today-add-schedule-btn"
          data-locked={!isParentMode}
          onClick={() =>
            performParentAction('이번 주 일정 추가', () =>
              onOpenEditModal?.(null, selectedWeekday, 'thisWeek')
            )
          }
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          {isParentMode ? (
            <Plus className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>+ 이번 주 추가</span>
        </button>
      </div>

      {/* ⭐ Weekly Star Stamp Board Card (Mon-Fri +1⭐ & Weekly Bonus +2⭐) */}
      <WeeklyStarStampBoardCard
        store={store}
        onTapWeekdaySlot={(day) => store.setSelectedWeekday(day)}
        onTapStarShop={() => {
          window.location.hash = '#stars';
        }}
        onRequestAwardStar={(day) => {
          if (store.isParentMode()) {
            store.awardDailyStar(day);
          } else if (onOpenParentPin && !onRequestParentAuth) {
            onOpenParentPin(day);
          } else {
            performParentAction('올클리어 스타 수여', () => store.awardDailyStar(day));
          }
        }}
        selectedWeekday={selectedWeekday}
      />

      {/* Mon–Sun 7-Column Weekday Selector Bar (375px single-row fit, ADR-0003) */}
      <div
        data-testid="weekday-selector-bar"
        className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full min-w-0"
      >
        {WEEKDAYS.map((day) => {
          const isSelected = selectedWeekday === day.number;
          const isToday = todayWeekday === day.number;
          const dayStats = store.getCompletionStats(day.number);
          const starState = store.getWeekdayStarState(day.number);
          const allVerified = dayStats.total > 0 && dayStats.verified === dayStats.total;
          const allChildDone = dayStats.total > 0 && dayStats.completed === dayStats.total;
          const hasAdjustment = store.getAdjustmentCountForWeekday(day.number) > 0;
          const isStarClaimable = starState.kind === 'claimable';

          const topLabelText = isToday
            ? '오늘'
            : isStarClaimable
            ? '수여'
            : hasAdjustment
            ? '조정'
            : '\u00A0';

          const topLabelColor = isToday
            ? isSelected
              ? 'text-white/90'
              : 'text-blue-600'
            : isStarClaimable
            ? isSelected
              ? 'text-yellow-300'
              : 'text-pink-600'
            : hasAdjustment
            ? isSelected
              ? 'text-yellow-300'
              : 'text-amber-600'
            : 'text-transparent select-none';

          const shortNameColor = isSelected
            ? 'text-white font-extrabold'
            : day.number === 7
            ? 'text-rose-600 font-bold'
            : day.number === 6
            ? 'text-blue-600 font-bold'
            : 'text-slate-800 font-semibold';

          const statusKind =
            starState.kind === 'awarded'
              ? 'star-awarded'
              : starState.kind === 'claimable'
              ? 'star-claimable'
              : allVerified
              ? 'all-verified'
              : allChildDone
              ? 'all-completed'
              : dayStats.completed > 0
              ? 'in-progress'
              : hasAdjustment
              ? 'adjusted'
              : 'none';

          const buttonBg = isSelected
            ? 'bg-blue-600 shadow-sm shadow-blue-500/25'
            : isToday
            ? 'bg-blue-50/90 hover:bg-blue-100/80'
            : 'bg-white hover:bg-slate-50';

          const buttonBorder = isSelected
            ? 'border-blue-600'
            : isStarClaimable
            ? 'border-pink-400'
            : isToday
            ? 'border-blue-300'
            : hasAdjustment
            ? 'border-amber-300'
            : 'border-slate-200';

          return (
            <button
              key={day.number}
              type="button"
              data-testid={`weekday-btn-${day.number}`}
              data-selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => store.setSelectedWeekday(day.number)}
              className={`flex flex-col items-center justify-between py-1.5 px-0.5 rounded-2xl border transition-all min-w-0 cursor-pointer select-none ${buttonBg} ${buttonBorder}`}
            >
              <span
                data-testid={`weekday-top-label-${day.number}`}
                className={`text-[9px] leading-tight font-extrabold truncate max-w-full ${topLabelColor}`}
              >
                {topLabelText}
              </span>

              <span
                data-testid={`weekday-short-name-${day.number}`}
                className={`text-xs sm:text-sm leading-snug my-0.5 ${shortNameColor}`}
              >
                {day.shortName}
              </span>

              <div
                data-testid={`weekday-status-indicator-${day.number}`}
                data-status={statusKind}
                className="h-3.5 flex items-center justify-center"
              >
                {starState.kind === 'awarded' ? (
                  <Star
                    className={`w-3 h-3 ${
                      isSelected
                        ? 'fill-yellow-300 text-yellow-300'
                        : 'fill-amber-500 text-amber-500'
                    }`}
                  />
                ) : starState.kind === 'claimable' ? (
                  <Sparkles
                    className={`w-3 h-3 ${
                      isSelected ? 'text-yellow-300' : 'text-pink-500'
                    }`}
                  />
                ) : allVerified ? (
                  <Award
                    className={`w-3 h-3 ${
                      isSelected ? 'text-yellow-300' : 'text-emerald-600'
                    }`}
                  />
                ) : allChildDone ? (
                  <CheckCircle2
                    className={`w-3 h-3 ${
                      isSelected ? 'text-yellow-300' : 'text-amber-500'
                    }`}
                  />
                ) : dayStats.completed > 0 ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-blue-500'
                    }`}
                  />
                ) : hasAdjustment ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-yellow-300' : 'bg-amber-400'
                    }`}
                  />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Category Filter Bar */}
      <div
        data-testid="category-filter-bar"
        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full min-w-0"
      >
        <button
          type="button"
          data-testid="category-chip-all"
          data-selected={selectedCategoryFilter === null}
          aria-pressed={selectedCategoryFilter === null}
          onClick={() => setSelectedCategoryFilter(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all cursor-pointer select-none ${
            selectedCategoryFilter === null
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50/50'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>전체</span>
          <span
            data-testid="category-count-all"
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
              selectedCategoryFilter === null
                ? 'bg-white/25 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {dayItems.length}
          </span>
        </button>

        {CATEGORY_ORDER.map((catKey) => {
          const cat = CATEGORIES[catKey];
          const isChipSelected = selectedCategoryFilter === catKey;
          const catCount = dayItems.filter((it) => it.category === catKey).length;

          return (
            <button
              key={catKey}
              type="button"
              data-testid={`category-chip-${catKey}`}
              data-selected={isChipSelected}
              data-color={cat.color}
              aria-pressed={isChipSelected}
              onClick={() =>
                setSelectedCategoryFilter((prev) => (prev === catKey ? null : catKey))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all cursor-pointer select-none ${
                isChipSelected ? 'text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
              style={
                isChipSelected
                  ? { backgroundColor: cat.color, borderColor: cat.color }
                  : { borderColor: `${cat.color}40` }
              }
            >
              <span style={isChipSelected ? { color: '#ffffff' } : { color: cat.color }}>
                {renderCategoryIcon(catKey)}
              </span>
              <span>{cat.title}</span>
              <span
                data-testid={`category-count-${catKey}`}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                  isChipSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {catCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Section Header */}
      <div data-testid="day-section-header" className="space-y-2.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              data-testid="selected-day-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight"
            >
              {selectedDayFullName}
            </h3>

            {selectedWeekday === todayWeekday && (
              <span
                data-testid="selected-day-today-badge"
                className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black tracking-wider uppercase"
              >
                TODAY
              </span>
            )}

            {selectedDayAdjustmentCount > 0 && (
              <span
                data-testid="selected-day-adjustment-badge"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold border border-amber-200/80"
              >
                <span>⚡</span>
                <span>이번주 조정 {selectedDayAdjustmentCount}건</span>
              </span>
            )}
          </div>

          {selectedDayStats.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="selected-day-completed-stat"
                className="inline-flex items-center gap-1 font-bold text-slate-600"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  아이 {selectedDayStats.completed}/{selectedDayStats.total}
                </span>
              </span>

              <span
                data-testid="selected-day-verified-stat"
                className="inline-flex items-center gap-1 font-extrabold text-emerald-700"
              >
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  부모확인 {selectedDayStats.verified}/{selectedDayStats.total}
                </span>
              </span>

              {selectedDayStats.completed > 0 && (
                <button
                  type="button"
                  data-testid="selected-day-reset-completions-btn"
                  data-locked={!isParentMode}
                  onClick={() =>
                    performParentAction('완료 체크 초기화', () =>
                      store.resetCompletionsForWeekday(selectedWeekday, true)
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {isParentMode ? (
                    <RotateCcw className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  <span>초기화</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Weekly Override Summary & Reset Banner when current week has active adjustments */}
        {weekAdjustmentCount > 0 && (
          <div
            data-testid="day-weekly-override-banner"
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-orange-50/90 border border-orange-200/90 text-xs"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="text-orange-600 font-bold pt-0.5 shrink-0">🗓️</span>
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold text-slate-900">
                  {selectedDayAdjustmentCount > 0
                    ? `${selectedDayFullName} 일정 ${selectedDayAdjustmentCount}개가 이번 주만 임시 조정되었어요`
                    : `이번 주 총 ${weekAdjustmentCount}개의 스케줄이 임시 조정되어 있어요`}
                </p>
                <p className="text-[11px] text-slate-500">
                  다음 주 월요일에는 원래 기본 시간표로 자동 복구됩니다 · 전체 변경은 [주간 시간표] 탭에서 가능
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="open-reset-adjustments-dialog-btn"
              data-locked={!isParentMode}
              onClick={() =>
                performParentAction('이번 주 조정 복구', () =>
                  setShowingResetAdjustmentsDialog(true)
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {isParentMode ? (
                <RotateCcw className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              <span>원래대로</span>
            </button>
          </div>
        )}

        {/* Batch Parent Verification Banner when child has completed items waiting for parent verification */}
        {selectedDayStats.waiting > 0 && (
          <div
            data-testid="day-waiting-verification-banner"
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-xs"
          >
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <span>🙋</span>
              <span>
                아이가 '다 했어요' 체크한 숙제 {selectedDayStats.waiting}개가 부모님 확인을 기다리고 있어요!
              </span>
            </div>

            <button
              type="button"
              data-testid="verify-all-waiting-btn"
              data-locked={!isParentMode}
              onClick={() =>
                performParentAction('일괄 확인 및 하트 지급', () =>
                  store.verifyAllWaitingItems(selectedWeekday, true)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {isParentMode ? (
                <Award className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>모두 확인 + ❤️</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Schedule Item Cards */}
      {displayedItems.length === 0 ? (
        <div
          data-testid="today-empty-state"
          className="p-10 sm:p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-slate-500 space-y-3"
        >
          <p className="text-base font-bold text-slate-700">표시할 스케줄이 없어요</p>
          <p className="text-xs text-slate-400">
            이번 주 보강·특별 일정을 추가하거나 아래에서 휴강된 일정을 복구해 보세요!
          </p>
          <div className="pt-1">
            <button
              type="button"
              data-testid="empty-day-add-schedule-btn"
              data-locked={!isParentMode}
              onClick={() =>
                performParentAction('이번 주 일정 추가', () =>
                  onOpenEditModal?.(null, selectedWeekday, 'thisWeek')
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isParentMode ? (
                <Plus className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>이번 주 일정 추가하기</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item) => {
            const cat = CATEGORIES[item.category] || CATEGORIES.study;
            const timeStr = formatTimeRange(item.startHour, item.startMinute, item.endHour, item.endMinute);
            const isCheckable = store.isItemCheckable(item);
            const isCompleted = store.isCompleted(item);
            const isVerified = store.isParentVerified(item);
            const isActive = selectedWeekday === todayWeekday && store.isCurrentlyActive(item);
            const reaction = store.getItemReaction(item);
            const badgeText = store.adjustmentBadgeText(item);

            return (
              <div
                key={item.id}
                id={`schedule-card-${item.id}`}
                data-testid={`schedule-card-${item.id}`}
                data-active={isActive}
                data-focused={focusedItemId === item.id}
                tabIndex={-1}
                className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all relative overflow-hidden outline-none ${
                  isActive
                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/10'
                    : isCompleted
                    ? 'border-slate-200 bg-slate-50/70 shadow-none'
                    : 'border-slate-200 hover:shadow-md'
                }`}
                style={{ borderLeftWidth: '5px', borderLeftColor: cat.color }}
              >
                <div className="flex items-start gap-3.5">
                  {/* Left Action: Checkbox / Seal / Category Badge */}
                  <div className="pt-0.5 shrink-0">
                    {isCheckable ? (
                      <button
                        type="button"
                        data-testid={`item-check-btn-${item.id}`}
                        aria-checked={isCompleted}
                        data-verified={isVerified}
                        onClick={() => handleItemToggle(item)}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                          isVerified
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : isCompleted
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'border-2 border-slate-300 hover:border-blue-500 text-transparent hover:text-slate-300'
                        }`}
                        title={isVerified ? '부모 확인 완료 (보호됨)' : isCompleted ? '완료됨' : '다 했어요'}
                      >
                        {isVerified ? (
                          <Award className="w-5 h-5 text-white" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                    ) : (
                      <div
                        data-testid={`item-badge-${item.id}`}
                        className="w-9 h-9 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: cat.softBackgroundColor }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                    )}
                  </div>

                  {/* Right Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: cat.color, backgroundColor: cat.softBackgroundColor }}
                        >
                          {cat.title}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{timeStr}</span>
                        </div>
                        {isActive && (
                          <span
                            data-testid={`item-active-badge-${item.id}`}
                            className="flex items-center gap-1 text-[11px] font-extrabold text-white bg-emerald-500 px-2 py-0.5 rounded-full shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>진행중</span>
                          </span>
                        )}
                        {badgeText && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              data-testid={`item-adjustment-badge-${item.id}`}
                              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              <span>⚡</span>
                              <span>{badgeText}</span>
                            </span>
                            {!item.targetWeekKey && store.hasThisWeekOverride(item.id) && (
                              <button
                                type="button"
                                data-testid={`item-revert-override-btn-${item.id}`}
                                data-locked={!isParentMode}
                                onClick={() =>
                                  performParentAction('이번 주 조정 복구', () =>
                                    store.revertThisWeekOverride(item.id)
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                              >
                                {isParentMode ? (
                                  <RotateCcw className="w-2.5 h-2.5 text-blue-600" />
                                ) : (
                                  <Lock className="w-2.5 h-2.5 text-blue-600" />
                                )}
                                <span>원래대로</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isVerified && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Award className="w-3 h-3 text-emerald-600" />
                            <span>부모 확인 완료</span>
                          </span>
                        )}

                        {item.isNotificationEnabled && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            <Bell className="w-3 h-3 text-amber-500" />
                            <span>알림</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3
                        className={`text-base font-bold transition-colors ${
                          isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.note && (
                        <p
                          className={`text-xs mt-0.5 ${
                            isCompleted ? 'text-slate-400 line-through' : 'text-slate-500'
                          }`}
                        >
                          {item.note}
                        </p>
                      )}
                    </div>

                    {/* Schedule Item Reaction & Comment Display */}
                    {reaction && ((reaction.heartCount && reaction.heartCount > 0) || reaction.comment) && (
                      <div
                        data-testid={`item-reaction-badge-${item.id}`}
                        className="mt-2.5 flex flex-wrap items-center gap-2 p-2 rounded-xl bg-pink-50/80 border border-pink-200/60 text-xs"
                      >
                        <div className="flex items-center gap-1 font-bold text-pink-700">
                          <span>{STICKER_EMOJIS[reaction.sticker] || '❤️'}</span>
                          {reaction.heartCount > 0 && (
                            <span className="flex items-center gap-0.5 text-rose-600 font-black">
                              <Heart className="w-3 h-3 fill-rose-600" />+{reaction.heartCount}
                            </span>
                          )}
                        </div>
                        {reaction.comment && (
                          <div className="flex items-center gap-1 text-slate-700 font-medium">
                            <span className="text-slate-300 font-normal">|</span>
                            <span className="italic">"{reaction.comment}"</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Subtasks Section */}
                    {item.subTasks && item.subTasks.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                          <span>세부 할 일</span>
                        </div>

                        <div className="space-y-1 pl-1">
                          {item.subTasks.map((sub) => {
                            const subDone = store.isSubTaskCompleted(sub);
                            const subVerified = store.isSubTaskParentVerified(sub);

                            return (
                              <div
                                key={sub.id}
                                className="flex items-center gap-2 group text-xs text-slate-700 justify-between"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isCheckable ? (
                                    <button
                                      type="button"
                                      data-testid={`subtask-check-btn-${sub.id}`}
                                      aria-checked={subDone}
                                      data-verified={subVerified}
                                      aria-label={
                                        subVerified
                                          ? `${sub.title} 부모 확인 완료`
                                          : subDone
                                          ? `${sub.title} 완료 취소`
                                          : `${sub.title} 다 했어요`
                                      }
                                      title={
                                        subVerified
                                          ? '부모 확인 완료 (보호됨)'
                                          : subDone
                                          ? '완료 취소'
                                          : '다 했어요'
                                      }
                                      onClick={() => handleSubTaskToggle(sub, item)}
                                      className={`w-4 h-4 rounded flex items-center justify-center transition-all shrink-0 ${
                                        subVerified
                                          ? 'bg-emerald-600 text-white'
                                          : subDone
                                          ? 'bg-blue-600 text-white'
                                          : 'border border-slate-300 hover:border-blue-500 text-transparent'
                                      }`}
                                    >
                                      {subVerified || subDone ? (
                                        <CheckSquare className="w-3.5 h-3.5" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                  )}

                                  <span
                                    className={`truncate transition-colors ${
                                      subDone ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'
                                    }`}
                                  >
                                    {sub.title}
                                  </span>
                                </div>

                                {isParentMode && isCheckable && (
                                  <button
                                    type="button"
                                    data-testid={`subtask-parent-stamp-btn-${sub.id}`}
                                    onClick={() => handleSubTaskParentStampClick(sub, item)}
                                    title={
                                      subVerified
                                        ? '부모 확인 도장 취소'
                                        : store.canParentVerifySubTask(sub)
                                        ? '부모 확인 도장 날인'
                                        : '아이가 완료해야 도장을 찍을 수 있어요'
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 ${
                                      subVerified
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : store.canParentVerifySubTask(sub)
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {subVerified ? '도장 완료' : '도장'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Protected Parent Actions (Edit, Cheer & Parent Stamp) */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 justify-end">
                      <button
                        type="button"
                        data-testid={`item-edit-btn-${item.id}`}
                        data-locked={!isParentMode}
                        onClick={() =>
                          performParentAction('일정 수정', () => onOpenEditModal?.(item))
                        }
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                      >
                        {isParentMode ? (
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>수정</span>
                      </button>

                      {isCheckable && (
                        <button
                          type="button"
                          data-testid={`item-praise-btn-${item.id}`}
                          data-locked={!isParentMode}
                          onClick={() =>
                            performParentAction('응원 하트 보내기', () =>
                              onOpenPraiseModal?.(item)
                            )
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200/60 transition-colors cursor-pointer"
                        >
                          {isParentMode ? (
                            <Heart className="w-3.5 h-3.5 text-pink-600 fill-pink-600" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-pink-600" />
                          )}
                          <span>응원하기</span>
                        </button>
                      )}

                      {isParentMode && isCheckable && (
                        <button
                          type="button"
                          data-testid={`item-parent-stamp-btn-${item.id}`}
                          onClick={() => handleParentStampClick(item)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            isVerified
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : store.canParentVerify(item)
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 shadow-sm'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200/80 border border-slate-200'
                          }`}
                        >
                          <Award className="w-4 h-4" />
                          <span>
                            {isVerified
                              ? '참 잘했어요 도장 날인됨'
                              : store.canParentVerify(item)
                              ? '부모 확인 도장 찍기'
                              : '아이 완료 대기 중'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Excluded / Moved Master Schedule Items for Selected Day (if any) */}
      {excludedDayInfos.length > 0 && (
        <div
          data-testid="today-skipped-items-section"
          className="bg-slate-100/90 border border-dashed border-orange-300/80 rounded-3xl p-4 sm:p-5 space-y-2.5 animate-in fade-in"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-amber-600" />
              <span>이번 주 휴강·요일 이동된 원래 일정 ({excludedDayInfos.length}개)</span>
            </div>
            <span className="text-[11px] text-amber-600 font-semibold">다음 주 자동 복구</span>
          </div>

          <div className="space-y-2">
            {excludedDayInfos.map((info) => {
              const masterItem = info.masterItem;
              return (
                <div
                  key={masterItem.id}
                  data-testid={`excluded-item-row-${masterItem.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-2xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-bold ${
                          info.isSkipped
                            ? 'text-slate-400 line-through'
                            : 'text-slate-600'
                        }`}
                      >
                        {masterItem.title}
                      </span>
                      <span
                        data-testid={`excluded-item-reason-${masterItem.id}`}
                        className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200/80"
                      >
                        {info.reasonText}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      원래 시간: {formatTimeRange(masterItem.startHour, masterItem.startMinute, masterItem.endHour, masterItem.endMinute)}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`restore-skipped-btn-${masterItem.id}`}
                    data-locked={!isParentMode}
                    onClick={() =>
                      performParentAction('제외 일정 복구', () =>
                        store.revertThisWeekOverride(masterItem.id)
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 transition-colors cursor-pointer shrink-0"
                  >
                    {isParentMode ? (
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>원래대로 복구</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Resetting Weekly Overrides (Selected Day Only vs Entire Week) */}
      {showingResetAdjustmentsDialog && (
        <div
          data-testid="reset-adjustments-confirm-dialog"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                이번 주 조정한 스케줄을 원래 기본 시간표로 되돌릴까요?
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                일정을 원래 시간으로 되돌려도 이번 주에 완료 체크한 기록과 부모님 확인 도장·하트는 그대로 유지됩니다.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {selectedDayAdjustmentCount > 0 && (
                <button
                  type="button"
                  data-testid="confirm-reset-selected-day-adjustments-btn"
                  onClick={() => {
                    performParentAction('이번 주 조정 복구', () => {
                      store.resetThisWeekAdjustments(selectedWeekday);
                      setShowingResetAdjustmentsDialog(false);
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  {selectedDayFullName} 조정만 원래대로 되돌리기
                </button>
              )}

              <button
                type="button"
                data-testid="confirm-reset-all-week-adjustments-btn"
                onClick={() => {
                  performParentAction('이번 주 조정 복구', () => {
                    store.resetThisWeekAdjustments();
                    setShowingResetAdjustmentsDialog(false);
                  });
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-extrabold transition-all cursor-pointer"
              >
                이번 주 전체(월~일) 조정 모두 원래대로 되돌리기
              </button>

              <button
                type="button"
                data-testid="cancel-reset-adjustments-dialog-btn"
                onClick={() => setShowingResetAdjustmentsDialog(false)}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone 6-Digit Master PIN Authentication Modal when not delegated to App */}
      {!onRequestParentAuth && (
        <ParentPinModal
          isOpen={pinPrompt !== null}
          reason={pinPrompt?.reason}
          store={store}
          onClose={() => setPinPrompt(null)}
          onSuccess={() => {
            const actionToRun = pinPrompt?.onConfirm;
            setPinPrompt(null);
            actionToRun?.();
          }}
        />
      )}
    </div>
  );
};
