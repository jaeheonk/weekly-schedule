# 4. Cross-Platform UUID Canonical Uppercase Normalization

Date: 2026-11-11
Status: accepted

## Context

iOS/macOS(Apple Foundation)의 `UUID.uuidString`은 16진수 대문자 문자열(`8-4-4-4-12`)을 직렬화합니다. 반면 Web(TypeScript)의 `deterministicUUID` 및 표준 `crypto.randomUUID()`는 소문자 문자열을 생성합니다.
웹앱의 스냅샷 병합(`mergeScheduleItems`) 및 딕셔너리 키 조회(`completionFlags`, `parentVerifiedFlags`, `weeklyOverrides`, `deletedItemTimestamps`)가 대소문자를 구분하는(Case-Sensitive) 문자열 키 매칭을 수행하면서, iOS에서 수정된 동일 일정(`702BED2E-...`, 21:30~22:00)과 웹의 초기 기본 일정(`702bed2e-...`, 21:30~22:30)이 서로 다른 항목으로 인식되어 Vercel Blob 클라우드 스냅샷에 32개의 중복 일정이 누적·발생했습니다.

## Decision

1. **대문자 정규화 (Canonical Uppercase UUID)**:
   - 클라우드 동기화 스냅샷과 웹앱의 모든 UUID(`ScheduleItem.id`, `SubTask.id`) 생성 및 인입 시 항상 대문자(`UUID.toUpperCase()`)로 정규화한다.
   - 복합 키(`${weekKey}_${UUID}`) 역시 UUID 영역을 대문자로 정규화하여 저장 및 조회한다.

2. **대소문자 무시(Case-Insensitive) 병합 및 최신순 단일화**:
   - `mergeScheduleItems` 및 모든 플래그 병합 헬퍼에서 ID 비교를 대소문자 무관하게 수행한다.
   - 동일 정규 ID에 대해 복수의 레코드가 존재할 경우 최신 `updatedAt`을 가진 레코드(사용자 수정본)를 채택하고 구버전 기본값 레코드(`updatedAt = 1700000000`)를 폐기한다.

3. **Swift 동등 ID 정규화(`normalizeItemsToCanonicalIDs`) 웹 이식**:
   - 요일·시작시각·제목 기반 해시 시그니처(`weekday|startHour:startMinute|title`)를 통해 레거시 임의 UUID를 정규 결정론적 대문자 ID로 교정하는 로직을 웹 클라이언트에 이식하여 플랫폼 간 완전한 정합성을 유지한다.

## Consequences

- Web과 iOS/macOS가 Vercel Blob을 통해 공유하는 단일 진실 공급원(SSOT) JSON 스냅샷에서 키와 식별자의 대소문자 분기가 영구적으로 해소된다.
- 기존 스냅샷에 축적된 32개의 중복 일정이 첫 로드 및 동기화 시점에 최신 사용자 수정본으로 단일화되어 클라우드로 재업로드된다.
- Web의 `deterministicUUID` 생성 결과가 Swift `DefaultScheduleData`의 대문자 `uuidString`과 바이트뿐만 아니라 문자열 표현까지 100% 일치하게 된다.
