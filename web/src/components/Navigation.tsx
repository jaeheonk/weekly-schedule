import React from 'react';
import {
  Calendar,
  CheckSquare,
  Grid,
  RefreshCw,
  Lock,
  Unlock,
  ShieldCheck,
  Heart,
} from 'lucide-react';
import { getWeekdayNumber, getWeekKey } from '../domain/calendarUtils';
import { WEEKDAYS } from '../types/schedule';

export interface NavigationProps {
  activeTab: 'today' | 'weekly';
  onSelectTab: (tab: 'today' | 'weekly') => void;
  currentDate?: Date;
  isSyncing?: boolean;
  onSync?: () => void;
  isParentMode?: boolean;
  onOpenParentPin?: () => void;
  onLockParentMode?: () => void;
  availableHearts?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  currentDate = new Date(),
  isSyncing = false,
  onSync,
  isParentMode = false,
  onOpenParentPin,
  onLockParentMode,
  availableHearts = 0,
}) => {
  const weekdayNum = getWeekdayNumber(currentDate);
  const weekdayInfo = WEEKDAYS.find((w) => w.number === weekdayNum);
  const weekKey = getWeekKey(currentDate);

  const formattedDate = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일 (${weekdayInfo?.shortName || ''})`;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Date Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-blue-200 shadow-md">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">주간 시간표</h1>
              <p className="text-xs text-slate-500 font-medium">Weekly Schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-slate-200/60">
              <span>{formattedDate}</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-blue-600 font-bold">{weekKey}</span>
            </div>

            {availableHearts > 0 && (
              <div
                data-testid="header-hearts-badge"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-bold border border-pink-200/80 shadow-sm"
                title={`보유 하트: ${availableHearts}개`}
              >
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>{availableHearts}</span>
              </div>
            )}

            {onSync && (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                title="클라우드 동기화 (⌘R)"
                aria-label="클라우드 동기화"
                data-testid="header-sync-button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200/60 disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'
                  }`}
                />
                <span className="hidden md:inline">{isSyncing ? '동기화 중' : '동기화'}</span>
              </button>
            )}

            {/* Mode Switcher */}
            {isParentMode ? (
              <div className="flex items-center gap-1">
                <span
                  data-testid="parent-mode-indicator"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>부모 모드</span>
                </span>
                {onLockParentMode && (
                  <button
                    type="button"
                    onClick={onLockParentMode}
                    data-testid="mode-lock-button"
                    title="아이 모드로 전환 (잠금)"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors"
                  >
                    <Unlock className="w-3 h-3 text-slate-500" />
                    <span className="hidden sm:inline">잠금</span>
                  </button>
                )}
              </div>
            ) : (
              onOpenParentPin && (
                <button
                  type="button"
                  onClick={onOpenParentPin}
                  data-testid="mode-switch-button"
                  title="부모 모드로 전환 (6자리 PIN)"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-xs font-bold border border-indigo-200/80 transition-colors shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>부모 모드</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav aria-label="메인 내비게이션" className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto border border-slate-200/80">
          <button
            type="button"
            onClick={() => onSelectTab('today')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>오늘의 할 일</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('weekly')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'weekly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>주간 시간표</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
