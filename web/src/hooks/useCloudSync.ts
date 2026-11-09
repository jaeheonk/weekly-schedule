import { useState, useEffect, useRef, useCallback } from 'react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { VercelBlobSyncService } from '../services/vercelBlobSync';
import { SyncStatus } from '../components/SyncToast';

export interface UseCloudSyncOptions {
  store?: ScheduleStore;
  syncService?: VercelBlobSyncService;
  pollingIntervalMs?: number;
  syncOnMount?: boolean;
  onSyncRequest?: () => void;
}

export function useCloudSync({
  store = globalScheduleStore,
  syncService = VercelBlobSyncService.shared(),
  pollingIntervalMs = 30000,
  syncOnMount = true,
  onSyncRequest,
}: UseCloudSyncOptions = {}) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isSyncingRef = useRef(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
    setSyncStatus('idle');
  }, []);

  const scheduleToastDismiss = useCallback((delayMs: number = 3500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setSyncStatus('idle');
      toastTimeoutRef.current = null;
    }, delayMs);
  }, []);

  const triggerSync = useCallback(
    async (options: { isManual?: boolean } = {}) => {
      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      setSyncStatus('syncing');
      if (options.isManual) {
        setToastMessage('클라우드 동기화 중...');
      }

      try {
        const token = store.getBlobToken();
        const familyCode = store.getFamilyCode();
        const deviceId = store.getDeviceId();

        // 1. Fetch latest metadata
        const { latest, allBlobs } = await syncService.fetchLatestBlobMetadata(
          token,
          familyCode
        );

        // 2. Download and merge remote snapshot if one exists
        if (latest) {
          const remote = await syncService.downloadSnapshot(latest.url, token);
          store.applyMergedRemoteSnapshot(remote);
        }

        // 3. Upload merged current snapshot to cloud
        const currentSnapshot = store.makeCurrentSnapshot();
        await syncService.uploadSnapshot(currentSnapshot, {
          token,
          familyCode,
          shortDeviceId: deviceId,
          previousBlobsToDelete: allBlobs,
        });

        setLastSyncedAt(new Date());
        setSyncStatus('success');
        setToastMessage('클라우드 동기화 완료');
        scheduleToastDismiss(3500);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.';
        setSyncStatus('error');
        setToastMessage(errorMsg);
        scheduleToastDismiss(4500);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [store, syncService, scheduleToastDismiss]
  );

  // Keyboard shortcut: Cmd+R / Ctrl+R triggers manual sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (onSyncRequest) {
          onSyncRequest();
        }
        triggerSync({ isManual: true });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSync, onSyncRequest]);

  // Tab visibility change: trigger background sync when user returns to app tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync({ isManual: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [triggerSync]);

  // Background polling every 30 seconds
  useEffect(() => {
    if (pollingIntervalMs <= 0) return;

    const intervalId = setInterval(() => {
      triggerSync({ isManual: false });
    }, pollingIntervalMs);

    return () => clearInterval(intervalId);
  }, [triggerSync, pollingIntervalMs]);

  // Initial sync on mount
  useEffect(() => {
    if (syncOnMount) {
      triggerSync({ isManual: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncOnMount]);

  return {
    syncStatus,
    toastMessage,
    lastSyncedAt,
    isSyncing: syncStatus === 'syncing',
    triggerSync,
    clearToast,
  };
}
