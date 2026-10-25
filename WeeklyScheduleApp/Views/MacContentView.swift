import SwiftUI

#if os(macOS)
enum MacNavigationItem: String, CaseIterable, Identifiable, Hashable {
    case weeklyGrid = "weeklyGrid"
    case todaySchedule = "todaySchedule"
    case bookshelf = "bookshelf"
    case history = "history"
    case printPreview = "printPreview"
    case syncAndSettings = "syncAndSettings"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .weeklyGrid: return "주간 시간표"
        case .todaySchedule: return "오늘의 스케줄"
        case .bookshelf: return "책장"
        case .history: return "지난 일정 기록"
        case .printPreview: return "1페이지 인쇄·PDF"
        case .syncAndSettings: return "동기화·설정"
        }
    }

    var icon: String {
        switch self {
        case .weeklyGrid: return "calendar"
        case .todaySchedule: return "checklist.checked"
        case .bookshelf: return "books.vertical.fill"
        case .history: return "clock.arrow.circlepath"
        case .printPreview: return "printer.fill"
        case .syncAndSettings: return "cloud.fill"
        }
    }
}

struct MacContentView: View {
    @EnvironmentObject var store: ScheduleStore
    @StateObject private var notificationManager = NotificationManager.shared
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedItem: MacNavigationItem? = .weeklyGrid
    @State private var showingAddSheet: Bool = false
    @State private var showingPinPrompt: ParentPinPromptContext? = nil
    @State private var showingHeartPrompt: PraiseHeartPromptContext? = nil
    @State private var showingRewardSheet: Bool = false
    @State private var showingStarShopSheet: Bool = false
    @State private var scheduleToEdit: ScheduleItem? = nil

    var body: some View {
        NavigationSplitView {
            sidebarContent
                .navigationSplitViewColumnWidth(min: 240, ideal: 270, max: 320)
        } detail: {
            ZStack(alignment: .top) {
                detailContent

                // 상단 토스트 알림 (실시간 클라우드 동기화 알림)
                if let toast = store.syncToastMessage {
                    HStack(spacing: 10) {
                        Image(systemName: "sparkles")
                            .foregroundStyle(.yellow)
                        Text(toast)
                            .font(.callout.weight(.bold))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [Color.indigo, Color.pink],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .shadow(color: Color.black.opacity(0.3), radius: 10, x: 0, y: 4)
                    )
                    .padding(.top, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture {
                        withAnimation {
                            store.syncToastMessage = nil
                        }
                    }
                    .zIndex(99)
                }

                // 시계 알람 오버레이
                if let activeSession = notificationManager.activeAlarm {
                    ClockAlarmOverlayView(
                        session: activeSession,
                        onSnooze: { mins in
                            Task {
                                await notificationManager.snoozeActiveAlarm(minutes: mins)
                            }
                        },
                        onStop: {
                            notificationManager.stopActiveAlarm()
                        }
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    .zIndex(200)
                }
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                // ⭐ 스타 보유량 & 스타 보상 상점 버튼
                Button {
                    showingStarShopSheet = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundStyle(Color.orange)
                        Text("\(store.availableStars)개")
                            .fontWeight(.bold)
                    }
                }
                .help("스타 잔액 확인 및 스타 보상 상점 열기")

                // 하트 보유량 & 보상 교환 버튼
                Button {
                    showingRewardSheet = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(Color.pink)
                        Text("\(store.availableHearts)개")
                            .fontWeight(.bold)
                    }
                }
                .help("하트 잔액 확인 및 보상 교환")

                // 부모 모드 전환 버튼
                Button {
                    toggleParentMode()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: store.isParentModeUnlocked ? "lock.open.fill" : "lock.fill")
                            .foregroundStyle(store.isParentModeUnlocked ? Color.green : Color.orange)
                        Text(store.isParentModeUnlocked ? "부모 모드 ON" : "부모 잠금 해제")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .help("부모 확인 도장 및 설정을 관리하기 위해 잠금을 해제합니다 (⌘L)")

                // 실시간 Vercel Blob 클라우드 동기화
                Button {
                    Task {
                        await store.syncNow(forceUploadIfEmpty: false)
                    }
                } label: {
                    Label(store.isSyncing ? "동기화 중..." : "지금 동기화", systemImage: "arrow.triangle.2.circlepath")
                }
                .disabled(store.isSyncing)
                .help("가족 클라우드와 즉시 동기화합니다 (⌘R)")

                // 새 일정 추가 버튼
                Button {
                    showingAddSheet = true
                } label: {
                    Label("새 일정 추가", systemImage: "plus")
                        .fontWeight(.bold)
                }
                .keyboardShortcut("n", modifiers: .command)
                .help("새로운 수업이나 숙제 일정을 추가합니다 (⌘N)")
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            ScheduleEditSheet(
                mode: .add,
                defaultWeekday: store.selectedWeekday,
                initialScope: .master
            )
            .environmentObject(store)
            .frame(minWidth: 550, minHeight: 650)
        }
        .sheet(item: $showingPinPrompt) { ctx in
            ParentPinSheet(context: ctx)
                .environmentObject(store)
                .frame(minWidth: 460, minHeight: 560)
        }
        .sheet(item: $showingHeartPrompt) { ctx in
            PraiseHeartSheet(context: ctx)
                .environmentObject(store)
                .frame(minWidth: 480, minHeight: 580)
        }
        .sheet(isPresented: $showingRewardSheet) {
            RewardExchangeSheet()
                .environmentObject(store)
                .frame(minWidth: 500, minHeight: 620)
        }
        .sheet(isPresented: $showingStarShopSheet) {
            StarRewardShopSheet()
                .environmentObject(store)
                .frame(minWidth: 540, minHeight: 680)
        }
        .task {
            await store.syncNow(forceUploadIfEmpty: false)
            await notificationManager.refreshAuthorizationStatus()
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                store.refreshDateAndDayChange()
                Task {
                    await store.syncNow(forceUploadIfEmpty: false)
                }
            }
        }
    }

    // MARK: - 사이드바
    private var sidebarContent: some View {
        VStack(spacing: 0) {
            // 앱 로고 & 타이틀 헤더
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.25, green: 0.42, blue: 0.95), Color.indigo],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 42, height: 42)

                    Image(systemName: "calendar.badge.clock")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("주간 시간표")
                        .font(.headline.weight(.heavy))
                    Text("아이 & 부모 스케줄러")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            Divider()
                .padding(.horizontal, 12)

            // 내비게이션 목록
            List(selection: $selectedItem) {
                Section("스케줄 관리") {
                    ForEach(MacNavigationItem.allCases, id: \.self) { (item: MacNavigationItem) in
                        NavigationLink(value: item) {
                            HStack(spacing: 10) {
                                Image(systemName: item.icon)
                                    .font(.body)
                                    .frame(width: 22)
                                    .foregroundStyle(iconColor(for: item))

                                Text(item.title)
                                    .font(.body.weight(.medium))

                                Spacer()

                                if item == .todaySchedule {
                                    let todayItems = store.items(for: store.todayWeekday)
                                    let completedCount = todayItems.filter { store.isCompleted($0) }.count
                                    Text("\(completedCount)/\(todayItems.count)")
                                        .font(.caption2.weight(.bold))
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.16))
                                        .clipShape(Capsule())
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .listStyle(.sidebar)

            Spacer()

            // 사이드바 하단: 부모 모드 상태 & 클라우드 상태
            sidebarFooter
        }
    }

    private func iconColor(for item: MacNavigationItem) -> Color {
        switch item {
        case .weeklyGrid: return .blue
        case .todaySchedule: return .green
        case .bookshelf: return .indigo
        case .history: return .teal
        case .printPreview: return .purple
        case .syncAndSettings: return .orange
        }
    }

    // MARK: - 사이드바 하단 정보 패널
    private var sidebarFooter: some View {
        VStack(spacing: 10) {
            Divider()

            VStack(alignment: .leading, spacing: 8) {
                // 부모 모드 전환 토글 카드
                HStack(spacing: 8) {
                    Image(systemName: store.deviceRole == .parent ? "person.badge.shield.checkmark.fill" : "person.fill")
                        .foregroundStyle(store.deviceRole == .parent ? Color.indigo : Color.teal)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(store.deviceRole == .parent ? "부모 모드" : "아이 모드")
                            .font(.caption.weight(.bold))
                        Text(store.isParentModeUnlocked ? "확인 도장 및 수정 가능" : "보호 잠금 활성 중")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button {
                        toggleParentMode()
                    } label: {
                        Text(store.isParentModeUnlocked ? "잠금" : "해제")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(store.isParentModeUnlocked ? Color.orange.opacity(0.18) : Color.blue.opacity(0.18))
                            .foregroundStyle(store.isParentModeUnlocked ? Color.orange : Color.blue)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))

                // Vercel Blob 클라우드 상태
                HStack(spacing: 6) {
                    Circle()
                        .fill(store.isSyncing ? Color.orange : Color.green)
                        .frame(width: 8, height: 8)

                    Text(store.isSyncing ? "클라우드 동기화 중..." : (store.lastSyncedAt != nil ? "클라우드 동기화 완료" : "동기화 대기 중"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Spacer()

                    if let lastSync = store.lastSyncedAt {
                        Text(lastSync, style: .time)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.horizontal, 4)
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 12)
        }
    }

    // MARK: - 메인 상세 콘텐츠
    @ViewBuilder
    private var detailContent: some View {
        switch selectedItem {
        case .weeklyGrid:
            WeeklyGridView()
        case .todaySchedule:
            TodayScheduleView()
        case .bookshelf:
            BookshelfWebView()
        case .history:
            MacScheduleHistoryView()
        case .printPreview:
            SchedulePrintPreviewSheet()
        case .syncAndSettings:
            NotificationSettingsView()
        case .none:
            WeeklyGridView()
        }
    }

    private func toggleParentMode() {
        if store.isParentModeUnlocked {
            withAnimation {
                store.lockParentMode()
            }
        } else {
            showingPinPrompt = ParentPinPromptContext(
                mode: .authenticate(
                    reason: "부모 확인 도장 및 시간표 수정을 위해 마스터 PIN을 입력해 주세요."
                ) {
                    // 성공 시 부모 모드 자동 잠금 해제됨
                }
            )
        }
    }
}

private struct MacHistoryRecord: Identifiable {
    let id: String
    let weekStart: Date
    let date: Date?
    let item: ScheduleItem?
    let usesCurrentDetails: Bool
    let completed: Bool
    let verified: Bool
    let skipped: Bool
    let reaction: ItemParentReaction?
}

private struct MacScheduleHistoryView: View {
    @EnvironmentObject private var store: ScheduleStore
    @State private var selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
    private let calendar = Calendar(identifier: .iso8601)
    
    // Only stored evidence creates a history entry. A current recurring schedule
    // must never imply that an unrecorded occurrence happened in a past week.
    private var records: [MacHistoryRecord] {
        var keys = store.completedItemKeys.union(store.parentVerifiedItemKeys)
        keys.formUnion(store.itemReactions.keys)
        keys.formUnion(store.weeklyOverrides.values.filter(\.isActive).map(\.id))
        for item in store.items {
            if let week = item.targetWeekKey {
                keys.insert("\(week)_\(item.id.uuidString)")
            }
        }
        let calendar = Calendar(identifier: .iso8601)
        let today = calendar.startOfDay(for: store.now)
        let currentWeekStart = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        return keys.compactMap { key -> MacHistoryRecord? in
            let parts = key.split(separator: "_", maxSplits: 1)
            guard parts.count == 2,
                  let id = UUID(uuidString: String(parts[1])) else { return nil }
            let weekParts = parts[0].components(separatedBy: "-W")
            guard weekParts.count == 2,
                  let year = Int(weekParts[0]), let week = Int(weekParts[1]),
                  (1...53).contains(week),
                  let start = calendar.date(from: DateComponents(
                    weekday: 2, weekOfYear: week, yearForWeekOfYear: year
                  )) else { return nil }
            let override = store.weeklyOverrides[key]
            let activeOverride = override?.isActive == true ? override : nil
            let base = store.items.first { $0.id == id }
            let item = activeOverride?.overriddenItem ?? base
            let date = item.flatMap {
                calendar.date(byAdding: .day, value: $0.weekday.rawValue - 1, to: start)
            }
            // Unknown/deleted schedules can only be assigned to their stored week.
            guard date.map({ $0 < today }) ?? (start < currentWeekStart) else {
                return nil
            }
            return MacHistoryRecord(
                id: key, weekStart: start, date: date, item: item,
                usesCurrentDetails: activeOverride?.overriddenItem == nil && base?.targetWeekKey == nil,
                completed: store.completedItemKeys.contains(key),
                verified: store.parentVerifiedItemKeys.contains(key),
                skipped: activeOverride?.isSkipped == true,
                reaction: store.itemReactions[key]
            )
        }.sorted {
            if $0.weekStart != $1.weekStart { return $0.weekStart > $1.weekStart }
            let leftDay = $0.item?.weekday.rawValue ?? 8
            let rightDay = $1.item?.weekday.rawValue ?? 8
            if leftDay != rightDay { return leftDay < rightDay }
            let leftTime = $0.item?.startTotalMinutes ?? 0
            let rightTime = $1.item?.startTotalMinutes ?? 0
            return leftTime == rightTime ? $0.id < $1.id : leftTime < rightTime
        }
    }

    var body: some View {
        let allRecords = records
        let datedRecords = allRecords.filter { $0.date != nil }
        let byDate = Dictionary(grouping: datedRecords) { calendar.startOfDay(for: $0.date ?? $0.weekStart) }
        let day = calendar.startOfDay(for: selectedDate)
        let visibleRecords = byDate[day] ?? []
        let unknownRecords = allRecords.filter { $0.date == nil }

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("지난 일정 기록")
                    .font(.largeTitle.bold())
                Text("날짜를 선택하면 어제까지 저장된 완료·부모 확인·칭찬 기록을 볼 수 있습니다.")
                    .foregroundStyle(.secondary)
                MacHistoryCalendar(
                    selectedDate: $selectedDate,
                    counts: byDate.mapValues(\.count),
                    today: calendar.startOfDay(for: store.now)
                )
                Divider()
                Text(selectedDate.formatted(date: .complete, time: .omitted))
                    .font(.title2.bold())
                Text("기록 \(visibleRecords.count)건 · 완료 \(visibleRecords.filter { $0.completed || $0.verified }.count)건 · 부모 확인 \(visibleRecords.filter(\.verified).count)건")
                    .font(.headline)
                if visibleRecords.isEmpty {
                    Label("이 날짜에 저장된 기록이 없습니다.", systemImage: "calendar")
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 20)
                }
                ForEach(visibleRecords) { record in
                    MacHistoryRecordRow(record: record)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                }
                if !unknownRecords.isEmpty {
                    DisclosureGroup("날짜를 확인할 수 없는 기록 \(unknownRecords.count)건") {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(unknownRecords) { record in
                                VStack(alignment: .leading) {
                                    Text("\(record.weekStart.formatted(date: .abbreviated, time: .omitted)) 시작 주")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    MacHistoryRecordRow(record: record)
                                }
                            }
                        }
                    }
                }
                Text("과거 원본이 없는 일정의 날짜·제목·시간은 현재 시간표 기준입니다. 삭제되어 날짜를 알 수 없는 기록은 별도로 표시합니다.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(24)
        }
        .navigationTitle("지난 일정 기록")
    }
}

private struct MacHistoryCalendar: View {
    @Binding var selectedDate: Date
    let counts: [Date: Int]
    let today: Date
    private let calendar = Calendar(identifier: .iso8601)

    private var monthStart: Date {
        calendar.dateInterval(of: .month, for: selectedDate)?.start ?? selectedDate
    }

    private var weeks: [[Date]] {
        let leadingDays = (calendar.component(.weekday, from: monthStart) + 5) % 7
        let dayCount = calendar.range(of: .day, in: .month, for: monthStart)?.count ?? 31
        let cellCount = ((leadingDays + dayCount + 6) / 7) * 7
        let dates = (0..<cellCount).compactMap {
            calendar.date(byAdding: .day, value: $0 - leadingDays, to: monthStart)
        }
        return stride(from: 0, to: dates.count, by: 7).map {
            Array(dates[$0..<min($0 + 7, dates.count)])
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button {
                    moveMonth(by: -1)
                } label: {
                    Label("이전 달", systemImage: "chevron.left")
                }
                Spacer()
                Text(selectedDate.formatted(.dateTime.year().month(.wide)))
                    .font(.title2.bold())
                Spacer()
                Button("이번 달") {
                    let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
                    selectedDate = calendar.isDate(yesterday, equalTo: today, toGranularity: .month) ? yesterday : today
                }
                Button {
                    moveMonth(by: 1)
                } label: {
                    Label("다음 달", systemImage: "chevron.right")
                }
                .disabled(calendar.isDate(selectedDate, equalTo: today, toGranularity: .month))
            }
            Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                GridRow {
                    ForEach(Weekday.allCases) { weekday in
                        Text(weekday.shortName)
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .foregroundStyle(weekday.isWeekend ? Color.secondary : Color.primary)
                    }
                }
                ForEach(weeks, id: \.first) { week in
                    GridRow {
                        ForEach(week, id: \.self) { date in
                            dayButton(date)
                        }
                    }
                }
            }
        }
    }

    private func moveMonth(by offset: Int) {
        guard let date = calendar.date(byAdding: .month, value: offset, to: monthStart) else { return }
        selectedDate = date
    }

    private func dayButton(_ date: Date) -> some View {
        let inMonth = calendar.isDate(date, equalTo: selectedDate, toGranularity: .month)
        let selected = calendar.isDate(date, inSameDayAs: selectedDate)
        let count = counts[date] ?? 0
        return Button {
            selectedDate = date
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(calendar.component(.day, from: date))")
                    .font(.headline)
                Text(count > 0 ? "기록 \(count)건" : " ")
                    .font(.caption)
            }
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .padding(8)
            .background(selected ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.06),
                        in: RoundedRectangle(cornerRadius: 8))
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(selected ? Color.accentColor : Color.clear, lineWidth: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!inMonth || date >= today)
        .opacity(inMonth ? 1 : 0.3)
        .accessibilityLabel("\(date.formatted(date: .complete, time: .omitted)), 기록 \(count)건")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct MacHistoryRecordRow: View {
    let record: MacHistoryRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(record.item?.title ?? "삭제되었거나 정보를 찾을 수 없는 일정")
                .font(.headline)
            if let item = record.item {
                Text("\(item.weekday.fullName) · \(item.startTimeString)–\(item.endTimeString)")
                    .foregroundStyle(.secondary)
                Text(record.usesCurrentDetails ? "일정 정보: 현재 시간표 기준" : "일정 정보: 해당 주 저장 내용")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 16) {
                if record.skipped {
                    Label("휴강·제외", systemImage: "calendar.badge.minus")
                }
                if record.verified {
                    Label("부모 확인 완료", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                } else if record.completed {
                    Label("완료 · 부모 확인 기록 없음", systemImage: "checkmark.circle")
                        .foregroundStyle(.blue)
                } else {
                    Text("완료 기록 없음")
                        .foregroundStyle(.secondary)
                }
            }
            if let reaction = record.reaction {
                if reaction.heartCount > 0 {
                    Label("칭찬 하트 \(reaction.heartCount)개", systemImage: "heart.fill")
                        .foregroundStyle(.pink)
                }
                if !reaction.allComments.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(reaction.allComments) { c in
                            HStack(alignment: .top, spacing: 4) {
                                Image(systemName: "bubble.left.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.blue)
                                    .padding(.top, 2)
                                Text(c.text)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                } else if !reaction.comment.isEmpty {
                    Text(reaction.comment)
                        .textSelection(.enabled)
                }
            }
        }
        .padding(.vertical, 8)
    }
}

#endif
