import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { TodayScheduleView } from './components/TodayScheduleView';
import { WeeklyGridView } from './components/WeeklyGridView';
import { SyncToast } from './components/SyncToast';
import { useCloudSync } from './hooks/useCloudSync';
import { globalScheduleStore } from './domain/scheduleStore';
import { compareScheduleItemsByTime } from './domain/calendarUtils';
import { ScheduleItem, WEEKDAYS } from './types/schedule';

export interface AppProps {
  syncOnMount?: boolean;
}

export const App: React.FC<AppProps> = ({ syncOnMount = true }) => {
  const getTabFromHash = (): 'today' | 'weekly' => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#weekly') return 'weekly';
    return 'today';
  };

  const [activeTab, setActiveTab] = useState<'today' | 'weekly'>(getTabFromHash);
  const [items, setItems] = useState<ScheduleItem[]>(() => globalScheduleStore.getItems());
  const currentDate = globalScheduleStore.getCurrentDate();
  const currentWeekday = globalScheduleStore.getCurrentWeekday();

  const { syncStatus, toastMessage, isSyncing, triggerSync, clearToast } = useCloudSync({
    store: globalScheduleStore,
    syncOnMount,
  });

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(getTabFromHash());
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = globalScheduleStore.subscribe(() => {
      setItems(globalScheduleStore.getItems());
    });
    return unsubscribe;
  }, []);

  const handleSelectTab = (tab: 'today' | 'weekly') => {
    window.location.hash = `#${tab}`;
    setActiveTab(tab);
  };

  const currentWeekdayInfo = WEEKDAYS.find((w) => w.number === currentWeekday);
  const todayItems = items
    .filter((item) => item.weekday === currentWeekday)
    .sort(compareScheduleItemsByTime);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <SyncToast
        status={syncStatus}
        message={toastMessage}
        onClose={clearToast}
      />

      <Navigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentDate={currentDate}
        isSyncing={isSyncing}
        onSync={() => triggerSync({ isManual: true })}
      />

      <main className="flex-1 pb-12">
        {activeTab === 'today' ? (
          <TodayScheduleView
            items={todayItems}
            weekdayName={currentWeekdayInfo?.fullName || '오늘'}
            store={globalScheduleStore}
          />
        ) : (
          <WeeklyGridView
            items={items}
            currentWeekday={currentWeekday}
          />
        )}
      </main>
    </div>
  );
};

export default App;
