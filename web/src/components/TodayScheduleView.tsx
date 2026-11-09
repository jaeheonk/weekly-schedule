import React from 'react';
import { Bell, Clock, ListChecks } from 'lucide-react';
import { ScheduleItem } from '../types/schedule';
import { CATEGORIES } from '../types/schedule';
import { formatTimeRange } from '../domain/calendarUtils';

export interface TodayScheduleViewProps {
  items: ScheduleItem[];
  weekdayName: string;
}

export const TodayScheduleView: React.FC<TodayScheduleViewProps> = ({ items, weekdayName }) => {
  return (
    <div data-testid="today-view" className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>오늘의 할 일</span>
            <span className="text-blue-600 bg-blue-50 text-sm font-semibold px-2 py-0.5 rounded-md border border-blue-100">
              {weekdayName}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">총 {items.length}개의 일정이 등록되어 있습니다.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500">
          오늘 등록된 일정이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cat = CATEGORIES[item.category] || CATEGORIES.study;
            const timeStr = formatTimeRange(item.startHour, item.startMinute, item.endHour, item.endMinute);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden"
                style={{ borderLeftWidth: '5px', borderLeftColor: cat.color }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color: cat.color, backgroundColor: cat.softBackgroundColor }}
                    >
                      {cat.title}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{timeStr}</span>
                    </div>
                  </div>

                  {item.isNotificationEnabled && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md self-start sm:self-auto">
                      <Bell className="w-3 h-3 text-amber-500" />
                      <span>알림</span>
                    </div>
                  )}
                </div>

                <div className="mt-2.5">
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
                </div>

                {item.subTasks && item.subTasks.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                      <span>세부 할 일</span>
                    </div>
                    <ul className="space-y-1 pl-1">
                      {item.subTasks.map((sub) => (
                        <li key={sub.id} className="text-xs text-slate-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          <span>{sub.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
