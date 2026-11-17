import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import {
  RedisSyncStorage,
  familyLatestKey,
  readRedisConfig,
} from './redisStorage.js';
import { resolveStorageFromEnv } from './storageFactory.js';
import { VercelBlobStorage } from './blobStorage.js';
import { MemoryRedis } from './testing/memoryRedis.js';

const T0 = 1_794_960_000_000;

describe('RedisSyncStorage', () => {
  it('returns the empty contract for an unknown family with a single GET', async () => {
    const redis = new MemoryRedis();
    const storage = new RedisSyncStorage(redis);

    const res = await storage.getLatestSnapshot('  New-Family ');

    expect(res).toEqual({ latest: null, snapshot: null, allBlobs: [] });
    expect(redis.calls).toEqual([{ op: 'get', key: 'ws:family:new-family:latest' }]);
  });

  it('stores the latest snapshot with one SET and reads it back in the Blob-compatible shape', async () => {
    const redis = new MemoryRedis();
    const storage = new RedisSyncStorage(redis, () => T0);
    const snapshot = { schemaVersion: 5, familyCode: 'kim', updatedAt: 1 };

    const put = await storage.uploadSnapshot({
      familyCode: 'Kim',
      shortDeviceId: 'my mac!',
      snapshot,
      previousBlobsToDelete: [{ url: 'https://x.blob/families/kim/state-old.json', pathname: 'families/kim/state-old.json' }],
    });

    expect(put.pathname).toBe(`families/kim/state-0${T0}-mymac.json`);
    expect(put.url).toBe(`redis://ws:family:kim:latest#${put.pathname}`);
    expect(redis.calls).toEqual([{ op: 'set', key: 'ws:family:kim:latest' }]);

    const latest = await storage.getLatestSnapshot('kim');
    expect(latest.snapshot).toEqual(snapshot);
    expect(latest.latest).toMatchObject({
      url: put.url,
      pathname: put.pathname,
      uploadedAt: new Date(T0).toISOString(),
    });
    expect(latest.latest?.size).toBe(JSON.stringify(snapshot).length);
    expect(latest.allBlobs).toEqual([latest.latest]);
  });

  it('overwrites the previous state and changes the pathname on every upload', async () => {
    const redis = new MemoryRedis();
    let now = T0;
    const storage = new RedisSyncStorage(redis, () => now);

    const first = await storage.uploadSnapshot({ familyCode: 'kim', snapshot: { v: 1 } });
    now += 1000;
    const second = await storage.uploadSnapshot({ familyCode: 'kim', snapshot: { v: 2 } });

    expect(second.pathname).not.toBe(first.pathname);
    expect(second.pathname.localeCompare(first.pathname)).toBeGreaterThan(0);
    const latest = await storage.getLatestSnapshot('kim');
    expect(latest.snapshot).toEqual({ v: 2 });
    expect(redis.data.size).toBe(1);
  });

  it('keeps families apart', async () => {
    const redis = new MemoryRedis();
    const storage = new RedisSyncStorage(redis, () => T0);
    await storage.uploadSnapshot({ familyCode: 'fam-a', snapshot: { who: 'a' } });

    expect((await storage.getLatestSnapshot('fam-b')).latest).toBeNull();
    expect((await storage.getLatestSnapshot('fam-a')).snapshot).toEqual({ who: 'a' });
    expect([...redis.data.keys()]).toEqual([familyLatestKey('fam-a')]);
  });

  it('rejects an empty family code', async () => {
    const storage = new RedisSyncStorage(new MemoryRedis());
    await expect(storage.getLatestSnapshot('!!!')).rejects.toThrow(/familyCode/);
    await expect(storage.uploadSnapshot({ familyCode: '', snapshot: {} })).rejects.toThrow(/familyCode/);
  });

  it('serves the HTTP contract end to end through the Express app', async () => {
    const app = createApp({ storage: new RedisSyncStorage(new MemoryRedis(), () => T0) });

    const empty = await request(app).get('/api/sync/latest?familyCode=fam-http');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ latest: null, snapshot: null, allBlobs: [] });

    const up = await request(app)
      .post('/api/sync/upload')
      .send({ familyCode: 'fam-http', shortDeviceId: 'web', snapshot: { schemaVersion: 5 }, previousBlobsToDelete: [] });
    expect(up.status).toBe(200);
    expect(Object.keys(up.body).sort()).toEqual(['pathname', 'url']);

    const latest = await request(app).get('/api/sync/latest?familyCode=fam-http');
    expect(latest.status).toBe(200);
    expect(latest.body.latest.pathname).toBe(up.body.pathname);
    expect(latest.body.snapshot).toEqual({ schemaVersion: 5 });
    expect(latest.body.allBlobs).toHaveLength(1);
  });
});

describe('storage selection from env', () => {
  it('reads KV_* first and falls back to UPSTASH_REDIS_REST_*', () => {
    expect(readRedisConfig({ KV_REST_API_URL: 'https://kv', KV_REST_API_TOKEN: 't1' })).toEqual({ url: 'https://kv', token: 't1' });
    expect(
      readRedisConfig({ UPSTASH_REDIS_REST_URL: 'https://up', UPSTASH_REDIS_REST_TOKEN: 't2' })
    ).toEqual({ url: 'https://up', token: 't2' });
    expect(
      readRedisConfig({ KV_REST_API_URL: ' ', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: 'https://up', UPSTASH_REDIS_REST_TOKEN: 't2' })
    ).toEqual({ url: 'https://up', token: 't2' });
    expect(readRedisConfig({ KV_REST_API_URL: 'https://kv' })).toBeUndefined();
  });

  it('defaults to Redis and ignores the Blob token unless SYNC_STORAGE=blob', () => {
    expect(resolveStorageFromEnv({ BLOB_READ_WRITE_TOKEN: 'b' })).toBeUndefined();
    expect(resolveStorageFromEnv({ KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' })).toBeInstanceOf(RedisSyncStorage);
    expect(resolveStorageFromEnv({ SYNC_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'b' })).toBeInstanceOf(VercelBlobStorage);
    expect(resolveStorageFromEnv({ SYNC_STORAGE: 'blob' })).toBeUndefined();
  });
});
