import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudSync } from './useCloudSync';
import { ScheduleStore } from '../domain/scheduleStore';
import { VercelBlobSyncService } from '../services/vercelBlobSync';

describe('useCloudSync Hook', () => {
  let store: ScheduleStore;
  let syncService: VercelBlobSyncService;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ScheduleStore();
    syncService = VercelBlobSyncService.shared();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('performs full sync: downloads latest snapshot and applies merge', async () => {
    const mockRemoteSnapshot = store.makeCurrentSnapshot();
    mockRemoteSnapshot.parentPinCode = '888888';
    mockRemoteSnapshot.parentPinUpdatedAt = Date.now() / 1000 + 50;

    vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue({
      latest: { url: 'https://blob.test/state1.json', pathname: 'families/family-main/state-1.json' },
      snapshot: mockRemoteSnapshot,
      allBlobs: [],
    });
    const uploadSpy = vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state2.json',
      pathname: 'families/family-main/state-2.json',
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    await act(async () => {
      await result.current.triggerSync({ isManual: true });
    });

    expect(result.current.syncStatus).toBe('success');
    expect(result.current.toastMessage).toContain('동기화 완료');
    expect(store.getParentPinCode()).toBe('888888');
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('shows incoming praise card toast when remote changes arrive from another device', async () => {
    const mockRemoteSnapshot = store.makeCurrentSnapshot();
    mockRemoteSnapshot.updatedByDeviceId = 'other-device-iphone';
    mockRemoteSnapshot.praiseNotes = [
      {
        id: 'praise-1',
        hearts: 5,
        sticker: 'heart',
        message: '오늘 하루도 최고야!',
        createdAt: Date.now() / 1000,
      },
    ];

    vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue({
      latest: { url: 'https://blob.test/state-new.json', pathname: 'families/family-main/state-new.json' },
      snapshot: mockRemoteSnapshot,
      allBlobs: [],
    });
    vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state-put.json',
      pathname: 'families/family-main/state-put.json',
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    await act(async () => {
      await result.current.triggerSync({ isManual: false });
    });

    expect(result.current.syncStatus).toBe('success');
    expect(result.current.toastMessage).toContain('부모님이 칭찬 응원 카드를 보내주셨어요');
  });

  it('does not upload when the proxy returns blob metadata without a snapshot', async () => {
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue({
      latest: { url: 'https://blob.test/state1.json', pathname: 'families/family-main/state-1.json' },
      snapshot: null,
      allBlobs: [
        { url: 'https://blob.test/state1.json', pathname: 'families/family-main/state-1.json' },
      ],
    });
    const uploadSpy = vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state2.json',
      pathname: 'families/family-main/state-2.json',
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    await act(async () => {
      await result.current.triggerSync({ isManual: true });
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(result.current.syncStatus).toBe('error');
    expect(result.current.toastMessage).toContain('클라우드 동기화 스냅샷');
  });

  it('handles sync error gracefully and displays error toast', async () => {
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockRejectedValue(
      new Error('네트워크 연결 끊김')
    );

    const { result } = renderHook(() => useCloudSync({ store, syncService, pollingIntervalMs: 0 }));

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(result.current.syncStatus).toBe('error');
    expect(result.current.toastMessage).toContain('네트워크 연결 끊김');
  });

  it('intercepts Cmd+R / Ctrl+R keyboard shortcut to trigger sync and prevent reload', () => {
    const triggerSpy = vi.fn();
    renderHook(() => useCloudSync({ store, syncService, pollingIntervalMs: 0, onSyncRequest: triggerSpy }));

    const preventDefault = vi.fn();
    const event = new KeyboardEvent('keydown', {
      key: 'r',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });

  it('shows 클라우드 동기화 중... through a cold-start wait and then recovers', async () => {
    let resolveFetch: (value: {
      latest: null;
      snapshot: null;
      allBlobs: [];
    }) => void = () => {};
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const uploadSpy = vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state.json',
      pathname: 'families/family-main/state.json',
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    act(() => {
      void result.current.triggerSync({ isManual: false });
    });

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.toastMessage).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(result.current.syncStatus).toBe('syncing');
    expect(result.current.toastMessage).toContain('동기화 중...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50_000);
    });

    expect(result.current.syncStatus).toBe('syncing');
    expect(result.current.toastMessage).toContain('동기화 중...');

    await act(async () => {
      resolveFetch({ latest: null, snapshot: null, allBlobs: [] });
    });

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(result.current.syncStatus).toBe('success');
    expect(result.current.toastMessage).toContain('클라우드 동기화 완료');
  });

  it('recovers the cold-start toast when the remote 클라우드 동기화 스냅샷 is unchanged', async () => {
    const pathname = 'families/family-main/state-same.json';
    const snapshot = store.makeCurrentSnapshot();
    const remote = {
      latest: { url: 'https://blob.test/state-same.json', pathname },
      snapshot,
      allBlobs: [] as [],
    };
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue(remote);
    vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state-same.json',
      pathname,
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    await act(async () => {
      await result.current.triggerSync({ isManual: false, forceUpload: true });
    });

    let resolveSlowFetch: (value: typeof remote) => void = () => {};
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlowFetch = resolve;
        })
    );
    const uploadSpy = vi.spyOn(syncService, 'uploadSnapshot');

    act(() => {
      void result.current.triggerSync({ isManual: false });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(result.current.toastMessage).toContain('동기화 중...');

    await act(async () => {
      resolveSlowFetch(remote);
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(result.current.syncStatus).toBe('success');
    expect(result.current.toastMessage).toContain('클라우드 동기화 완료');
  });

  it('keeps a fast background sync quiet', async () => {
    vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue({
      latest: null,
      snapshot: null,
      allBlobs: [],
    });
    vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state.json',
      pathname: 'families/family-main/state.json',
    });

    const { result } = renderHook(() =>
      useCloudSync({ store, syncService, pollingIntervalMs: 0, syncOnMount: false })
    );

    await act(async () => {
      await result.current.triggerSync({ isManual: false });
    });

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.toastMessage).toBeNull();
  });

  it('triggers sync on visibility change when returning to tab', async () => {
    const fetchSpy = vi.spyOn(syncService, 'fetchLatestSnapshot').mockResolvedValue({
      latest: null,
      snapshot: null,
      allBlobs: [],
    });
    vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state.json',
      pathname: 'state.json',
    });

    renderHook(() => useCloudSync({ store, syncService, pollingIntervalMs: 0 }));

    // Simulate returning to tab
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(fetchSpy).toHaveBeenCalled();
  });
});
