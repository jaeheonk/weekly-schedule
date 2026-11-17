# Vercel 단일 프로젝트 배포 (웹앱 + 동기화 API)

ADR-0002의 2단계다. 웹앱(`web/`)과 클라우드 동기화 프록시(`server/src`)를 Vercel 프로젝트 하나에서 같은 주소로 서비스한다. GitHub Pages와 Render는 전환이 끝날 때까지 그대로 두고, 확인이 끝나면 끈다.

토큰 값은 이 문서나 Git에 적지 않는다. `BLOB_READ_WRITE_TOKEN`은 Vercel 프로젝트 환경 변수에만 둔다.

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

| 키 | 대상 | 값 |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Render에 넣었던 것과 같은 Blob 스토어의 읽기/쓰기 토큰 |

같은 스토어를 써야 기존 가족 코드의 스냅샷(`families/<code>/state-*.json`)이 그대로 이어진다. Vercel 대시보드의 Storage에서 해당 Blob 스토어를 이 프로젝트에 연결하면 토큰이 자동으로 들어간다. 연결이 어려우면 Render 대시보드의 값을 그대로 복사해 넣는다.

## 전환 순서

1. Vercel에서 이 저장소로 프로젝트를 만든다(이름 `weekly-schedule`). 설정은 `vercel.json`이 정한다.
2. `BLOB_READ_WRITE_TOKEN`을 넣고 다시 배포한다.
3. 프리뷰 배포에서 확인한다.
   - `/`가 열린다.
   - `/health`, `/api/sync/health`가 `{ "status": "ok" }`를 돌려준다.
   - 앱에서 기존 가족 코드로 동기화하면 기존 일정이 불러와진다.
4. PR을 main에 머지하면 프로덕션(`https://weekly-schedule.vercel.app` 또는 Vercel이 정한 주소)에 배포된다.
5. 휴대폰에서 새 주소를 열고 홈 화면에 다시 추가한다. 홈 화면 앱과 로컬 저장소(PIN, Face ID 등록 등)는 주소마다 따로라, 새 주소에서 가족 코드로 한 번 동기화하고 Face ID를 다시 등록한다.
6. 새 주소가 안정적이면 GitHub Pages 배포(`.github/workflows/deploy-web.yml`)와 Render 서비스(`weekly-schedule-sync`)를 끈다. 그 뒤 `render.yaml`과 `docs/render-deployment.md`를 지운다.

## 되돌리기

- 전환 중에는 GitHub Pages와 Render가 그대로 돌기 때문에 예전 주소(`https://jaeheonk.github.io/weekly-schedule/`)를 그대로 쓰면 된다. 둘 다 같은 Blob 스토어를 쓰므로 데이터는 갈라지지 않는다.
- Vercel 쪽만 문제라면 Vercel 대시보드에서 이전 배포로 롤백하거나 이 PR을 revert한다. 이 PR은 GitHub Pages 워크플로, `render.yaml`, `server/` 실행 방식을 바꾸지 않는다.
- Render를 이미 껐다면 Render 대시보드에서 서비스를 다시 켠다(Resume). `VITE_SYNC_API_URL` 시크릿을 지우지 않았다면 Pages 배포본은 그대로 동작한다.
