import { get, list } from '@vercel/blob';
import { sanitizeFamilyCode } from './blobStorage.js';
import { buildFamilyRecord, familyLatestKey, RedisLike, StoredFamilyRecord } from './redisStorage.js';
import { VercelBlobItem } from './types.js';

/** 마이그레이션이 Blob에서 쓰는 읽기 전용 작업. */
export interface BlobSource {
  /** `families/` 아래 모든 스냅샷 항목. */
  listAllSnapshots(): Promise<VercelBlobItem[]>;
  downloadSnapshot(url: string): Promise<Record<string, unknown>>;
}

export interface MigrationOptions {
  dryRun: boolean;
  /** Redis에 같거나 더 새로운 상태가 있어도 덮어쓴다. 기본은 건너뛴다. */
  force?: boolean;
}

export interface MigrationReport {
  dryRun: boolean;
  blobsListed: number;
  families: number;
  written: number;
  wouldWrite: number;
  skippedNewerInRedis: number;
  failed: number;
}

const SNAPSHOT_PATH = /^families\/([^/]+)\/state-[^/]+\.json$/;

/** 가족별로 pathname이 가장 큰(가장 최신) 스냅샷만 고른다. */
export function pickLatestPerFamily(items: VercelBlobItem[]): Map<string, VercelBlobItem> {
  const latest = new Map<string, VercelBlobItem>();
  for (const item of items) {
    const match = SNAPSHOT_PATH.exec(item.pathname);
    if (!match) continue;
    const family = sanitizeFamilyCode(match[1]);
    if (!family || family !== match[1]) continue;
    const current = latest.get(family);
    if (!current || item.pathname.localeCompare(current.pathname) > 0) {
      latest.set(family, item);
    }
  }
  return latest;
}

/**
 * Blob → Redis 일회성 이전. Blob은 읽기만 한다(삭제·쓰기 없음).
 * 결과는 개수만 돌려준다. 가족 코드나 스냅샷 내용은 출력하지 않는다.
 */
export async function migrateBlobToRedis(
  source: BlobSource,
  redis: RedisLike,
  options: MigrationOptions
): Promise<MigrationReport> {
  const items = await source.listAllSnapshots();
  const latestPerFamily = pickLatestPerFamily(items);
  const report: MigrationReport = {
    dryRun: options.dryRun,
    blobsListed: items.length,
    families: latestPerFamily.size,
    written: 0,
    wouldWrite: 0,
    skippedNewerInRedis: 0,
    failed: 0,
  };

  for (const [family, item] of latestPerFamily) {
    try {
      const existing = await redis.get<StoredFamilyRecord>(familyLatestKey(family));
      if (!options.force && existing?.pathname && existing.pathname.localeCompare(item.pathname) >= 0) {
        report.skippedNewerInRedis += 1;
        continue;
      }
      if (options.dryRun) {
        report.wouldWrite += 1;
        continue;
      }
      const snapshot = await source.downloadSnapshot(item.url);
      const uploadedAt =
        item.uploadedAt instanceof Date ? item.uploadedAt.toISOString() : item.uploadedAt;
      const record = buildFamilyRecord(family, snapshot, { pathname: item.pathname, uploadedAt });
      await redis.set(familyLatestKey(family), record);
      report.written += 1;
    } catch {
      report.failed += 1;
    }
  }

  return report;
}

/** @vercel/blob으로 만든 읽기 전용 소스. list는 1,000개씩 페이지를 넘긴다. */
export function createVercelBlobSource(token: string): BlobSource {
  return {
    async listAllSnapshots() {
      const items: VercelBlobItem[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: 'families/', limit: 1000, cursor, token });
        for (const b of page.blobs) {
          items.push({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return items;
    },
    async downloadSnapshot(url: string) {
      const result = await get(url, { access: 'private', token });
      if (!result || !result.stream) {
        throw new Error('스냅샷 본문을 읽을 수 없습니다.');
      }
      return JSON.parse(await new Response(result.stream).text());
    },
  };
}
