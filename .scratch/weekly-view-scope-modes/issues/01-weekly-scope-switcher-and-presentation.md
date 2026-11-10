# 01: 주간 시간표 상단 스코프 전환 바 및 스코프별 일정 시각화 엔진 (Weekly View Scope Switcher & Presentation)

**What to build:**
주간 시간표(`web/src/components/WeeklyGridView.tsx`) 상단에 iOS와 1:1로 일치하는 2단 스코프 전환 바(`전체 기본 시간표 (매주 변경)` vs `이번 주 적용 시간표`)와 모드별 안내 배너 및 `이번주 조정 초기화` 버튼을 구축한다. 사용자가 선택한 스코프에 따라 '기본 시간표'(`store.getMasterItems()`)와 '이번 주 적용 시간표'(`store.getEffectiveItems()`)를 전환하여 표시하고, 기본 시간표 모드에서도 이번 주 휴강(취소선 및 오렌지 배지) 및 조정(시계 아이콘 및 오렌지 테두리) 상태를 시각화한다.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `WeeklyGridView` 내부에 `weeklyScope: ScheduleEditScope` ('master' | 'thisWeek') 로컬 상태를 추가하고 기본값을 `'thisWeek'`로 설정한다.
- [x] 상단에 iOS와 동일한 2단 전환 버튼 바를 배치한다:
  - `전체 기본 시간표 (매주 변경)`: 클릭 시 `'master'` 모드로 전환 (Indigo 활성 스타일).
  - `이번 주 적용 시간표` / `이번 주 시간표 (조정 N건)`: 클릭 시 `'thisWeek'` 모드로 전환 (Orange 활성 스타일).
- [x] 전환 바 하단에 각 모드 안내 배너와, 이번 주 조정 내역이 1건 이상이고 부모 모드일 때 동작하는 `이번주 조정 초기화` 버튼을 배치한다.
- [x] `'master'` 모드 렌더링 규칙:
  - `store.getMasterItems()`를 기준으로 요일별 일정 표시 (한시 추가 일정 제외).
  - 이번 주 휴강된 일정(`store.isSkippedThisWeek(item.id)`)은 취소선 + 반투명 + 오렌지색 `이번 주 휴강` 배지 표시.
  - 이번 주 시간/요일이 조정된 일정(`store.hasThisWeekOverride(item.id)`)은 오렌지색 시계 아이콘 및 오렌지 테두리 강조.
  - 점선 안내 카드(휴강/이동 안내)는 숨김.
- [x] `'thisWeek'` 모드 렌더링 규칙:
  - `store.getEffectiveItems()`를 기준으로 요일별 일정 표시.
  - 이번 주 조정 배지(`이번 주 추가 일정`, `이번 주 시간 조정` 등) 유지.
  - 해당 요일에서 제외/이동된 마스터 일정 점선 안내 카드 유지.
- [x] 권한 제어: 아이 모드에서도 스코프 전환 조회를 허용하되, `+ 새 일정 추가`, `편집`, `이번주 조정 초기화` 액션 버튼은 숨김 처리한다.
- [x] `web/src/components/WeeklyGridView.test.tsx` (Seam 3)에 스코프 전환, 마스터/유효 일정 렌더링, 뱃지, 초기화 및 아이 모드 권한 제어를 검증하는 포괄적인 단위 테스트를 추가하고 통과시킨다.
