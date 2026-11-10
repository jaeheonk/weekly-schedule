# 01: 시간 슬롯 통합 블록(Spanned Time Block) 병합 조건 전면 완화 및 인쇄 엔진 개선

**What to build:**
주간 인쇄 레이아웃 엔진(`web/src/domain/printLayout.ts`)에서 7개 요일의 시간 슬롯을 취합할 때, 특정 요일의 단일 일정이 다른 요일의 일정 시작 시각으로 인해 2개 이상의 시간 슬롯에 걸치게 되는 경우, 카테고리·소요 시간·할 일 개수 제약 없이 무조건 하나의 통합된 단일 셀(`spanCount >= 2`, `isHighlightedSpanBlock: true`)로 병합하여 표시한다. 이로써 수요일 `학교 축구(15:00~17:00)`, 일요일 `오케스트라 연습(16:00~17:30)`, 특정 요일의 `취침(22:00~23:00)` 등이 중간 시간 슬롯 경계에서 2개 이상의 셀로 쪼개져 `(~종료시각)` 부제목과 함께 중복 표시되던 현상을 완전히 해결한다.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] `web/src/domain/printLayout.ts`의 `shouldMergeAcrossSlots` 함수에서 카테고리(`category === 'free'`), 세부 할 일 개수(`subTasks.length >= 3`), 주말 소요 시간(`duration >= 120`), 슬롯 3개 이상(`spannedSlotCount >= 3`) 등 불필요하게 제한적이던 휴리스틱 조건을 모두 제거한다.
- [x] `mergeLongBlocks` 옵션이 활성화(`true`)되어 있고 해당 일정이 2개 이상의 시간 슬롯에 걸쳐 있는 경우(`spannedSlotCount >= 2`), 카테고리 및 요일과 무관하게 항상 `true`를 반환하여 단일 확장 셀로 통합한다.
- [x] 2개 이상의 시간 슬롯에 걸친 단일 일정이 하나의 `DayCellBlock`(`spanCount = span`, `isHighlightedSpanBlock: true`)으로 생성되며, 불필요한 분할 블록이나 `(~종료시각)` 부제목이 나타나지 않는다.
- [x] `SchedulePrintModal.tsx`의 "긴 일정 블록 병합 (mergeLongBlocks)" 토글이 켜져 있을 때 모든 분할 대상 일정이 일관되게 단일 셀로 렌더링되고, 토글을 끄면 슬롯별 개별 표시로 전환되는 동작을 유지한다.
- [x] `web/src/domain/printLayout.test.ts` 및 `web/src/components/SchedulePrintModal.test.tsx`에 2개 슬롯에 걸친 일반 과목/운동/취침 일정이 단일 블록으로 병합됨을 검증하는 단위/통합 테스트를 추가하고 모든 테스트가 통과한다.
