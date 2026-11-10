# Spec: 크로스 플랫폼 UUID 대문자 정규화 및 클라우드 스냅샷 중복 복구 (Snapshot UUID Canonical Normalization)

Status: ready-for-agent

## Problem Statement

1. **UUID 대소문자 불일치로 인한 일정 중복 노출**:
   - iOS/macOS 앱(Apple Foundation)은 UUID를 항상 대문자 16진수(`702BED2E-...`)로 인코딩하고, 복합 키(`YYYY-Www_UUID`) 및 `deletedItemTimestamps`도 대문자 키로 저장한다.
   - 웹앱(TypeScript)의 `deterministicUUID` 및 표준 `crypto.randomUUID()`는 소문자(`702bed2e-...`)로 생성된다.
   - 웹 클라이언트의 스냅샷 병합(`snapshotMerge.ts`) 및 스토어 조회(`scheduleStore.ts`)가 Case-Sensitive 비교를 수행하여, 동일 일정임에도 대소문자가 다른 항목을 서로 별개의 일정으로 취급하였다.
2. **클라우드 스냅샷 오염 (32개 항목 중복)**:
   - 사용자가 iOS에서 수정한 최신 기본 일정(예: `Faye 수업` 21:30~22:00, `취침` 22:00~22:30, `updatedAt > 1790000000`, 대문자 ID)과 웹앱 초기 기본 일정(예: 21:30~22:30, 22:30~23:00, `updatedAt = 1700000000`, 소문자 ID)이 모두 보존된 채 Vercel Blob으로 업로드되어, 모바일 웹앱 및 모든 기기에서 동일 요일에 동일 제목의 일정이 2개씩 노출되는 오류가 발생하였다.

## Solution

1. **대문자 정규화 (Canonical Uppercase UUID)**:
   - 웹앱의 `deterministicUUID`, `generateEntityId` 및 모든 인입 데이터의 UUID를 대문자로 통일한다.
   - 복합 키(`${weekKey}_${UUID}`)의 UUID 부분도 대문자로 정규화한다.
2. **Swift 동등 `normalizeItemsToCanonicalIDs` 웹앱 구현**:
   - `weekday|startHour:startMinute|title` 시그니처를 기반으로 기본 시간표 항목을 정규 결정론적 대문자 ID로 매핑하고, 세부 할 일 ID도 함께 정규화한다.
3. **대소문자 무시 병합 및 최신 `updatedAt` 채택**:
   - `mergeScheduleItems`에서 ID를 대소문자 무시하여 맵핑하고, 동일 ID 충돌 시 최신 `updatedAt`을 채택하여 구버전 기본값(`updatedAt = 1700000000`)을 완전히 제거한다.
   - 플래그 딕셔너리(`completionFlags`, `parentVerifiedFlags`, `itemReactions`, `weeklyOverrides`, `deletedItemTimestamps`) 병합 시 대문자 키로 통합한다.
4. **오염된 클라우드 스냅샷 정제 및 자동 동기화**:
   - 정제된 스냅샷(108개 -> 76개 유효 항목)을 Vercel Blob에 안전하게 업로드하여 모든 기기의 데이터를 복구한다.

## User Stories

1. As a child or parent viewing the today schedule or weekly grid on the web app, I want each scheduled lesson and routine (like Faye 수업 and 취침) to appear as a single clear card, so that I don't see duplicated or conflicting time slots.
2. As a user modifying schedules on iOS or macOS, I want my edits to cleanly overwrite default schedules on the web without creating case-variant duplicate cards.
3. As a parent verifying homework, I want parent stamps and heart reactions to sync seamlessly between iOS and Web without key mismatch due to UUID casing.
