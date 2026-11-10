import Foundation

// MARK: - Test Assertions
func assertTrue(_ condition: @autoclosure () -> Bool, _ message: String = "", file: StaticString = #file, line: UInt = #line) {
    if !condition() {
        print("❌ FAIL at \(file):\(line): \(message)")
        exit(1)
    }
}

func assertFalse(_ condition: @autoclosure () -> Bool, _ message: String = "", file: StaticString = #file, line: UInt = #line) {
    if condition() {
        print("❌ FAIL at \(file):\(line): \(message)")
        exit(1)
    }
}

func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String = "", file: StaticString = #file, line: UInt = #line) {
    if actual != expected {
        print("❌ FAIL at \(file):\(line): expected [\(expected)], got [\(actual)]. \(message)")
        exit(1)
    }
}

// MARK: - Seam 1 Tests: SchedulePrintHelper Pure Domain Logic
func runSeam1Tests() {
    print("Running Seam 1: SchedulePrintHelper tests...")

    // 1. shouldMergeAcrossSlots tests
    let soccerItem = ScheduleItem(
        weekday: .wednesday,
        startHour: 15,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        title: "학교 축구",
        category: .sports
    )

    let bedtimeItem = ScheduleItem(
        weekday: .monday,
        startHour: 22,
        startMinute: 0,
        endHour: 23,
        endMinute: 0,
        title: "취침",
        category: .routine
    )

    let studyItem = ScheduleItem(
        weekday: .tuesday,
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 30,
        title: "수학 공부",
        category: .study
    )

    // When mergeLongBlocks is true and spannedSlotCount >= 2, should always return true
    assertTrue(SchedulePrintHelper.shouldMergeAcrossSlots(item: soccerItem, spannedSlotCount: 2, mergeLongBlocks: true), "2-slot sports item must merge")
    assertTrue(SchedulePrintHelper.shouldMergeAcrossSlots(item: bedtimeItem, spannedSlotCount: 2, mergeLongBlocks: true), "2-slot bedtime item must merge")
    assertTrue(SchedulePrintHelper.shouldMergeAcrossSlots(item: studyItem, spannedSlotCount: 2, mergeLongBlocks: true), "2-slot study item must merge")

    // When mergeLongBlocks is false, must return false even if spannedSlotCount >= 2
    assertFalse(SchedulePrintHelper.shouldMergeAcrossSlots(item: soccerItem, spannedSlotCount: 2, mergeLongBlocks: false), "Must not merge when mergeLongBlocks is false")
    assertFalse(SchedulePrintHelper.shouldMergeAcrossSlots(item: soccerItem, spannedSlotCount: 3, mergeLongBlocks: false), "Must not merge 3 slots when mergeLongBlocks is false")

    // When spannedSlotCount <= 1, must return false
    assertFalse(SchedulePrintHelper.shouldMergeAcrossSlots(item: soccerItem, spannedSlotCount: 1, mergeLongBlocks: true), "1-slot item must not merge")
    assertFalse(SchedulePrintHelper.shouldMergeAcrossSlots(item: soccerItem, spannedSlotCount: 0, mergeLongBlocks: true), "0-slot item must not merge")

    // 2. canMergeContiguous tests
    let itemA = ScheduleItem(
        weekday: .monday,
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        title: "수학 숙제",
        category: .study
    )

    let itemB = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "수학 숙제",
        category: .study
    )

    let itemBWithSpaces = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "  수학 숙제  ",
        category: .study
    )

    assertTrue(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: itemB), "Exact matching contiguous items should be mergeable")
    assertTrue(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: itemBWithSpaces), "Contiguous items matching trimmed title should be mergeable")

    // Gap of 5 minutes
    let gappedItem = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 5,
        endHour: 16,
        endMinute: 5,
        title: "수학 숙제",
        category: .study
    )
    assertFalse(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: gappedItem), "Items with 5-minute gap must not merge")

    // Different title
    let englishItem = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "영어 숙제",
        category: .study
    )
    assertFalse(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: englishItem), "Items with different titles must not merge")

    // Different category
    let freeItem = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "수학 숙제",
        category: .free
    )
    assertFalse(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: freeItem), "Items with different categories must not merge")

    // Different weekday
    let tuesdayItem = ScheduleItem(
        weekday: .tuesday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "수학 숙제",
        category: .study
    )
    assertFalse(SchedulePrintHelper.canMergeContiguous(prev: itemA, next: tuesdayItem), "Items on different weekdays must not merge")

    // 3. mergeContiguousItems tests
    var noteItemA = itemA
    noteItemA.note = "문제집 10~15p"
    noteItemA.subTasks = [SubTask(title: "1단계 기본")]

    var noteItemB = itemB
    noteItemB.note = "오답 노트 정리"
    noteItemB.subTasks = [SubTask(title: "2단계 심화")]

    let merged = SchedulePrintHelper.mergeContiguousItems([noteItemA, noteItemB])
    assertEqual(merged.count, 1, "Two contiguous items should merge into 1")
    assertEqual(merged[0].startHour, 14, "Merged startHour")
    assertEqual(merged[0].startMinute, 0, "Merged startMinute")
    assertEqual(merged[0].endHour, 16, "Merged endHour")
    assertEqual(merged[0].endMinute, 0, "Merged endMinute")
    assertEqual(merged[0].title, "수학 숙제", "Merged title")
    assertEqual(merged[0].note, "문제집 10~15p\n오답 노트 정리", "Notes joined with newline")
    assertEqual(merged[0].subTasks.count, 2, "Subtasks concatenated")
    assertEqual(merged[0].subTasks.map { $0.title }, ["1단계 기본", "2단계 심화"])

    // 3 items chaining test (13:00~14:00, 14:00~15:00, 15:00~16:00)
    let item1 = ScheduleItem(weekday: .thursday, startHour: 13, startMinute: 0, endHour: 14, endMinute: 0, title: "자율 학습", category: .study)
    let item2 = ScheduleItem(weekday: .thursday, startHour: 14, startMinute: 0, endHour: 15, endMinute: 0, title: "자율 학습", category: .study)
    let item3 = ScheduleItem(weekday: .thursday, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, title: "자율 학습", category: .study)

    let chainedMerged = SchedulePrintHelper.mergeContiguousItems([item1, item2, item3])
    assertEqual(chainedMerged.count, 1, "3 contiguous items should chain-merge into 1")
    assertEqual(chainedMerged[0].startHour, 13)
    assertEqual(chainedMerged[0].endHour, 16)
    assertEqual(chainedMerged[0].durationMinutes, 180)

    // Non-mergeable list returns both
    let nonMergeList = SchedulePrintHelper.mergeContiguousItems([itemA, gappedItem])
    assertEqual(nonMergeList.count, 2, "Items with gap should remain 2")

    print("✅ Seam 1 tests passed!")
}

// MARK: - Seam 2 Tests: Presentation & Table Column Block Building
func runSeam2Tests() {
    print("Running Seam 2: Presentation & Column Block Builder tests...")

    // Scenario 1: Wednesday Soccer 15:00~17:00 spanning across a 16:00 slot created by Sunday Orchestra 16:00~17:30
    let soccer = ScheduleItem(
        weekday: .wednesday,
        startHour: 15,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        title: "학교 축구",
        category: .sports
    )

    let orchestra = ScheduleItem(
        weekday: .sunday,
        startHour: 16,
        startMinute: 0,
        endHour: 17,
        endMinute: 30,
        title: "오케스트라 연습",
        category: .music
    )

    let items = [soccer, orchestra]
    let slots = SchedulePrintHelper.generateTimeSlots(for: items)

    // Verify time slots contain both 15:00 and 16:00
    assertTrue(slots.contains { $0.hour == 15 && $0.minute == 0 }, "Slots must contain 15:00")
    assertTrue(slots.contains { $0.hour == 16 && $0.minute == 0 }, "Slots must contain 16:00")

    // With mergeLongBlocks = true:
    let mergedBlocks = SchedulePrintHelper.buildColumnBlocks(
        for: .wednesday,
        items: items,
        slots: slots,
        mergeLongBlocks: true
    )

    // Find block starting at 15:00
    let soccerBlock = mergedBlocks.first { $0.slot.hour == 15 && $0.slot.minute == 0 }
    assertTrue(soccerBlock != nil, "Should find block at 15:00")
    assertEqual(soccerBlock?.spanCount, 2, "Soccer block must span across 2 slots (15:00 and 16:00)")
    assertEqual(soccerBlock?.isHighlightedSpanBlock, true, "Soccer block must be marked as highlighted span block")
    assertEqual(soccerBlock?.items.first?.title, "학교 축구")

    // There should NOT be an active block starting at 16:00 for Wednesday since it was absorbed
    let soccer1600Block = mergedBlocks.first { $0.slot.hour == 16 && $0.slot.minute == 0 }
    assertTrue(soccer1600Block == nil, "16:00 slot must be absorbed by the 15:00 spanned block")

    // With mergeLongBlocks = false:
    let unmergedBlocks = SchedulePrintHelper.buildColumnBlocks(
        for: .wednesday,
        items: items,
        slots: slots,
        mergeLongBlocks: false
    )

    let unmerged1500 = unmergedBlocks.first { $0.slot.hour == 15 && $0.slot.minute == 0 }
    let unmerged1600 = unmergedBlocks.first { $0.slot.hour == 16 && $0.slot.minute == 0 }
    assertTrue(unmerged1500 != nil, "Unmerged 15:00 block must exist")
    assertTrue(unmerged1600 != nil, "Unmerged 16:00 block must exist as continuation")
    assertEqual(unmerged1500?.spanCount, 1, "Unmerged 15:00 must have span 1")
    assertEqual(unmerged1600?.spanCount, 1, "Unmerged 16:00 must have span 1")
    assertEqual(unmerged1500?.isHighlightedSpanBlock, false, "Must not be highlighted span block")
    assertEqual(unmerged1600?.isHighlightedSpanBlock, false, "Must not be highlighted span block")

    // Scenario 2: Two contiguous Monday study items (14:00~15:00 and 15:00~16:00)
    let mathA = ScheduleItem(
        weekday: .monday,
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        title: "수학 숙제",
        note: "교재 20p",
        category: .study,
        subTasks: [SubTask(title: "단원평가")]
    )

    let mathB = ScheduleItem(
        weekday: .monday,
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        title: "수학 숙제",
        note: "오답 풀이",
        category: .study,
        subTasks: [SubTask(title: "복습")]
    )

    // Preprocessing with mergeContiguousItems
    let preprocessed = SchedulePrintHelper.mergeContiguousItems([mathA, mathB])
    assertEqual(preprocessed.count, 1, "Preprocessed items should have merged into 1 virtual item")

    let mathSlots = SchedulePrintHelper.generateTimeSlots(for: preprocessed)
    // 14:00 is in slots, but 15:00 slot is NOT created by these items (since base slot at 15:00 exists, let's test building blocks)
    let mondayBlocks = SchedulePrintHelper.buildColumnBlocks(
        for: .monday,
        items: preprocessed,
        slots: mathSlots,
        mergeLongBlocks: true
    )

    let mathBlock = mondayBlocks.first { $0.slot.hour == 14 && $0.slot.minute == 30 || $0.slot.hour == 14 && $0.slot.minute == 0 }
    assertTrue(mathBlock != nil, "Must find merged math block starting at 14:00")
    assertEqual(mathBlock?.items.first?.endHour, 16, "Virtual merged item covers up to 16:00")
    assertEqual(mathBlock?.items.first?.note, "교재 20p\n오답 풀이")
    assertEqual(mathBlock?.items.first?.subTasks.count, 2)

    // Scenario 3: Bedtime (22:00~23:00) spanning across base 22:30 slot
    let bedtime = ScheduleItem(
        weekday: .thursday,
        startHour: 22,
        startMinute: 0,
        endHour: 23,
        endMinute: 0,
        title: "취침",
        category: .routine
    )

    let bedtimeSlots = SchedulePrintHelper.generateTimeSlots(for: [bedtime])
    assertTrue(bedtimeSlots.contains { $0.hour == 22 && $0.minute == 0 })
    assertTrue(bedtimeSlots.contains { $0.hour == 22 && $0.minute == 30 })

    let bedtimeBlocks = SchedulePrintHelper.buildColumnBlocks(
        for: .thursday,
        items: [bedtime],
        slots: bedtimeSlots,
        mergeLongBlocks: true
    )

    let thursdayBedtimeBlock = bedtimeBlocks.first { $0.slot.hour == 22 && $0.slot.minute == 0 }
    assertTrue(thursdayBedtimeBlock != nil, "Must find bedtime block at 22:00")
    assertEqual(thursdayBedtimeBlock?.spanCount, 2, "Bedtime must span across 2 slots (22:00 and 22:30)")
    assertEqual(thursdayBedtimeBlock?.isHighlightedSpanBlock, true, "Bedtime block must be merged and highlighted")

    print("✅ Seam 2 tests passed!")
}

// MARK: - Main Runner
@main
struct TestRunner {
    static func main() {
        runSeam1Tests()
        runSeam2Tests()
    }
}
