import React from 'react';
import { ScheduleItem, WEEKDAYS, WeekdayNumber } from '../types/schedule';
import { CATEGORIES } from '../types/schedule';
import { formatTime, compareScheduleItemsByTime } from '../domain/calendarUtils';

export interface WeeklyGridViewProps {
  items: ScheduleItem[];
  currentWeekday: WeekdayNumber;
}

export const WeeklyGridView: React.FC<WeeklyGridViewProps> = ({ items, currentWeekday }) => {
  return (
    <div data-testid="weekly-view" className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">주간 시간표 (와이드 그리드)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            월요일부터 일요일까지 시간 블록별 리듬을 한눈에 파악하는 주간 와이드 뷰
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[880px] grid grid-cols-7 gap-3">
          {WEEKDAYS.map((weekday) => {
            const isToday = weekday.number === currentWeekday;
            const dayItems = items
              .filter((item) => item.weekday === weekday.number)
              .sort(compareScheduleItemsByTime);

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
                  className={`p-3 text-center border-b rounded-t-2xl flex flex-col items-center gap-1 ${
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
                  <span className={`text-[11px] ${isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                    {dayItems.length}개 일정
                  </span>
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

                      // Visually scale height slightly based on duration (from 56px to 130px)
                      const cardMinHeight = Math.min(130, Math.max(56, Math.round(durationMin * 0.95)));

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl p-2.5 text-left border shadow-2xs transition-all hover:-translate-y-0.5 flex flex-col justify-between"
                          style={{
                            backgroundColor: cat.softBackgroundColor,
                            borderColor: `${cat.color}45`,
                            borderLeftWidth: '4px',
                            borderLeftColor: cat.color,
                            minHeight: `${cardMinHeight}px`,
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                              <span style={{ color: cat.color }}>{cat.title}</span>
                              <span className="text-slate-500 font-mono text-[9px] bg-white/70 px-1 py-0.2 rounded">
                                {durationText}
                              </span>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
