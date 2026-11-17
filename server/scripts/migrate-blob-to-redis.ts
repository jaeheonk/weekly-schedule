/**
 * Vercel Blob → Upstash Redis 일회성 이전 스크립트.
 *
 *   npm run migrate:blob-to-redis            # 기본은 dry-run (Redis에 쓰지 않음)
 *   npm run migrate:blob-to-redis -- --apply # 실제로 Redis에 쓴다
 *   npm run migrate:blob-to-redis -- --apply --force  # Redis에 더 새 상태가 있어도 덮어쓴다
 *
 * 필요한 환경 변수: BLOB_READ_WRITE_TOKEN, 그리고
 * KV_REST_API_URL/KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.
 * Blob은 읽기만 한다(list + 가족당 get 1회). 출력은 개수뿐이고, 토큰·가족 코드·내용은 찍지 않는다.
 */
import 'dotenv/config';
import { createVercelBlobSource, migrateBlobToRedis } from '../src/migration.js';
import { createUpstashRedis, readRedisConfig } from '../src/redisStorage.js';

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has('--apply');
  const force = args.has('--force');

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const redisConfig = readRedisConfig(process.env);
  if (!blobToken || !redisConfig) {
    console.error(
      '환경 변수가 부족합니다: BLOB_READ_WRITE_TOKEN, KV_REST_API_URL/KV_REST_API_TOKEN(또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)'
    );
    process.exit(2);
  }

  const report = await migrateBlobToRedis(
    createVercelBlobSource(blobToken),
    createUpstashRedis(redisConfig),
    { dryRun, force }
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('마이그레이션 실패:', err instanceof Error ? err.message : '알 수 없는 오류');
  process.exit(1);
});
