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

    vi.spyOn(syncService, 'fetchLatestBlobMetadata').mockResolvedValue({
      latest: { url: 'https://blob.test/state1.json', pathname: 'families/family-main/state-1.json' },
      allBlobs: [],
    });
    vi.spyOn(syncService, 'downloadSnapshot').mockResolvedValue(mockRemoteSnapshot);
    const uploadSpy = vi.spyOn(syncService, 'uploadSnapshot').mockResolvedValue({
      url: 'https://blob.test/state2.json',
      pathname: 'families/family-main/state-2.json',
    });

    const { result } = renderHook(() => useCloudSync({ store, syncService, pollingIntervalMs: 0 }));

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(result.current.syncStatus).toBe('success');
    expect(result.current.toastMessage).toContain('동기화 완료');
    expect(store.getParentPinCode()).toBe('888888');
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('handles sync error gracefully and displays error toast', async () => {
    vi.spyOn(syncService, 'fetchLatestBlobMetadata').mockRejectedValue(
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

  it('triggers sync on visibility change when returning to tab', async () => {
    const fetchSpy = vi.spyOn(syncService, 'fetchLatestBlobMetadata').mockResolvedValue({
      latest: null,
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
