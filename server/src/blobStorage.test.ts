import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VercelBlobStorage, sanitizeFamilyCode, DEFAULT_FAMILY_CODE } from './blobStorage.js';
import * as blobSdk from '@vercel/blob';

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('BlobStorage Seam 2: VercelBlobStorage & helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeFamilyCode', () => {
    it('normalizes uppercase and trims spaces', () => {
      expect(sanitizeFamilyCode('  My-Family_99  ')).toBe('my-family_99');
    });

    it('strips invalid characters and falls back to default when empty', () => {
      expect(sanitizeFamilyCode('!@#$%^&*()')).toBe(DEFAULT_FAMILY_CODE);
      expect(sanitizeFamilyCode('')).toBe(DEFAULT_FAMILY_CODE);
      expect(sanitizeFamilyCode(undefined)).toBe(DEFAULT_FAMILY_CODE);
    });

    it('preserves valid alphanumeric with dash and underscore', () => {
      expect(sanitizeFamilyCode('kim-family-2026')).toBe('kim-family-2026');
    });
  });

  describe('constructor', () => {
    it('throws error when token is empty or whitespace', () => {
      expect(() => new VercelBlobStorage('')).toThrow(/BLOB_READ_WRITE_TOKEN/);
      expect(() => new VercelBlobStorage('   ')).toThrow(/BLOB_READ_WRITE_TOKEN/);
    });
  });

  describe('getLatestSnapshot', () => {
    it('returns nulls when list returns empty blobs', async () => {
      vi.mocked(blobSdk.list).mockResolvedValueOnce({
        blobs: [],
        hasMore: false,
        cursor: undefined,
      } as any);

      const storage = new VercelBlobStorage('test-token-123');
      const res = await storage.getLatestSnapshot('test-fam');

      expect(blobSdk.list).toHaveBeenCalledWith({
        prefix: 'families/test-fam/state-',
        limit: 100,
        token: 'test-token-123',
      });
      expect(res.latest).toBeNull();
      expect(res.snapshot).toBeNull();
      expect(res.allBlobs).toEqual([]);
    });

    it('sorts blobs descending by pathname and downloads latest snapshot', async () => {
      const olderBlob = {
        url: 'https://blob.vercel-storage.com/families/test-fam/state-00001-mac.json',
        pathname: 'families/test-fam/state-00001-mac.json',
        size: 100,
      };
      const newerBlob = {
        url: 'https://blob.vercel-storage.com/families/test-fam/state-00002-web.json',
        pathname: 'families/test-fam/state-00002-web.json',
        size: 150,
      };

      vi.mocked(blobSdk.list).mockResolvedValueOnce({
        blobs: [olderBlob, newerBlob], // list returns in arbitrary order
        hasMore: false,
      } as any);

      const mockSnapshot = {
        schemaVersion: 5,
        familyCode: 'test-fam',
        items: [{ id: '1', title: '국어 숙제' }],
      };

      // Mock get with readable stream
      const jsonBuffer = new TextEncoder().encode(JSON.stringify(mockSnapshot));
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(jsonBuffer);
          controller.close();
        },
      });

      vi.mocked(blobSdk.get).mockResolvedValueOnce({
        statusCode: 200,
        stream: mockStream as any,
        headers: new Headers(),
        blob: newerBlob as any,
      });

      const storage = new VercelBlobStorage('test-token-123');
      const res = await storage.getLatestSnapshot('test-fam');

      // newerBlob (state-00002) should be first
      expect(res.latest?.pathname).toBe(newerBlob.pathname);
      expect(res.snapshot).toEqual(mockSnapshot);
      expect(res.allBlobs[0].pathname).toBe(newerBlob.pathname);
      expect(res.allBlobs[1].pathname).toBe(olderBlob.pathname);
      expect(blobSdk.get).toHaveBeenCalledWith(newerBlob.url, {
        access: 'private',
        token: 'test-token-123',
      });
    });
  });

  describe('uploadSnapshot', () => {
    it('uploads with private mode and cleans up previous blobs asynchronously', async () => {
      vi.mocked(blobSdk.put).mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/families/test-fam/state-new.json',
        downloadUrl: 'https://blob.vercel-storage.com/families/test-fam/state-new.json?download=1',
        pathname: 'families/test-fam/state-new.json',
        contentType: 'application/json',
        contentDisposition: '',
        etag: 'mock-etag-1',
      });
      vi.mocked(blobSdk.del).mockResolvedValueOnce(undefined as any);

      const storage = new VercelBlobStorage('test-token-123');
      const dummySnapshot = { schemaVersion: 5, familyCode: 'test-fam' };

      const res = await storage.uploadSnapshot({
        familyCode: 'test-fam',
        shortDeviceId: 'my-mac',
        snapshot: dummySnapshot,
        previousBlobsToDelete: [
          {
            url: 'https://blob.vercel-storage.com/families/test-fam/state-old1.json',
            pathname: 'families/test-fam/state-old1.json',
          },
          {
            url: 'https://blob.vercel-storage.com/families/test-fam/state-old2.json',
            pathname: 'families/test-fam/state-old2.json',
          },
        ],
      });

      expect(res.url).toBe('https://blob.vercel-storage.com/families/test-fam/state-new.json');
      expect(blobSdk.put).toHaveBeenCalledWith(
        expect.stringMatching(/^families\/test-fam\/state-\d{14}-my-mac\.json$/),
        JSON.stringify(dummySnapshot),
        expect.objectContaining({
          access: 'private',
          token: 'test-token-123',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
        })
      );

      expect(blobSdk.del).toHaveBeenCalledWith(
        [
          'https://blob.vercel-storage.com/families/test-fam/state-old1.json',
          'https://blob.vercel-storage.com/families/test-fam/state-old2.json',
        ],
        { token: 'test-token-123' }
      );
    });

    it('falls back to public access mode if bucket rejects private mode', async () => {
      vi.mocked(blobSdk.put)
        .mockRejectedValueOnce(new Error('This store only allows public blobs'))
        .mockResolvedValueOnce({
          url: 'https://blob.vercel-storage.com/families/test-fam/state-public.json',
          downloadUrl: 'https://blob.vercel-storage.com/families/test-fam/state-public.json',
          pathname: 'families/test-fam/state-public.json',
          contentType: 'application/json',
          contentDisposition: '',
          etag: 'mock-etag-2',
        });

      const storage = new VercelBlobStorage('test-token-123');
      const res = await storage.uploadSnapshot({
        familyCode: 'test-fam',
        snapshot: { schemaVersion: 5 },
      });

      expect(res.pathname).toBe('families/test-fam/state-public.json');
      expect(blobSdk.put).toHaveBeenCalledTimes(2);
      expect(blobSdk.put).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ access: 'public' })
      );
    });
  });
});
