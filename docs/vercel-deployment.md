# Vercel 단일 프로젝트 배포 (웹앱 + 동기화 API)

ADR-0002의 2단계다. 웹앱(`web/`)과 클라우드 동기화 프록시(`server/src`)를 Vercel 프로젝트 하나에서 같은 주소로 서비스한다. GitHub Pages와 Render는 전환이 끝날 때까지 그대로 두고, 확인이 끝나면 끈다.

토큰 값은 이 문서나 Git에 적지 않는다. 저장소 토큰은 Vercel 프로젝트 환경 변수에만 둔다.

동기화 저장소는 Upstash Redis다(ADR-0006). Vercel Blob은 정지돼서, 데이터를 옮길 때만 읽는다.

## 구성

| 항목 | 값 |
| --- | --- |
| 프로젝트 루트 | 저장소 루트 (`vercel.json`) |
| 설치 | `npm ci --prefix web && npm ci --prefix server` |
| 빌드 | `cd web && VITE_BASE_URL=/ npm run build` |
| 정적 출력 | `web/dist` |
| 함수 | `api/health.ts`, `api/sync/health.ts`, `api/sync/latest.ts`, `api/sync/upload.ts` |
| Node | `22.x` (루트 `package.json`의 `engines`) |

`api/*.ts`는 모두 `api/_app.ts`가 만든 Express 앱(`server/src/app.ts`의 `createApp()`)을 그대로 내보낸다. 라우트 파일 경로가 곧 요청 경로라 Express 라우터가 Render 때와 같은 경로(`/api/sync/latest`, `/api/sync/upload`)를 처리한다. `/health`는 `/api/health`로 다시 쓴다.

웹앱은 같은 오리진에서 돌기 때문에 `VITE_SYNC_API_URL`을 비워 둔다. 그러면 클라이언트가 상대 경로 `/api/sync/...`를 호출한다. Vite `base`는 `VITE_BASE_URL=/`로 루트에 둔다. GitHub Pages 워크플로는 계속 `/weekly-schedule/`로 빌드한다.

`vercel.json`의 헤더:

- `sw.js`는 캐시하지 않는다. 서비스 워커 업데이트가 바로 반영된다.
- `/`, `index.html`, `manifest.webmanifest`는 `no-cache`로 매번 확인한다.
- `/assets/*`는 파일 이름에 해시가 있어서 1년 캐시한다.
- `/api/*`는 `no-store`다.

## 환경 변수

서버는 아래 이름을 읽는다. Vercel Marketplace에서 Upstash Redis를 프로젝트에 연결하면 자동으로 들어간다.

| 키 | 대상 | 설명 |
| --- | --- | --- |
| `KV_REST_API_URL` | Production, Preview | Upstash Redis REST URL. 없으면 `UPSTASH_REDIS_REST_URL`을 읽는다 |
| `KV_REST_API_TOKEN` | Production, Preview | Upstash Redis REST 토큰. 없으면 `UPSTASH_REDIS_REST_TOKEN`을 읽는다 |
| `SYNC_STORAGE` | (보통 비움) | `blob`이면 Redis 대신 Vercel Blob을 쓴다. 되돌리기 전용 |
| `BLOB_READ_WRITE_TOKEN` | (보통 비움) | `SYNC_STORAGE=blob`일 때와 마이그레이션 스크립트에서만 읽는다 |

Redis 키는 가족마다 `ws:family:<가족코드>:latest` 하나다. 최신 동기화 요청은 GET 1회, 업로드는 SET 1회를 쓴다.

## Blob → Redis 데이터 옮기기

Blob 스토어가 다시 열린 뒤 한 번만 실행한다. Blob은 읽기만 한다(`list` 몇 회 + 가족당 `get` 1회). 출력은 개수뿐이다.

```sh
cd server
# 환경 변수: BLOB_READ_WRITE_TOKEN, KV_REST_API_URL, KV_REST_API_TOKEN
npm run migrate:blob-to-redis              # dry-run: 옮길 가족 수만 센다
npm run migrate:blob-to-redis -- --apply   # Redis에 쓴다
```

Redis에 같거나 더 새로운 상태가 이미 있으면 그 가족은 건너뛴다(`skippedNewerInRedis`). 덮어쓰려면 `--force`를 붙인다. Blob이 계속 정지 상태면 옮기지 않아도 된다. 웹앱 기기에 남은 로컬 데이터가 첫 업로드 때 Redis로 올라간다.

## 전환 순서

1. Vercel에서 이 저장소로 프로젝트를 만든다(이름 `weekly-schedule`). 설정은 `vercel.json`이 정한다.
2. Vercel Marketplace에서 Upstash Redis를 만들어 프로젝트에 연결하고(Production, Preview) 다시 배포한다. Blob이 열려 있으면 위의 마이그레이션을 실행한다.
3. 프리뷰 배포에서 확인한다.
   - `/`가 열린다.
   - `/health`, `/api/sync/health`가 `{ "status": "ok" }`를 돌려준다.
   - `/api/sync/latest?familyCode=<처음 쓰는 코드>`가 `{"latest":null,...}`을 돌려준다.
   - 앱에서 가족 코드로 동기화하면 업로드와 불러오기가 된다.
4. PR을 main에 머지하면 프로덕션(`https://weekly-schedule.vercel.app` 또는 Vercel이 정한 주소)에 배포된다.
5. 휴대폰에서 새 주소를 열고 홈 화면에 다시 추가한다. 홈 화면 앱과 로컬 저장소(PIN, Face ID 등록 등)는 주소마다 따로라, 새 주소에서 가족 코드로 한 번 동기화하고 Face ID를 다시 등록한다.
6. 새 주소가 안정적이면 GitHub Pages 배포(`.github/workflows/deploy-web.yml`)와 Render 서비스(`weekly-schedule-sync`)를 끈다. 그 뒤 `render.yaml`과 `docs/render-deployment.md`를 지운다.

## 되돌리기

- 전환 중에는 GitHub Pages와 Render가 그대로 돌기 때문에 예전 주소(`https://jaeheonk.github.io/weekly-schedule/`)를 쓸 수 있다. 다만 Render는 정지된 Blob을 쓰므로 Blob이 다시 열려야 동기화된다. Vercel(Redis)과 Render(Blob)는 서로 다른 저장소라 데이터가 갈라진다.
- 저장소만 Blob으로 되돌리려면 Vercel에 `SYNC_STORAGE=blob`과 `BLOB_READ_WRITE_TOKEN`을 넣고 다시 배포한다.
- Vercel 쪽만 문제라면 Vercel 대시보드에서 이전 배포로 롤백하거나 이 PR을 revert한다. 이 PR은 GitHub Pages 워크플로, `render.yaml`, `server/` 실행 방식을 바꾸지 않는다.
- Render를 이미 껐다면 Render 대시보드에서 서비스를 다시 켠다(Resume). `VITE_SYNC_API_URL` 시크릿을 지우지 않았다면 Pages 배포본은 그대로 동작한다.

## 알려진 제약

- iOS 앱과 위젯은 아직 Vercel Blob에 직접 붙는다(`WeeklyScheduleApp/Services/VercelBlobSyncService.swift`). iOS 앱이 `/api/sync/...`를 쓰도록 바꾸기 전까지 iOS와 웹의 데이터는 갈라진다.
- iOS 코드에 Blob 읽기/쓰기 토큰이 기본값으로 들어 있고, 이 저장소는 공개 저장소다. iOS를 프록시로 옮긴 뒤 Blob 토큰을 폐기한다.
