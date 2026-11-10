# 02: Swift 동등 normalizeItemsToCanonicalIDs 로직 웹앱 구현

Status: resolved
Blocked by: 01

**What to build:**
- `web/src/domain/snapshotMerge.ts` 및 `web/src/domain/scheduleStore.ts`에 Swift `ScheduleStore.swift:normalizeItemsToCanonicalIDs`와 동일한 로직을 구현한다:
  - `startSig = "${item.weekday}|${item.startHour}:${item.startMinute}|${cleanTitle}"`를 기반으로 정규 마스터 항목의 canonical ID를 검색한다.
  - `item.targetWeekKey == null`인 기본 일정에 대해 임의 UUID나 구버전 ID가 부여되어 있으면 canonical ID(대문자)로 교정한다.
  - 세부 할 일(`subTasks`)의 ID도 canonical subtask ID(대문자)로 일치시킨다.
- 단위 테스트를 작성하여 Swift와 100% 동일한 정규화 동작을 검증한다.
