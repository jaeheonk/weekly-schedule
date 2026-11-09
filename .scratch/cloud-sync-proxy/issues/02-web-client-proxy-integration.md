# 02: 웹 프론트엔드 동기화 서비스 리팩토링 및 클라이언트 토큰 제거

Status: resolved

**What to build:**
웹 프론트엔드의 `VercelBlobSyncService`를 리팩토링하여 브라우저에서 직접 Vercel Blob으로 요청하던 코드를 프록시 API 엔드포인트 호출로 전환합니다. 클라이언트 소스코드에 하드코딩되어 있던 `DEFAULT_VERCEL_BLOB_TOKEN`을 완전히 제거하고, `VITE_SYNC_API_URL` 환경 변수를 통해 프록시 서버 주소를 동적으로 주입받도록 구성합니다.

**Blocked by:** 01

**Acceptance Criteria:**
- [x] `web/src/services/vercelBlobSync.ts`에서 하드코딩된 Vercel Blob 토큰 및 직접 Vercel REST API 호출 로직이 완전히 제거된다.
- [x] 프록시 API 엔드포인트(`GET /api/sync/latest`, `POST /api/sync/upload`)를 호출하도록 클라이언트 서비스 함수가 수정된다.
- [x] `import.meta.env.VITE_SYNC_API_URL` 환경 변수를 지원하여 로컬(상대 경로)과 프로덕션(Render URL)을 유연하게 전환할 수 있다.
- [x] `useCloudSync` 훅과의 인터페이스가 하위 호환성을 유지하여 기존 컴포넌트(`App.tsx`, `Navigation.tsx`, `TodayScheduleView.tsx`) 코드 수정 없이 동작한다.
- [x] `vercelBlobSync.test.ts` 및 `useCloudSync.test.ts` 단위 테스트가 프록시 계약에 맞게 갱신되고 100% 통과한다.

## Comments

## Answer

웹 동기화 클라이언트가 Vercel Blob REST를 직접 호출하지 않고 프록시만 사용하도록 바꿨습니다.

1. **토큰 제거** (`web/src/services/vercelBlobSync.ts`, `web/src/domain/scheduleStore.ts`):
   - 하드코딩된 Blob 읽기/쓰기 토큰과 `blob.vercel-storage.com` 직접 호출(`list`/`download`/`put`/`delete`)을 삭제했습니다.
   - 스토어는 더 이상 토큰을 보관하지 않고, 이전 빌드가 `localStorage`에 남긴 키는 로드 시 제거합니다.

2. **프록시 계약** (`fetchLatestSnapshot`, `uploadSnapshot`):
   - `GET /api/sync/latest?familyCode=` 응답의 `latest`, `snapshot`, `allBlobs`를 그대로 사용합니다. 스냅샷 본문은 별도 다운로드하지 않습니다.
   - `POST /api/sync/upload`에 `familyCode`, `shortDeviceId`, `snapshot`, `previousBlobsToDelete`만 보냅니다. 이전 스냅샷 정리는 서버가 합니다.
   - 베이스 URL은 `import.meta.env.VITE_SYNC_API_URL`입니다. 비어 있으면 상대 경로(`/api/...`)이고, 끝에 슬래시가 있어도 한 번 제거합니다.

3. **훅 호환** (`useCloudSync`):
   - 반환값(`syncStatus`, `toastMessage`, `triggerSync` 등)은 그대로입니다. `App.tsx`, `Navigation.tsx`, `TodayScheduleView.tsx`는 수정하지 않았습니다.
   - 병합은 프록시가 내려준 클라우드 동기화 스냅샷으로 수행합니다.

4. **검증**:
   - `vercelBlobSync.test.ts` 6개, `useCloudSync.test.ts` 5개, `App.test.tsx` 13개 통과.
   - 웹 전체 122개 테스트와 `tsc --noEmit` 통과. 서버 스위트 23개도 통과.
