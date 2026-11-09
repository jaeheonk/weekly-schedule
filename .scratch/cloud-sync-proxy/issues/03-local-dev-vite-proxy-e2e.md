# 03: Vite 로컬 프록시 설정, 동시 실행 스크립트 및 통합 테스트

Status: ready-for-agent

**What to build:**
로컬 개발 환경에서 Vite 개발 서버가 `/api` 요청을 로컬 Express 프록시 서버(포트 3001)로 자동 프록시하도록 `vite.config.ts`를 설정하고, 프론트엔드와 백엔드를 단일 명령어로 함께 띄울 수 있는 `dev:all` 스크립트를 추가합니다. 로컬 머신의 Safari 브라우저에서 실제 동기화 및 `Load failed` 해소 여부를 검증합니다.

**Blocked by:** 01, 02

**Acceptance Criteria:**
- [ ] `web/vite.config.ts`에 `/api` 경로를 `http://localhost:3001`로 중계하는 proxy 규칙이 구성된다.
- [ ] 루트 또는 `web/package.json`에 프론트엔드와 프록시 서버를 동시에 실행하는 스크립트(`npm run dev:all`)가 추가된다.
- [ ] 로컬 환경에서 Safari 브라우저를 통해 동기화 실행 시 `Load failed` 오류가 발생하지 않고 "클라우드 동기화 완료" 토스트가 표시된다.
- [ ] 웹에서 수정한 일정이 Vercel Blob에 정상 저장되고, 네이티브 앱 스키마와 충돌 없이 로드된다.

## Comments
