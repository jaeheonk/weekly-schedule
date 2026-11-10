# 02: 일정 편집 및 인쇄 모달 스코프 연동 및 앱 최상위 통합 (Modal Scope Propagation & App Integration)

**What to build:**
주간 시간표(`WeeklyGridView`)에서 일정 카드를 클릭하거나 '+ 새 일정 추가'를 누를 때, 현재 활성화된 스코프(`'master'` 또는 `'thisWeek'`)를 `onOpenEditModal` 콜백으로 상위 컨테이너에 전달한다. 또한 'A4 1페이지 인쇄' 버튼 클릭 시에도 현재 활성 스코프를 `onOpenPrint` 콜백에 전달한다. 최상위 앱(`web/src/App.tsx`)에서는 전달받은 스코프를 `ScheduleEditModal` 및 `SchedulePrintModal`의 초기 스코프로 연동하여 모달이 현재 보고 있던 스코프 맥락으로 열리도록 보장한다.

**Blocked by:** 01 (needs WeeklyGridView scope state)

**Status:** resolved

- [x] `WeeklyGridViewProps`의 `onOpenEditModal` 콜백 시그니처를 `(item: ScheduleItem | null, weekday?: WeekdayNumber, scope?: ScheduleEditScope) => void`로 정비하고, 현재 주간 뷰의 `weeklyScope`를 함께 전달한다.
- [x] `WeeklyGridViewProps`의 `onOpenPrint` 콜백 시그니처를 `(scope?: ScheduleEditScope) => void`로 정비하고, 현재 주간 뷰의 `weeklyScope`를 함께 전달한다.
- [x] '이번 주 적용 시간표' 모드에서 표시되는 점선 안내 카드의 [편집] 버튼을 클릭했을 때, 해당 마스터 아이템을 `thisWeek` 스코프로 모달에 전달하여 부모가 휴강 취소 또는 재조정을 즉시 수행할 수 있도록 연동한다.
- [x] `web/src/App.tsx`에서 주간 그리드가 호출하는 `handleOpenEditModal`에 `scope` 매개변수를 수신하여 `editModal.initialScope`에 바인딩한다.
- [x] `web/src/App.tsx`에서 `isPrintModalOpen` 및 `printScope` 상태를 관리하여 `handleOpenPrint` 호출 시 전달받은 스코프를 `SchedulePrintModal`의 `initialScope`로 전달한다.
- [x] `web/src/App.test.tsx` (Seam 4)에 주간 뷰의 스코프에 따른 `ScheduleEditModal` 및 `SchedulePrintModal` 연동 통합 테스트를 작성하고 모든 테스트가 통과함을 확인한다.
