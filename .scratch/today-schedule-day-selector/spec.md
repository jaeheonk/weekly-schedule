# Spec: 웹앱 오늘 스케쥴 탭 요일 선택 메뉴 및 iOS 일일 스케쥴 1:1 기능 동기화 (Today Schedule Day Selector & iOS Parity)

Status: ready-for-agent

## Problem Statement

현재 주간 시간표 웹앱(PWA)의 '오늘 스케쥴' 탭은 오직 시스템 시계 기준의 '실제 오늘 요일'에 해당하는 일과만 고정적으로 보여준다. 반면 iOS/macOS 네이티브 앱의 '오늘 스케쥴' 탭은 월요일부터 일요일까지 원하는 요일을 선택할 수 있는 7열 요일 선택 바를 제공하여, 아이와 부모가 이번 주 내의 다른 요일(어제 미처 체크하지 못한 숙제, 내일 미리 확인할 학원 일정, 주말 자유 일정 등)의 **일일 스케쥴(Daily Schedule)**을 자유롭게 조회하고 완료 체크·부모 확인 도장·응원 하트 전송·평일 스타 적립까지 수행할 수 있다.

또한 네이티브 앱의 '오늘 스케쥴' 탭에는 실시간 오늘 현황 히어로 카드(현재 진행 중인 일과 및 다음 예정 일과 안내), 카테고리별 필터 바, 선택 요일의 확인 대기 숙제를 한 번에 승인하는 일괄 부모 확인 및 응원 하트 지급 배너, 선택 요일 완료 체크 초기화, 이번 주 조정 내역 요약 및 복구 배너, 타 요일로 이동된 기본 시간표 항목 표시 및 복구, 그리고 아이 모드에서도 보호된 부모 액션 버튼을 노출하되 클릭 시 6자리 마스터 PIN 인증을 거쳐 즉시 실행하는 흐름이 구현되어 있으나 웹앱에는 이들이 누락되어 있거나 부분적으로만 동작한다. 이로 인해 웹 환경 사용자가 다른 요일의 일일 스케쥴을 점검하거나 관리할 때 주간 시간표 탭을 오가야 하는 불편과 기기 간 UX 불일치가 발생한다.

## Solution

웹앱의 '오늘 스케쥴' 탭을 iOS/macOS 네이티브 앱의 '오늘 스케쥴' 화면과 UI 구성부터 세부 도메인 동작 규칙까지 1:1로 동일하게 구현한다.

1. **실시간 오늘 현황 히어로 카드 고정 배치**: 화면 최상단에는 선택한 요일과 무관하게 항상 '실제 오늘'을 기준으로 오늘 날짜, 보유 하트 및 하트 보상 교환 진입 버튼, 응원 보내기 버튼, 실제 오늘의 아이 완료·부모 확인 달성률, 최신 부모님 응원 메시지, 그리고 현재 시각에 진행 중인 일과(`지금 하는 일`)와 `다음 일정` 요약을 실시간으로 표시한다.
2. **주간 스타 스탬프 보드 및 월~일 7열 요일 선택 바 연동**: 모바일 375px 화면에서도 가로 스크롤 없이 한 줄에 표시되는 월~일 7열 요일 선택 바를 제공한다. 각 요일 버튼은 3단 구조(① 상단 상태 라벨: `오늘`/`수여`/`조정`, ② 중단 요일명: `월`~`일` 및 주말 색상 구분, ③ 하단 상태 아이콘: 스타 획득/수여 가능/부모 확인 완료/아이 완료/진행 점)로 이번 주 각 요일의 일일 스케쥴 상태를 한눈에 보여주며, 주간 스타 스탬프 보드의 평일(월~금) 슬롯과 양방향으로 연동된다.
3. **선택 요일 기반 일일 스케쥴 실행 및 관리**: 실제 오늘이 아닌 요일을 선택하더라도 이번 주 내의 완료 체크, 세부 할 일 체크, 부모 확인 도장, 응원 하트 전송, 평일 스타 수여를 100% 동일하게 허용한다. 단, 타임라인 카드의 실시간 `"진행중"` 배지 및 강조 테두리는 실제 오늘 요일을 조회할 때만 표시한다.
4. **카테고리 필터 및 선택 요일 헤더 액션 완비**: 요일 선택 바 아래에 카테고리 필터 칩(`전체` 및 각 일정 카테고리)을 제공하고, 선택 요일 헤더에 `TODAY` 배지(실제 오늘일 때), `이번주 조정 N건` 배지, 선택 요일의 완료·부모 확인 통계 및 완료 초기화 버튼, 이번 주 조정 복구 배너(선택 요일만 복구 / 이번 주 전체 복구), 확인 대기 항목 일괄 승인(`"모두 확인 + ❤️"`) 배너를 제공한다.
5. **휴강 및 타 요일 이동 기본 시간표 복구**: 선택 요일 하단에 단순 휴강 항목뿐 아니라 이번 주 조정으로 인해 다른 요일로 이동된 원래 기본 시간표 항목까지 이동 사유와 함께 표시하고 즉시 원래대로 복구할 수 있게 한다.
6. **아이 모드 보호 액션의 부모 PIN 즉시 인증 연동**: 아이 모드에서도 부모 전용 액션 버튼(일괄 확인, 완료 초기화, 이번 주 조정 복구, 제외 일정 복구, 응원 보내기, 이번 주 일정 추가 등)을 숨기지 않고 노출하되, 클릭 시 6자리 부모 PIN 인증 모달을 띄워 인증 성공 즉시 원래 요청한 동작을 실행한다.

## User Stories

1. As a child or parent, I want to see a 7-column Mon–Sun day selector bar on the Today Schedule tab, so that I can inspect and interact with any day's Daily Schedule within the current week.
2. As a mobile web user on a compact 375px screen, I want all 7 weekday buttons (Mon–Sun) to fit cleanly in a single horizontal row without horizontal page overflow, so that I can switch days with one tap on any smartphone.
3. As a child or parent, I want each weekday button in the selector bar to display a top micro-label showing `"오늘"` on the actual current weekday, `"수여"` when a daily star is claimable, or `"조정"` when that day has Weekly Overrides, so that I can spot important days at a glance.
4. As a child or parent, I want Saturday to be styled in blue and Sunday in red when unselected (and white on accent fill when selected), so that weekdays and weekends are visually distinct.
5. As a child or parent, I want each weekday button in the selector bar to display a bottom status indicator (awarded star icon, claimable sparkles icon, all-verified seal icon, all-child-completed checkmark icon, or progress/adjustment dot), so that I can see the completion and star status of every day of the week without clicking through each one.
6. As a child or parent, I want tapping a Mon–Fri slot in the Weekly Star Stamp Board card to also switch the selected weekday (and highlight the selected slot), so that the stamp board and the Daily Schedule list stay synchronized in both directions.
7. As a child or parent viewing a weekday other than actual today, I want a `"오늘"` (Back to Today) button to appear in the top action area, so that I can jump back to today's Daily Schedule with a single tap.
8. As a user opening or refreshing the web app, I want the selected weekday to always initialize to the actual current weekday, so that I immediately see today's tasks first.
9. As a user switching from the Today Schedule tab to the Weekly Schedule or Star Reward Shop tab and returning within the same session, I want my previously selected weekday to remain selected, so that I do not lose my place while cross-referencing tabs.
10. As a user keeping the web app open past midnight when the calendar date changes to a new day, I want the selected weekday to automatically advance to the new actual today weekday, so that the screen never stays stale on yesterday's schedule.
11. As a child or parent, I want the top Live Status Hero Card to always remain pinned to actual today's date, today's completion/verification stats, and today's real-time active/upcoming tasks regardless of which weekday is selected below, so that I never lose track of what is happening right now.
12. As a child or parent, I want the Live Status Hero Card to display my available Praise Heart count (opening the Heart Reward Redemption modal on click), a `"응원 보내기"` button, and the latest parent praise message banner inside the hero card, so that all real-time family motivation status lives in one cohesive header card.
13. As a child or parent, I want the Live Status Hero Card to show the currently active schedule item (`"지금 하는 일"`) with its time range and completion badge, as well as the next upcoming schedule item (`"다음 일정"`) for actual today, so that I immediately know what to do right now and what comes next.
14. As a child or parent, I want clicking the current or next schedule item inside the Live Status Hero Card to switch the selected weekday back to actual today and focus or open that item, so that I can act on it immediately.
15. As a child or parent, I want a horizontal Category Filter Bar (`전체` plus each schedule category with its icon/color and item count) below the weekday selector bar, so that I can filter the selected day's Daily Schedule by category (e.g. only study or academy items).
16. As a child or parent, I want the selected day's section header to display the full weekday name (e.g. `"수요일"`), a `"TODAY"` badge only when the selected day is actual today, and an `"이번주 조정 N건"` badge when that day has active Weekly Overrides, so that I always have clear context about the day I am viewing.
17. As a child or parent, I want the selected day's section header to display that specific day's child completion count (`아이 X/Y`) and parent verification count (`부모확인 X/Y`), so that I can track progress for any selected day independently of actual today.
18. As a child, I want to check or uncheck `"다 했어요"` on checkable schedule items and subtasks on any selected day of the current week (Mon–Sun), so that I can catch up on yesterday's missed checkmarks or record weekend study tasks.
19. As a parent, I want to stamp or unstamp parent verification seals and send Praise Hearts on checkable schedule items and subtasks for any selected day of the current week (Mon–Sun), so that I can review my child's completed work from earlier in the week.
20. As a child or parent, I want daily star earning (`+1⭐`) on the Weekly Star Stamp Board to work for any selected weekday (Mon–Fri) whose tasks are all verified by a parent, prioritizing the currently selected weekday when claimable, so that we can claim stars for any completed weekday in the current week.
21. As a child or parent viewing Saturday or Sunday with the Weekly Star Stamp Board expanded, I want to see a clear notice explaining that weekends are free schedule days excluded from weekday star earning, while still being able to check off and verify weekend schedule items.
22. As a child or parent, I want timeline schedule cards to display the live `"진행중"` badge and active highlight border only when viewing actual today and the current time falls within the item's time range, so that past or future days do not falsely appear as currently in progress.
23. As a parent or child, I want an orange batch-verification banner (`"아이가 '다 했어요' 체크한 숙제 N개가 부모님 확인을 기다리고 있어요!"`) with a `"모두 확인 + ❤️"` button to appear in the selected day's header whenever that day has child-completed items awaiting parent verification, so that a parent can verify all waiting tasks on that day and award 1 heart to each in one action.
24. As a parent or child, I want a `"초기화"` button to appear in the selected day's header whenever at least one item is completed on that day, so that completions and parent verifications for that specific weekday can be reset when needed.
25. As a parent or child, I want an orange Weekly Override summary banner to appear in the selected day's header whenever the current week has active adjustments, showing a `"원래대로"` button that lets me choose between resetting only the selected weekday's adjustments or resetting all adjustments across the entire week (Mon–Sun).
26. As a parent or child, I want each schedule card that has a Weekly Override on the selected day to display its adjustment badge (e.g. `"이번 주 추가 일정"`, `"이번 주 시간 조정"`, `"이번 주 요일·시간 조정"`) alongside an inline `"원래대로"` button for overridden Master Schedule items, so that individual adjustments can be reverted directly from the card.
27. As a parent or child viewing the excluded items section at the bottom of the selected day, I want to see both Master Schedule items that were skipped (`"이번 주 휴강·제외"`) AND Master Schedule items originally on that weekday that were moved to another weekday (`"이번 주 X요일 Y시(으)로 이동"`), each with a `"원래대로 복구"` button, so that I know why a regular item is missing from that day and can restore it.
28. As a parent or child viewing a selected day that has no active schedule items (or none matching the category filter), I want to see an empty-state card with an `"이번 주 일정 추가하기"` button (and still see the excluded/moved Master Schedule items section below it if any exist), so that I can add a temporary schedule item or restore skipped items for that day.
29. As a parent or child clicking the add schedule button from the Today Schedule tab, I want the Schedule Edit modal to default to the currently selected weekday (`selectedWeekday`) and the `'이번 주만 적용(thisWeek)'` scope, so that adding an item while viewing a specific day naturally adds it to that day for the current week.
30. As a user in Child Mode, I want protected parent actions (`"모두 확인 + ❤️"`, `"초기화"`, `"이번 주 조정 원래대로"`, individual override `"원래대로"`, excluded item `"원래대로 복구"`, `"응원 보내기"`, and `"+ 이번 주 추가"`) to remain visible on screen (with lock indicators where appropriate) and automatically prompt for the 6-digit Master PIN when clicked, immediately executing the requested action upon successful authentication without requiring a second click.

## Implementation Decisions

### 1. Domain Vocabulary & State Management
- **Canonical Term**: Use `일일 스케쥴 (Daily Schedule)` as defined in `GLOSSARY.md` to refer to the effective list of tasks for a specific weekday (`Mon–Sun`, `1..7`) of the current ISO-8601 week, combining the Master Schedule with active Weekly Overrides. Keep the UI tab label as `'오늘 스케쥴'` for user familiarity.
- **Selected Weekday Lifecycle**:
  - Track `selectedWeekday` (`1..7`) alongside `todayWeekday` (derived from the store's current date/time).
  - On initial app load or full page refresh, `selectedWeekday` initializes to `todayWeekday`.
  - Switching between top-level navigation tabs within the same session preserves `selectedWeekday`.
  - A periodic time/date check (and window focus/visibility check) detects when the calendar day rolls over past midnight; when `todayWeekday` changes, `selectedWeekday` automatically updates to the new `todayWeekday`.
- **Day-Agnostic Weekly Mutations**:
  - Child completion toggles (items and subtasks), parent verification stamps (single and batch), item reactions/Praise Hearts, per-day completion resets, and Weekly Override creation/reversion all operate on any `selectedWeekday` (`1..7`) within the current week key.
  - Daily star claiming (`+1⭐`) operates on any weekday (`1..5`) in the current week whose state is claimable; the Weekly Star Stamp Board prioritizes `selectedWeekday` first when determining the active claimable target.

### 2. Domain Store Queries & Helpers
- **Real-Time Today Queries**:
  - Provide queries for `currentActiveItems` (effective items on `todayWeekday` whose `[startMinutes, endMinutes)` range contains the current time of day) and `nextUpcomingItem` (the earliest effective item on `todayWeekday` whose `startMinutes` is strictly greater than the current time of day).
  - Provide `isCurrentlyActive(item)` which returns `true` **only** when `item.weekday === todayWeekday` and the current time falls within the item's start/end time range.
- **Per-Weekday Adjustment & Excluded Master Item Queries**:
  - Provide `getAdjustmentCountForWeekday(weekday)` counting active Weekly Overrides affecting `weekday` (master items originally on `weekday` that are skipped or modified, overridden items moved onto `weekday`, and temporary `thisWeek` items added on `weekday`).
  - Expand `getExcludedMasterItemsForThisWeek(weekday)` so it returns all Master Schedule items whose original `weekday` matches the target day and that are either:
    1. Skipped for this week (`isSkipped === true`), with reason text `"이번 주 휴강·제외"`, or
    2. Overridden to a different weekday (`overriddenItem.weekday !== weekday`), with reason text `"이번 주 {요일} {시간}(으)로 이동"`.
  - Provide `verifyAllWaitingItems(weekday, giveHeartToEach)` to stamp all child-completed, unverified checkable items (and their subtasks) on `weekday` and optionally add +1 heart reaction to each newly verified item.
  - Provide `resetCompletionsForWeekday(weekday, includeParentVerified)` to clear child completion and parent verification records for all items (and subtasks) on `weekday` for the current week.

### 3. UI Layout & Component Structure (1:1 Parity with Native App)
Order the sections inside the Today Schedule view from top to bottom as follows:
1. **Live Status Hero Card (Pinned to Actual Today)**:
   - Displays actual today's formatted date, available Praise Hearts button (opens Heart Reward Redemption modal), `"응원 보내기"` button, actual today's completion/verification stats and greeting slogan, the latest family praise note banner (if any), and real-time `"지금 하는 일"` (current active item) / `"다음 일정"` (next upcoming item) rows.
   - Tapping the current or next item in the hero card sets `selectedWeekday` to `todayWeekday` and opens/focuses that item.
   - Retains existing test identifiers (`progress-gauge-card`, `progress-percentage-text`, `progress-bar-fill`, `stats-completed-badge`, `stats-verified-badge`, `today-hero-reward-exchange-btn`, `family-praise-banner`, `send-family-praise-btn`) for backward compatibility with existing tests.
2. **Weekly Star Stamp Board Card**:
   - Passes `selectedWeekday` and wires `onTapWeekdaySlot` so tapping any Mon–Fri stamp slot updates `selectedWeekday`.
   - When expanded while Saturday (`6`) or Sunday (`7`) is selected, displays the weekend exclusion caption (`"주말(토·일)은 자유 일정으로 평일 스타 적립 대상에서 제외돼요."`).
3. **Mon–Sun Weekday Selector Bar & Top Quick Actions**:
   - Renders a 7-column equal-width grid (`월`~`일`) engineered to fit within a `375px` mobile viewport without horizontal scroll (respecting ADR-0003).
   - Each button renders 3 stacked rows:
     - Top micro-label: `"오늘"` if `day === todayWeekday`, else `"수여"` if star is claimable, else `"조정"` if `getAdjustmentCountForWeekday(day) > 0`, else a layout-preserving blank placeholder.
     - Middle label: short weekday name (`월`~`일`) with Saturday in blue and Sunday in red when unselected.
     - Bottom status indicator: star icon if awarded, sparkles icon if claimable, seal icon if all checkable items are parent-verified, check-circle icon if all checkable items are child-completed, or a status dot (completed > 0 or adjusted).
   - When `selectedWeekday !== todayWeekday`, displays a `"오늘"` button in the top action bar to immediately reset `selectedWeekday = todayWeekday`.
   - Provides a `"+ 이번 주 추가"` button that opens the Schedule Edit modal pre-configured with `defaultWeekday = selectedWeekday` and `initialScope = 'thisWeek'`.
4. **Category Filter Bar**:
   - Horizontal chip bar with `"전체"` and each schedule category (`study`, `academy`, `music`, `sports`, `routine`, `free`), filtering the displayed schedule items for `selectedWeekday`.
5. **Selected Day Section Header (`daySectionHeader`)**:
   - Displays the selected day's full name (e.g. `"월요일"`), `"TODAY"` badge (only when `selectedWeekday === todayWeekday`), and `"이번주 조정 N건"` badge (when > 0).
   - Displays `아이 completed/total`, `부모확인 verified/total`, and a `"초기화"` button (when `completed > 0`).
   - When the current week has any active Weekly Overrides, displays the orange adjustment summary banner with a `"원래대로"` button that opens a confirmation choice: revert only `selectedWeekday`'s adjustments or revert all adjustments for the entire week.
   - When `selectedWeekday` has waiting items (`completed > verified`), displays the orange waiting banner (`"아이가 '다 했어요' 체크한 숙제 N개가 부모님 확인을 기다리고 있어요!"`) with the `"모두 확인 + ❤️"` button.
6. **Timeline Schedule Cards List (or Empty State)**:
   - Displays cards for `selectedWeekday` (filtered by selected category).
   - Shows the live `"진행중"` badge and active highlight border on a card **only** when `store.isCurrentlyActive(item)` is true (`selectedWeekday === todayWeekday` and current time is within range).
   - For items modified by a Weekly Override, displays the adjustment badge and an inline `"원래대로"` button to revert that single item's override.
   - When no items match, displays the empty day state with an `"이번 주 일정 추가하기"` button.
7. **Excluded / Moved Master Items Section (`excludedItemsSection`)**:
   - Renders below the timeline list (or empty state) whenever `getExcludedMasterItemsForThisWeek(selectedWeekday)` is non-empty.
   - Lists both skipped items and items moved to another weekday, showing the reason badge (`"이번 주 휴강·제외"` or `"이번 주 X요일 Y시(으)로 이동"`), original time range, and a `"원래대로 복구"` button.

### 4. Child Mode Protected Action Delegation (`performParentAction`)
- Protected parent actions in the Today Schedule tab (`"모두 확인 + ❤️"`, `"초기화"`, `"이번 주 조정 원래대로"`, per-item `"원래대로"`, excluded item `"원래대로 복구"`, `"응원 보내기"`, `"+ 이번 주 추가"`) are rendered visibly in both Child Mode and Parent Mode.
- When clicked in Parent Mode, the action executes immediately.
- When clicked in Child Mode, the app opens the 6-digit Master PIN modal with a descriptive reason string and a pending callback; upon valid PIN entry, the pending callback executes immediately without requiring a second click.

## Testing Decisions

### What Makes a Good Test
Tests must assert observable behavior and domain state through public interfaces from the user's perspective, rather than internal component state or implementation details. Good tests render the view or exercise the store, simulate real user actions (clicking a weekday button, filtering by category, checking items on another day, clicking a protected parent action in Child Mode and entering the 6-digit PIN), and verify visible DOM updates and resulting store state.

### Modules to be Tested
1. **Primary UI Integration Seam (`TodayScheduleView` & `App`)**:
   - Rendering the 7-column Mon–Sun `WeekdaySelectorBar` with accurate top micro-labels (`오늘`, `수여`, `조정`) and bottom status indicators.
   - Switching `selectedWeekday` via both the `WeekdaySelectorBar` and `WeeklyStarStampBoardCard` slots, verifying that the schedule list and `daySectionHeader` update to the selected day while the top `LiveStatusHeroCard` stays pinned to actual today.
   - Visibility and behavior of the `"오늘"` (Back to Today) button and `"TODAY"` badge when switching between actual today and other weekdays.
   - Preserving `selectedWeekday` across tab navigation (`#today` ↔ `#weekly` / `#stars`) within a session.
   - Filtering items on the selected weekday via the `CategoryFilterBar`.
   - Checking off items/subtasks, stamping parent verifications, batch verifying with `"모두 확인 + ❤️"`, and resetting completions (`"초기화"`) on non-today weekdays (including weekends).
   - Displaying and restoring both skipped Master Schedule items and Master Schedule items moved to another weekday in the excluded items section, as well as resetting adjustments for the selected day vs. the entire week.
   - Executing protected parent actions from Child Mode by opening the Parent PIN modal, entering the 6-digit PIN, and verifying immediate execution of the pending action.
   - Displaying the `"진행중"` badge on a timeline row only when viewing actual today during the item's active time window.
2. **Secondary Domain Store Seam (`ScheduleStore`)**:
   - `selectedWeekday` initialization to `todayWeekday`, manual selection updates, and automatic rollover when the date changes across midnight.
   - `getCurrentActiveItems`, `getNextUpcomingItem`, and `isCurrentlyActive` (enforcing `item.weekday === todayWeekday`).
   - `getAdjustmentCountForWeekday(weekday)` and `getExcludedMasterItemsForThisWeek(weekday)` (covering both `isSkipped` and weekday-moved overrides with accurate reason strings).
   - `verifyAllWaitingItems(weekday, giveHeartToEach)` and `resetCompletionsForWeekday(weekday, includeParentVerified)`.

### Prior Art
- `web/src/components/TodayScheduleView.test.tsx`: component tests for checklist completion, parent verification protection, praise banners, and skipped items restoration.
- `web/src/components/WeeklyStarStampBoardCard.test.tsx`: component tests for weekday star states, slot interactions, and PIN-gated star claiming.
- `web/src/App.test.tsx`: full-app integration tests for tab routing, PIN modal authentication flows, and cross-view state synchronization.
- `web/src/domain/scheduleStore.test.ts`: domain unit tests for weekly overrides, completion keys, and snapshot synchronization.

## Out of Scope
- Browsing or editing schedules for past or future ISO-8601 weeks (both iOS and Web operate strictly on the current week's `일일 스케쥴` and `이번 주 조정`).
- Modifying the `CloudSyncSnapshot (v5)` wire schema (`selectedWeekday` is transient UI/session state, while all completions, verifications, hearts, stars, and weekly overrides already use the existing v5 schema).
- Redesigning the Weekly Grid tab (`WeeklyGridView`) or Print Layout modal.

## Further Notes
- All terminology strictly follows `GLOSSARY.md`, including the newly added `일일 스케쥴 (Daily Schedule)` definition.
- Complies with ADR-0001 (Web PWA & Cloud Sync Snapshot v5 parity), ADR-0002 (Proxy Sync Architecture), and ADR-0003 (Mobile Viewport Lock & 375px no-horizontal-overflow constraint).
