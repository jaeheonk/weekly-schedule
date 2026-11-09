import { describe, it, expect, vi, afterEach } from 'vitest';
import { VercelBlobSyncService } from './vercelBlobSync';
import { CloudSyncSnapshot } from '../types/snapshot';

const remoteSnapshot: CloudSyncSnapshot = {
  schemaVersion: 5,
  familyCode: 'family-main',
  updatedAt: 1700000000,
  updatedByRole: '웹',
  updatedByDeviceId: 'web-1234',
  parentPinCode: '160125',
  parentPinUpdatedAt: 1700000000,
  items: [],
  deletedItemTimestamps: {},
  weeklyOverrides: {},
  completionFlags: {},
  subTaskCompletionFlags: {},
  parentVerifiedFlags: {},
  parentVerifiedSubTaskFlags: {},
  itemReactions: {},
  praiseNotes: [],
  rewardRedemptions: [],
  archivedEarnedHearts: 0,
  rewardPresets: [],
  deletedRewardPresetTimestamps: {},
  starTransactions: [],
  starRedemptionRequests: [],
  starRewardPresets: [],
  deletedStarPresetTimestamps: {},
  revokedStarTransactionIds: [],
  revokedStarRedemptionIds: [],
  revokedPraiseNoteIds: [],
};

describe('VercelBlobSyncService proxy client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('loads the latest 클라우드 동기화 스냅샷 from the proxy without a blob token', async () => {
    const proxyPayload = {
      latest: {
        url: 'https://blob.test/state3',
        pathname: 'families/family-main/state-00000003000-dev2.json',
      },
      snapshot: remoteSnapshot,
      allBlobs: [
        {
          url: 'https://blob.test/state3',
          pathname: 'families/family-main/state-00000003000-dev2.json',
        },
        {
          url: 'https://blob.test/state1',
          pathname: 'families/family-main/state-00000001000-dev1.json',
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => proxyPayload,
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService();
    const result = await service.fetchLatestSnapshot('family-main');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/sync/latest?familyCode=family-main');
    expect(options.method).toBe('GET');
    expect(options.headers?.Authorization).toBeUndefined();
    expect(JSON.stringify(options.headers)).not.toContain('vercel_blob');
    expect(result.latest?.pathname).toBe('families/family-main/state-00000003000-dev2.json');
    expect(result.snapshot?.schemaVersion).toBe(5);
    expect(result.snapshot?.parentPinCode).toBe('160125');
    expect(result.allBlobs).toHaveLength(2);
  });

  it('does not abort a proxy request that waits out a Render cold start', async () => {
    vi.useFakeTimers();
    try {
      let resolveFetch: (value: {
        ok: boolean;
        status: number;
        json: () => Promise<{ latest: null; snapshot: null; allBlobs: [] }>;
      }) => void = () => {};
      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        expect(init?.signal).toBeUndefined();
        return new Promise((resolve) => {
          resolveFetch = resolve;
        });
      });
      globalThis.fetch = mockFetch;

      const service = new VercelBlobSyncService('https://weekly-schedule-sync.onrender.com');
      const pending = service.fetchLatestSnapshot('family-main');
      let settled = false;
      pending.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        }
      );

      await vi.advanceTimersByTimeAsync(50_000);
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({ latest: null, snapshot: null, allBlobs: [] }),
      });
      await expect(pending).resolves.toEqual({
        latest: null,
        snapshot: null,
        allBlobs: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('prefixes proxy requests with VITE_SYNC_API_URL when a production origin is configured', async () => {
    vi.stubEnv('VITE_SYNC_API_URL', 'https://sync.example.com/');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ latest: null, snapshot: null, allBlobs: [] }),
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService();
    await service.fetchLatestSnapshot('Kim Family!');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://sync.example.com/api/sync/latest?familyCode=kimfamily');
  });

  it('rejects a family code that sanitizes to empty instead of targeting the default family', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService('');
    await expect(service.fetchLatestSnapshot('!!!')).rejects.toThrow('familyCode');
    await expect(
      service.uploadSnapshot(remoteSnapshot, {
        familyCode: '!!!',
        shortDeviceId: 'web-1234',
      })
    ).rejects.toThrow('familyCode');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns an empty snapshot when the proxy has no stored blobs', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ latest: null, snapshot: null, allBlobs: [] }),
    });

    const service = new VercelBlobSyncService('');
    const result = await service.fetchLatestSnapshot('family-main');

    expect(result.latest).toBeNull();
    expect(result.snapshot).toBeNull();
    expect(result.allBlobs).toEqual([]);
  });

  it('surfaces the proxy error message when the latest snapshot request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: '서버 환경 변수 BLOB_READ_WRITE_TOKEN이 설정되지 않아 클라우드 동기화를 처리할 수 없습니다.',
      }),
    });

    const service = new VercelBlobSyncService('');
    await expect(service.fetchLatestSnapshot('family-main')).rejects.toThrow(
      '동기화 서버 응답 오류 (500): 서버 환경 변수 BLOB_READ_WRITE_TOKEN이 설정되지 않아 클라우드 동기화를 처리할 수 없습니다.'
    );
  });

  it('uploads a 클라우드 동기화 스냅샷 through the proxy and leaves cleanup to the server', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        url: 'https://blob.test/new-state.json',
        pathname: 'families/family-main/state-00001-web-1234.json',
      }),
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService('https://sync.example.com');
    const putRes = await service.uploadSnapshot(remoteSnapshot, {
      familyCode: 'family-main',
      shortDeviceId: 'web-1234',
      previousBlobsToDelete: [
        { url: 'https://blob.test/old1.json', pathname: 'old1.json' },
        { url: 'https://blob.test/old2.json', pathname: 'old2.json' },
      ],
    });

    expect(putRes).toEqual({
      url: 'https://blob.test/new-state.json',
      pathname: 'families/family-main/state-00001-web-1234.json',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://sync.example.com/api/sync/upload');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(options)).not.toContain('vercel_blob');
    expect(JSON.stringify(options)).not.toContain('blob.vercel-storage.com');

    const body = JSON.parse(options.body as string);
    expect(body.familyCode).toBe('family-main');
    expect(body.shortDeviceId).toBe('web-1234');
    expect(body.snapshot.schemaVersion).toBe(5);
    expect(body.snapshot.parentPinCode).toBe('160125');
    expect(body.previousBlobsToDelete).toEqual([
      { url: 'https://blob.test/old1.json', pathname: 'old1.json' },
      { url: 'https://blob.test/old2.json', pathname: 'old2.json' },
    ]);
  });

  it('surfaces the proxy error message when the snapshot upload fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: '유효한 familyCode 및 snapshot JSON 데이터가 필요합니다.',
      }),
    });

    const service = new VercelBlobSyncService('');
    await expect(
      service.uploadSnapshot(remoteSnapshot, {
        familyCode: 'family-main',
        shortDeviceId: 'web-1234',
      })
    ).rejects.toThrow(
      '동기화 서버 응답 오류 (400): 유효한 familyCode 및 snapshot JSON 데이터가 필요합니다.'
    );
  });
});
