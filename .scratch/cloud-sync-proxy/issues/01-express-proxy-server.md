# 01: Express 백엔드 프록시 서버 구현 및 Vercel Blob SDK 연동

Status: resolved

**What to build:**
Node.js/Express 기반의 경량 API 프록시 서버(`server/`)를 구축하여 Vercel Blob과의 통신을 대행합니다. 서버 환경 변수(`BLOB_READ_WRITE_TOKEN`)를 통해 마스터 토큰을 안전하게 보호하며, `GET /api/sync/latest`, `POST /api/sync/upload`, `GET /health` 엔드포인트를 제공하고 GitHub Pages 및 로컬 출처에 대한 CORS를 활성화합니다.

**Acceptance Criteria:**
- [x] `server/` 디렉토리에 Express 및 `@vercel/blob` 기반의 독립 백엔드 서버가 구성된다.
- [x] `GET /api/sync/latest?familyCode=<familyCode>` 호출 시 Vercel Blob에서 최신 스냅샷 메타데이터를 조회하고, 프라이빗 스냅샷 내용을 서버 사이드에서 다운로드하여 클라이언트에 JSON으로 반환한다.
- [x] `POST /api/sync/upload` 호출 시 새 스냅샷을 Vercel Blob에 `private` 모드로 업로드하고, 전달받은 이전 스냅샷 목록을 비동기로 삭제 정리한다.
- [x] CORS 미들웨어를 통해 `https://jaeheonk.github.io` 및 로컬 개발 환경(`localhost:5173`, `localhost:4173`)에서의 교차 출처 요청을 허용한다.
- [x] 유효한 `BLOB_READ_WRITE_TOKEN`이 없을 경우 500 에러와 명확한 오류 메시지를 반환한다.
- [x] 프록시 라우트 핸들러를 검증하는 서버 통합 단위 테스트가 작성되고 통과한다.

## Comments

## Answer

Node.js/Express 기반의 Vercel Blob 프록시 백엔드 서버(`server/`) 구현 및 단위/통합 테스트를 완료했습니다:

1. **독립 Express 백엔드 패키지 구성 (`server/package.json`, `tsconfig.json`)**:
   - Express 4, `@vercel/blob`, `cors`, `dotenv`, `tsx`, `vitest`, `supertest` 탑재.
   - TypeScript ES2022 기반 빌드 및 `prestart` 자동 빌드 체계 구성.

2. **CORS 미들웨어 (`server/src/cors.ts`)**:
   - GitHub Pages 프로덕션 출처(`https://jaeheonk.github.io`) 및 로컬 개발 환경(`http://localhost:5173`, `http://localhost:4173`, `http://127.0.0.1:*`) 허용.
   - `OPTIONS` preflight 사전요청 처리 및 사용자 커스텀 출처 확장(`ALLOWED_ORIGINS`) 지원.

3. **엔드포인트 라우팅 및 토큰 보안 격리 (`server/src/routes/sync.ts`, `health.ts`, `app.ts`)**:
   - `GET /health`: 서버 헬스체크 및 가동 시간(uptime) 반환.
   - `GET /api/sync/latest?familyCode=<familyCode>`: 최신 스냅샷 메타데이터 목록 조회 후 서버 사이드에서 프라이빗 스냅샷을 안전하게 다운로드하여 `{ latest, snapshot, allBlobs }` 반환.
   - `POST /api/sync/upload`: `private` 모드로 스냅샷을 Vercel Blob에 업로드(공개 버킷 폴백 지원)하고, 이전 스냅샷 목록(`previousBlobsToDelete`)을 비동기로 백그라운드 삭제 정리.
   - 유효한 `BLOB_READ_WRITE_TOKEN` 미설정 시 `500` 오류와 명확한 한글 에러 메시지 반환.

4. **검증**:
   - `server/src/app.test.ts` (13개 테스트): 헬스체크, CORS 출처/사전요청, 토큰 미설정 500 에러, GET 최신 스냅샷 조회, POST 업로드 및 400 유효성 검사.
   - `server/src/blobStorage.test.ts` (8개 테스트): `@vercel/blob` SDK 연동, 패밀리 코드 정규화, 타임스탬프 내림차순 정렬, 스트림 기반 JSON 파싱, 프라이빗/퍼블릭 업로드 및 비동기 삭제.
   - 총 21개 테스트 100% 통과 및 전체 타입체크 통과.
