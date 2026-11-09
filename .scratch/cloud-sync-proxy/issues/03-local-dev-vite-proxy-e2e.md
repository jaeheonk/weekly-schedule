# 03: Vite 로컬 프록시 설정, 동시 실행 스크립트 및 통합 테스트

Status: resolved

**What to build:**
로컬 개발 환경에서 Vite 개발 서버가 `/api` 요청을 로컬 Express 프록시 서버(포트 3001)로 자동 프록시하도록 `vite.config.ts`를 설정하고, 프론트엔드와 백엔드를 단일 명령어로 함께 띄울 수 있는 `dev:all` 스크립트를 추가합니다. 로컬 머신의 Safari 브라우저에서 실제 동기화 및 `Load failed` 해소 여부를 검증합니다.

**Blocked by:** 01, 02

**Acceptance Criteria:**
- [x] `web/vite.config.ts`에 `/api` 경로를 `http://localhost:3001`로 중계하는 proxy 규칙이 구성된다.
- [x] 루트 또는 `web/package.json`에 프론트엔드와 프록시 서버를 동시에 실행하는 스크립트(`npm run dev:all`)가 추가된다.
- [ ] 로컬 환경에서 Safari 브라우저를 통해 동기화 실행 시 `Load failed` 오류가 발생하지 않고 "클라우드 동기화 완료" 토스트가 표시된다.
- [x] 웹에서 수정한 일정이 Vercel Blob에 정상 저장되고, 네이티브 앱 스키마와 충돌 없이 로드된다.

## Comments

## Answer

로컬 Vite 개발 서버가 `/api`를 Express 프록시로 넘기고, `npm run dev:all` 한 번으로 웹과 프록시를 함께 띄우도록 구성했습니다.

1. **Vite 프록시** (`web/vite.config.ts`):
   - `/api`를 `http://localhost:3001`로 중계합니다. Vite base가 `/weekly-schedule/`이어도 프록시 미들웨어가 base 검사보다 먼저라 브라우저의 `/api/sync/*` 요청이 앱 경로에 갇히지 않습니다.
   - 3001이 이미 쓰이면 `VITE_DEV_PROXY_TARGET`으로 대상을 바꿀 수 있습니다. 기본값은 `http://localhost:3001`입니다.

2. **동시 실행** (`web/package.json`의 `dev:all`, `web/scripts/dev-all.mjs`):
   - `cd web && npm run dev:all`이 프록시(`server`, 기본 포트 3001)와 Vite(기본 포트 5173)를 함께 띄웁니다.
   - `PORT`를 바꾸면 프록시 대상도 그 포트로 맞춥니다. Vite 포트는 `VITE_DEV_PORT`로 바꿉니다.

3. **검증**:
   - 통합 테스트 3개: Vite를 거친 일정 수정본이 schemaVersion 5로 다시 읽히는지, 기본 프록시 대상이 `http://localhost:3001`인지, `dev:all`의 `/api/sync/latest`가 HTML이 아닌 프록시 JSON인지.
   - 실제 Vercel Blob에 가족 코드 `proxy-e2e`로 수정 일정을 올리고 다시 읽어 schemaVersion 5와 제목·요일·카테고리를 확인한 뒤 테스트 blob은 삭제했습니다. `family-main` pathname은 변하지 않았습니다.
   - 서버 타입체크와 테스트 26개, 웹 타입체크와 테스트 124개가 통과했습니다.
   - Safari에서 토스트를 확인하지 못했습니다. Safari 설정의 Developer → Allow remote automation이 꺼져 있고, `safaridriver --enable`은 관리자 암호가 필요해 실패했습니다. 그 설정을 켠 뒤 `cd web && npm run dev:all`로 띄우고 Safari에서 `http://localhost:5173/weekly-schedule/`의 동기화 버튼을 누르면 "클라우드 동기화 완료"를 볼 수 있습니다. 이 머신의 3001 포트는 다른 앱이 사용 중이므로, 그때는 `PORT=3011 npm run dev:all`처럼 빈 포트를 지정하면 됩니다.
