import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VercelBlobSyncService } from './vercelBlobSync';
import { CloudSyncSnapshot } from '../types/snapshot';

describe('VercelBlobSyncService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetchLatestBlobMetadata queries vercel blob API and returns sorted list', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        blobs: [
          { pathname: 'families/family-main/state-00000001000-dev1.json', url: 'https://blob.test/state1' },
          { pathname: 'families/family-main/state-00000003000-dev2.json', url: 'https://blob.test/state3' },
          { pathname: 'families/family-main/state-00000002000-dev1.json', url: 'https://blob.test/state2' },
        ],
      }),
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService();
    const result = await service.fetchLatestBlobMetadata('token123', 'family-main');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('https://blob.vercel-storage.com?prefix=families%2Ffamily-main%2Fstate-&limit=100&_t=');
    expect(options.headers['Authorization']).toBe('Bearer token123');
    expect(options.headers['x-api-version']).toBe('7');
    expect(options.headers['Cache-Control']).toBe('no-cache');

    expect(result.latest?.pathname).toBe('families/family-main/state-00000003000-dev2.json');
    expect(result.allBlobs).toHaveLength(3);
    expect(result.allBlobs[0].pathname).toBe('families/family-main/state-00000003000-dev2.json');
    expect(result.allBlobs[2].pathname).toBe('families/family-main/state-00000001000-dev1.json');
  });

  it('fetchLatestBlobMetadata handles empty blob list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ blobs: [] }),
    });

    const service = new VercelBlobSyncService();
    const result = await service.fetchLatestBlobMetadata('token123', 'family-main');
    expect(result.latest).toBeNull();
    expect(result.allBlobs).toEqual([]);
  });

  it('throws when token is missing', async () => {
    const service = new VercelBlobSyncService();
    await expect(service.fetchLatestBlobMetadata('', 'family-main')).rejects.toThrow('토큰');
  });

  it('downloadSnapshot downloads and decodes JSON correctly', async () => {
    const mockSnapshot: Partial<CloudSyncSnapshot> = {
      schemaVersion: 5,
      familyCode: 'family-main',
      parentPinCode: '160125',
      items: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSnapshot,
    });

    const service = new VercelBlobSyncService();
    const result = await service.downloadSnapshot('https://blob.test/download.json', 'token123');

    expect(globalThis.fetch).toHaveBeenCalledWith('https://blob.test/download.json', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token123',
        'Cache-Control': 'no-cache',
      },
    });
    expect(result.schemaVersion).toBe(5);
    expect(result.familyCode).toBe('family-main');
  });

  it('downloadSnapshot throws on HTTP error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
      json: async () => ({ message: 'Blob not found' }),
    });

    const service = new VercelBlobSyncService();
    await expect(service.downloadSnapshot('https://blob.test/download.json', 'token123')).rejects.toThrow('404');
  });

  it('uploadSnapshot uploads snapshot and cleans up previous blobs', async () => {
    const mockSnapshot: CloudSyncSnapshot = {
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

    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      if (options.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            url: 'https://blob.test/new-state.json',
            pathname: 'families/family-main/state-00001-web-1234.json',
          }),
        });
      }
      if (options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ deleted: true }),
        });
      }
      return Promise.reject(new Error('Unexpected fetch call'));
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService();
    const putRes = await service.uploadSnapshot(mockSnapshot, {
      token: 'token123',
      familyCode: 'family-main',
      shortDeviceId: 'web-1234',
      previousBlobsToDelete: [
        { url: 'https://blob.test/old1.json', pathname: 'old1.json' },
        { url: 'https://blob.test/old2.json', pathname: 'old2.json' },
      ],
    });

    expect(putRes.url).toBe('https://blob.test/new-state.json');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [putUrl, putOpts] = mockFetch.mock.calls[0];
    expect(putUrl).toContain('https://blob.vercel-storage.com/families/family-main/state-');
    expect(putOpts.method).toBe('PUT');
    expect(putOpts.headers['x-vercel-blob-access']).toBe('private');
    expect(putOpts.headers['x-allow-overwrite']).toBe('1');
    expect(JSON.parse(putOpts.body as string).schemaVersion).toBe(5);

    const [delUrl, delOpts] = mockFetch.mock.calls[1];
    expect(delUrl).toBe('https://blob.vercel-storage.com/delete');
    expect(delOpts.method).toBe('POST');
    expect(JSON.parse(delOpts.body as string).urls).toEqual([
      'https://blob.test/old1.json',
      'https://blob.test/old2.json',
    ]);
  });

  it('retries upload with access public if 400 error mentions public', async () => {
    let putCount = 0;
    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      if (options.method === 'PUT') {
        putCount++;
        if (putCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: async () => 'Store only supports public access',
            json: async () => ({ message: 'Store only supports public access' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            url: 'https://blob.test/public-state.json',
            pathname: 'families/family-main/state-public.json',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    globalThis.fetch = mockFetch;

    const service = new VercelBlobSyncService();
    const result = await service.uploadSnapshot({} as CloudSyncSnapshot, {
      token: 'token123',
      familyCode: 'family-main',
      shortDeviceId: 'web-1234',
    });

    expect(result.url).toBe('https://blob.test/public-state.json');
    expect(putCount).toBe(2);
    expect(mockFetch.mock.calls[1][1].headers['x-vercel-blob-access']).toBe('public');
  });
});
