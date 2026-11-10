# Spec: 주간 시간표 뷰 스코프 전환 및 iOS 1:1 기능 동기화 (Weekly View Scope Modes & iOS Parity)

Status: ready-for-agent

## Problem Statement

현재 웹앱의 '주간 시간표' 탭은 특정 주차의 **이번 주 조정(Weekly Override)**이 반영된 유효 시간표만 일방적으로 표시한다. 사용자가 매주 반복되는 정규 일정 원본인 **기본 시간표(Master Schedule)** 전체를 확인하거나 일괄 편집하고 싶어도 주간 그리드 화면에서는 기본 시간표 모드로 전환할 수 있는 방법이 없다.

반면 iOS/macOS 앱에서는 상단의 스코프 전환 바를 통해:
1. `전체 기본 시간표 (매주 변경)`
2. `이번 주 적용 시간표` (조정 건수가 있을 때 `이번 주 시간표 (조정 N건)`)

를 자유롭게 전환하며 비교할 수 있고, '전체 기본 시간표' 모드에서도 이번 주에 임시로 휴강되거나 시간이 이동된 항목을 취소선과 뱃지로 한눈에 파악할 수 있다. 또한 사용자가 선택한 스코프 맥락이 일정 편집 모달의 기본 수정 범위와 인쇄 미리보기 대상으로 자연스럽게 연동된다.

웹앱에 이 스코프 전환 시스템이 누락되어 있어, 부모 사용자가 정규 기본 시간표를 관리하거나 이번 주 임시 변동 사항과의 차이점을 직관적으로 비교·파악하지 못하는 플랫폼 간 사용성 격차가 발생하고 있다.

## Solution

웹앱의 주간 시간표 뷰에 iOS 앱과 1:1로 일치하는 **주간 뷰 스코프 전환 시스템**을 구축한다.

1. **상단 2단 스코프 전환 바 및 안내 배너 배치**:
   - `전체 기본 시간표 (매주 변경)` (Indigo 테마) ↔ `이번 주 적용 시간표` / `이번 주 시간표 (조정 N건)` (Orange 테마) 전환 버튼을 주간 그리드 상단에 배치한다.
   - 각 모드에 따른 목적 안내 문구와 함께, 이번 주 조정 내역이 존재하고 부모 모드일 때 즉시 원복할 수 있는 `이번주 조정 초기화` 버튼을 제공한다.
   - 주간 시간표 탭 진입 시 기본 선택 모드는 사용자의 일상적 시간표 확인을 위해 **'이번 주 적용 시간표'**로 열린다.
2. **전체 기본 시간표 모드 시각화 (Master Scope)**:
   - 정규 반복 일정 목록을 표시하되, 이번 주에 한시 조정된 항목에 대해 시각적 단서를 제공한다:
     - 이번 주 휴강/제외된 일정: 취소선(strikethrough) 및 `이번 주 휴강` 배지 표시
     - 이번 주 시간/요일이 조정된 일정: 오렌지색 시계 아이콘 및 오렌지 테두리 강조 표시
     - 이번 주 한시 추가 일정: 기본 시간표에는 존재하지 않으므로 숨김 처리
3. **이번 주 적용 시간표 모드 시각화 (Effective Scope)**:
   - 이번 주 조정 내역(한시 추가, 시간/요일 변경)이 모두 적용된 최종 일정을 표시한다.
   - 이번 주에 다른 요일로 이동했거나 휴강된 기본 시간표 일정은 해당 요일 열 하단에 점선 안내 카드(`이번 주 휴강·제외`, `이번 주 X요일 Y시로 이동`)로 유지하여 일정 누락 혼란을 방지한다.
4. **편집 및 인쇄 모달과의 스코프 컨텍스트 연동**:
   - 주간 그리드에서 현재 활성화된 스코프가 새 일정 추가 및 기존 일정 편집 시 `ScheduleEditModal`의 기본 스코프(`initialScope`)로 자동 연동된다.
   - 점선 안내 카드의 [편집] 버튼을 누르면 해당 기본 일정을 불러와 `thisWeek` 스코프로 모달을 열어 즉시 휴강 취소 또는 재조정이 가능하도록 한다.
   - 주간 그리드 상단의 'A4 1페이지 인쇄' 버튼 클릭 시 현재 선택된 스코프가 인쇄 미리보기의 기본 출력 모드로 연동된다.
5. **아이 모드 vs 부모 모드 권한 제어**:
   - 아이 모드: 스코프 전환을 통한 양방향 조회가 가능하며, 편집·추가·초기화 버튼은 숨겨 안전한 실행 환경을 유지한다.
   - 부모 모드: 모든 편집, 추가 및 일괄 조정 초기화 액션이 활성화된다.

## User Stories

1. As a parent managing our family routine, I want to switch between "전체 기본 시간표 (매주 변경)" and "이번 주 적용 시간표" on the Weekly Schedule tab, so that I can independently inspect our regular repeating rhythm versus this week's temporary adjustments.
2. As a parent or child entering the Weekly Schedule tab, I want the view to default to "이번 주 적용 시간표", so that I immediately see this week's realistic schedule without having to manually switch modes.
3. As a parent, I want to see an Indigo-styled button for "전체 기본 시간표 (매주 변경)" and an Orange-styled button for "이번 주 적용 시간표", so that the visual hierarchy clearly communicates permanent versus temporary schedule modes.
4. As a parent or child, I want the "이번 주 적용 시간표" button to display the dynamic adjustment count (e.g. "이번 주 시간표 (조정 2건)") whenever active Weekly Overrides exist, so that I am instantly aware that adjustments are in effect.
5. As a parent or child viewing "전체 기본 시간표", I want an informative helper text stating "칸을 탭하면 매주 반복되는 전체 기본 스케줄이 영구적으로 변경됩니다.", so that I understand edits here will affect every week.
6. As a parent or child viewing "이번 주 적용 시간표", I want an informative helper text stating "이번 주에만 일시 조정된 시간표입니다. (다음 주 월요일 원래대로 자동 복구)", so that I know these changes are temporary.
7. As a parent viewing "전체 기본 시간표", I want Master Schedule items that are skipped for the current week to show a strikethrough title and an orange badge, so that I know they are paused this week without losing track of their regular place.
8. As a parent viewing "전체 기본 시간표", I want Master Schedule items that have adjusted times or weekdays this week to display an orange clock icon and highlight border, so that I can see at a glance which regular routines were shifted.
9. As a parent viewing "전체 기본 시간표", I want temporary items added only for this week to be hidden, so that the Master Schedule view remains 100% pure and true to the repeating base template.
10. As a parent viewing "전체 기본 시간표", I want dashed excluded-item cards to be omitted, so that the grid reflects only regular repeating items.
11. As a parent viewing "이번 주 적용 시간표", I want all effective items (including temporary additions and time/day shifts) to be displayed with their appropriate category colors and adjustment badges, so that this week's actual operational schedule is crystal clear.
12. As a parent viewing "이번 주 적용 시간표", I want Master Schedule items that were skipped or moved to another day to be displayed as dashed cards at the bottom of their original day column, so that I understand why an expected activity is not present at its regular time.
13. As a parent in Parent Mode, I want an "이번주 조정 초기화" button to appear in the sub-banner whenever adjustments exist, so that I can wipe all temporary overrides for the week in one click and return fully to the Master Schedule.
14. As a child in Child Mode, I want to be able to switch between "전체 기본 시간표" and "이번 주 적용 시간표" to view both modes, but have all editing buttons, add buttons, and reset buttons hidden, so that I cannot accidentally modify or reset our schedules.
15. As a parent in Parent Mode viewing "전체 기본 시간표", I want clicking "+ 새 일정 추가" or clicking a schedule card to open the Schedule Edit modal with the scope preset to "전체 기본 시간표", so that my edits apply permanently to the base schedule.
16. As a parent in Parent Mode viewing "이번 주 적용 시간표", I want clicking "+ 새 일정 추가" or clicking a schedule card to open the Schedule Edit modal with the scope preset to "이번 주만 적용", so that my edits create temporary overrides for the current week.
17. As a parent in Parent Mode viewing a dashed skipped or moved card in "이번 주 적용 시간표", I want clicking the edit button on that card to open the Schedule Edit modal with that item in "이번 주만 적용" scope, so that I can easily cancel the skip or re-adjust the schedule.
18. As a parent or child clicking the "A4 1페이지 인쇄" button from the Weekly Schedule tab, I want the print preview modal to initialize with the currently selected scope (Master Schedule vs Effective Schedule), so that what I was just looking at is what gets prepared for printing.
19. As a user switching between tabs (e.g. from Weekly Schedule to Today Schedule and back), I want the Weekly Schedule tab to refresh cleanly with the default "이번 주 적용 시간표" scope, so that I always land on the most actionable view.

## Implementation Decisions

### 1. View Scope State & Lifecycle
- Manage the active view scope (`'master'` | `'thisWeek'`) as a local React state inside the weekly grid component, initializing to `'thisWeek'`.
- Subscribing to the domain schedule store triggers re-renders whenever items or overrides change, keeping the active adjustment count in the switcher bar always up to date.

### 2. Schedule Item Filtering & Presentation Rules
- When active scope is `'master'`:
  - Primary items: query only Master Schedule items (items without `targetWeekKey`).
  - Temporary this-week-only additions (`targetWeekKey === currentWeekKey`) are excluded.
  - For each master item, query if it is skipped or modified in the current week:
    - Skipped items receive a strikethrough styling on their title, dimmed background opacity, and an orange `이번 주 휴강` badge.
    - Time- or weekday-shifted items receive an orange clock icon and orange border highlight.
  - Excluded day items (dashed cards) are omitted in master mode to keep the grid clean.
- When active scope is `'thisWeek'`:
  - Primary items: query effective schedule items (master items merged with this week's overrides, plus this-week-only additions).
  - Modified and temporary items display their existing adjustment badges (`이번 주 추가 일정`, `이번 주 시간 조정`, `이번 주 요일 이동`, 등).
  - Excluded items (skipped or moved to another day) render as dashed cards in their original day column with reason text.

### 3. Modal & Action Scope Propagation
- Extend the weekly view's add/edit callback interface so that the currently active view scope is passed down to the parent container when opening the Schedule Edit modal:
  - If viewing master scope: dispatch modal with `initialScope: 'master'`.
  - If viewing this-week scope: dispatch modal with `initialScope: 'thisWeek'`.
- Dash card edit action explicitly passes `initialScope: 'thisWeek'` with the associated master item.
- Extend the print callback to pass the current scope so the print preview modal opens directly in the matching print scope.

### 4. Mode-Dependent UI Guarding
- Protect administrative actions (`이번주 조정 초기화`, `+ 새 일정 추가`, 카드별 `편집` 버튼) behind the domain store's Parent Mode check.
- Keep the scope switcher bar fully interactive in Child Mode for reading and comparison.

### 5. Domain Modeling Alignment
- The domain vocabulary in `GLOSSARY.md` contains the official definitions for `기본 시간표 (Master Schedule)`, `이번 주 조정 (Weekly Override)`, and `이번 주 적용 시간표 (Effective Weekly Schedule)`. All UI titles, helper texts, and tooltips follow this exact phrasing.

## Testing Decisions

### What makes a good test
- Tests must verify external behavior through user actions (rendering elements, clicking switcher tabs, asserting visible badges and buttons) rather than internal React state.
- Tests should assert that changing scopes produces the correct visual output (master items with override badges vs effective items with dashed cards).
- Tests should assert that callbacks (edit modal and print modal) receive the correct scope argument.
- Tests should assert that Child Mode suppresses mutative controls while preserving tab navigation.

### Modules tested
- **Seam 3 (Composite View Component)**: `WeeklyGridView` component unit and interaction tests (`WeeklyGridView.test.tsx`).
- **Seam 4 (App Integration)**: `App` component top-level modal dispatch and state integration tests (`App.test.tsx`).

### Prior Art
- `web/src/components/WeeklyGridView.test.tsx`: Existing tests for grid column rendering, adjustment badges, reset button, and edit triggers.
- `web/src/App.test.tsx`: Existing integration tests for parent PIN authentication, schedule editing modals, and print preview navigation.

## Out of Scope

- Modifying the underlying `ScheduleStore` data schema (existing methods `getMasterItems()`, `getEffectiveItems()`, `isAdjustedThisWeek()`, `isSkippedThisWeek()`, `hasThisWeekOverride()`, `resetThisWeekAdjustments()` already fully support both scopes).
- Cloud sync protocol changes (the SSOT snapshot already synchronizes master items and weekly overrides).
- Adding multi-week historical navigation to the weekly tab (scope is strictly between current week's Master Schedule and current week's Effective Schedule).

## Further Notes

- The UI layout, color palettes (Indigo for Master Schedule, Orange for Weekly Overrides), iconography, and Korean copy are designed to match the native iOS `WeeklyGridView.swift` implementation 1:1, providing seamless familiarity for users switching between Apple devices and web browsers.
