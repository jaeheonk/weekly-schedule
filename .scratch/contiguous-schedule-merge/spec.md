# Spec: 시간 슬롯 통합 블록 및 연속 일정 병합 표시 (Spanned Time Block & Merged Contiguous Schedule)

Status: ready-for-agent

## Problem Statement

주간 시간표 및 인쇄 미리보기 화면에서 다음과 같은 두 가지 원인으로 인해 원래 하나의 활동이어야 할 일정이 여러 개의 셀로 쪼개져 중복 표시되는 사용자 경험 문제가 발생한다:

1. **다른 요일 일정으로 인한 시간 슬롯 분할 현상**:
   주간 인쇄 표는 월~일 7개 요일의 모든 일정 시작 시각을 취합하여 공통 시간 슬롯(행)을 생성한다. 이로 인해 특정 요일의 단일 일정(예: 수요일 `학교 축구 15:00~17:00`, 일요일 `오케스트라 연습 16:00~17:30`, 특정 요일의 `취침 22:00~23:00`)이 다른 요일의 일정 시작 시각(예: 16:00, 17:00, 22:30)을 지나게 되면 해당 일정이 2개 이상의 시간 슬롯으로 분할된다.
   그런데 기존 레이아웃 엔진의 슬롯 병합 정책(`shouldMergeAcrossSlots`)이 3칸 이상, 자유시간 카테고리, 할 일 3개 이상, 주말 2시간 이상 등 지나치게 엄격하게 제한되어 있어, 일반 과목·운동·취침 등의 2슬롯 일정은 병합되지 못하고 각 슬롯마다 중복 셀(첫 번째는 제목, 두 번째는 `(~종료시각)` 표시)로 쪼개져 나타난다.

2. **데이터상 실제로 연속된 동일 일정의 중복 표시**:
   사용자가 동일한 요일에 연속되는 시간(간격 0분)으로 동일한 제목과 카테고리의 일정을 별개의 항목으로 등록한 경우(예: 22:00~22:30 취침, 22:30~23:00 취침), 화면 및 인쇄 표에서 각각 별도의 카드로 표시되어 시각적 피로감을 유발한다.

## Solution

1. **시간 슬롯 통합 블록 (Spanned Time Block) 병합 조건 전면 완화**:
   인쇄 레이아웃 및 주간 테이블 렌더링 시, 단일 일정이 다른 요일의 시간 경계로 인해 2개 이상의 시간 슬롯에 걸치게 되는 경우, 카테고리·요일·소요 시간 제한 없이 항상 하나의 확장된 셀(`spanCount` / `rowspan`)로 결합하여 표시한다.
2. **연속 동일 일정 가상 병합 (Merged Contiguous Schedule)**:
   동일한 요일에서 시간 간격이 0분으로 정확히 이어지고 제목(공백 제외)과 카테고리가 일치하는 복수의 일정이 존재하는 경우, 데이터 원본은 안전하게 보존하면서 화면 및 인쇄 표 렌더링 시점에 하나의 통합 일정 블록으로 가상 병합하여 표시한다.
3. **플랫폼 일관성 보장**:
   웹(React/TypeScript)과 iOS/macOS(SwiftUI) 인쇄 및 주간 뷰 엔진에 동일한 규칙을 적용하여 모든 기기에서 일관된 시각적 결과물을 제공한다.

## User Stories

1. As a child or parent viewing the A4 print preview, I want single schedules that span across another day's time boundary (e.g. Wednesday School Soccer 15:00~17:00) to appear as a single unified cell, so that the activity does not look split into two confusing blocks.
2. As a child or parent viewing the A4 print preview, I want bedtime (취침) to render as one clean cell even if other days have earlier or later sleep times, so that our evening routine is clearly visible as a continuous rest block.
3. As a child or parent viewing the A4 print preview, I want 90-minute music lessons or practices (e.g. Sunday Orchestra 16:00~17:30) to merge across intermediate hour marks without being cut in half, so that lesson blocks remain clean and legible.
4. As a child or parent viewing the weekly schedule or print sheet, I want two consecutively scheduled items with the same title and category (e.g. Study 14:00~15:00 and Study 15:00~16:00) to display as one continuous 2-hour block (14:00~16:00), so that redundant schedule cards do not clutter the timeline.
5. As a parent printing the weekly schedule for the refrigerator, I want all spanned blocks in the table to display with appropriate multi-row height and single clear title typography, so that no unwanted "(~17:00)" continuation lines crowd the printable page.
6. As a user on iOS or macOS, I want the native print preview sheet to render identical spanned blocks to the web app, so that printing from a Mac or iPhone yields the exact same clean single-page schedule.
7. As a user toggling the "긴 일정 블록 병합 (mergeLongBlocks)" print option, I want disabling the toggle to show individual slots and enabling it to cleanly merge all spanned blocks, so that I retain full control over table density.
8. As a child or parent checking completion or notes on merged items, I want notes and subtasks from merged contiguous items to be cleanly aggregated, so that no task details are lost upon visual merging.

## Implementation Decisions

### 1. Presentation-Layer Virtual Grouping (No Data Migration)
- Store and Cloud Sync Snapshot models remain unchanged to maintain 100% backward compatibility and prevent synchronization conflicts across devices.
- Merging is computed dynamically at the view/presentation layout layer.

### 2. Spanned Time Block Decision (`shouldMergeAcrossSlots`)
- Remove arbitrary heuristics requiring `spannedSlotCount >= 3`, `category == 'free'`, `subTasks >= 3`, or `duration >= 120`.
- Whenever `mergeLongBlocks` is active, any schedule item that spans across 2 or more slots (`spannedSlotCount >= 2`) is merged into a single `DayCellBlock` with `spanCount = totalSpannedSlots` and `isHighlightedSpanBlock = true`.

### 3. Contiguous Schedule Items Preprocessing
- Implement a pure domain helper that scans chronological items within a weekday:
  - If item B immediately follows item A (`A.endTotalMinutes === B.startTotalMinutes`), and `A.title.trim() === B.title.trim()` and `A.category === B.category`, they are combined into a single virtual item spanning `[A.start, B.end]`.
  - Notes are combined with a line break, and subtasks are concatenated in sequence.
- Feed the preprocessed items into the table slot generator and block builder.

### 4. Cross-Platform Parity
- Apply identical domain logic in TypeScript (`web/src/domain/printLayout.ts`) and Swift (`WeeklyScheduleApp/Views/SchedulePrintPreviewSheet.swift`).

## Testing Decisions

- **Good Test Principle**: Tests must verify external presentation behavior (e.g., that a 2-hour or multi-slot item on a given weekday results in exactly one `DayCellBlock` with `spanCount === 2` and zero continuation subtitle blocks), rather than private implementation details.
- **Modules Tested**:
  - `web/src/domain/printLayout.ts` via `web/src/domain/printLayout.test.ts`
  - `web/src/components/SchedulePrintModal.tsx` via `web/src/components/SchedulePrintModal.test.tsx`
- **Prior Art**:
  - Existing `printLayout.test.ts` tests for slot calculation and `mergeLongBlocks`.

## Out of Scope

- Permanent database consolidation or destructive schema updates to existing `ScheduleItem` records in CloudSyncSnapshot.
- Merging across different weekdays (schedules spanning past midnight into the next day).
- Merging items that have gaps between them (even 5-minute intervals).

## Further Notes

- Domain terms `시간 슬롯 통합 블록 (Spanned Time Block)` and `연속 일정 병합 (Merged Contiguous Schedule)` have been formally registered in `GLOSSARY.md`.
