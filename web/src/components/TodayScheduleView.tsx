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
} from 'lucide-react';
import { ScheduleItem, CATEGORIES, SubTask, WeekdayNumber } from '../types/schedule';
import { STICKER_EMOJIS } from '../types/snapshot';
import { formatTimeRange, formatTime } from '../domain/calendarUtils';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { playCompletionChime } from '../services/soundEffects';
import { WeeklyStarStampBoardCard } from './WeeklyStarStampBoardCard';

export interface TodayScheduleViewProps {
  items: ScheduleItem[];
  weekdayName: string;
  store?: ScheduleStore;
  onPlayChime?: () => void;
  onOpenPraiseModal?: (item?: ScheduleItem | null) => void;
  onOpenEditModal?: (item?: ScheduleItem | null) => void;
  onOpenParentPin?: (day?: WeekdayNumber) => void;
}

export const TodayScheduleView: React.FC<TodayScheduleViewProps> = ({
  items,
  weekdayName,
  store = globalScheduleStore,
  onPlayChime = playCompletionChime,
  onOpenPraiseModal,
  onOpenEditModal,
  onOpenParentPin,
}) => {
  const [, setRenderVersion] = useState(0);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
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

  const stats = store.getCompletionStats(items);
  const isParentMode = store.isParentMode();
  const latestPraise = store.getLatestPraiseNote();
  const currentWeekday = store.getCurrentWeekday();
  const skippedTodayItems = store
    .getMasterItems()
    .filter((it) => it.weekday === currentWeekday && store.isSkippedThisWeek(it.id));

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

      {/* Family Praise Banner (if praise notes exist) */}
      {latestPraise && (
        <div
          data-testid="family-praise-banner"
          className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 rounded-3xl p-4 sm:p-5 text-white shadow-lg shadow-pink-500/15 relative overflow-hidden flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shrink-0 shadow-inner">
              {STICKER_EMOJIS[latestPraise.sticker] || '❤️'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-extrabold bg-white/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  부모님의 응원 카드
                </span>
                {latestPraise.hearts > 0 && (
                  <span className="text-xs font-black text-amber-200 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-amber-200" />
                    <span>+{latestPraise.hearts}</span>
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base font-bold truncate text-white">
                {latestPraise.message}
              </p>
            </div>
          </div>

          {isParentMode && (
            <div className="flex items-center gap-2 shrink-0">
              {onOpenEditModal && (
                <button
                  type="button"
                  data-testid="today-add-schedule-btn"
                  onClick={() => onOpenEditModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-sm transition-all active:scale-95 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>일정 추가</span>
                </button>
              )}
              {onOpenPraiseModal && (
                <button
                  type="button"
                  data-testid="send-family-praise-btn"
                  onClick={() => onOpenPraiseModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  응원 보내기
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Parent Mode Top Action Bar (when no praise notes yet) */}
      {isParentMode && !latestPraise && (
        <div className="flex items-center justify-end gap-2">
          {onOpenEditModal && (
            <button
              type="button"
              data-testid="today-add-schedule-btn"
              onClick={() => onOpenEditModal(null)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>새 일정 추가</span>
            </button>
          )}
          {onOpenPraiseModal && (
            <button
              type="button"
              data-testid="send-family-praise-btn"
              onClick={() => onOpenPraiseModal(null)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95"
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>아이에게 전체 응원 보내기</span>
            </button>
          )}
        </div>
      )}

      {/* ⭐ Weekly Star Stamp Board Card (Mon-Fri +1⭐ & Weekly Bonus +2⭐) */}
      <WeeklyStarStampBoardCard
        store={store}
        onTapStarShop={() => {
          window.location.hash = '#stars';
        }}
        onRequestAwardStar={(day) => {
          if (store.isParentMode()) {
            store.awardDailyStar(day);
          } else if (onOpenParentPin) {
            onOpenParentPin(day);
          }
        }}
        selectedWeekday={currentWeekday}
      />

      {/* 1. Daily Progress Gauge Card */}
      <div
        data-testid="progress-gauge-card"
        className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-indigo-500/10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white">
                {weekdayName}
              </span>
              <span className="text-xs text-blue-100 font-medium">일일 체크리스트</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold bg-white/15 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span data-testid="progress-percentage-text">{stats.percentage}%</span>
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
                {stats.verified > 0 && (
                  <span data-testid="stats-verified-badge" className="flex items-center gap-1 text-emerald-200">
                    <Award className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      부모확인 {stats.verified}/{stats.total}
                    </span>
                  </span>
                )}
              </div>

              <span>남은 할 일 {Math.max(0, stats.total - stats.completed)}개</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Schedule Item Cards */}
      {items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-slate-500 space-y-2">
          <p className="text-base font-semibold text-slate-700">오늘 등록된 일정이 없습니다.</p>
          <p className="text-xs text-slate-400">자유로운 하루를 즐겨보세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cat = CATEGORIES[item.category] || CATEGORIES.study;
            const timeStr = formatTimeRange(item.startHour, item.startMinute, item.endHour, item.endMinute);
            const isCheckable = store.isItemCheckable(item);
            const isCompleted = store.isCompleted(item);
            const isVerified = store.isParentVerified(item);
            const reaction = store.getItemReaction(item);
            const badgeText = store.adjustmentBadgeText(item);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all relative overflow-hidden ${
                  isCompleted
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
                        {badgeText && (
                          <span
                            data-testid={`item-adjustment-badge-${item.id}`}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                          >
                            <span>⚡</span>
                            <span>{badgeText}</span>
                          </span>
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

                    {/* Parent Mode Actions (Edit, Stamp & Cheer) */}
                    {isParentMode && (
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 justify-end">
                        {onOpenEditModal && (
                          <button
                            type="button"
                            data-testid={`item-edit-btn-${item.id}`}
                            onClick={() => onOpenEditModal(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>수정</span>
                          </button>
                        )}

                        {isCheckable && onOpenPraiseModal && (
                          <button
                            type="button"
                            data-testid={`item-praise-btn-${item.id}`}
                            onClick={() => onOpenPraiseModal(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200/60 transition-colors"
                          >
                            <Heart className="w-3.5 h-3.5 text-pink-600 fill-pink-600" />
                            <span>응원하기</span>
                          </button>
                        )}

                        {isCheckable && (
                          <button
                            type="button"
                            data-testid={`item-parent-stamp-btn-${item.id}`}
                            onClick={() => handleParentStampClick(item)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
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
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skipped / Cancelled Items for Today (if any) */}
      {skippedTodayItems.length > 0 && (
        <div
          data-testid="today-skipped-items-section"
          className="bg-slate-100/90 border border-dashed border-slate-300 rounded-3xl p-4 sm:p-5 space-y-2.5 animate-in fade-in"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-amber-600" />
              <span>이번 주 휴강·제외된 일정 ({skippedTodayItems.length}건)</span>
            </div>
            <span className="text-[11px] text-slate-400">다음 주가 되면 원래대로 자동 복구됩니다</span>
          </div>

          <div className="space-y-2">
            {skippedTodayItems.map((sk) => (
              <div
                key={sk.id}
                className="flex items-center justify-between text-xs bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 line-through font-semibold">{sk.title}</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({formatTime(sk.startHour, sk.startMinute)} ~ {formatTime(sk.endHour, sk.endMinute)})
                  </span>
                </div>
                {isParentMode && (
                  <button
                    type="button"
                    data-testid={`restore-skipped-btn-${sk.id}`}
                    onClick={() => store.revertThisWeekOverride(sk.id)}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>휴강 취소 및 복구</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
