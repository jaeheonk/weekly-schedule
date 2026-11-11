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
  Star,
  Printer,
} from 'lucide-react';
import { getWeekdayNumber, getWeekKey } from '../domain/calendarUtils';
import { WEEKDAYS } from '../types/schedule';

export type MainTab = 'today' | 'weekly';

export interface NavigationProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentDate?: Date;
  isSyncing?: boolean;
  onSync?: () => void;
  onOpenPrint?: () => void;
  isParentMode?: boolean;
  onOpenParentPin?: () => void;
  onLockParentMode?: () => void;
  onOpenRewardExchange?: () => void;
  /** ⭐ 스타 배지를 누르면 스타 보상 상점 모달을 연다 (iOS처럼 탭이 아닌 시트) */
  onOpenStarShop?: () => void;
  isStarShopOpen?: boolean;
  availableHearts?: number;
  availableStars?: number;
  pendingStarRedemptions?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  currentDate = new Date(),
  isSyncing = false,
  onSync,
  onOpenPrint,
  isParentMode = false,
  onOpenParentPin,
  onLockParentMode,
  onOpenRewardExchange,
  onOpenStarShop,
  isStarShopOpen = false,
  availableHearts = 0,
  availableStars = 0,
  pendingStarRedemptions = 0,
}) => {
  const weekdayNum = getWeekdayNumber(currentDate);
  const weekdayInfo = WEEKDAYS.find((w) => w.number === weekdayNum);
  const weekKey = getWeekKey(currentDate);

  const formattedDate = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일 (${weekdayInfo?.shortName || ''})`;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm overflow-x-hidden">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Brand & Top Status Row */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-blue-200 shadow-md shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">주간 시간표</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-none">Weekly Schedule</p>
            </div>
          </div>

          {/* Desktop/Tablet Date Badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200/60 shrink-0">
            <span>{formattedDate}</span>
            <span className="text-slate-400 font-normal">|</span>
            <span className="text-blue-600 font-bold">{weekKey}</span>
          </div>

          {/* Quick Actions & Status Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {availableHearts > 0 && (
              <button
                type="button"
                onClick={onOpenRewardExchange}
                data-testid="header-hearts-badge"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-pink-50 hover:bg-pink-100 active:bg-pink-200 text-pink-700 text-xs font-bold border border-pink-200/80 shadow-xs transition-colors cursor-pointer shrink-0"
                title={`하트 보상 교환 (보유 하트: ${availableHearts}개)`}
              >
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>{availableHearts}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenStarShop}
              data-testid="header-stars-badge"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all border shadow-xs shrink-0 ${
                isStarShopOpen
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/80'
              }`}
              title={`스타 보상 상점 열기 (보유 스타: ${availableStars}개)`}
              aria-label={`스타 보상 상점 열기 (보유 스타 ${availableStars}개)`}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  isStarShopOpen
                    ? 'fill-yellow-200 text-yellow-200'
                    : 'fill-amber-500 text-amber-500'
                }`}
              />
              <span>{availableStars}</span>
              {pendingStarRedemptions > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-600 ring-1 ring-white" />
              )}
            </button>

            {onSync && (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                title="클라우드 동기화 (⌘R)"
                aria-label="클라우드 동기화"
                data-testid="header-sync-button"
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200/60 disabled:opacity-60 shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'
                  }`}
                />
                <span className="hidden md:inline">{isSyncing ? '동기화 중' : '동기화'}</span>
              </button>
            )}

            {onOpenPrint && (
              <button
                type="button"
                onClick={onOpenPrint}
                title="1페이지 시간표 인쇄 (⌘P)"
                aria-label="시간표 인쇄"
                data-testid="header-print-button"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200/60 shrink-0"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">인쇄</span>
              </button>
            )}

            {/* Mode Switcher */}
            {isParentMode ? (
              <div className="flex items-center gap-1 shrink-0">
                <span
                  data-testid="parent-mode-indicator"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm whitespace-nowrap"
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
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors shrink-0"
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
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-xs font-bold border border-indigo-200/80 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>부모 모드</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Mobile Date Badge (Row 2 on mobile) */}
        <div className="flex sm:hidden items-center justify-center w-full">
          <div className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-slate-200/60 max-w-full truncate">
            <span>{formattedDate}</span>
            <span className="text-slate-400 font-normal">|</span>
            <span className="text-blue-600 font-bold">{weekKey}</span>
          </div>
        </div>

        {/* View Switcher Tabs (Row 3 on mobile, Right column on desktop) */}
        <nav aria-label="메인 내비게이션" className="grid grid-cols-2 sm:flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto border border-slate-200/80">
          <button
            type="button"
            onClick={() => onSelectTab('today')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">오늘의 할 일</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('weekly')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'weekly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">주간 시간표</span>
          </button>

        </nav>
      </div>
    </header>
  );
};
