# 03: snapshotMerge 대소문자 무시 병합 및 최신 updatedAt 단일화

Status: resolved
Blocked by: 01, 02

**What to build:**
- `web/src/domain/snapshotMerge.ts`의 `mergeScheduleItems`:
  - `itemDict` 구축 시 ID를 대문자로 정규화(`item.id.toUpperCase()`)하여 맵핑한다.
  - 동일한 canonical ID를 가진 항목이 복수 존재하는 경우, `updatedAt`이 더 큰 항목(사용자 수정본)을 보존하고 구버전 기본 일정(`updatedAt = 1700000000`)을 완전히 탈락시킨다.
  - `deletedItemTimestamps` 조회 시에도 ID를 대문자로 비교한다.
- 플래그 딕셔너리(`completionFlags`, `parentVerifiedFlags`, `weeklyOverrides`, `itemReactions`, `deletedItemTimestamps`):
  - 키의 대소문자를 정규화하여 복합 키(`${weekKey}_${canonicalId}`)의 충돌이나 누락을 방지하고, 타임스탬프가 최신인 플래그를 채택한다.
- 단위 테스트 작성: 대소문자가 다른 동일 UUID 쌍이 들어왔을 때 최신본 1개만 남는지 검증.
