import { useState, useEffect, useRef, useCallback } from 'react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { VercelBlobSyncService } from '../services/vercelBlobSync';
import { SyncStatus } from '../components/SyncToast';

// Render's free web service sleeps after 15 minutes and can take about a minute
// to answer the request that wakes it. Show the syncing toast once a request
// has been waiting, and leave the request running until the proxy responds.
const SLOW_SYNC_NOTICE_MS = 3000;

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
  const lastSyncedBlobPathnameRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    async (options: { isManual?: boolean; forceUpload?: boolean } = {}) => {
      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      let announcedSlowSync = options.isManual === true;
      if (options.isManual) {
        setSyncStatus('syncing');
        setToastMessage('클라우드 동기화 중...');
      }
      const slowNoticeTimer = setTimeout(() => {
        if (!isSyncingRef.current) return;
        announcedSlowSync = true;
        setSyncStatus('syncing');
        setToastMessage('클라우드 동기화 중...');
      }, SLOW_SYNC_NOTICE_MS);

      const showRecoveryToast = () => {
        setSyncStatus('success');
        setToastMessage('클라우드 동기화 완료');
        scheduleToastDismiss(3500);
      };

      try {
        const familyCode = store.getFamilyCode();
        const deviceId = store.getDeviceId();

        // 1. Fetch the latest 클라우드 동기화 스냅샷 from the proxy
        const { latest, snapshot, allBlobs } = await syncService.fetchLatestSnapshot(familyCode);

        // If background polling and remote hasn't changed and local is clean, skip work
        if (
          !options.isManual &&
          !options.forceUpload &&
          !isDirtyRef.current &&
          latest &&
          latest.pathname === lastSyncedBlobPathnameRef.current
        ) {
          if (announcedSlowSync) {
            showRecoveryToast();
          }
          return;
        }

        if (latest && !snapshot) {
          throw new Error('최신 클라우드 동기화 스냅샷을 받지 못했습니다.');
        }

        let eventToastMessage: string | null = null;

        // 2. Merge the proxy snapshot when a newer remote pathname arrives
        if (latest && snapshot && latest.pathname !== lastSyncedBlobPathnameRef.current) {
          const remote = snapshot;

          const localBefore = store.makeCurrentSnapshot();
          const prevPraiseCount = localBefore.praiseNotes.length;
          const prevVerifiedCount = Object.values(localBefore.parentVerifiedFlags).filter(
            (f) => f.isSet
          ).length;

          isApplyingRemoteRef.current = true;
          try {
            store.applyMergedRemoteSnapshot(remote);
          } finally {
            isApplyingRemoteRef.current = false;
          }

          lastSyncedBlobPathnameRef.current = latest.pathname;

          // Detect incoming remote events if updated by another device
          if (remote.updatedByDeviceId && remote.updatedByDeviceId !== deviceId) {
            const newPraiseCount = remote.praiseNotes.length;
            const newVerifiedCount = Object.values(remote.parentVerifiedFlags).filter(
              (f) => f.isSet
            ).length;

            if (newPraiseCount > prevPraiseCount) {
              eventToastMessage = '❤️ 부모님이 칭찬 응원 카드를 보내주셨어요!';
            } else if (newVerifiedCount > prevVerifiedCount) {
              const diff = newVerifiedCount - prevVerifiedCount;
              eventToastMessage = `✅ 부모님이 숙제 ${diff}개에 확인 도장을 찍어주셨어요!`;
            }
          }
        }

        // 3. Upload merged current snapshot if dirty, forceUpload, or no remote snapshot yet
        const shouldUpload =
          isDirtyRef.current ||
          options.forceUpload ||
          !latest ||
          options.isManual;

        if (shouldUpload) {
          const currentSnapshot = store.makeCurrentSnapshot();
          const putResult = await syncService.uploadSnapshot(currentSnapshot, {
            familyCode,
            shortDeviceId: deviceId,
            previousBlobsToDelete: allBlobs,
          });

          lastSyncedBlobPathnameRef.current = putResult.pathname;
          isDirtyRef.current = false;
        }

        setLastSyncedAt(new Date());

        if (eventToastMessage) {
          setSyncStatus('success');
          setToastMessage(eventToastMessage);
          scheduleToastDismiss(4000);
        } else if (options.isManual || announcedSlowSync) {
          showRecoveryToast();
        } else {
          // Quiet background sync: no intrusive toast
          setSyncStatus('idle');
          setToastMessage(null);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.';
        setSyncStatus('error');
        setToastMessage(errorMsg);
        scheduleToastDismiss(4500);
      } finally {
        clearTimeout(slowNoticeTimer);
        isSyncingRef.current = false;
      }
    },
    [store, syncService, scheduleToastDismiss]
  );

  // Debounced auto-upload on local store mutations
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      if (isApplyingRemoteRef.current) return;
      isDirtyRef.current = true;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (isDirtyRef.current) {
          triggerSync({ isManual: false, forceUpload: true });
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [store, triggerSync]);

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
