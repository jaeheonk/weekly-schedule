import React, { useState, useEffect } from 'react';
import { Plus, Edit3, RotateCcw, AlertTriangle } from 'lucide-react';
import { ScheduleItem, WEEKDAYS, WeekdayNumber } from '../types/schedule';
import { CATEGORIES } from '../types/schedule';
import { formatTime, compareScheduleItemsByTime } from '../domain/calendarUtils';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';

export interface WeeklyGridViewProps {
  items?: ScheduleItem[];
  currentWeekday: WeekdayNumber;
  store?: ScheduleStore;
  onOpenEditModal?: (item: ScheduleItem | null, weekday?: WeekdayNumber) => void;
}

export const WeeklyGridView: React.FC<WeeklyGridViewProps> = ({
  items: propsItems,
  currentWeekday,
  store = globalScheduleStore,
  onOpenEditModal,
}) => {
  const [, setRenderVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [store]);

  const items = propsItems || store.getEffectiveItems();
  const isParentMode = store.isParentMode();
  const adjustmentCount = store.getCurrentWeekAdjustmentCount();

  const handleResetAdjustments = () => {
    store.resetThisWeekAdjustments();
  };

  return (
    <div data-testid="weekly-view" className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">주간 시간표 (와이드 그리드)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            월요일부터 일요일까지 시간 블록별 리듬을 한눈에 파악하는 주간 와이드 뷰
          </p>
        </div>

        {isParentMode && onOpenEditModal && (
          <button
            type="button"
            data-testid="weekly-add-item-btn"
            onClick={() => onOpenEditModal(null, currentWeekday)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>새 일정 추가</span>
          </button>
        )}
      </div>

      {/* Weekly Adjustments Banner (if adjustments exist) */}
      {adjustmentCount > 0 && (
        <div
          data-testid="weekly-adjustments-banner"
          className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-amber-900 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold">이번 주 조정 {adjustmentCount}건</span>
              <span className="text-amber-700 ml-1.5 hidden sm:inline">
                (시간 이동, 요일 변경, 휴강 등은 다음 주가 되면 자동으로 원래 기본 시간표로 복구됩니다)
              </span>
            </div>
          </div>

          {isParentMode && (
            <button
              type="button"
              data-testid="reset-weekly-adjustments-btn"
              onClick={handleResetAdjustments}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-amber-800 hover:bg-amber-100/80 font-bold text-xs border border-amber-300 shadow-2xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>이번 주 조정 모두 되돌리기</span>
            </button>
          )}
        </div>
      )}

      {/* 7-Day Grid */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[880px] grid grid-cols-7 gap-3">
          {WEEKDAYS.map((weekday) => {
            const isToday = weekday.number === currentWeekday;
            const dayItems = items
              .filter((item) => item.weekday === weekday.number)
              .sort(compareScheduleItemsByTime);
            const skippedDayItems = store.getExcludedMasterItemsForThisWeek(weekday.number);

            return (
              <div
                key={weekday.number}
                data-testid={`weekly-col-${weekday.shortName}`}
                className={`rounded-2xl border flex flex-col min-h-[560px] transition-all ${
                  isToday
                    ? 'bg-blue-50/40 border-blue-300 shadow-sm'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center border-b rounded-t-2xl flex flex-col items-center gap-1 relative ${
                    isToday
                      ? 'bg-blue-600 text-white border-blue-600'
                      : weekday.isWeekend
                      ? 'bg-slate-100 text-red-600 border-slate-200'
                      : 'bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{weekday.fullName}</span>
                    {isToday && (
                      <span className="text-[10px] bg-white text-blue-700 font-extrabold px-1.5 py-0.2 rounded-full shadow-xs">
                        오늘
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between w-full px-1">
                    <span className={`text-[11px] ${isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                      {dayItems.length}개 일정
                    </span>
                    {isParentMode && onOpenEditModal && (
                      <button
                        type="button"
                        data-testid={`weekly-add-day-btn-${weekday.number}`}
                        onClick={() => onOpenEditModal(null, weekday.number)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                          isToday
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-slate-200/60 hover:bg-slate-200 text-slate-600'
                        }`}
                        title={`${weekday.fullName}에 일정 추가`}
                      >
                        + 추가
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Items Column with visual time slots */}
                <div className="p-2 space-y-2.5 flex-1 flex flex-col">
                  {dayItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 py-8">
                      일정 없음
                    </div>
                  ) : (
                    dayItems.map((item) => {
                      const cat = CATEGORIES[item.category] || CATEGORIES.study;
                      const startTime = formatTime(item.startHour, item.startMinute);
                      const endTime = formatTime(item.endHour, item.endMinute);

                      const durationMin = Math.max(
                        15,
                        item.endHour * 60 + item.endMinute - (item.startHour * 60 + item.startMinute)
                      );
                      const durationText =
                        durationMin >= 60
                          ? durationMin % 60 === 0
                            ? `${Math.floor(durationMin / 60)}시간`
                            : `${Math.floor(durationMin / 60)}시간 ${durationMin % 60}분`
                          : `${durationMin}분`;

                      const cardMinHeight = Math.min(130, Math.max(56, Math.round(durationMin * 0.95)));
                      const badgeText = store.adjustmentBadgeText(item);

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl p-2.5 text-left border shadow-2xs transition-all hover:-translate-y-0.5 flex flex-col justify-between group relative"
                          style={{
                            backgroundColor: cat.softBackgroundColor,
                            borderColor: `${cat.color}45`,
                            borderLeftWidth: '4px',
                            borderLeftColor: cat.color,
                            minHeight: `${cardMinHeight}px`,
                          }}
                        >
                          <div>
                            {/* Adjustment Badge */}
                            {badgeText && (
                              <div
                                data-testid={`weekly-adjustment-badge-${item.id}`}
                                className="mb-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-extrabold tracking-tight flex items-center gap-1 shadow-2xs"
                              >
                                <span>⚡</span>
                                <span className="truncate">{badgeText}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                              <span style={{ color: cat.color }}>{cat.title}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-mono text-[9px] bg-white/70 px-1 py-0.2 rounded">
                                  {durationText}
                                </span>
                                {isParentMode && onOpenEditModal && (
                                  <button
                                    type="button"
                                    data-testid={`weekly-edit-item-btn-${item.id}`}
                                    onClick={() => onOpenEditModal(item, item.weekday)}
                                    className="p-1 rounded hover:bg-black/10 text-slate-500 hover:text-slate-800 transition-colors"
                                    title="시간표 편집 및 조정"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="font-bold text-xs text-slate-900 leading-tight">
                              {item.title}
                            </div>
                          </div>

                          <div className="mt-2 pt-1 border-t border-black/5 flex items-center justify-between text-[10px] text-slate-500">
                            <span>
                              {startTime} ~ {endTime}
                            </span>
                            {item.subTasks && item.subTasks.length > 0 && (
                              <span className="text-[9px] bg-white/80 px-1 py-0.2 rounded text-slate-600 font-medium">
                                할 일 {item.subTasks.length}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Skipped Items for this Day Column */}
                  {skippedDayItems.map((item) => {
                    const cat = CATEGORIES[item.category] || CATEGORIES.study;
                    const startTime = formatTime(item.startHour, item.startMinute);
                    const endTime = formatTime(item.endHour, item.endMinute);
                    const badgeText = store.adjustmentBadgeText(item);

                    return (
                      <div
                        key={`skipped-${item.id}`}
                        data-testid={`weekly-skipped-card-${item.id}`}
                        className="rounded-xl p-2.5 text-left border border-dashed border-slate-300 bg-slate-100/80 shadow-2xs flex flex-col justify-between opacity-80"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftColor: '#94a3b8',
                          minHeight: '75px',
                        }}
                      >
                        <div>
                          <div
                            data-testid={`weekly-adjustment-badge-${item.id}`}
                            className="mb-1.5 px-1.5 py-0.5 rounded bg-slate-600 text-white text-[9px] font-extrabold tracking-tight flex items-center gap-1 shadow-2xs"
                          >
                            <span>⏭️</span>
                            <span className="truncate">{badgeText || '이번 주 휴강·제외'}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                            <span className="text-slate-400 line-through">{cat.title}</span>
                            {isParentMode && onOpenEditModal && (
                              <button
                                type="button"
                                data-testid={`weekly-edit-item-btn-${item.id}`}
                                onClick={() => onOpenEditModal(item, item.weekday)}
                                className="p-1 rounded hover:bg-black/10 text-slate-500 hover:text-slate-800 transition-colors"
                                title="시간표 편집 및 조정"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="font-bold text-xs text-slate-400 line-through leading-tight">
                            {item.title}
                          </div>
                        </div>
                        <div className="mt-2 pt-1 border-t border-black/5 text-[10px] text-slate-400">
                          <span>
                            {startTime} ~ {endTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
