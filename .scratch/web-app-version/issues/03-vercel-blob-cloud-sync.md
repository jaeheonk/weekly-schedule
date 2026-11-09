# 03: Vercel Blob 클라우드 동기화 및 타임스탬프 결정론적 스냅샷 병합

**What to build:**
별도의 중계 서버 없이 브라우저에서 직접 Vercel Blob 스토리지와 CORS 통신하여 기존 iOS/macOS 네이티브 앱과 양방향 실시간 동기화를 구현합니다. 결정론적 타임스탬프 병합 알고리즘을 통해 충돌 없이 스케줄 데이터, 완료 체크, 오버라이드, 부모 확인 도장 상태를 최신 상태로 유지하며, 백그라운드 폴링과 수동 동기화, 시각적 토스트 알림을 제공합니다.

**Blocked by:** 02: 아이 모드 일일 체크리스트, 진행률 게이지 및 Web Audio 효과음

**Status:** resolved

- [x] Vercel Blob REST API를 통해 가족 채널의 최신 클라우드 동기화 스냅샷(CloudSyncSnapshot v5)을 조회 및 다운로드하고, 변경사항을 새 스냅샷으로 안전하게 업로드할 수 있다.
- [x] 로컬 상태와 원격 스냅샷 간의 충돌 시 삭제 타임스탬프와 최종 수정 타임스탬프를 기준으로 결정론적인 최신 상태 병합이 수행된다.
- [x] 브라우저 탭 활성화(visibilitychange) 복귀 시 및 30초 주기 백그라운드 폴링을 통해 최신 스냅샷을 자동으로 가져온다.
- [x] 상단 동기화 버튼 클릭 또는 ⌘R / Ctrl+R 단축키 입력 시 강제 즉시 동기화가 실행된다.
- [x] 동기화 완료 또는 오류 발생 시 화면 상단에 플로팅 그라디언트 토스트 배너로 상태가 사용자에게 명확히 피드백된다.
- [x] 스냅샷 직렬화/역직렬화 및 타임스탬프 병합 규칙을 검증하는 단위 테스트가 통과한다.

## Comments

- **Vercel Blob REST 클라이언트 구현**: `web/src/services/vercelBlobSync.ts`에 `fetchLatestBlobMetadata`, `downloadSnapshot`, `uploadSnapshot`, `deleteBlobs` 구현. Vercel Blob API v7 헤더, CORS 통신, `private` 400 시 `public` 자동 폴백 및 스토리지 절약을 위한 이전 스냅샷 자동 비동기 삭제 지원.
- **결정론적 타임스탬프 스냅샷 병합 엔진**: `web/src/domain/snapshotMerge.ts`에 Swift 네이티브 앱과 100% 동일한 순수 함수 기반 병합 로직 구현 (`mergeFlagDict`, `mergeScheduleItems`, `mergeStarTransactions`, `mergeStarRedemptionRequests`, `mergeSnapshots`).
  - 삭제 타임스탬프(`deletedItemTimestamps`) 우선 삭제 유지.
  - 마스터 PIN 6자리 유효성 및 최신 타임스탬프 채택.
  - 스타 원장(Star Ledger) 불변 트랜잭션의 중복 없는 합집합 병합(동일 ID 충돌 시 최초 생성 시각 보존).
  - 부모 확인 도장이 찍힌 항목의 완료 플래그 정합성 자동 보장.
- **클라우드 동기화 훅 및 백그라운드 폴링**: `web/src/hooks/useCloudSync.ts`를 통해 30초 주기 폴링, 탭 활성화(`visibilitychange`) 자동 복귀 동기화, `inFlight` 락을 통한 동시성 경합 방지.
- **즉시 동기화 트리거 & 단축키**: 상단 내비게이션 바에 새로고침 스핀 애니메이션 동기화 버튼(`data-testid="header-sync-button"`) 배치, `⌘R` / `Ctrl+R` 입력 시 브라우저 강제 새로고침을 인터셉트하여 즉각 클라우드 동기화 수행.
- **플로팅 그라디언트 토스트 UI**: `web/src/components/SyncToast.tsx`에 글래스모피즘 기반 상단 플로팅 토스트 배너 구현 (동기화 중: 블루/인디고, 성공: 에메랄드/틸, 오류: 로즈/앰버).
- **TDD 및 테스트 통과**: 신규 단위/통합 테스트 32개 추가, 총 56개 테스트(`vercelBlobSync`, `snapshotMerge`, `scheduleStore`, `useCloudSync`, `SyncToast`, `App`, `TodayScheduleView`, `soundEffects`) 100% 통과 및 TypeScript strict 빌드 성공.
- **Two-Axis Code Review 통과**: Standards(Fowler smells 제로, 순수 도메인 함수 분리, GLOSSARY 용어 준수) 및 Spec(Swift 스키마 27개 필드 완전 호환 및 6개 인수 조건 충족) 검증 완료.
