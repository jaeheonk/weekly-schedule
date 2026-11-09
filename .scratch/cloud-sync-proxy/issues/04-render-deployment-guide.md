# 04: Render 배포 구성(render.yaml) 및 GitHub Pages 연동 가이드

Status: resolved

**What to build:**
Render 무료 웹 서비스 배포를 위한 설정 파일(`render.yaml`)을 추가하고, GitHub Pages 배포 워크플로우에 `VITE_SYNC_API_URL` 빌드 환경 변수를 연결할 수 있도록 가이드를 작성합니다.

**Blocked by:** 01, 02

**Acceptance Criteria:**
- [x] Render Blueprint 사양을 만족하는 `render.yaml` 파일이 프로젝트 루트에 추가된다.
- [x] 환경 변수(`BLOB_READ_WRITE_TOKEN`, `PORT`) 및 서비스 시작 명령어(`npm start`)가 올바르게 정의된다.
- [x] GitHub Actions 워크플로우(`.github/workflows/deploy-web.yml`)에 `VITE_SYNC_API_URL` 시크릿 연동 옵션이 문서화된다.
- [x] Render 15분 슬립(콜드 스타트) 시에도 프론트엔드가 gracefully하게 "동기화 중..." 상태를 표시하고 타임아웃 없이 복구되는지 검증된다.

## Comments

## Answer

Render 무료 웹 서비스용 Blueprint와 GitHub Pages 빌드 시크릿 연동을 추가했습니다.

1. **Blueprint** (`render.yaml`):
   - 루트에 `weekly-schedule-sync` 웹 서비스를 정의합니다. `rootDir`은 `server`, 플랜은 `free`, 빌드는 `npm install && npm run build`, 시작은 `npm start`, 헬스체크는 `GET /health`입니다.
   - `BLOB_READ_WRITE_TOKEN`은 `sync: false`라 값은 첫 Blueprint 동기화 때 대시보드에서 입력합니다. 파일에는 토큰을 넣지 않습니다.
   - `PORT`는 Render가 공개 HTTP를 넘기는 `10000`입니다. 서버는 `process.env.PORT`를 읽고 `0.0.0.0`에 바인드합니다.
   - 스펙의 `node server/index.js` 대신 티켓의 `npm start`를 씁니다. `server/`가 루트라 `npm start`가 컴파일된 `dist/index.js`를 실행합니다.

2. **GitHub Pages** (`.github/workflows/deploy-web.yml`, `docs/render-deployment.md`):
   - 빌드가 저장소 시크릿 `VITE_SYNC_API_URL`을 Vite에 넘깁니다. 비어 있으면 상대 경로 `/api`(로컬 Vite 프록시)이고, Pages는 Render 오리진이 필요합니다.
   - 배포 순서, 15분 슬립, 시크릿 설정 방법은 `docs/render-deployment.md`에 있습니다.

3. **콜드 스타트**:
   - 프록시 요청에는 `AbortSignal`을 붙이지 않습니다. 50초를 기다려도 요청은 취소되지 않고 응답을 받습니다.
   - 백그라운드 동기화가 3초를 넘으면 `클라우드 동기화 중...`을 보여주고, 프록시가 응답하면 `클라우드 동기화 완료`로 바꿉니다. 빠른 백그라운드 동기화는 토스트 없이 끝납니다.
   - 라이브 Render 슬립은 배포 전이라 확인하지 못했습니다. 검증은 웹 단위 테스트입니다.

4. **검증**:
   - 웹 테스트 128개와 `tsc --noEmit` 통과.
   - 서버 테스트 26개와 `tsc --noEmit` 통과. `dev:all` 로그 대기를 `0.0.0.0` 바인드에 맞췄습니다.
