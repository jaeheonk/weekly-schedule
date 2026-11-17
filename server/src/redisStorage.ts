import { Redis } from '@upstash/redis';
import { sanitizeFamilyCode } from './blobStorage.js';
import { SyncLatestResponse, SyncStorage, UploadPayload, UploadResponse, VercelBlobItem } from './types.js';

/** Redis에 저장하는 가족별 최신 스냅샷 레코드. */
export interface StoredFamilyRecord {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  snapshot: Record<string, unknown>;
}

/** RedisSyncStorage가 쓰는 최소 명령. @upstash/redis의 Redis와 테스트용 가짜가 구현한다. */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
}

export const REDIS_KEY_PREFIX = 'ws:family:';

export function familyLatestKey(safeFamily: string): string {
  return `${REDIS_KEY_PREFIX}${safeFamily}:latest`;
}

/** 클라이언트가 보는 pathname은 Blob 시절과 같은 모양을 유지한다. */
export function snapshotPathname(safeFamily: string, timestampMs: number, shortDeviceId?: string): string {
  const paddedTs = String(timestampMs).padStart(14, '0');
  const safeDeviceId =
    (shortDeviceId || 'web').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'web';
  return `families/${safeFamily}/state-${paddedTs}-${safeDeviceId}.json`;
}

export function redisItemUrl(safeFamily: string, pathname: string): string {
  return `redis://${familyLatestKey(safeFamily)}#${pathname}`;
}

function toItem(record: StoredFamilyRecord): VercelBlobItem {
  return {
    url: record.url,
    pathname: record.pathname,
    size: record.size,
    uploadedAt: record.uploadedAt,
  };
}

/**
 * Upstash Redis 어댑터. 가족마다 키 하나(`ws:family:<code>:latest`)에 최신 스냅샷만 둔다.
 * - latest: GET 1회
 * - upload: SET 1회 (이전 스냅샷은 같은 키를 덮어써서 사라지므로 따로 지우지 않는다)
 * 응답 모양은 Blob 어댑터와 같다. allBlobs는 최신 항목 하나만 담는다.
 */
export class RedisSyncStorage implements SyncStorage {
  constructor(
    private readonly redis: RedisLike,
    private readonly now: () => number = Date.now
  ) {}

  public async getLatestSnapshot(familyCode: string): Promise<SyncLatestResponse> {
    const safeFamily = sanitizeFamilyCode(familyCode);
    if (!safeFamily) {
      throw new Error('유효한 familyCode가 필요합니다.');
    }

    const record = await this.redis.get<StoredFamilyRecord>(familyLatestKey(safeFamily));
    if (!record || typeof record !== 'object' || !record.pathname || !record.snapshot) {
      return { latest: null, snapshot: null, allBlobs: [] };
    }

    const item = toItem(record);
    return { latest: item, snapshot: record.snapshot, allBlobs: [item] };
  }

  public async uploadSnapshot(payload: UploadPayload): Promise<UploadResponse> {
    const safeFamily = sanitizeFamilyCode(payload.familyCode);
    if (!safeFamily) {
      throw new Error('유효한 familyCode가 필요합니다.');
    }

    const record = buildFamilyRecord(safeFamily, payload.snapshot, {
      timestampMs: this.now(),
      shortDeviceId: payload.shortDeviceId,
    });
    await this.redis.set(familyLatestKey(safeFamily), record);
    return { url: record.url, pathname: record.pathname };
  }
}

export function buildFamilyRecord(
  safeFamily: string,
  snapshot: Record<string, unknown>,
  options: { timestampMs?: number; shortDeviceId?: string; pathname?: string; uploadedAt?: string }
): StoredFamilyRecord {
  const timestampMs = options.timestampMs ?? Date.now();
  const pathname = options.pathname ?? snapshotPathname(safeFamily, timestampMs, options.shortDeviceId);
  return {
    pathname,
    url: redisItemUrl(safeFamily, pathname),
    size: Buffer.byteLength(JSON.stringify(snapshot), 'utf8'),
    uploadedAt: options.uploadedAt ?? new Date(timestampMs).toISOString(),
    snapshot,
  };
}

/** Vercel Marketplace(Upstash) 연결이 넣는 이름을 모두 받는다. */
export const REDIS_URL_ENV_KEYS = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL'] as const;
export const REDIS_TOKEN_ENV_KEYS = ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'] as const;

function firstNonEmpty(env: NodeJS.ProcessEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readRedisConfig(env: NodeJS.ProcessEnv): { url: string; token: string } | undefined {
  const url = firstNonEmpty(env, REDIS_URL_ENV_KEYS);
  const token = firstNonEmpty(env, REDIS_TOKEN_ENV_KEYS);
  if (!url || !token) return undefined;
  return { url, token };
}

export function createUpstashRedis(config: { url: string; token: string }): RedisLike {
  return new Redis({ url: config.url, token: config.token });
}
