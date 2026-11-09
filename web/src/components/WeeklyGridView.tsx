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
          <h2 className="text-xl font-bold text-slate-900">주간 시간표</h2>
          <p className="text-xs text-slate-500 mt-0.5">월요일부터 일요일까지 한눈에 확인하는 전체 일정</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[840px] grid grid-cols-7 gap-3">
          {WEEKDAYS.map((weekday) => {
            const isToday = weekday.number === currentWeekday;
            const dayItems = items
              .filter((item) => item.weekday === weekday.number)
              .sort(compareScheduleItemsByTime);

            return (
              <div
                key={weekday.number}
                data-testid={`weekly-col-${weekday.shortName}`}
                className={`rounded-2xl border flex flex-col min-h-[500px] transition-all ${
                  isToday
                    ? 'bg-blue-50/50 border-blue-300 shadow-sm'
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

                {/* Day Items Column */}
                <div className="p-2 space-y-2 flex-1">
                  {dayItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 py-8">
                      일정 없음
                    </div>
                  ) : (
                    dayItems.map((item) => {
                      const cat = CATEGORIES[item.category] || CATEGORIES.study;
                      const startTime = formatTime(item.startHour, item.startMinute);
                      const endTime = formatTime(item.endHour, item.endMinute);

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl p-2.5 text-left border shadow-2xs transition-transform hover:-translate-y-0.5"
                          style={{
                            backgroundColor: cat.softBackgroundColor,
                            borderColor: `${cat.color}40`,
                          }}
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                            <span style={{ color: cat.color }}>{cat.title}</span>
                            <span className="text-slate-500">{startTime}</span>
                          </div>
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {startTime} ~ {endTime}
                          </div>
                          {item.subTasks && item.subTasks.length > 0 && (
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                              <span>세부 할 일 {item.subTasks.length}개</span>
                            </div>
                          )}
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
