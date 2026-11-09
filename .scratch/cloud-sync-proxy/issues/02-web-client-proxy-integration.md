# 02: 웹 프론트엔드 동기화 서비스 리팩토링 및 클라이언트 토큰 제거

Status: ready-for-agent

**What to build:**
웹 프론트엔드의 `VercelBlobSyncService`를 리팩토링하여 브라우저에서 직접 Vercel Blob으로 요청하던 코드를 프록시 API 엔드포인트 호출로 전환합니다. 클라이언트 소스코드에 하드코딩되어 있던 `DEFAULT_VERCEL_BLOB_TOKEN`을 완전히 제거하고, `VITE_SYNC_API_URL` 환경 변수를 통해 프록시 서버 주소를 동적으로 주입받도록 구성합니다.

**Blocked by:** 01

**Acceptance Criteria:**
- [ ] `web/src/services/vercelBlobSync.ts`에서 하드코딩된 Vercel Blob 토큰 및 직접 Vercel REST API 호출 로직이 완전히 제거된다.
- [ ] 프록시 API 엔드포인트(`GET /api/sync/latest`, `POST /api/sync/upload`)를 호출하도록 클라이언트 서비스 함수가 수정된다.
- [ ] `import.meta.env.VITE_SYNC_API_URL` 환경 변수를 지원하여 로컬(상대 경로)과 프로덕션(Render URL)을 유연하게 전환할 수 있다.
- [ ] `useCloudSync` 훅과의 인터페이스가 하위 호환성을 유지하여 기존 컴포넌트(`App.tsx`, `Navigation.tsx`, `TodayScheduleView.tsx`) 코드 수정 없이 동작한다.
- [ ] `vercelBlobSync.test.ts` 및 `useCloudSync.test.ts` 단위 테스트가 프록시 계약에 맞게 갱신되고 100% 통과한다.

## Comments
