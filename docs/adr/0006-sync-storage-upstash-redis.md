# 0006. 웹 동기화 저장소를 Vercel Blob에서 Upstash Redis로 옮긴다

## Status
Accepted (ADR-0002의 저장소 부분을 대체한다. 프록시 구조와 HTTP API는 그대로다.)

## Context
2026년 11월, 웹 동기화에 쓰던 Vercel Blob 스토어(`weekly-schedule-blob`, ICN1)가 정지(suspended)됐다. 저장 용량은 169 kB뿐이었지만, Advanced Operations가 한 달 무료 한도 2천 건을 넘어 13만 4,700건까지 갔다.

동기화 방식이 Blob의 비싼 작업을 계속 부른다.

- `GET /api/sync/latest` 한 번에 `list`(Advanced Operation) 1회와 `get` 1회를 쓴다. 웹은 30초마다, 그리고 화면으로 돌아올 때마다 이 요청을 보낸다.
- `POST /api/sync/upload` 한 번에 `put`(Advanced Operation) 1회와 이전 스냅샷 `del`을 쓴다.
- iOS 앱과 위젯도 같은 스토어에 직접 `list`/`put`/`del`을 보낸다.

Blob은 큰 파일을 위한 저장소다. 가족당 몇십 kB짜리 최신 상태 하나를 자주 읽고 쓰는 용도에는 키-값 저장소가 맞다.

## Decision
1. 서버 저장소를 `SyncStorage` 인터페이스(`getLatestSnapshot`, `uploadSnapshot`) 뒤에 둔다.
2. 기본 어댑터는 `RedisSyncStorage`(`@upstash/redis`, Vercel Marketplace의 Upstash Redis)다.
   - 키: 가족마다 `ws:family:<familyCode>:latest` 하나. 값은 `{ pathname, url, size, uploadedAt, snapshot }` JSON이다.
   - `latest`는 GET 1회, `upload`는 SET 1회다. 이전 상태는 같은 키를 덮어써서 사라지므로 따로 지우지 않는다. 기존 API에는 스냅샷 기록을 돌려주는 기능이 없어서 기록 목록은 두지 않는다.
3. HTTP 계약은 그대로 둔다.
   - `latest`는 `{ latest, snapshot, allBlobs }` 모양을 유지한다. `allBlobs`에는 최신 항목 하나만 담는다.
   - `pathname`은 Blob 시절과 같은 `families/<code>/state-<14자리 ms>-<device>.json` 모양이고 업로드마다 바뀐다. 웹 클라이언트는 이 값이 바뀌었는지로 새 상태를 알아챈다.
   - `url`은 `redis://ws:family:<code>:latest#<pathname>`이다. 클라이언트는 이 값을 `previousBlobsToDelete`로 돌려보내기만 하고, Redis 어댑터는 그 값을 무시한다.
4. 환경 변수는 `KV_REST_API_URL`/`KV_REST_API_TOKEN`을 먼저 읽고, 없으면 `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`을 읽는다.
5. Blob 어댑터(`VercelBlobStorage`)는 마이그레이션과 되돌리기 용도로만 남긴다. `SYNC_STORAGE=blob`일 때만 쓰인다.
6. 기존 데이터는 `server/scripts/migrate-blob-to-redis.ts`로 한 번 옮긴다. Blob은 읽기만 하고, 가족마다 최신 상태만 옮긴다. 기본은 dry-run이다.

## Consequences
- 요청 1건이 Redis 명령 1건이다. 30초 폴링을 하는 기기 하나가 한 달에 약 8만 6천 건을 쓴다. 기기 수가 늘면 Upstash 무료 한도(월 50만 명령)를 넘을 수 있으니, 그때는 폴링 간격을 늘리거나 유료 플랜을 쓴다.
- 스냅샷 기록(여러 버전)은 남지 않는다. 지금 클라이언트는 최신 상태만 쓰고 병합은 클라이언트가 한다.
- **iOS 앱과 위젯은 아직 Blob에 직접 붙는다**(`VercelBlobSyncService.swift`). 웹이 Redis로 옮겨가면, iOS 앱이 같은 프록시 API(`/api/sync/...`)를 쓰도록 바꾸기 전까지 iOS와 웹의 데이터가 갈라진다. iOS 전환은 별도 작업이다.
- 공개 저장소의 iOS 코드에 Blob 읽기/쓰기 토큰이 기본값으로 들어 있다. iOS가 프록시로 옮긴 뒤 이 토큰을 폐기(rotate)해야 한다.
