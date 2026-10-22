import SwiftUI

struct WeeklyGridView: View {
    @EnvironmentObject var store: ScheduleStore
    @State private var gridScope: ScheduleEditScope = .master
    @State private var isCompactMode: Bool = false
    @State private var editingItem: ScheduleItem? = nil
    @State private var addingSlot: (weekday: Weekday, hour: Int, minute: Int)? = nil
    @State private var showingPrintSheet: Bool = false

    struct TimeSlot: Identifiable, Hashable {
        let hour: Int
        let minute: Int
        var id: Int { hour * 60 + minute }
        var totalMinutes: Int { hour * 60 + minute }

        var label: String {
            ScheduleItem.formatCompactTime(hour: hour, minute: minute)
        }
    }

    private var activeGridItems: [ScheduleItem] {
        gridScope == .master ? store.masterItems : store.effectiveItems
    }

    /// 기본 시간표의 14개 핵심 시간대 + 사용자가 새로 추가한 일정의 시작 시간대를 자동 병합
    private var timeSlots: [TimeSlot] {
        let baseSlots: [(Int, Int)] = [
            (7, 0),
            (9, 30),
            (10, 30),
            (12, 0),
            (13, 30),
            (14, 30),
            (15, 0),
            (16, 0),
            (17, 0),
            (18, 0),
            (19, 0),
            (20, 0),
            (21, 30),
            (22, 30)
        ]

        var set = Set<TimeSlot>(baseSlots.map { TimeSlot(hour: $0.0, minute: $0.1) })
        for item in activeGridItems {
            set.insert(TimeSlot(hour: item.startHour, minute: item.startMinute))
        }
        // 시작하거나 진행 중인 일정이 있는 시간대만 표시합니다.
        return set.filter { slot in
            activeGridItems.contains { item in
                item.startTotalMinutes == slot.totalMinutes ||
                    (item.startTotalMinutes < slot.totalMinutes && item.endTotalMinutes > slot.totalMinutes)
            }
        }
        .sorted { $0.totalMinutes < $1.totalMinutes }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 0. 전체 스케줄 변경 vs 이번 주 조정 반영 보기 전환 바
                scopeModeSwitchBar

                // 1. 상단 카테고리 범례 + 동기화 스위치
                legendHeaderBar

                GeometryReader { geo in
                    let timeColumnWidth: CGFloat = isCompactMode ? 52 : 68
                    let availableWidth = max(260, geo.size.width - timeColumnWidth - 16)
                    let dayColumnWidth: CGFloat = isCompactMode ? (availableWidth / 7.0) : 118

                    ScrollView(.vertical, showsIndicators: true) {
                        ScrollView(.horizontal, showsIndicators: !isCompactMode) {
                            VStack(spacing: 0) {
                                // 요일 헤더 행
                                headerRow(timeColumnWidth: timeColumnWidth, dayColumnWidth: dayColumnWidth)

                                mergedGrid(timeColumnWidth: timeColumnWidth, dayColumnWidth: dayColumnWidth)
                            }
                            .background(Color(.systemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color(.separator), lineWidth: 0.8)
                            )
                            .padding(8)
                        }
                    }
                    .refreshable {
                        await store.syncNow(forceUploadIfEmpty: false)
                    }
                    .background(Color(.systemGroupedBackground))
                }
            }
            .navigationTitle("주간 시간표")
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .appLeading) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isCompactMode.toggle()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: isCompactMode ? "arrow.up.left.and.arrow.down.right" : "rectangle.compress.vertical")
                            Text(isCompactMode ? "크게 보기" : "한눈에 보기")
                        }
                        .font(.caption.weight(.semibold))
                    }
                }

                ToolbarItem(placement: .appTrailing) {
                    HStack(spacing: 10) {
                        Button {
                            showingPrintSheet = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "printer.fill")
                                Text("1페이지 출력")
                            }
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Color.accentColor.opacity(0.14))
                            .foregroundStyle(Color.accentColor)
                            .clipShape(Capsule())
                        }

                        Button {
                            addingSlot = (store.selectedWeekday, 15, 0)
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                        }
                    }
                }
            }
            .sheet(item: $editingItem) { item in
                ScheduleEditSheet(
                    mode: .edit(item),
                    defaultWeekday: item.weekday,
                    initialScope: gridScope
                )
            }
            .sheet(
                isPresented: Binding(
                    get: { addingSlot != nil },
                    set: { if !$0 { addingSlot = nil } }
                )
            ) {
                if let slot = addingSlot {
                    ScheduleEditSheet(
                        mode: .add,
                        defaultWeekday: slot.weekday,
                        initialStartHour: slot.hour,
                        initialStartMinute: slot.minute,
                        initialScope: gridScope
                    )
                }
            }
            .sheet(isPresented: $showingPrintSheet) {
                SchedulePrintPreviewSheet()
            }
        }
    }

    private var scopeModeSwitchBar: some View {
        let adjustmentCount = store.currentWeekAdjustmentCount

        return VStack(spacing: 6) {
            HStack(spacing: 8) {
                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        gridScope = .master
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "calendar")
                            .font(.caption.weight(.bold))
                        Text("전체 기본 시간표 (매주 변경)")
                            .font(.caption.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(gridScope == .master ? Color.indigo : Color(.tertiarySystemFill))
                    .foregroundStyle(gridScope == .master ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                }
                .buttonStyle(.plain)

                Button {
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                        gridScope = .thisWeek
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "calendar.badge.clock")
                            .font(.caption.weight(.bold))
                        Text(adjustmentCount > 0 ? "이번 주 시간표 (조정 \(adjustmentCount)건)" : "이번 주 적용 시간표")
                            .font(.caption.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(gridScope == .thisWeek ? Color.orange : Color(.tertiarySystemFill))
                    .foregroundStyle(gridScope == .thisWeek ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 6) {
                Image(systemName: gridScope == .master ? "info.circle.fill" : "sparkles")
                    .font(.system(size: 10))
                    .foregroundStyle(gridScope == .master ? .indigo : .orange)
                Text(
                    gridScope == .master
                        ? "칸을 탭하면 매주 반복되는 전체 기본 스케줄이 영구적으로 변경됩니다."
                        : "이번 주에만 일시 조정된 시간표입니다. (다음 주 월요일 원래대로 자동 복구)"
                )
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)

                Spacer()

                if adjustmentCount > 0 {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            store.resetThisWeekAdjustments(for: nil)
                        }
                    } label: {
                        Text("이번주 조정 초기화")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.orange)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(Color(.secondarySystemGroupedBackground))
    }

    private var legendHeaderBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                Button {
                    Task {
                        await store.syncNow(forceUploadIfEmpty: true)
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: store.isSyncing ? "arrow.triangle.2.circlepath" : "icloud.fill")
                            .font(.caption2)
                        Text(store.isSyncing ? "동기화 중" : "실시간 동기화")
                            .font(.caption2.weight(.bold))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.12))
                    .foregroundStyle(.blue)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                Divider()
                    .frame(height: 12)

                HStack(spacing: 3) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                    Text("아이 체크")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 3) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                    Text("부모 확인")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Divider()
                    .frame(height: 12)

                ForEach(ScheduleCategory.allCases) { category in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(category.color)
                            .frame(width: 8, height: 8)
                        Text(category.title)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 8)

                Text(gridScope == .master ? "칸을 탭하여 전체 시간표 변경" : "칸을 탭하여 이번 주만 조정")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
        }
        .background(Color(.secondarySystemGroupedBackground))
    }

    private func headerRow(timeColumnWidth: CGFloat, dayColumnWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            Text("시간")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: timeColumnWidth, height: 38)
                .background(Color(.secondarySystemBackground))
                .overlay(Rectangle().stroke(Color(.separator).opacity(0.5), lineWidth: 0.4))

            ForEach(Weekday.allCases) { day in
                let isToday = day == store.todayWeekday
                HStack(spacing: 3) {
                    Text(isCompactMode ? day.shortName : day.fullName)
                        .font(isCompactMode ? .caption.weight(.bold) : .subheadline.weight(.bold))
                        .foregroundStyle(
                            isToday ? Color.accentColor :
                            (day == .sunday ? Color.red : (day == .saturday ? Color.blue : Color.primary))
                        )
                    if isToday && !isCompactMode {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 6, height: 6)
                    }
                }
                .frame(width: dayColumnWidth, height: 38)
                .background(isToday ? Color.accentColor.opacity(0.12) : Color(.secondarySystemBackground))
                .overlay(Rectangle().stroke(Color(.separator).opacity(0.5), lineWidth: 0.4))
            }
        }
    }

    private struct GridPlacement: Identifiable {
        let item: ScheduleItem
        let startRow: Int
        let rowCount: Int
        let lane: Int
        var id: UUID { item.id }
    }

    // 같은 일정은 한 번만 배치하고, 겹치는 일정은 별도 열에 놓습니다.
    private func placements(for day: Weekday, slots: [TimeSlot]) -> [GridPlacement] {
        let items = activeGridItems.filter { $0.weekday == day }.sorted {
            if $0.startTotalMinutes == $1.startTotalMinutes {
                return $0.id.uuidString < $1.id.uuidString
            }
            return $0.startTotalMinutes < $1.startTotalMinutes
        }
        var laneEnds: [Int] = []
        var result: [GridPlacement] = []
        for item in items {
            guard let start = slots.firstIndex(where: { $0.totalMinutes == item.startTotalMinutes }) else { continue }
            let end = slots.firstIndex(where: { $0.totalMinutes >= item.endTotalMinutes }) ?? slots.count
            let endRow = max(start + 1, end)
            let lane = laneEnds.firstIndex(where: { $0 <= start }) ?? laneEnds.count
            if lane == laneEnds.count {
                laneEnds.append(endRow)
            } else {
                laneEnds[lane] = endRow
            }
            result.append(GridPlacement(item: item, startRow: start, rowCount: endRow - start, lane: lane))
        }
        return result
    }

    private func mergedGrid(timeColumnWidth: CGFloat, dayColumnWidth: CGFloat) -> some View {
        let slots = timeSlots
        let rowHeight: CGFloat = isCompactMode ? 60 : 100
        return HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                ForEach(slots) { slot in
                    Text(slot.label)
                        .font(.system(size: isCompactMode ? 9 : 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: timeColumnWidth, height: rowHeight)
                        .background(Color(.secondarySystemBackground).opacity(0.6))
                        .overlay(Rectangle().stroke(Color(.separator).opacity(0.4), lineWidth: 0.4))
                }
            }
            ForEach(Weekday.allCases) { day in
                let cards = placements(for: day, slots: slots)
                let laneCount = (cards.map(\.lane).max() ?? 0) + 1
                let laneWidth = dayColumnWidth / CGFloat(laneCount)
                ZStack(alignment: .topLeading) {
                    VStack(spacing: 0) {
                        ForEach(slots) { slot in
                            Color.clear
                                .frame(width: dayColumnWidth, height: rowHeight)
                                .contentShape(Rectangle())
                                .onTapGesture { addingSlot = (day, slot.hour, slot.minute) }
                                .overlay(Rectangle().stroke(Color(.separator).opacity(0.4), lineWidth: 0.4))
                        }
                    }
                    ForEach(cards) { card in
                        gridCellItemView(item: card.item)
                            .frame(width: laneWidth - 6, height: CGFloat(card.rowCount) * rowHeight - 6)
                            .offset(x: CGFloat(card.lane) * laneWidth + 3, y: CGFloat(card.startRow) * rowHeight + 3)
                    }
                }
                .frame(width: dayColumnWidth, height: CGFloat(slots.count) * rowHeight, alignment: .topLeading)
                .background(day == store.todayWeekday ? Color.accentColor.opacity(0.03) : Color.clear)
            }
        }
    }

    private func gridCellItemView(item: ScheduleItem) -> some View {
        let isCompleted = store.isCompleted(item)
        let isParentVerified = store.isParentVerified(item)
        let isActive = store.isCurrentlyActive(item)
        let isSkippedInThisWeek = gridScope == .master && store.isSkippedThisWeek(item.id)
        let hasThisWeekMod = gridScope == .master
            ? store.hasThisWeekOverride(for: item.id)
            : store.isAdjustedThisWeek(item)

        return Button {
            editingItem = item
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 3) {
                    if isParentVerified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: isCompactMode ? 8 : 10))
                            .foregroundStyle(.green)
                    } else if isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: isCompactMode ? 8 : 10))
                            .foregroundStyle(.blue)
                    } else if !isCompactMode {
                        Image(systemName: item.iconName)
                            .font(.system(size: 9))
                            .foregroundStyle(item.category.color)
                    }

                    Text(item.title)
                        .font(.system(size: isCompactMode ? 9.5 : 11.5, weight: .bold))
                        .foregroundStyle((isCompleted || isSkippedInThisWeek) ? .secondary : .primary)
                        .strikethrough(isCompleted || isSkippedInThisWeek, color: .secondary)
                        .lineLimit(isCompactMode ? 2 : 3)
                        .multilineTextAlignment(.leading)

                    Spacer(minLength: 0)

                    if hasThisWeekMod {
                        Image(systemName: isSkippedInThisWeek ? "calendar.badge.minus" : "calendar.badge.clock")
                            .font(.system(size: isCompactMode ? 7.5 : 9))
                            .foregroundStyle(.orange)
                    } else if let reaction = store.reaction(for: item), reaction.heartCount > 0 {
                        HStack(spacing: 1) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: isCompactMode ? 7.5 : 9))
                                .foregroundStyle(.pink)
                            if !isCompactMode {
                                Text("\(reaction.heartCount)")
                                    .font(.system(size: 8.5, weight: .heavy))
                                    .foregroundStyle(.pink)
                            }
                        }
                    } else if let reaction = store.reaction(for: item), !reaction.allComments.isEmpty {
                        Image(systemName: "bubble.left.fill")
                            .font(.system(size: isCompactMode ? 7.5 : 9))
                            .foregroundStyle(.blue)
                    } else if item.isNotificationEnabled && !isCompactMode {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 8))
                            .foregroundStyle(.orange)
                    }
                }

                // 세부 항목이 있고 크게 보기 모드일 때 표시 (예: 토요일 1~4번 미션)
                if !isCompactMode && !item.subTasks.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        ForEach(item.subTasks.prefix(3)) { sub in
                            Text("· \(sub.title)")
                                .font(.system(size: 9.5))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .padding(.horizontal, isCompactMode ? 3 : 6)
            .padding(.vertical, isCompactMode ? 4 : 5)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(item.category.color.opacity(isSkippedInThisWeek ? 0.06 : 0.15))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(
                        isActive
                            ? Color.accentColor
                            : (hasThisWeekMod ? Color.orange.opacity(0.6) : item.category.color.opacity(0.35)),
                        lineWidth: (isActive || hasThisWeekMod) ? 1.3 : 0.6
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
