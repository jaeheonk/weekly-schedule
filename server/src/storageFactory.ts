import { VercelBlobStorage } from './blobStorage.js';
import { createUpstashRedis, readRedisConfig, RedisSyncStorage } from './redisStorage.js';
import { SyncStorage } from './types.js';

/**
 * 환경 변수로 동기화 저장소를 고른다.
 * - 기본: Upstash Redis (KV_REST_API_URL/KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)
 * - SYNC_STORAGE=blob: Vercel Blob (BLOB_READ_WRITE_TOKEN). 마이그레이션·되돌리기 전용.
 * 설정이 없으면 undefined를 돌려주고, 라우트가 500으로 안내한다.
 */
export function resolveStorageFromEnv(env: NodeJS.ProcessEnv = process.env): SyncStorage | undefined {
  const mode = (env.SYNC_STORAGE || 'redis').trim().toLowerCase();

  if (mode === 'blob') {
    const token = env.BLOB_READ_WRITE_TOKEN?.trim();
    return token ? new VercelBlobStorage(token) : undefined;
  }

  const config = readRedisConfig(env);
  return config ? new RedisSyncStorage(createUpstashRedis(config)) : undefined;
}

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  '서버 동기화 저장소가 설정되지 않아 클라우드 동기화를 처리할 수 없습니다. ' +
  'KV_REST_API_URL/KV_REST_API_TOKEN(또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) 환경 변수를 확인하세요.';
