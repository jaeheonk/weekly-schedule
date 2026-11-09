# 01: Express 백엔드 프록시 서버 구현 및 Vercel Blob SDK 연동

Status: ready-for-agent

**What to build:**
Node.js/Express 기반의 경량 API 프록시 서버(`server/`)를 구축하여 Vercel Blob과의 통신을 대행합니다. 서버 환경 변수(`BLOB_READ_WRITE_TOKEN`)를 통해 마스터 토큰을 안전하게 보호하며, `GET /api/sync/latest`, `POST /api/sync/upload`, `GET /health` 엔드포인트를 제공하고 GitHub Pages 및 로컬 출처에 대한 CORS를 활성화합니다.

**Acceptance Criteria:**
- [ ] `server/` 디렉토리에 Express 및 `@vercel/blob` 기반의 독립 백엔드 서버가 구성된다.
- [ ] `GET /api/sync/latest?familyCode=<familyCode>` 호출 시 Vercel Blob에서 최신 스냅샷 메타데이터를 조회하고, 프라이빗 스냅샷 내용을 서버 사이드에서 다운로드하여 클라이언트에 JSON으로 반환한다.
- [ ] `POST /api/sync/upload` 호출 시 새 스냅샷을 Vercel Blob에 `private` 모드로 업로드하고, 전달받은 이전 스냅샷 목록을 비동기로 삭제 정리한다.
- [ ] CORS 미들웨어를 통해 `https://jaeheonk.github.io` 및 로컬 개발 환경(`localhost:5173`, `localhost:4173`)에서의 교차 출처 요청을 허용한다.
- [ ] 유효한 `BLOB_READ_WRITE_TOKEN`이 없을 경우 500 에러와 명확한 오류 메시지를 반환한다.
- [ ] 프록시 라우트 핸들러를 검증하는 서버 통합 단위 테스트가 작성되고 통과한다.

## Comments
