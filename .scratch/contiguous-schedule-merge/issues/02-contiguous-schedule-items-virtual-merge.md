# 02: 연속 동일 일정 가상 병합(Merged Contiguous Schedule) 헬퍼 및 뷰 적용

**What to build:**
동일한 요일 내에서 시간 간격이 0분으로 정확히 이어지고 일정 명칭(공백 제외)과 카테고리가 일치하는 복수의 일정이 등록된 경우(예: 14:00~15:00 수학, 15:00~16:00 수학 또는 22:00~22:30 취침, 22:30~23:00 취침), 데이터 원본 스냅샷은 안전하게 보존하면서 화면 표시 계층(View / Presentation Layer)에서 이를 하나의 연속 일정 블록(`[첫 일정 시작 ~ 마지막 일정 종료]`)으로 가상 병합하여 표시한다.

**Blocked by:** 01: 시간 슬롯 통합 블록(Spanned Time Block) 병합 조건 전면 완화 및 인쇄 엔진 개선

**Status:** ready-for-agent

- [ ] `web/src/domain/printLayout.ts`(또는 `calendarUtils.ts`)에 순수 함수 `mergeContiguousScheduleItems(items: ScheduleItem[]): ScheduleItem[]`을 구현한다:
  - 동일한 요일의 항목들을 시간순으로 정렬한 뒤, 앞 항목의 종료 시각(`endHour * 60 + endMinute`)과 뒤 항목의 시작 시각(`startHour * 60 + startMinute`)이 분 단위까지 정확히 일치(간격 0분)하는지 검사한다.
  - 양 항목의 `title.trim()` 및 `category`가 일치하는 경우, 시작 시각은 앞 항목, 종료 시각은 뒤 항목을 따르는 단일 가상 `ScheduleItem`으로 병합한다.
  - 메모(`note`)는 빈 문자열이 아닌 경우 줄바꿈(`\n`)으로 결합하고, 세부 할 일(`subTasks`)은 순서대로 합산한다.
- [ ] `SchedulePrintModal.tsx`의 인쇄 시간 슬롯 수집(`getPrintableTimeSlots`) 및 일일 컬럼 블록 생성(`buildPrintColumnBlocks`) 시 `mergeContiguousScheduleItems`를 적용하여, 데이터상 2개로 분할 등록된 연속 일정도 인쇄 표에서 하나의 블록으로 깔끔하게 통합 렌더링되도록 한다.
- [ ] 3개 이상의 동일 일정이 연속되는 경우(예: 13:00~14:00, 14:00~15:00, 15:00~16:00)에도 누락 없이 하나의 3시간 블록으로 누적 병합된다.
- [ ] 제목이나 카테고리가 다르거나 5분이라도 시간 간격이 있는 일정은 병합되지 않고 기존대로 독립된 카드로 유지된다.
- [ ] 관련 단위 테스트(`printLayout.test.ts` 및 컴포넌트 테스트)를 작성하여 정상 병합 및 에지 케이스(간격 있음, 제목 상이, 카테고리 상이, 3연속 병합 등)를 검증하고 전체 테스트가 통과한다.
