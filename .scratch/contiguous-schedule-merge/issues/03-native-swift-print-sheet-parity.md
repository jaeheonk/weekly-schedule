# 03: iOS / macOS 네이티브 인쇄 미리보기(SchedulePrintPreviewSheet.swift) 1:1 패리티

**What to build:**
Web 인쇄 엔진에 적용된 시간 슬롯 통합 블록(`Spanned Time Block`) 및 연속 동일 일정 가상 병합(`Merged Contiguous Schedule`) 규칙을 iOS/macOS 네이티브 앱의 `WeeklyScheduleApp/Views/SchedulePrintPreviewSheet.swift`에도 1:1로 동일하게 적용하여, Apple 생태계(Mac, iPhone, iPad) 인쇄 미리보기에서도 일정 쪼개짐 없는 완벽한 A4 단일 페이지 시간표가 출력되도록 보장한다.

**Blocked by:** 01: 시간 슬롯 통합 블록(Spanned Time Block) 병합 조건 전면 완화 및 인쇄 엔진 개선, 02: 연속 동일 일정 가상 병합(Merged Contiguous Schedule) 헬퍼 및 뷰 적용

**Status:** resolved

- [x] `WeeklyScheduleApp/Views/SchedulePrintPreviewSheet.swift`의 `shouldMergeAcrossSlots(item:spannedSlotCount:)` 메서드에서 제한적 조건(`spannedSlotCount >= 3`, `category == .free`, `subTasks.count >= 3`, `duration >= 120`)을 전면 제거한다.
- [x] `mergeLongBlocks`가 활성화되어 있을 때 2개 이상의 슬롯에 걸친 일정(`spannedSlotCount >= 2`)은 카테고리와 요일에 관계없이 항상 `true`를 반환하여 단일 확장 셀로 통합한다.
- [x] Swift 인쇄 모델에도 연속 동일 일정 가상 병합 헬퍼(`mergeContiguousItems`)를 구현하여, 요일·제목·카테고리가 일치하고 시간 간격이 0분인 연속 일정이 인쇄 표 블록 생성 시 단일 항목으로 처리되도록 연동한다.
- [x] Xcode 빌드 타입체크 및 기존 네이티브 앱 동작에 부작용이 없음을 확인한다.
