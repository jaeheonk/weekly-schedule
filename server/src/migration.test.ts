import { describe, it, expect } from 'vitest';
import { BlobSource, migrateBlobToRedis, pickLatestPerFamily } from './migration.js';
import { RedisSyncStorage, familyLatestKey } from './redisStorage.js';
import { MemoryRedis } from './testing/memoryRedis.js';
import { VercelBlobItem } from './types.js';

function blob(pathname: string): VercelBlobItem {
  return { url: `https://store.private.blob.vercel-storage.com/${pathname}`, pathname, uploadedAt: '2026-11-01T00:00:00.000Z' };
}

class FakeBlobSource implements BlobSource {
  public downloads: string[] = [];
  constructor(private readonly items: VercelBlobItem[], private readonly bodies: Record<string, Record<string, unknown>>) {}
  async listAllSnapshots() {
    return this.items;
  }
  async downloadSnapshot(url: string) {
    this.downloads.push(url);
    const body = this.bodies[url];
    if (!body) throw new Error('missing');
    return body;
  }
}

const items = [
  blob('families/kim/state-00000000000001-mac.json'),
  blob('families/kim/state-00000000000009-web.json'),
  blob('families/lee/state-00000000000005-ios.json'),
  blob('toonviewer-sync/x/head.json'),
  blob('families/kim/notes.txt'),
];
const bodies = {
  [items[1].url]: { schemaVersion: 5, who: 'kim-latest' },
  [items[2].url]: { schemaVersion: 5, who: 'lee' },
};

describe('Blob → Redis migration', () => {
  it('picks only the newest state file per family', () => {
    const picked = pickLatestPerFamily(items);
    expect([...picked.keys()].sort()).toEqual(['kim', 'lee']);
    expect(picked.get('kim')?.pathname).toBe('families/kim/state-00000000000009-web.json');
  });

  it('dry-run writes nothing and downloads nothing', async () => {
    const redis = new MemoryRedis();
    const source = new FakeBlobSource(items, bodies);
    const report = await migrateBlobToRedis(source, redis, { dryRun: true });

    expect(report).toEqual({
      dryRun: true, blobsListed: 5, families: 2, written: 0, wouldWrite: 2, skippedNewerInRedis: 0, failed: 0,
    });
    expect(redis.data.size).toBe(0);
    expect(source.downloads).toEqual([]);
  });

  it('apply writes the latest state so the Redis adapter serves the same pathname', async () => {
    const redis = new MemoryRedis();
    const report = await migrateBlobToRedis(new FakeBlobSource(items, bodies), redis, { dryRun: false });

    expect(report.written).toBe(2);
    const latest = await new RedisSyncStorage(redis).getLatestSnapshot('kim');
    expect(latest.latest?.pathname).toBe('families/kim/state-00000000000009-web.json');
    expect(latest.latest?.uploadedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(latest.snapshot).toEqual({ schemaVersion: 5, who: 'kim-latest' });
  });

  it('does not overwrite a newer state already in Redis unless forced, and counts failures', async () => {
    const redis = new MemoryRedis();
    await new RedisSyncStorage(redis, () => 99).uploadSnapshot({ familyCode: 'kim', snapshot: { who: 'redis-newer' } });
    const failingBodies = { [items[1].url]: bodies[items[1].url] }; // lee download fails

    const report = await migrateBlobToRedis(new FakeBlobSource(items, failingBodies), redis, { dryRun: false });

    expect(report).toMatchObject({ written: 0, skippedNewerInRedis: 1, failed: 1 });
    expect(JSON.parse(redis.data.get(familyLatestKey('kim'))!).snapshot).toEqual({ who: 'redis-newer' });
  });
});
