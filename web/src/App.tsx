import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { TodayScheduleView } from './components/TodayScheduleView';
import { WeeklyGridView } from './components/WeeklyGridView';
import { StarRewardShopView } from './components/StarRewardShopView';
import { StarCelebrationModal } from './components/StarCelebrationModal';
import { SyncToast, SyncStatus } from './components/SyncToast';
import { ParentPinModal } from './components/ParentPinModal';
import { PraiseHeartModal } from './components/PraiseHeartModal';
import { RewardExchangeModal } from './components/RewardExchangeModal';
import { ScheduleEditModal } from './components/ScheduleEditModal';
import { SchedulePrintModal } from './components/SchedulePrintModal';
import { useCloudSync } from './hooks/useCloudSync';
import { globalScheduleStore } from './domain/scheduleStore';
import { ScheduleItem, WEEKDAYS, WeekdayNumber, ScheduleEditScope } from './types/schedule';
import { StarCelebrationContext } from './types/snapshot';

export interface AppProps {
  syncOnMount?: boolean;
}

export const App: React.FC<AppProps> = ({ syncOnMount = true }) => {
  const getTabFromHash = (): 'today' | 'weekly' | 'stars' => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#weekly') return 'weekly';
    if (hash === '#stars') return 'stars';
    return 'today';
  };

  const isPrintHash = (): boolean => window.location.hash.toLowerCase() === '#print';

  const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'stars'>(getTabFromHash);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(isPrintHash);
  const [printScope, setPrintScope] = useState<ScheduleEditScope>('master');
  const [items, setItems] = useState<ScheduleItem[]>(() => globalScheduleStore.getItems());
  const [isParentMode, setIsParentMode] = useState<boolean>(() =>
    globalScheduleStore.isParentMode()
  );
  const [availableHearts, setAvailableHearts] = useState<number>(() =>
    globalScheduleStore.getAvailableHearts()
  );
  const [availableStars, setAvailableStars] = useState<number>(() =>
    globalScheduleStore.getAvailableStars()
  );
  const [pendingStarRedemptions, setPendingStarRedemptions] = useState<number>(() =>
    globalScheduleStore.getPendingStarRedemptionCount()
  );
  const [celebrationContext, setCelebrationContext] = useState<StarCelebrationContext | null>(() =>
    globalScheduleStore.getCelebrationContext()
  );
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayNumber>(() =>
    globalScheduleStore.getSelectedWeekday()
  );

  const [pinPrompt, setPinPrompt] = useState<{
    reason?: string;
    onConfirm?: () => void;
  } | null>(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [localToast, setLocalToast] = useState<{ message: string; status: SyncStatus } | null>(
    null
  );
  const [praiseModal, setPraiseModal] = useState<{
    isOpen: boolean;
    targetItem: ScheduleItem | null;
  }>({ isOpen: false, targetItem: null });

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    initialItem: ScheduleItem | null;
    defaultWeekday: WeekdayNumber;
    initialScope: ScheduleEditScope;
  }>({
    isOpen: false,
    initialItem: null,
    defaultWeekday: globalScheduleStore.getCurrentWeekday(),
    initialScope: 'master',
  });

  const currentDate = globalScheduleStore.getCurrentDate();
  const currentWeekday = globalScheduleStore.getCurrentWeekday();

  const handleOpenEditModal = (
    item: ScheduleItem | null = null,
    weekday?: WeekdayNumber,
    scope?: ScheduleEditScope
  ) => {
    setEditModal({
      isOpen: true,
      initialItem: item,
      defaultWeekday: weekday || currentWeekday,
      initialScope: scope || 'master',
    });
  };

  const { syncStatus, toastMessage, isSyncing, triggerSync, clearToast } = useCloudSync({
    store: globalScheduleStore,
    syncOnMount,
  });

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#print') {
        setIsPrintModalOpen(true);
      } else {
        setIsPrintModalOpen(false);
        setActiveTab(getTabFromHash());
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleOpenPrint = (scope?: ScheduleEditScope) => {
    if (scope) {
      setPrintScope(scope);
    }
    window.location.hash = '#print';
    setIsPrintModalOpen(true);
  };

  const handleClosePrint = () => {
    setIsPrintModalOpen(false);
    if (window.location.hash.toLowerCase() === '#print') {
      window.location.hash = `#${activeTab}`;
    }
  };

  useEffect(() => {
    const unsubscribe = globalScheduleStore.subscribe(() => {
      setItems(globalScheduleStore.getItems());
      setIsParentMode(globalScheduleStore.isParentMode());
      setAvailableHearts(globalScheduleStore.getAvailableHearts());
      setAvailableStars(globalScheduleStore.getAvailableStars());
      setPendingStarRedemptions(globalScheduleStore.getPendingStarRedemptionCount());
      setCelebrationContext(globalScheduleStore.getCelebrationContext());
      setSelectedWeekday(globalScheduleStore.getSelectedWeekday());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const checkDateChange = () => {
      globalScheduleStore.refreshDateAndDayChange();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        globalScheduleStore.refreshDateAndDayChange();
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
  }, []);

  useEffect(() => {
    return globalScheduleStore.onToast((msg, status) => {
      setLocalToast({ message: msg, status });
    });
  }, []);

  useEffect(() => {
    if (!localToast) return;
    const timer = setTimeout(() => {
      setLocalToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [localToast]);

  const handleSelectTab = (tab: 'today' | 'weekly' | 'stars') => {
    window.location.hash = `#${tab}`;
    setActiveTab(tab);
  };

  const currentWeekdayInfo = WEEKDAYS.find((w) => w.number === currentWeekday);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 overflow-x-hidden w-full max-w-full">
      <SyncToast
        status={localToast ? localToast.status : syncStatus}
        message={localToast ? localToast.message : toastMessage}
        onClose={() => {
          if (localToast) setLocalToast(null);
          clearToast();
        }}
      />

      <Navigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentDate={currentDate}
        isSyncing={isSyncing}
        onSync={() => triggerSync({ isManual: true })}
        onOpenPrint={handleOpenPrint}
        isParentMode={isParentMode}
        onOpenParentPin={() => setPinPrompt({})}
        onLockParentMode={() => globalScheduleStore.lockParentMode()}
        onOpenRewardExchange={() => setIsRewardModalOpen(true)}
        availableHearts={availableHearts}
        availableStars={availableStars}
        pendingStarRedemptions={pendingStarRedemptions}
      />

      <main className="flex-1 pb-12">
        {activeTab === 'stars' ? (
          <StarRewardShopView
            store={globalScheduleStore}
            onOpenParentPin={() => setPinPrompt({})}
            onOpenRewardExchange={() => setIsRewardModalOpen(true)}
          />
        ) : activeTab === 'today' ? (
          <TodayScheduleView
            weekdayName={currentWeekdayInfo?.fullName || '오늘'}
            store={globalScheduleStore}
            onOpenPraiseModal={(target) =>
              setPraiseModal({
                isOpen: true,
                targetItem: target === undefined ? null : target,
              })
            }
            onOpenEditModal={(target, weekday, scope) =>
              handleOpenEditModal(
                target || null,
                weekday || selectedWeekday,
                scope || (target ? 'master' : 'thisWeek')
              )
            }
            onRequestParentAuth={(reason, action) => {
              setPinPrompt({ reason, onConfirm: action });
            }}
            onOpenRewardExchange={() => setIsRewardModalOpen(true)}
          />
        ) : (
          <WeeklyGridView
            currentWeekday={currentWeekday}
            store={globalScheduleStore}
            onOpenEditModal={handleOpenEditModal}
            onOpenPrint={handleOpenPrint}
          />
        )}
      </main>

      {/* 6-Digit Master PIN Authentication Modal */}
      <ParentPinModal
        isOpen={pinPrompt !== null}
        reason={pinPrompt?.reason}
        onClose={() => setPinPrompt(null)}
        onSuccess={() => {
          const actionToRun = pinPrompt?.onConfirm;
          setPinPrompt(null);
          actionToRun?.();
        }}
        store={globalScheduleStore}
      />

      {/* Star Celebration Modal (Daily +1⭐ or Weekly Bonus +2⭐ or Reward Approval) */}
      <StarCelebrationModal
        isOpen={celebrationContext !== null}
        onClose={() => globalScheduleStore.clearCelebrationContext()}
        onOpenStarShop={() => {
          globalScheduleStore.clearCelebrationContext();
          handleSelectTab('stars');
        }}
        context={celebrationContext}
      />

      {/* Praise Heart & Sticker Bottom Sheet / Modal */}
      <PraiseHeartModal
        isOpen={praiseModal.isOpen}
        onClose={() => setPraiseModal({ isOpen: false, targetItem: null })}
        targetItem={praiseModal.targetItem}
        store={globalScheduleStore}
      />

      {/* Schedule Edit & Weekly Override Modal */}
      <ScheduleEditModal
        isOpen={editModal.isOpen}
        onClose={() =>
          setEditModal((prev) => ({
            ...prev,
            isOpen: false,
            initialItem: null,
          }))
        }
        initialItem={editModal.initialItem}
        defaultWeekday={editModal.defaultWeekday}
        initialScope={editModal.initialScope}
        store={globalScheduleStore}
      />

      {/* A4 1-Page Landscape Print Engine Modal */}
      <SchedulePrintModal
        isOpen={isPrintModalOpen}
        onClose={handleClosePrint}
        initialScope={printScope}
        store={globalScheduleStore}
      />

      {/* Heart Reward Exchange Modal */}
      <RewardExchangeModal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        store={globalScheduleStore}
      />
    </div>
  );
};

export default App;
