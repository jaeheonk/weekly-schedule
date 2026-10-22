import SwiftUI

struct TodayScheduleView: View {
    @EnvironmentObject var store: ScheduleStore
    @State private var selectedCategoryFilter: ScheduleCategory? = nil
    @State private var editingItem: ScheduleItem? = nil
    @State private var editingScope: ScheduleEditScope = .thisWeek
    @State private var showingAddSheet = false
    @State private var addScope: ScheduleEditScope = .thisWeek
    @State private var showingResetAdjustmentsDialog = false
    @State private var pinPrompt: ParentPinPromptContext? = nil
    @State private var praisePrompt: PraiseHeartPromptContext? = nil
    @State private var showingRewardExchangeSheet: Bool = false

    private var filteredItems: [ScheduleItem] {
        let dayItems = store.items(for: store.selectedWeekday)
        guard let category = selectedCategoryFilter else { return dayItems }
        return dayItems.filter { $0.category == category }
    }

    private var excludedDayInfos: [DayExcludedScheduleInfo] {
        store.excludedMasterItemsForThisWeek(on: store.selectedWeekday)
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { _ in
                ScrollView {
                    VStack(spacing: 16) {
                        // 0. 최초 실행 시 이 기기가 '아이의 폰'인지 '부모님 폰'인지 선택하는 배너
                        if !store.hasConfirmedDeviceRole {
                            deviceRoleOnboardingBanner
                                .padding(.horizontal, 16)
                        }

                        // 부모 확인 모드가 켜져 있을 때 상단 안내 배너
                        if store.isParentModeUnlocked {
                            parentModeActiveBanner
                                .padding(.horizontal, 16)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        // 1. 실시간 현재/다음 할 일 & 오늘 달성률 & 하트 응원 히어로 배너
                        LiveStatusHeroCard(
                            onTapItem: { item in
                                store.selectedWeekday = item.weekday
                                editingScope = .thisWeek
                                editingItem = item
                            },
                            onRequestParentAuth: { reason, action in
                                performParentAction(reason: reason, action: action)
                            },
                            onTapRewardExchange: {
                                showingRewardExchangeSheet = true
                            },
                            onTapSendFamilyHeart: {
                                performParentAction(
                                    reason: "아이에게 ❤️ 하트와 응원 메시지를 보내려면 부모 인증이 필요해요."
                                ) {
                                    praisePrompt = PraiseHeartPromptContext(target: .familyBanner)
                                }
                            }
                        )
                        .padding(.horizontal, 16)

                        // 2. 월~일 요일 선택 바
                        WeekdaySelectorBar()
                            .padding(.horizontal, 16)

                        // 3. 과목/활동 카테고리 필터 칩
                        CategoryFilterBar(selectedCategory: $selectedCategoryFilter)

                        // 4. 선택된 요일 헤더 + 빠른 액션 + 이번 주 스케줄 조정 배너
                        daySectionHeader

                        // 5. 일정 타임라인 리스트
                        if filteredItems.isEmpty {
                            emptyDayState
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(filteredItems) { item in
                                    ScheduleTimelineRow(
                                        item: item,
                                        onTapEdit: {
                                            editingScope = .thisWeek
                                            editingItem = item
                                        },
                                        onTapEditMaster: {
                                            editingScope = .master
                                            editingItem = item
                                        },
                                        onRequestParentAuth: { reason, action in
                                            performParentAction(reason: reason, action: action)
                                        },
                                        onTapSendHeart: { targetItem in
                                            performParentAction(
                                                reason: "[\(targetItem.title)] 숙제에 응원 메시지나 하트를 보내려면 부모 인증을 해주세요."
                                            ) {
                                                praisePrompt = PraiseHeartPromptContext(target: .scheduleItem(targetItem))
                                            }
                                        }
                                    )
                                    .id(item.id)
                                }
                            }
                            .padding(.horizontal, 16)
                        }

                        // 6. 이번 주에 휴강·제외되었거나 다른 요일로 이동된 정규 일정 복구 섹션
                        if !excludedDayInfos.isEmpty {
                            excludedItemsSection(excludedDayInfos)
                                .padding(.horizontal, 16)
                        }

                        Spacer(minLength: 24)
                    }
                    .padding(.top, 8)
                }
                .refreshable {
                    store.refreshDateAndDayChange()
                    await store.syncNow(forceUploadIfEmpty: false)
                }
                .onAppear {
                    store.refreshDateAndDayChange()
                }
                .background(Color(.systemGroupedBackground))
                .navigationTitle("오늘의 스케줄")
                .inlineNavigationBarTitle()
                .toolbar {
                    ToolbarItem(placement: .appLeading) {
                        HStack(spacing: 6) {
                            // 부모 모드 잠금/해제 버튼
                            Button {
                                if store.isParentModeUnlocked {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                        store.lockParentMode()
                                    }
                                } else {
                                    performParentAction(
                                        reason: store.deviceRole == .parent
                                            ? "부모님 폰에서 Face ID 또는 6자리 마스터 PIN으로 부모 확인 모드를 켭니다."
                                            : "부모 확인 모드를 켜려면 6자리 마스터 PIN을 입력해 주세요."
                                    ) {}
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Image(
                                        systemName: store.isParentModeUnlocked
                                            ? "lock.open.fill"
                                            : (store.deviceRole == .parent ? "faceid" : "lock.shield.fill")
                                    )
                                    Text(
                                        store.isParentModeUnlocked
                                            ? "부모모드 켜짐"
                                            : (store.deviceRole == .parent ? "부모 승인" : "부모 확인")
                                    )
                                }
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 9)
                                .padding(.vertical, 5)
                                .background(
                                    store.isParentModeUnlocked
                                        ? Color.green.opacity(0.18)
                                        : Color.indigo.opacity(0.12)
                                )
                                .foregroundStyle(store.isParentModeUnlocked ? Color.green : Color.indigo)
                                .clipShape(Capsule())
                            }

                            // 실시간 동기화 상태 & 즉시 동기화 버튼
                            Button {
                                Task {
                                    await store.syncNow(forceUploadIfEmpty: true)
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: store.isSyncing ? "arrow.triangle.2.circlepath" : "icloud.fill")
                                        .font(.caption2)
                                    Text(store.deviceRole == .parent ? "부모폰" : "아이폰")
                                        .font(.caption2.weight(.bold))
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(Color.blue.opacity(0.12))
                                .foregroundStyle(Color.blue)
                                .clipShape(Capsule())
                            }
                        }
                    }

                    ToolbarItem(placement: .appTrailing) {
                        HStack(spacing: 8) {
                            if store.selectedWeekday != store.todayWeekday {
                                Button {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        store.selectedWeekday = store.todayWeekday
                                    }
                                } label: {
                                    Text("오늘")
                                        .font(.caption.weight(.bold))
                                }
                            }

                            Button {
                                addScope = .thisWeek
                                showingAddSheet = true
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: "plus.circle.fill")
                                    Text("이번주 추가")
                                        .fontWeight(.semibold)
                                }
                                .font(.subheadline)
                            }
                        }
                    }
                }
                .sheet(item: $editingItem) { item in
                    ScheduleEditSheet(
                        mode: .edit(item),
                        defaultWeekday: store.selectedWeekday,
                        initialScope: editingScope
                    )
                }
                .sheet(isPresented: $showingAddSheet) {
                    ScheduleEditSheet(
                        mode: .add,
                        defaultWeekday: store.selectedWeekday,
                        initialScope: addScope
                    )
                }
                .sheet(item: $pinPrompt) { prompt in
                    ParentPinSheet(context: prompt)
                }
                .sheet(item: $praisePrompt) { prompt in
                    PraiseHeartSheet(context: prompt)
                }
                .sheet(isPresented: $showingRewardExchangeSheet) {
                    RewardExchangeSheet()
                }
                .confirmationDialog(
                    "이번 주 조정한 스케줄을 원래 기본 시간표로 되돌릴까요?",
                    isPresented: $showingResetAdjustmentsDialog,
                    titleVisibility: .visible
                ) {
                    if store.adjustmentCount(for: store.selectedWeekday) > 0 {
                        Button("\(store.selectedWeekday.fullName) 조정만 원래대로 되돌리기") {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                store.resetThisWeekAdjustments(for: store.selectedWeekday)
                            }
                        }
                    }
                    Button("이번 주 전체(월~일) 조정 모두 원래대로 되돌리기", role: .destructive) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            store.resetThisWeekAdjustments(for: nil)
                        }
                    }
                    Button("취소", role: .cancel) {}
                } message: {
                    Text("일정을 원래 시간으로 되돌려도 이번 주에 완료 체크한 기록과 부모님 확인 도장·하트는 그대로 유지됩니다.")
                }
            }
        }
    }

    private func performParentAction(reason: String, action: @escaping () -> Void) {
        if store.isParentModeUnlocked {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                action()
            }
        } else {
            pinPrompt = ParentPinPromptContext(
                mode: .authenticate(reason: reason) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                        action()
                    }
                }
            )
        }
    }

    private var deviceRoleOnboardingBanner: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "iphone.gen3.radiowaves.left.and.right")
                    .font(.title3)
                    .foregroundStyle(.indigo)
                VStack(alignment: .leading, spacing: 2) {
                    Text("이 아이폰은 누가 사용하는 기기인가요?")
                        .font(.subheadline.weight(.bold))
                    Text("아이 폰은 체크리스트 직접 체크 및 시간표 알람이 울리고, 부모님 폰은 확인 도장과 칭찬 하트를 보내며 알림이 울리지 않습니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 10) {
                Button {
                    withAnimation {
                        store.setDeviceRole(.child)
                    }
                } label: {
                    HStack(spacing: 5) {
                        Text("👦 아이의 폰으로 사용")
                            .font(.caption.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)

                Button {
                    pinPrompt = ParentPinPromptContext(
                        mode: .authenticate(
                            reason: "이 기기를 '부모님 폰'으로 설정하려면 6자리 마스터 PIN을 입력해 주세요."
                        ) {
                            store.setDeviceRole(.parent)
                        }
                    )
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "lock.shield.fill")
                            .font(.caption2)
                        Text("👩👨 부모님 폰으로 설정")
                            .font(.caption.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.indigo)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.indigo.opacity(0.4), lineWidth: 1.5)
        )
    }

    private var parentModeActiveBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .font(.title3)
                .foregroundStyle(.green)

            VStack(alignment: .leading, spacing: 2) {
                Text(store.deviceRole == .parent ? "부모님 폰 승인 모드가 열려 있어요" : "부모 확인 모드가 열려 있어요")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)
                Text("숙제 도장을 찍거나 ❤️ 하트를 보낼 수 있어요. 끝나면 잠그기를 눌러주세요.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    store.lockParentMode()
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill")
                    Text("잠그기")
                }
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.green)
                .foregroundStyle(.white)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.green.opacity(0.5), lineWidth: 1.5)
        )
    }

    private var daySectionHeader: some View {
        let stats = store.completionStats(for: store.selectedWeekday)
        let dayAdjustmentCount = store.adjustmentCount(for: store.selectedWeekday)
        let weekAdjustmentCount = store.currentWeekAdjustmentCount

        return VStack(spacing: 8) {
            HStack {
                HStack(spacing: 6) {
                    Text(store.selectedWeekday.fullName)
                        .font(.headline.weight(.bold))
                    if store.selectedWeekday == store.todayWeekday {
                        Text("TODAY")
                            .font(.caption2.weight(.heavy))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.15))
                            .foregroundStyle(.blue)
                            .clipShape(Capsule())
                    }
                    if dayAdjustmentCount > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 9, weight: .bold))
                            Text("이번주 조정 \(dayAdjustmentCount)건")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(Color.orange.opacity(0.16))
                        .foregroundStyle(Color.orange)
                        .clipShape(Capsule())
                    }
                }

                Spacer()

                if stats.total > 0 {
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.blue)
                            Text("아이 \(stats.completed)/\(stats.total)")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                        HStack(spacing: 3) {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundStyle(.green)
                            Text("부모확인 \(stats.verified)/\(stats.total)")
                        }
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.green)

                        if stats.completed > 0 {
                            Button {
                                performParentAction(
                                    reason: "\(store.selectedWeekday.fullName)의 완료 체크를 초기화하려면 부모 인증(6자리 PIN)이 필요해요."
                                ) {
                                    store.resetCompletions(for: store.selectedWeekday, includeParentVerified: true)
                                }
                            } label: {
                                Text("초기화")
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(.tertiarySystemFill))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }

            // 이번 주 스케줄 조정이 적용 중일 때 안내 및 빠른 복구 배너
            if weekAdjustmentCount > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.orange)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(
                            dayAdjustmentCount > 0
                                ? "\(store.selectedWeekday.fullName) 일정 \(dayAdjustmentCount)개가 이번 주만 임시 조정되었어요"
                                : "이번 주 총 \(weekAdjustmentCount)개의 스케줄이 임시 조정되어 있어요"
                        )
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.primary)

                        Text("다음 주 월요일에는 원래 기본 시간표로 자동 복구됩니다 · 전체 변경은 [주간 시간표] 탭에서 가능")
                            .font(.system(size: 10.5))
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button {
                        showingResetAdjustmentsDialog = true
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "arrow.uturn.backward")
                            Text("원래대로")
                        }
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Color.orange)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.11))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.orange.opacity(0.35), lineWidth: 1)
                )
            }

            // 검사 대기 중인 항목이 있으면 일괄 확인 + 하트 선물 바 표시
            if stats.waiting > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "hand.raised.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                    Text("아이가 '다 했어요' 체크한 숙제 \(stats.waiting)개가 부모님 확인을 기다리고 있어요!")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.primary)
                    Spacer()
                    Button {
                        performParentAction(
                            reason: "\(store.selectedWeekday.fullName)에 아이가 완료 체크한 \(stats.waiting)개 숙제를 모두 확인 도장 찍고 ❤️ 하트를 보냅니다."
                        ) {
                            store.verifyAllWaitingItems(for: store.selectedWeekday, giveHeartToEach: true)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: store.isParentModeUnlocked ? "checkmark.seal.fill" : "lock.fill")
                            Text("모두 확인 + ❤️")
                        }
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.green)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 2)
    }

    private func excludedItemsSection(_ excluded: [DayExcludedScheduleInfo]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("이번 주 휴강·요일 이동된 원래 일정 (\(excluded.count)개)", systemImage: "calendar.badge.minus")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("다음 주 자동 복구")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.orange)
            }

            ForEach(excluded) { info in
                HStack(spacing: 10) {
                    Image(systemName: info.masterItem.iconName)
                        .font(.caption)
                        .foregroundStyle(info.masterItem.category.color)
                        .frame(width: 28, height: 28)
                        .background(info.masterItem.category.softBackgroundColor)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(info.masterItem.title)
                                .font(.subheadline.weight(.bold))
                                .strikethrough(info.isSkipped, color: .secondary)
                                .foregroundStyle(.secondary)

                            Text(info.reasonText)
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.15))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
                        }

                        Text("원래 시간: \(info.masterItem.timeRangeString)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            store.revertThisWeekOverride(for: info.masterItem.id)
                        }
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "arrow.uturn.backward")
                            Text("원래대로 복구")
                        }
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.14))
                        .foregroundStyle(.blue)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .background(Color(.tertiarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
        )
    }

    private var emptyDayState: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("표시할 스케줄이 없어요")
                .font(.headline)
            Text("이번 주 보강·특별 일정을 추가하거나 아래에서 휴강된 일정을 복구해 보세요!")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                addScope = .thisWeek
                showingAddSheet = true
            } label: {
                Label("이번 주 일정 추가하기", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .padding(.horizontal, 16)
    }
}

// MARK: - Live Status Hero Card
struct LiveStatusHeroCard: View {
    @EnvironmentObject var store: ScheduleStore
    var onTapItem: (ScheduleItem) -> Void
    var onRequestParentAuth: (String, @escaping () -> Void) -> Void
    var onTapRewardExchange: () -> Void
    var onTapSendFamilyHeart: () -> Void

    private var dateTitleString: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter.string(from: store.now)
    }

    var body: some View {
        let todayStats = store.completionStats(for: store.todayWeekday)
        let activeItems = store.currentActiveItems
        let nextItem = store.nextUpcomingItem
        let totalHearts = store.totalHeartsThisWeek

        VStack(alignment: .leading, spacing: 12) {
            // 상단 날짜 + 받은 하트 카운터 + 부모님 응원 버튼
            HStack(alignment: .center, spacing: 8) {
                Text(dateTitleString)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))

                Spacer()

                // 보유 하트 배지 (탭하면 보상 교환 시트 오픈)
                Button(action: onTapRewardExchange) {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(.pink)
                        Text("하트 \(totalHearts)개")
                            .fontWeight(.heavy)
                        Image(systemName: "gift.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(Color.pink.opacity(0.8))
                    }
                    .font(.caption)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(.white)
                    .foregroundStyle(Color.pink)
                    .clipShape(Capsule())
                    .shadow(color: Color.black.opacity(0.08), radius: 2, x: 0, y: 1)
                }
                .buttonStyle(.plain)

                // 부모님이 아이에게 하트 & 응원 보내기 버튼
                Button(action: onTapSendFamilyHeart) {
                    HStack(spacing: 3) {
                        Image(systemName: "heart.circle.fill")
                        Text("응원 보내기")
                            .fontWeight(.bold)
                    }
                    .font(.caption)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Color.pink.opacity(0.85))
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            // 오늘의 달성 현황 (아이 체크 + 부모님 확인)
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(greetingText(completed: todayStats.completed, verified: todayStats.verified, total: todayStats.total))
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)

                    HStack(spacing: 8) {
                        Label("다 했어요 \(todayStats.completed)/\(todayStats.total)", systemImage: "checkmark.circle.fill")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.white.opacity(0.18))
                            .foregroundStyle(.white)
                            .clipShape(Capsule())

                        Label("부모님 확인 \(todayStats.verified)/\(todayStats.total)", systemImage: "checkmark.seal.fill")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.green.opacity(0.35))
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                    .padding(.top, 2)
                }

                Spacer()

                // 원형 2중 달성률 배지 (바깥: 아이 완료, 안쪽 강조: 부모 확인)
                ZStack {
                    Circle()
                        .stroke(.white.opacity(0.22), lineWidth: 5)
                    Circle()
                        .trim(from: 0, to: todayStats.total > 0 ? CGFloat(todayStats.completed) / CGFloat(todayStats.total) : 0)
                        .stroke(.white.opacity(0.55), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Circle()
                        .trim(from: 0, to: todayStats.total > 0 ? CGFloat(todayStats.verified) / CGFloat(todayStats.total) : 0)
                        .stroke(Color.green, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(todayStats.verified)/\(todayStats.total)")
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(.white)
                        Text("부모확인")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }
                .frame(width: 56, height: 56)
            }

            // 부모님이 보낸 최신 응원 메시지 배너
            if let praise = store.latestPraiseNote {
                HStack(spacing: 10) {
                    Text(praise.sticker.emoji)
                        .font(.title3)
                        .frame(width: 34, height: 34)
                        .background(.white.opacity(0.2))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 5) {
                            Text("부모님의 응원 메시지")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(.yellow)
                            if praise.hearts > 0 {
                                Text("❤️ +\(praise.hearts)")
                                    .font(.system(size: 10, weight: .heavy))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1)
                                    .background(Color.pink.opacity(0.8))
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())
                            }
                        }
                        Text(praise.message)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.white.opacity(0.16))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }

            Divider()
                .overlay(.white.opacity(0.2))

            // 현재 진행 중인 할 일
            if let current = activeItems.first {
                let isChildDone = store.isCompleted(current)
                let isVerified = store.isParentVerified(current)

                Button {
                    onTapItem(current)
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 8, height: 8)
                                Text("지금 하는 일")
                                    .font(.caption.weight(.heavy))
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.white.opacity(0.2))
                            .clipShape(Capsule())

                            Text(current.timeRangeString)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.white.opacity(0.9))

                            Spacer()

                            Text(formatRemainingTime(store.remainingMinutes(forActive: current)))
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(.black.opacity(0.2))
                                .clipShape(Capsule())
                        }

                        HStack(spacing: 10) {
                            Image(systemName: current.iconName)
                                .font(.title3)
                                .frame(width: 36, height: 36)
                                .background(.white.opacity(0.2))
                                .clipShape(RoundedRectangle(cornerRadius: 10))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(current.title)
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                if !current.note.isEmpty {
                                    Text(current.note)
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.85))
                                        .lineLimit(1)
                                }
                            }

                            Spacer()

                            if current.isCheckable {
                                if store.deviceRole == .child {
                                    // 아이 완료 버튼 (아이 폰에서만 직접 체크 가능)
                                    if !isVerified {
                                        Button {
                                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                                _ = store.toggleCompletion(for: current)
                                            }
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: isChildDone ? "checkmark.circle.fill" : "circle")
                                                Text("다 했어요")
                                            }
                                            .font(.caption.weight(.bold))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 7)
                                            .background(isChildDone ? Color.yellow : Color.white)
                                            .foregroundStyle(Color.indigo)
                                            .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                } else {
                                    // 부모 폰에서는 아이의 완료 상태 뱃지 표시 (체크리스트는 아이만 체크)
                                    HStack(spacing: 4) {
                                        Image(systemName: isChildDone ? "checkmark.circle.fill" : "clock")
                                        Text(isChildDone ? "아이 완료함" : "아이 진행 중")
                                    }
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 7)
                                    .background(isChildDone ? Color.green.opacity(0.85) : Color.white.opacity(0.2))
                                    .foregroundStyle(Color.white)
                                    .clipShape(Capsule())
                                }

                                // 부모 확인 버튼
                                Button {
                                    let reason = isVerified
                                        ? "[\(current.title)]의 부모님 확인을 해제하려면 6자리 마스터 PIN을 입력해 주세요."
                                        : "[\(current.title)] 숙제를 확인하고 도장을 찍어주세요."
                                    onRequestParentAuth(reason) {
                                        store.toggleParentVerification(for: current)
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: isVerified ? "checkmark.seal.fill" : "lock.fill")
                                        Text(isVerified ? "확인완료" : "부모확인")
                                    }
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 7)
                                    .background(isVerified ? Color.green : Color.black.opacity(0.28))
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                                .disabled(!isVerified && !store.canParentVerify(current))
                            }
                        }

                        // 진행률 바
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(.white.opacity(0.25))
                                Capsule()
                                    .fill(.white)
                                    .frame(width: geo.size.width * store.progress(for: current))
                            }
                        }
                        .frame(height: 6)
                    }
                }
                .buttonStyle(.plain)
            }

            // 다음 할 일 안내
            if let next = nextItem {
                Button {
                    onTapItem(next)
                } label: {
                    HStack(spacing: 10) {
                        Text("다음 일정")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(.white.opacity(0.22))
                            .clipShape(Capsule())

                        Image(systemName: next.iconName)
                            .font(.subheadline)

                        Text("\(next.startTimeString) · \(next.title)")
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)

                        Spacer()

                        Text(formatMinutesUntil(store.minutesUntilStart(for: next)))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.yellow)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(.black.opacity(0.16))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            } else if activeItems.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                    Text("오늘 예정된 시간표가 모두 끝났어요! 푹 쉬세요 🌙")
                        .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(.white.opacity(0.95))
            }
        }
        .padding(16)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.24, green: 0.38, blue: 0.94),
                    Color(red: 0.48, green: 0.27, blue: 0.88)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.indigo.opacity(0.25), radius: 10, x: 0, y: 5)
    }

    private func greetingText(completed: Int, verified: Int, total: Int) -> String {
        if total == 0 { return "오늘의 일정을 확인해 볼까요?" }
        if verified == total { return "부모님 확인까지 모두 끝! 최고예요 🏆" }
        if completed == total { return "숙제 완료! 부모님께 확인 도장을 받아요 🙋" }
        if completed > total / 2 { return "절반 이상 완료! 정말 잘하고 있어요 🌟" }
        return "오늘도 하나씩 신나게 해볼까요? 💪"
    }

    private func formatMinutesUntil(_ minutes: Int) -> String {
        if minutes < 60 {
            return "\(minutes)분 뒤 시작"
        } else {
            let h = minutes / 60
            let m = minutes % 60
            return m == 0 ? "\(h)시간 뒤" : "\(h)시간 \(m)분 뒤"
        }
    }

    private func formatRemainingTime(_ minutes: Int) -> String {
        if minutes < 60 {
            return "\(minutes)분 남음"
        } else {
            let h = minutes / 60
            let m = minutes % 60
            return m == 0 ? "\(h)시간 남음" : "\(h)시간 \(m)분 남음"
        }
    }
}

// MARK: - Weekday Selector Bar
struct WeekdaySelectorBar: View {
    @EnvironmentObject var store: ScheduleStore

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Weekday.allCases) { day in
                let isSelected = store.selectedWeekday == day
                let isToday = store.todayWeekday == day
                let stats = store.completionStats(for: day)
                let allVerified = stats.total > 0 && stats.verified == stats.total
                let allChildDone = stats.total > 0 && stats.completed == stats.total
                let hasAdjustment = store.adjustmentCount(for: day) > 0

                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                        store.selectedWeekday = day
                    }
                } label: {
                    VStack(spacing: 4) {
                        if isToday {
                            Text("오늘")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(isSelected ? .white.opacity(0.9) : .blue)
                        } else if hasAdjustment {
                            Text("조정")
                                .font(.system(size: 8.5, weight: .bold))
                                .foregroundStyle(isSelected ? .yellow : .orange)
                        } else {
                            Text(" ")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.clear)
                        }

                        Text(day.shortName)
                            .font(.callout.weight(isSelected ? .heavy : .semibold))
                            .foregroundStyle(
                                isSelected ? .white :
                                (day == .sunday ? .red : (day == .saturday ? .blue : .primary))
                            )

                        if allVerified {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(isSelected ? .yellow : .green)
                        } else if allChildDone {
                            Image(systemName: "star.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(isSelected ? .yellow : .orange)
                        } else {
                            Circle()
                                .fill(
                                    stats.completed > 0
                                        ? (isSelected ? Color.white : Color.blue)
                                        : (hasAdjustment ? (isSelected ? Color.yellow : Color.orange.opacity(0.75)) : Color.clear)
                                )
                                .frame(width: 5, height: 5)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(
                                isSelected
                                    ? Color.accentColor
                                    : (isToday ? Color.accentColor.opacity(0.12) : Color(.secondarySystemGroupedBackground))
                            )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(
                                isToday && !isSelected
                                    ? Color.accentColor.opacity(0.45)
                                    : (hasAdjustment && !isSelected ? Color.orange.opacity(0.4) : Color.clear),
                                lineWidth: 1.5
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Category Filter Bar
struct CategoryFilterBar: View {
    @Binding var selectedCategory: ScheduleCategory?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(
                    title: "전체",
                    icon: "square.grid.2x2.fill",
                    color: .indigo,
                    isSelected: selectedCategory == nil
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedCategory = nil
                    }
                }

                ForEach(ScheduleCategory.allCases) { category in
                    FilterChip(
                        title: category.title,
                        icon: category.defaultIcon,
                        color: category.color,
                        isSelected: selectedCategory == category
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if selectedCategory == category {
                                selectedCategory = nil
                            } else {
                                selectedCategory = category
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

private struct FilterChip: View {
    let title: String
    let icon: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isSelected ? color : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : color.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Schedule Timeline Row Card
struct ScheduleTimelineRow: View {
    @EnvironmentObject var store: ScheduleStore
    let item: ScheduleItem
    let onTapEdit: () -> Void
    let onTapEditMaster: () -> Void
    let onRequestParentAuth: (String, @escaping () -> Void) -> Void
    let onTapSendHeart: (ScheduleItem) -> Void

    var body: some View {
        let isCompleted = store.isCompleted(item)
        let isParentVerified = store.isParentVerified(item)
        let isActive = store.isCurrentlyActive(item)
        let parentReaction = store.reaction(for: item)
        let adjustmentBadge = store.adjustmentBadgeText(for: item)

        HStack(alignment: .top, spacing: 12) {
            // 좌측 시간 열
            VStack(alignment: .trailing, spacing: 2) {
                Text(ScheduleItem.formatCompactTime(hour: item.startHour, minute: item.startMinute))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(isActive ? Color.accentColor : .primary)
                Text(ScheduleItem.formatCompactTime(hour: item.endHour, minute: item.endMinute))
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if isActive {
                    Text("진행중")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.green)
                        .clipShape(Capsule())
                        .padding(.top, 2)
                }
            }
            .frame(width: 62, alignment: .trailing)
            .padding(.top, 10)

            // 우측 카드 본문
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    if item.isCheckable {
                        if store.deviceRole == .child {
                            // 1단계: 아이 완료 체크박스 버튼 (아이 폰에서만 직접 체크 가능)
                            Button {
                                if isParentVerified && !store.isParentModeUnlocked {
                                    onRequestParentAuth(
                                        "이미 부모님이 확인 완료한 숙제예요.\n체크를 해제하려면 부모님 6자리 마스터 PIN을 입력해 주세요."
                                    ) {
                                        _ = store.toggleCompletion(for: item)
                                    }
                                } else {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.65)) {
                                        _ = store.toggleCompletion(for: item)
                                    }
                                }
                            } label: {
                                Image(
                                    systemName: isParentVerified
                                        ? "checkmark.seal.fill"
                                        : (isCompleted ? "checkmark.circle.fill" : "circle")
                                )
                                .font(.system(size: 26, weight: .semibold))
                                .foregroundStyle(
                                    isParentVerified
                                        ? Color.green
                                        : (isCompleted ? Color.blue : item.category.color)
                                )
                                .contentTransition(.symbolEffect(.replace))
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 2)
                        } else {
                            // 부모 폰: 체크리스트는 아이만 체크 가능 (부모는 현황 확인 및 안내 토스트)
                            Button {
                                store.showToast("체크리스트는 아이 폰에서만 직접 체크할 수 있어요 😊")
                            } label: {
                                Image(
                                    systemName: isParentVerified
                                        ? "checkmark.seal.fill"
                                        : (isCompleted ? "checkmark.circle.fill" : "circle.dashed")
                                )
                                .font(.system(size: 26, weight: .semibold))
                                .foregroundStyle(
                                    isParentVerified
                                        ? Color.green
                                        : (isCompleted ? Color.blue : Color.secondary.opacity(0.55))
                                )
                                .contentTransition(.symbolEffect(.replace))
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 2)
                        }
                    } else {
                        // 생활·습관 및 자유·여가 등 체크 제외 항목은 체크박스 대신 아이콘 배지로 일정만 표시
                        ZStack {
                            Circle()
                                .fill(item.category.softBackgroundColor)
                                .frame(width: 26, height: 26)
                            Image(systemName: item.iconName)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(item.category.color)
                        }
                        .padding(.top, 2)
                    }

                    // 제목 & 카테고리 태그
                    Button(action: onTapEdit) {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(spacing: 6) {
                                Label(item.category.title, systemImage: item.iconName)
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(item.category.softBackgroundColor)
                                    .foregroundStyle(item.category.color)
                                    .clipShape(Capsule())

                                if item.isNotificationEnabled {
                                    HStack(spacing: 2) {
                                        Image(systemName: "bell.fill")
                                        Text(item.notificationSummaryText)
                                    }
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.orange)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.12))
                                    .clipShape(Capsule())
                                }
                            }

                            if let badgeText = adjustmentBadge {
                                HStack(spacing: 6) {
                                    HStack(spacing: 3) {
                                        Image(systemName: item.isThisWeekOnlyAddition ? "sparkles" : "calendar.badge.clock")
                                        Text(badgeText)
                                    }
                                    .font(.system(size: 10.5, weight: .bold))
                                    .foregroundStyle(Color.orange)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2.5)
                                    .background(Color.orange.opacity(0.14))
                                    .clipShape(Capsule())

                                    if !item.isThisWeekOnlyAddition {
                                        Button {
                                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                                store.revertThisWeekOverride(for: item.id)
                                            }
                                        } label: {
                                            HStack(spacing: 2) {
                                                Image(systemName: "arrow.uturn.backward")
                                                Text("원래대로")
                                            }
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(.blue)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2.5)
                                            .background(Color.blue.opacity(0.12))
                                            .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            Text(item.title)
                                .font(.body.weight(.bold))
                                .foregroundStyle(isCompleted ? .secondary : .primary)
                                .strikethrough(isCompleted, color: .secondary)
                                .multilineTextAlignment(.leading)

                            if !item.note.isEmpty {
                                Text(item.note)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    // 우측 빠른 알림 토글 & 수정 아이콘
                    VStack(spacing: 8) {
                        Button {
                            withAnimation {
                                store.toggleNotification(for: item)
                            }
                        } label: {
                            Image(systemName: item.isNotificationEnabled ? "bell.fill" : "bell.slash")
                                .font(.subheadline)
                                .foregroundStyle(item.isNotificationEnabled ? .orange : .secondary.opacity(0.5))
                                .frame(width: 30, height: 30)
                                .background(
                                    Circle()
                                        .fill(item.isNotificationEnabled ? Color.orange.opacity(0.14) : Color(.tertiarySystemFill))
                                )
                        }
                        .buttonStyle(.plain)

                        Button(action: onTapEdit) {
                            Image(systemName: "slider.horizontal.3")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // 부모님이 보낸 ❤️ 하트 및 칭찬 메시지 배지 표시 (체크 대상 일정만)
                if item.isCheckable, let reaction = parentReaction {
                    HStack(alignment: .top, spacing: 8) {
                        if reaction.heartCount > 0 {
                            HStack(spacing: 3) {
                                Text(reaction.sticker.emoji)
                                    .font(.caption)
                                Image(systemName: "heart.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.pink)
                                Text("×\(reaction.heartCount)")
                                    .font(.caption.weight(.heavy))
                                    .foregroundStyle(.pink)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.pink.opacity(0.15))
                            .clipShape(Capsule())
                        } else {
                            HStack(spacing: 3) {
                                Text(reaction.sticker.emoji)
                                    .font(.caption)
                                Image(systemName: "bubble.left.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.blue)
                                Text("응원")
                                    .font(.caption.weight(.heavy))
                                    .foregroundStyle(.blue)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.15))
                            .clipShape(Capsule())
                        }

                        if !reaction.allComments.isEmpty {
                            VStack(alignment: .leading, spacing: 3) {
                                ForEach(reaction.allComments) { c in
                                    HStack(alignment: .top, spacing: 4) {
                                        if reaction.allComments.count > 1 {
                                            Image(systemName: "bubble.left")
                                                .font(.system(size: 9))
                                                .foregroundStyle(.secondary)
                                                .padding(.top, 2)
                                        }
                                        Text(c.text)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.primary)
                                            .lineLimit(2)
                                    }
                                }
                            }
                        } else if !reaction.comment.isEmpty {
                            Text(reaction.comment)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                        } else {
                            Text("부모님이 \(reaction.sticker.label) 응원을 보냈어요!")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                        }

                        Spacer()
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(reaction.heartCount > 0 ? Color.pink.opacity(0.08) : Color.blue.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.leading, 34)
                }

                // 세부 항목 (SubTasks)이 있을 경우
                if !item.subTasks.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(item.subTasks) { sub in
                            if item.isCheckable {
                                let subDone = store.isSubTaskCompleted(sub)
                                let subVerified = store.isSubTaskParentVerified(sub)

                                HStack(spacing: 8) {
                                    if store.deviceRole == .child {
                                        // 아이 세부 할 일 체크 버튼 (아이 폰에서만 직접 체크 가능)
                                        Button {
                                            if (isParentVerified || subVerified) && !store.isParentModeUnlocked {
                                                onRequestParentAuth(
                                                    "부모님이 확인한 세부 숙제예요.\n수정하려면 부모님 6자리 마스터 PIN을 입력해 주세요."
                                                ) {
                                                    _ = store.toggleSubTaskCompletion(sub, in: item)
                                                }
                                            } else {
                                                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                                    _ = store.toggleSubTaskCompletion(sub, in: item)
                                                }
                                            }
                                        } label: {
                                            HStack(spacing: 8) {
                                                Image(systemName: subDone ? "checkmark.square.fill" : "square")
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(
                                                        subVerified ? .green : (subDone ? .blue : item.category.color)
                                                    )
                                                Text(sub.title)
                                                    .font(.footnote.weight(.medium))
                                                    .foregroundStyle(subDone ? .secondary : .primary)
                                                    .strikethrough(subDone, color: .secondary)
                                                Spacer()
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    } else {
                                        // 부모 폰에서는 읽기 전용 (탭 시 안내)
                                        Button {
                                            store.showToast("세부 할 일은 아이 폰에서만 직접 체크할 수 있어요 😊")
                                        } label: {
                                            HStack(spacing: 8) {
                                                Image(systemName: subDone ? "checkmark.square.fill" : "square.dashed")
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(
                                                        subVerified ? .green : (subDone ? .blue : Color.secondary.opacity(0.55))
                                                    )
                                                Text(sub.title)
                                                    .font(.footnote.weight(.medium))
                                                    .foregroundStyle(subDone ? .secondary : .primary)
                                                    .strikethrough(subDone, color: .secondary)
                                                Spacer()
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    }

                                    // 어른 세부 항목 확인 배지/버튼
                                    Button {
                                        let reason = subVerified
                                            ? "[\(sub.title)] 부모 확인을 해제하려면 6자리 마스터 PIN을 입력해 주세요."
                                            : "[\(sub.title)] 숙제를 부모 확인 처리합니다."
                                        onRequestParentAuth(reason) {
                                            store.toggleSubTaskParentVerification(sub, in: item)
                                        }
                                    } label: {
                                        HStack(spacing: 3) {
                                            Image(
                                                systemName: subVerified
                                                    ? "checkmark.seal.fill"
                                                    : (store.isParentModeUnlocked ? "checkmark.seal" : "lock.fill")
                                            )
                                            Text(subVerified ? "확인됨" : "부모확인")
                                        }
                                        .font(.system(size: 10, weight: .bold))
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 4)
                                        .background(
                                            subVerified
                                                ? Color.green.opacity(0.16)
                                                : Color(.secondarySystemGroupedBackground)
                                        )
                                        .foregroundStyle(subVerified ? Color.green : Color.secondary)
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(!subVerified && !store.canParentVerifySubTask(sub))
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(.tertiarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            } else {
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(item.category.color)
                                        .frame(width: 5, height: 5)
                                    Text(sub.title)
                                        .font(.footnote.weight(.medium))
                                        .foregroundStyle(.primary)
                                    Spacer()
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color(.tertiarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }
                    .padding(.leading, 34)
                }

                // 하단 2단계 체크 상태 바 + ❤️ 하트 보내기 버튼 (체크 대상 일정만 표시)
                if item.isCheckable {
                    verificationFooterBar(isCompleted: isCompleted, isParentVerified: isParentVerified)
                        .padding(.leading, 34)
                }
            }
            .padding(13)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isActive
                            ? Color.accentColor
                            : (isParentVerified
                                ? Color.green.opacity(0.55)
                                : (isCompleted
                                    ? Color.blue.opacity(0.35)
                                    : (adjustmentBadge != nil ? Color.orange.opacity(0.45) : Color.clear))),
                        lineWidth: isActive ? 2.2 : 1.3
                    )
            )
            .shadow(color: isActive ? Color.accentColor.opacity(0.15) : Color.black.opacity(0.03), radius: isActive ? 8 : 3, x: 0, y: 2)
            .contextMenu {
                Button(action: onTapEdit) {
                    Label("이번 주만 시간·내용 조정", systemImage: "calendar.badge.clock")
                }

                if !item.isThisWeekOnlyAddition {
                    Button(action: onTapEditMaster) {
                        Label("전체 기본 시간표(매주) 변경", systemImage: "calendar")
                    }

                    if store.hasThisWeekOverride(for: item.id) {
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                store.revertThisWeekOverride(for: item.id)
                            }
                        } label: {
                            Label("이번 주 조정 취소 (원래 시간표로 복구)", systemImage: "arrow.uturn.backward")
                        }
                    }

                    if !(isParentVerified && !store.isParentModeUnlocked) {
                        Button(role: .destructive) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                _ = store.skipItemForThisWeek(item)
                            }
                        } label: {
                            Label("이번 주만 휴강·제외 (다음 주 자동 복구)", systemImage: "calendar.badge.minus")
                        }
                    }
                } else {
                    if !(isParentVerified && !store.isParentModeUnlocked) {
                        Button(role: .destructive) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                _ = store.deleteItem(item)
                            }
                        } label: {
                            Label("이번 주 추가 일정 삭제", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func verificationFooterBar(isCompleted: Bool, isParentVerified: Bool) -> some View {
        HStack(spacing: 6) {
            if isParentVerified {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Text("부모님 확인 완료!")
                        .fontWeight(.bold)
                        .foregroundStyle(.green)
                }
                .font(.caption)
            } else if isCompleted {
                HStack(spacing: 4) {
                    Image(systemName: "hand.raised.fill")
                        .foregroundStyle(.orange)
                    Text(store.deviceRole == .parent ? "아이가 완료함 (확인 도장 찍기)" : "부모님 확인 대기 중")
                        .fontWeight(.semibold)
                        .foregroundStyle(.orange)
                }
                .font(.caption)
            } else {
                if store.deviceRole == .child {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            _ = store.toggleCompletion(for: item)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "circle")
                            Text("다 했어요 체크!")
                        }
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .foregroundStyle(.secondary)
                        Text("아이 완료 대기 중")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            // 부모님 ❤️ 하트/응원 메시지 보내기 버튼
            Button {
                onTapSendHeart(item)
            } label: {
                HStack(spacing: 3) {
                    if let r = store.reaction(for: item), r.heartCount > 0 {
                        Image(systemName: "heart.fill")
                        Text("\(r.heartCount)")
                    } else if let r = store.reaction(for: item), !r.allComments.isEmpty {
                        Image(systemName: "bubble.left.fill")
                        Text("\(r.allComments.count)")
                    } else {
                        Image(systemName: "heart.fill")
                        Text("응원")
                    }
                }
                .font(.caption.weight(.bold))
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(
                    (store.reaction(for: item)?.heartCount ?? 0) > 0
                        ? Color.pink.opacity(0.15)
                        : ((store.reaction(for: item)?.allComments.isEmpty == false) ? Color.blue.opacity(0.15) : Color.pink.opacity(0.15))
                )
                .foregroundStyle(
                    (store.reaction(for: item)?.heartCount ?? 0) > 0
                        ? Color.pink
                        : ((store.reaction(for: item)?.allComments.isEmpty == false) ? Color.blue : Color.pink)
                )
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            // 2단계 어른 전용 확인 버튼 (6자리 마스터 PIN 또는 부모 폰 Face ID 잠금 보호)
            Button {
                let reason = isParentVerified
                    ? "[\(item.title)]의 부모님 확인 도장을 취소하려면 6자리 마스터 PIN을 입력해 주세요."
                    : "[\(item.title)] 숙제를 확인하고 도장을 찍어주세요."
                onRequestParentAuth(reason) {
                    store.toggleParentVerification(for: item)
                }
            } label: {
                HStack(spacing: 4) {
                    Image(
                        systemName: isParentVerified
                            ? "checkmark.seal.fill"
                            : (store.isParentModeUnlocked ? "checkmark.seal" : "lock.fill")
                    )
                    Text(
                        isParentVerified
                            ? "확인됨"
                            : (isCompleted ? "부모님 확인" : "부모 확인")
                    )
                }
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    isParentVerified
                        ? Color.green.opacity(0.16)
                        : (isCompleted ? Color.indigo : Color(.tertiarySystemFill))
                )
                .foregroundStyle(
                    isParentVerified
                        ? Color.green
                        : (isCompleted ? Color.white : Color.secondary)
                )
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(!isParentVerified && !store.canParentVerify(item))
        }
        .padding(.top, 2)
    }
}
