import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { BlobStorage, SyncLatestResponse, UploadResponse } from './types.js';

function createMockStorage(overrides: Partial<BlobStorage> = {}): BlobStorage {
  return {
    getLatestSnapshot: async (): Promise<SyncLatestResponse> => ({
      latest: null,
      snapshot: null,
      allBlobs: [],
    }),
    uploadSnapshot: async (): Promise<UploadResponse> => ({
      url: 'https://blob.vercel-storage.com/default.json',
      pathname: 'families/default/state-0.json',
    }),
    ...overrides,
  };
}

describe('Server Seam 1: Healthcheck & CORS', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('GET /health and GET /api/sync/health return 200 and health status', async () => {
    const app = createApp();

    const resRoot = await request(app).get('/health');
    expect(resRoot.status).toBe(200);
    expect(resRoot.body).toHaveProperty('status', 'ok');
    expect(typeof resRoot.body.timestamp).toBe('number');

    const resSync = await request(app).get('/api/sync/health');
    expect(resSync.status).toBe(200);
    expect(resSync.body).toHaveProperty('status', 'ok');
  });

  it('allows CORS from GitHub Pages origin', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://jaeheonk.github.io');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://jaeheonk.github.io');
  });

  it('allows CORS from localhost:5173 and localhost:4173', async () => {
    const app = createApp();

    const res5173 = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res5173.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const res4173 = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:4173');
    expect(res4173.headers['access-control-allow-origin']).toBe('http://localhost:4173');
  });

  it('rejects CORS from unauthorized origins', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-site.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles OPTIONS preflight request for allowed origins', async () => {
    const app = createApp();
    const res = await request(app)
      .options('/api/sync/latest')
      .set('Origin', 'https://jaeheonk.github.io')
      .set('Access-Control-Request-Method', 'GET');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('https://jaeheonk.github.io');
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
  });

  it('returns 500 when BLOB_READ_WRITE_TOKEN is missing on /api/sync/latest', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const app = createApp({ blobToken: undefined });

    const res = await request(app).get('/api/sync/latest?familyCode=test-fam');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('BLOB_READ_WRITE_TOKEN');
  });

  it('returns 500 when BLOB_READ_WRITE_TOKEN is missing on /api/sync/upload', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const app = createApp({ blobToken: undefined });

    const res = await request(app)
      .post('/api/sync/upload')
      .send({ familyCode: 'family-test', snapshot: {} });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('BLOB_READ_WRITE_TOKEN');
  });

  describe('GET /api/sync/latest', () => {
    it('returns 400 when familyCode query param is missing or empty', async () => {
      const mockStorage = createMockStorage();
      const app = createApp({ blobStorage: mockStorage });

      const resMissing = await request(app).get('/api/sync/latest');
      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error).toContain('familyCode');

      const resEmpty = await request(app).get('/api/sync/latest?familyCode=   ');
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toContain('familyCode');
    });

    it('returns empty snapshot when no blobs exist', async () => {
      const mockStorage = createMockStorage();
      const app = createApp({ blobStorage: mockStorage });
      const res = await request(app).get('/api/sync/latest?familyCode=test-fam');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        latest: null,
        snapshot: null,
        allBlobs: [],
      });
    });

    it('returns latest metadata and snapshot when blob exists', async () => {
      const dummySnapshot = {
        schemaVersion: 5,
        familyCode: 'test-fam',
        items: [{ id: 'item-1', title: '수학 숙제' }],
      };
      const mockStorage = createMockStorage({
        getLatestSnapshot: async (familyCode: string) => ({
          latest: {
            url: `https://blob.vercel-storage.com/families/${familyCode}/state-123.json`,
            pathname: `families/${familyCode}/state-123.json`,
          },
          snapshot: dummySnapshot,
          allBlobs: [
            {
              url: `https://blob.vercel-storage.com/families/${familyCode}/state-123.json`,
              pathname: `families/${familyCode}/state-123.json`,
            },
          ],
        }),
      });

      const app = createApp({ blobStorage: mockStorage });
      const res = await request(app).get('/api/sync/latest?familyCode=test-fam');

      expect(res.status).toBe(200);
      expect(res.body.latest.pathname).toBe('families/test-fam/state-123.json');
      expect(res.body.snapshot).toEqual(dummySnapshot);
      expect(res.body.allBlobs).toHaveLength(1);
    });

    it('returns 500 when storage throws', async () => {
      const mockStorage = createMockStorage({
        getLatestSnapshot: async () => {
          throw new Error('Vercel Blob Rate Limited');
        },
      });

      const app = createApp({ blobStorage: mockStorage });
      const res = await request(app).get('/api/sync/latest?familyCode=test-fam');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Vercel Blob Rate Limited');
    });
  });

  describe('POST /api/sync/upload', () => {
    it('returns 400 when body is missing required fields', async () => {
      const mockStorage = createMockStorage();
      const app = createApp({ blobStorage: mockStorage });

      const res1 = await request(app).post('/api/sync/upload').send({});
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/sync/upload').send({ familyCode: 'test-fam' });
      expect(res2.status).toBe(400);
    });

    it('successfully uploads snapshot and returns 200 with result', async () => {
      let passedPayload: any = null;
      const mockStorage = createMockStorage({
        uploadSnapshot: async (payload) => {
          passedPayload = payload;
          return {
            url: 'https://blob.vercel-storage.com/families/test-fam/state-999.json',
            pathname: 'families/test-fam/state-999.json',
          };
        },
      });

      const app = createApp({ blobStorage: mockStorage });
      const dummySnapshot = { schemaVersion: 5, familyCode: 'test-fam' };

      const res = await request(app)
        .post('/api/sync/upload')
        .send({
          familyCode: 'test-fam',
          shortDeviceId: 'web-agent',
          snapshot: dummySnapshot,
          previousBlobsToDelete: [{ url: 'https://blob.vercel-storage.com/old.json' }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        url: 'https://blob.vercel-storage.com/families/test-fam/state-999.json',
        pathname: 'families/test-fam/state-999.json',
      });
      expect(passedPayload).not.toBeNull();
      expect(passedPayload.familyCode).toBe('test-fam');
      expect(passedPayload.shortDeviceId).toBe('web-agent');
      expect(passedPayload.snapshot).toEqual(dummySnapshot);
      expect(passedPayload.previousBlobsToDelete).toHaveLength(1);
    });

    it('returns 500 when storage upload fails', async () => {
      const mockStorage = createMockStorage({
        uploadSnapshot: async () => {
          throw new Error('Upload payload exceeded limit');
        },
      });

      const app = createApp({ blobStorage: mockStorage });
      const res = await request(app)
        .post('/api/sync/upload')
        .send({
          familyCode: 'test-fam',
          snapshot: { schemaVersion: 5 },
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Upload payload exceeded limit');
    });
  });
});
