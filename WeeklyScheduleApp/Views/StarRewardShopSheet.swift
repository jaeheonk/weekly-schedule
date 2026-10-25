import SwiftUI

// MARK: - 1. 주간 스타 스탬프 보드 카드 (월~금 5칸 + 주간 올클리어 보너스 +2⭐ 슬롯)
struct WeeklyStarStampBoardCard: View {
    @EnvironmentObject var store: ScheduleStore
    var onTapWeekdaySlot: (Weekday) -> Void
    var onTapStarShop: () -> Void
    var onRequestAwardStar: (Weekday) -> Void
    var initiallyExpanded: Bool = false
    var showsShopButton: Bool = true

    @State private var isExpanded: Bool = false

    init(
        onTapWeekdaySlot: @escaping (Weekday) -> Void,
        onTapStarShop: @escaping () -> Void,
        onRequestAwardStar: @escaping (Weekday) -> Void,
        initiallyExpanded: Bool = false,
        showsShopButton: Bool = true
    ) {
        self.onTapWeekdaySlot = onTapWeekdaySlot
        self.onTapStarShop = onTapStarShop
        self.onRequestAwardStar = onRequestAwardStar
        self.initiallyExpanded = initiallyExpanded
        self.showsShopButton = showsShopButton
        self._isExpanded = State(initialValue: initiallyExpanded)
    }

    /// 선택된 요일 우선, 없으면 이번 주 수여 대기(.claimable) 중인 첫 평일 반환 (Progressive Disclosure)
    private var activeClaimableTarget: (day: Weekday, total: Int)? {
        let selected = store.selectedWeekday
        if case .claimable(let total) = store.weekdayStarState(for: selected) {
            return (selected, total)
        }
        if case .claimable(let todayTotal) = store.weekdayStarState(for: store.todayWeekday) {
            return (store.todayWeekday, todayTotal)
        }
        for day in Weekday.weekdaysOnly {
            if case .claimable(let total) = store.weekdayStarState(for: day) {
                return (day, total)
            }
        }
        return nil
    }

    var body: some View {
        let earnedCount = store.awardedDailyStarCount()
        let bonusAwarded = store.isWeeklyBonusAwarded()
        let selectedDay = store.selectedWeekday
        let selectedDayState = store.weekdayStarState(for: selectedDay)
        let claimableTarget = activeClaimableTarget

        VStack(alignment: .leading, spacing: 8) {
            // 상단 컴팩트 바: 좌측(접기/펼치기 + 미니 스탬프 현황) & 우측(스타 상점 진입 버튼)
            HStack(alignment: .center, spacing: 8) {
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "star.circle.fill")
                            .font(.headline)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.yellow, .orange],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )

                        Text("평일 스타")
                            .font(.footnote.weight(.heavy))
                            .foregroundStyle(.primary)
                            .lineLimit(1)

                        Text("\(earnedCount)/5")
                            .font(.system(size: 10, weight: .heavy))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(Color.orange.opacity(0.16))
                            .foregroundStyle(Color.orange)
                            .clipShape(Capsule())

                        if !isExpanded {
                            compactMiniStampStrip(bonusAwarded: bonusAwarded)
                        }

                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.secondary)
                            .padding(.leading, 2)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 4)

                // 스타 상점 열기 버튼 (중복 제거된 단일 진입점 · 대기 중 신청 건수 배지 포함)
                if showsShopButton {
                    Button(action: onTapStarShop) {
                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .foregroundStyle(.yellow)
                            Text("스타 상점 \(store.availableStars)개")
                                .font(.caption.weight(.heavy))
                            if store.pendingStarRedemptionCount > 0 {
                                Text("\(store.pendingStarRedemptionCount)")
                                    .font(.system(size: 9, weight: .heavy))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1.5)
                                    .background(Color.red)
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())
                            } else {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 9, weight: .bold))
                                    .opacity(0.75)
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            LinearGradient(
                                colors: [Color.orange, Color(red: 0.95, green: 0.38, blue: 0.18)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                        .shadow(color: Color.orange.opacity(0.22), radius: 3, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                }
            }

            // 펼침 상태일 때만 월~금 상세 스탬프 슬롯 + 주간 보너스 슬롯 노출
            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        ForEach(Weekday.weekdaysOnly) { day in
                            let state = store.weekdayStarState(for: day)
                            let isSelected = (store.selectedWeekday == day)
                            Button {
                                onTapWeekdaySlot(day)
                            } label: {
                                weekdayStampCell(day: day, state: state, isSelected: isSelected)
                            }
                            .buttonStyle(.plain)
                        }

                        // 오른쪽 끝: 주간 올클리어 보너스 (+2⭐) 슬롯
                        Button(action: onTapStarShop) {
                            weeklyBonusStampCell(earnedCount: earnedCount, bonusAwarded: bonusAwarded)
                        }
                        .buttonStyle(.plain)
                    }

                    if claimableTarget == nil {
                        expandedStatusCaption(for: selectedDay, state: selectedDayState)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            // Progressive Disclosure: 스타 수여 대기(.claimable) 상태일 때만 접힌 상태에서도 즉시 액션 배너 자동 노출
            if let target = claimableTarget {
                claimableActionBanner(for: target.day, total: target.total)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(.secondarySystemGroupedBackground))
                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    claimableTarget != nil
                        ? Color.pink.opacity(0.65)
                        : (bonusAwarded ? Color.orange.opacity(0.65) : Color.yellow.opacity(0.35)),
                    lineWidth: claimableTarget != nil ? 1.5 : 1.2
                )
        )
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }

    /// 접힌 상태에서 월~금 스탬프 현황과 주간 보너스를 한눈에 보여주는 인라인 미니 배지 스트립
    @ViewBuilder
    private func compactMiniStampStrip(bonusAwarded: Bool) -> some View {
        HStack(spacing: 3) {
            ForEach(Weekday.weekdaysOnly) { day in
                let state = store.weekdayStarState(for: day)
                ZStack {
                    Circle()
                        .fill(miniSlotBackground(for: state))
                        .frame(width: 18, height: 18)

                    switch state {
                    case .awarded:
                        Image(systemName: "star.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.orange)
                    case .claimable:
                        Image(systemName: "sparkles")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundStyle(.white)
                    case .inProgress:
                        Text(day.shortName)
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundStyle(.secondary)
                    case .ineligibleEmpty, .weekendExcluded:
                        Text(day.shortName)
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            // 주간 올클리어 +2⭐ 미니 아이콘
            ZStack {
                Capsule()
                    .fill(
                        bonusAwarded
                            ? AnyShapeStyle(LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing))
                            : AnyShapeStyle(Color.purple.opacity(0.12))
                    )
                    .frame(width: 24, height: 18)

                Text(bonusAwarded ? "👑" : "+2")
                    .font(.system(size: 8.5, weight: .heavy))
                    .foregroundStyle(bonusAwarded ? .white : Color.purple)
            }
        }
    }

    private func miniSlotBackground(for state: WeekdayStarState) -> AnyShapeStyle {
        switch state {
        case .awarded:
            return AnyShapeStyle(Color.yellow.opacity(0.28))
        case .claimable:
            return AnyShapeStyle(
                LinearGradient(colors: [.orange, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
            )
        case .inProgress:
            return AnyShapeStyle(Color(.tertiarySystemGroupedBackground))
        case .ineligibleEmpty, .weekendExcluded:
            return AnyShapeStyle(Color(.tertiarySystemGroupedBackground).opacity(0.5))
        }
    }

    @ViewBuilder
    private func weekdayStampCell(day: Weekday, state: WeekdayStarState, isSelected: Bool) -> some View {
        VStack(spacing: 4) {
            Text(day.shortName)
                .font(.caption2.weight(.heavy))
                .foregroundStyle(isSelected ? Color.orange : .secondary)

            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(slotBackgroundColor(for: state))
                    .frame(height: 36)

                switch state {
                case .awarded:
                    VStack(spacing: 1) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.yellow, .orange],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                        Text("+1⭐")
                            .font(.system(size: 8.5, weight: .heavy))
                            .foregroundStyle(Color.orange)
                    }

                case .claimable:
                    VStack(spacing: 1) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                        Text("수여대기")
                            .font(.system(size: 8, weight: .heavy))
                            .foregroundStyle(.white)
                    }

                case .inProgress(_, let verified, let total):
                    VStack(spacing: 1) {
                        Image(systemName: "star")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                        Text("\(verified)/\(total)")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundStyle(.secondary)
                    }

                case .ineligibleEmpty, .weekendExcluded:
                    VStack(spacing: 1) {
                        Image(systemName: "minus.circle")
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                        Text("일정없음")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        isSelected ? Color.orange : slotBorderColor(for: state),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func weeklyBonusStampCell(earnedCount: Int, bonusAwarded: Bool) -> some View {
        VStack(spacing: 4) {
            Text("올클리어")
                .font(.caption2.weight(.heavy))
                .foregroundStyle(bonusAwarded ? Color.purple : .secondary)

            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        bonusAwarded
                            ? LinearGradient(
                                colors: [Color.purple, Color.pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            : LinearGradient(
                                colors: [Color.purple.opacity(0.10), Color.orange.opacity(0.12)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                    )
                    .frame(height: 36)

                VStack(spacing: 1) {
                    Image(systemName: bonusAwarded ? "crown.fill" : "gift.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(bonusAwarded ? .yellow : Color.purple)
                    Text(bonusAwarded ? "+2⭐완료" : "+2⭐보너스")
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(bonusAwarded ? .white : Color.purple)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        bonusAwarded ? Color.yellow : Color.purple.opacity(0.35),
                        lineWidth: bonusAwarded ? 1.8 : 1
                    )
            )
        }
        .frame(maxWidth: .infinity)
    }

    /// 스타 수여 가능(.claimable) 상태일 때 자동 노출되는 액션 배너 (Progressive Disclosure)
    @ViewBuilder
    private func claimableActionBanner(for weekday: Weekday, total: Int) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.orange)

            VStack(alignment: .leading, spacing: 1) {
                Text("🎉 \(weekday.fullName) 할 일 \(total)개 올클리어 & 부모 확인 완료!")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text("부모님이 버튼을 누르면 오늘의 스타(+1⭐)가 지급돼요.")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            Button {
                onRequestAwardStar(weekday)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: store.isParentModeUnlocked ? "star.fill" : "lock.fill")
                    Text("⭐ +1 스타 수여")
                }
                .font(.caption.weight(.heavy))
                .padding(.horizontal, 11)
                .padding(.vertical, 6)
                .background(
                    LinearGradient(
                        colors: [.orange, .pink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundStyle(.white)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.orange.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    /// 펼침 상태에서만 표시되는 1줄 요약 안내
    @ViewBuilder
    private func expandedStatusCaption(for weekday: Weekday, state: WeekdayStarState) -> some View {
        switch state {
        case .claimable:
            EmptyView()

        case .awarded:
            HStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.orange)
                    .font(.caption2)
                Text("\(weekday.fullName) 올클리어 스타(+1⭐) 지급 완료!")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if store.isWeeklyBonusAwarded() {
                    Text("👑 주간 +2⭐ 달성!")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(.purple)
                }
            }

        case .weekendExcluded:
            HStack(spacing: 6) {
                Image(systemName: "sun.max.fill")
                    .foregroundStyle(.orange)
                    .font(.caption2)
                Text("주말(토·일)은 평일 스타 적립 제외 · 하트(❤️) 응원은 언제든 가능해요!")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
            }

        case .ineligibleEmpty:
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .foregroundStyle(.secondary)
                    .font(.caption2)
                Text("\(weekday.fullName)은 체크 가능한 할 일이 없어 스타 적립에서 제외됩니다.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
            }

        case .inProgress(let completed, let verified, let total):
            HStack(spacing: 6) {
                Image(systemName: "flag.checkered")
                    .foregroundStyle(.orange)
                    .font(.caption2)
                Text("\(weekday.fullName) 퀘스트: 아이 완료 \(completed)/\(total) · 부모 확인 \(verified)/\(total) (5일 올클리어 시 👑+2⭐)")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
            }
        }
    }

    private func slotBackgroundColor(for state: WeekdayStarState) -> AnyShapeStyle {
        switch state {
        case .awarded:
            return AnyShapeStyle(Color.yellow.opacity(0.20))
        case .claimable:
            return AnyShapeStyle(
                LinearGradient(
                    colors: [Color.orange, Color.pink],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        case .inProgress:
            return AnyShapeStyle(Color(.tertiarySystemGroupedBackground))
        case .ineligibleEmpty, .weekendExcluded:
            return AnyShapeStyle(Color(.tertiarySystemGroupedBackground).opacity(0.5))
        }
    }

    private func slotBorderColor(for state: WeekdayStarState) -> Color {
        switch state {
        case .awarded:
            return Color.orange.opacity(0.75)
        case .claimable:
            return Color.pink
        case .inProgress:
            return Color.secondary.opacity(0.2)
        case .ineligibleEmpty, .weekendExcluded:
            return Color.clear
        }
    }
}

// MARK: - 2. 스타 획득 축하 배너/모달 (일일 +1⭐ 및 주간 올클리어 +2⭐ 통합 축하)
struct StarCelebrationModalView: View {
    let context: StarCelebrationContext
    var onDismiss: () -> Void
    var onOpenStarShop: () -> Void

    @State private var animateScale: Bool = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }

            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.yellow.opacity(0.45), Color.orange.opacity(0.05)],
                                center: .center,
                                startRadius: 10,
                                endRadius: 70
                            )
                        )
                        .frame(width: 120, height: 120)
                        .scaleEffect(animateScale ? 1.08 : 0.92)

                    Text(context.earnedWeeklyBonus > 0 ? "👑" : "⭐")
                        .font(.system(size: 58))
                        .scaleEffect(animateScale ? 1.05 : 0.85)
                }

                VStack(spacing: 6) {
                    if context.earnedWeeklyBonus > 0 {
                        Text("🎉 이번 주 평일 올클리어 달성!")
                            .font(.title3.weight(.heavy))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.orange, .purple],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        Text("\(context.weekday?.fullName ?? "평일") 스타 +1개와 주간 올클리어 자동 보너스 +2개를 한꺼번에 받았어요!")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    } else {
                        Text("⭐ \(context.weekday?.fullName ?? "오늘")의 올클리어 스타 획득!")
                            .font(.title3.weight(.heavy))
                            .foregroundStyle(.primary)
                        Text("오늘 해야 할 일을 모두 끝내고 부모님 확인까지 완벽히 마쳤어요!")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }

                // 획득 내역 요약 칩
                HStack(spacing: 10) {
                    HStack(spacing: 4) {
                        Text("⭐ 일일 보상")
                            .font(.caption.weight(.semibold))
                        Text("+\(context.earnedDailyStar)")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(.orange)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.14))
                    .clipShape(Capsule())

                    if context.earnedWeeklyBonus > 0 {
                        HStack(spacing: 4) {
                            Text("👑 주간 올클리어")
                                .font(.caption.weight(.semibold))
                            Text("+\(context.earnedWeeklyBonus)")
                                .font(.subheadline.weight(.heavy))
                                .foregroundStyle(.purple)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.purple.opacity(0.14))
                        .clipShape(Capsule())
                    }
                }

                Text("현재 보유 스타: \(context.totalAvailableStars)⭐")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    Button {
                        onDismiss()
                    } label: {
                        Text("확인")
                            .font(.subheadline.weight(.bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color(.tertiarySystemFill))
                            .foregroundStyle(.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)

                    Button {
                        onDismiss()
                        onOpenStarShop()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                            Text("스타 상점 가기")
                        }
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(
                                colors: [.orange, .pink],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(24)
            .frame(maxWidth: 380)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color(.systemBackground))
                    .shadow(color: Color.black.opacity(0.25), radius: 20, x: 0, y: 10)
            )
            .padding(.horizontal, 24)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                animateScale = true
            }
        }
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }
}

// MARK: - 3. 스타 보상 상점 & 원장(Ledger) 시트 (StarRewardShopSheet)
struct StarRewardShopSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var pinPrompt: ParentPinPromptContext? = nil
    @State private var showingAddPresetSheet: Bool = false
    @State private var selectedTab: ShopSectionTab = .rewards

    enum ShopSectionTab: String, CaseIterable {
        case rewards = "보상 교환소"
        case ledger = "스타 원장 내역"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    // 1. 상단 히어로 잔액 & 로벅스 500개 목표 프로그레스 카드
                    starBalanceHeroCard

                    // 2. 이번 주 스탬프 보드 요약 (미수여 평일 바로 수여 가능 · 상점 내부에서는 펼침 상태 기본, 중복 상점 버튼 숨김)
                    WeeklyStarStampBoardCard(
                        onTapWeekdaySlot: { day in
                            store.selectedWeekday = day
                        },
                        onTapStarShop: {},
                        onRequestAwardStar: { day in
                            authenticateParent(
                                reason: "\(day.fullName)의 모든 할 일이 완료되었습니다. +1 스타를 수여할까요?"
                            ) {
                                _ = store.awardDailyStar(for: day)
                            }
                        },
                        initiallyExpanded: true,
                        showsShopButton: false
                    )

                    // 3. 부모 승인 대기 중인 교환 신청 큐 (Pending Queue)
                    let pendingList = store.starRedemptionRequests.filter { $0.status == .pending }
                    if !pendingList.isEmpty {
                        pendingApprovalsSection(pendingList)
                    }

                    // 4. 탭 전환 (보상 교환소 vs 스타 원장 내역)
                    Picker("상점 섹션", selection: $selectedTab) {
                        ForEach(ShopSectionTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)

                    if selectedTab == .rewards {
                        rewardCatalogSection
                        resolvedRedemptionsSection
                    } else {
                        ledgerHistorySection
                    }
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("⭐ 스타 보상 상점")
            .inlineNavigationBarTitle()
            #if os(iOS)
            .dynamicTypeSize(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            authenticateParent(reason: "새로운 스타 보상을 추가하려면 부모 인증이 필요해요.") {
                                showingAddPresetSheet = true
                            }
                        } label: {
                            Label("새 스타 보상 추가", systemImage: "plus.circle")
                        }

                        Button(role: .destructive) {
                            authenticateParent(reason: "스타 보상 목록을 기본값으로 초기화하려면 부모 인증이 필요해요.") {
                                store.resetStarRewardPresetsToDefault()
                            }
                        } label: {
                            Label("기본 보상으로 초기화", systemImage: "arrow.counterclockwise")
                        }

                        Divider()

                        Button(role: .destructive) {
                            authenticateParent(reason: "잘못 추가된 모든 스타 기록을 초기화하고 아이 폰과 동기화할까요?") {
                                Task {
                                    await store.resetAllStarTransactionsAndSync()
                                }
                            }
                        } label: {
                            Label("잘못 추가된 스타 모두 초기화 (아이 폰 동기화)", systemImage: "trash.circle")
                        }
                    } label: {
                        Label("보상 관리", systemImage: "slider.horizontal.3")
                    }
                }
            }
            .sheet(item: $pinPrompt) { prompt in
                ParentPinSheet(context: prompt)
            }
            .sheet(isPresented: $showingAddPresetSheet) {
                AddStarRewardPresetSheet()
                    .environmentObject(store)
            }
            .task {
                await store.syncNow(forceUploadIfEmpty: false)
            }
            .refreshable {
                await store.syncNow(forceUploadIfEmpty: false)
            }
        }
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }

    // MARK: - 상단 스타 잔액 & 목표 프로그레스 히어로 카드
    private var starBalanceHeroCard: some View {
        let robuxTarget = 10
        let progress = min(1.0, Double(store.availableStars) / Double(robuxTarget))

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("보유 중인 스타")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white.opacity(0.85))

                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("⭐ \(store.availableStars)")
                            .font(.system(size: 34, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                        Text("개")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(.white.opacity(0.9))
                    }

                    if store.reservedPendingStars > 0 {
                        Text("승인 대기 중 \(store.reservedPendingStars)⭐ · 추가 신청 가능 \(store.requestableStars)⭐")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.yellow)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(.pink)
                        Text("보유 하트 \(store.availableHearts)개")
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(.pink)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.white)
                    .clipShape(Capsule())

                    Text("이번 주 획득: +\(store.thisWeekEarnedStars)⭐ (최대 7⭐)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white.opacity(0.9))
                }
            }

            // 로블록스 로벅스 500개 (10⭐) 게이지 바
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("🎮 스페셜 목표: 로블록스 로벅스 500개")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(.white)
                    Spacer()
                    Text("\(min(store.availableStars, robuxTarget)) / \(robuxTarget) ⭐")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(.yellow)
                }

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.22))
                            .frame(height: 10)
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [.yellow, .green],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(10, geo.size.width * progress), height: 10)
                    }
                }
                .frame(height: 10)
            }
            .padding(12)
            .background(Color.black.opacity(0.18))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.96, green: 0.52, blue: 0.12),
                    Color(red: 0.88, green: 0.26, blue: 0.48),
                    Color.indigo
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - 부모 승인 대기 중인 신청 목록
    private func pendingApprovalsSection(_ pendingList: [StarRedemptionRequest]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("부모님 승인 대기 중인 교환 신청 (\(pendingList.count)건)", systemImage: "bell.badge.fill")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(.orange)
                Spacer()
            }

            ForEach(pendingList) { req in
                HStack(spacing: 12) {
                    Text(req.emoji)
                        .font(.title2)
                        .frame(width: 42, height: 42)
                        .background(Color.orange.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(req.rewardTitle)
                                .font(.subheadline.weight(.bold))
                            Text("-\(req.starCost)⭐")
                                .font(.caption.weight(.heavy))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
                        }
                        Text("\(formatDate(req.requestedAt)) · \(req.requestedByRole) 신청")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    // 취소/반려 버튼
                    Button {
                        store.rejectStarRedemption(req)
                    } label: {
                        Text("취소")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Color(.tertiarySystemFill))
                            .foregroundStyle(.secondary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    // 부모 승인 버튼
                    Button {
                        authenticateParent(
                            reason: "[\(req.rewardTitle)] 보상을 승인하고 스타 \(req.starCost)개를 차감할까요?"
                        ) {
                            _ = store.approveStarRedemption(req)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: store.isParentModeUnlocked ? "checkmark.seal.fill" : "lock.fill")
                            Text("부모 승인")
                        }
                        .font(.caption.weight(.heavy))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.green)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(14)
        .background(Color.orange.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.orange.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - 보상 카탈로그 섹션 (1⭐ -> 하트 5개 보너스 상자, 10⭐ -> 로블록스 로벅스 500개 등)
    private var rewardCatalogSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("교환 가능한 스타 보상")
                    .font(.headline.weight(.bold))
                Spacer()
                Text(store.deviceRole == .child ? "아이가 신청하면 부모님이 승인해요" : "부모님 폰에서 즉시 승인·지급 가능")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            ForEach(store.starRewardPresets) { preset in
                let canRequest = store.requestableStars >= preset.starCost
                let canApproveNow = store.availableStars >= preset.starCost

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Text(preset.emoji)
                            .font(.system(size: 30))
                            .frame(width: 54, height: 54)
                            .background(
                                preset.actionType == .convertToHearts
                                    ? Color.pink.opacity(0.14)
                                    : Color.indigo.opacity(0.14)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14))

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(preset.badgeTag)
                                    .font(.system(size: 10, weight: .heavy))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2)
                                    .background(
                                        preset.actionType == .convertToHearts
                                            ? Color.pink.opacity(0.15)
                                            : Color.purple.opacity(0.15)
                                    )
                                    .foregroundStyle(
                                        preset.actionType == .convertToHearts ? Color.pink : Color.purple
                                    )
                                    .clipShape(Capsule())

                                if preset.actionType == .convertToHearts {
                                    Text("+❤️\(preset.grantedHearts)개 자동 충전")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundStyle(.pink)
                                }
                            }

                            Text(preset.title)
                                .font(.headline.weight(.bold))
                                .foregroundStyle(.primary)

                            Text(preset.subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 6) {
                            Text("⭐ \(preset.starCost)개")
                                .font(.subheadline.weight(.heavy))
                                .foregroundStyle(Color.orange)

                            if store.deviceRole == .child && !store.isParentModeUnlocked {
                                // 아이 모드: 교환 신청(Pending) 버튼 + 부모님과 함께 바로 받기 버튼
                                VStack(spacing: 5) {
                                    Button {
                                        _ = store.requestStarRedemption(preset: preset)
                                    } label: {
                                        Text(canRequest ? "교환 신청하기" : "스타 부족")
                                            .font(.caption.weight(.heavy))
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 7)
                                            .background(canRequest ? Color.orange : Color.gray.opacity(0.25))
                                            .foregroundStyle(canRequest ? .white : .secondary)
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(!canRequest)

                                    if canApproveNow {
                                        Button {
                                            authenticateParent(
                                                reason: "[\(preset.title)] 보상을 지금 바로 승인하고 지급할까요? (스타 \(preset.starCost)개 차감)"
                                            ) {
                                                _ = store.redeemStarRewardImmediately(preset: preset)
                                            }
                                        } label: {
                                            HStack(spacing: 3) {
                                                Image(systemName: "lock.fill")
                                                Text("부모님 바로승인")
                                            }
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(.indigo)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            } else {
                                // 부모 기기 또는 부모 모드 잠금 해제 상태: 즉시 승인 및 교환
                                Button {
                                    authenticateParent(
                                        reason: "[\(preset.title)] 보상을 승인하고 스타 \(preset.starCost)개를 차감할까요?"
                                    ) {
                                        _ = store.redeemStarRewardImmediately(preset: preset)
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: store.isParentModeUnlocked ? "checkmark.seal.fill" : "lock.fill")
                                        Text(canApproveNow ? "즉시 교환 승인" : "스타 부족")
                                    }
                                    .font(.caption.weight(.heavy))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(canApproveNow ? Color.green : Color.gray.opacity(0.25))
                                    .foregroundStyle(canApproveNow ? .white : .secondary)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                                .disabled(!canApproveNow)
                            }
                        }
                    }
                }
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .contextMenu {
                    Button(role: .destructive) {
                        authenticateParent(reason: "[\(preset.title)] 보상을 목록에서 삭제할까요?") {
                            store.deleteStarRewardPreset(id: preset.id)
                        }
                    } label: {
                        Label("이 보상 삭제", systemImage: "trash")
                    }
                }
            }
        }
    }

    // MARK: - 최근 승인/반려 완료 내역
    private var resolvedRedemptionsSection: some View {
        let resolved = store.starRedemptionRequests.filter { $0.status != .pending }.prefix(15)
        return Group {
            if !resolved.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("최근 교환 처리 내역")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.secondary)

                    ForEach(Array(resolved)) { req in
                        HStack(spacing: 10) {
                            Text(req.emoji)
                                .font(.title3)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(req.rewardTitle)
                                    .font(.caption.weight(.bold))
                                Text(formatDate(req.resolvedAt ?? req.requestedAt))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(req.status == .approved ? "승인 완료 (-\(req.starCost)⭐)" : "취소됨")
                                .font(.caption2.weight(.heavy))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    req.status == .approved
                                        ? Color.green.opacity(0.15)
                                        : Color.secondary.opacity(0.15)
                                )
                                .foregroundStyle(req.status == .approved ? .green : .secondary)
                                .clipShape(Capsule())
                        }
                        .padding(10)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }

    // MARK: - 스타 원장(Append-Only Ledger) 전체 트랜잭션 내역
    private var ledgerHistorySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("변경 불가능한 스타 원장 (총 \(store.starTransactions.count)건)")
                    .font(.subheadline.weight(.bold))
                Spacer()
                Text("누적 획득 +\(store.totalEarnedStars)⭐ · 누적 사용 -\(store.totalSpentStars)⭐")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            if store.starTransactions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "star.slash")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("아직 기록된 스타 원장 내역이 없어요.")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("평일(월~금) 할 일을 모두 마치고 부모님 확인을 받아 첫 스타를 모아보세요!")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                ForEach(store.starTransactions) { tx in
                    HStack(spacing: 12) {
                        Image(systemName: iconForTransaction(tx.kind))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(colorForTransaction(tx.kind))
                            .frame(width: 36, height: 36)
                            .background(colorForTransaction(tx.kind).opacity(0.14))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(tx.title)
                                .font(.subheadline.weight(.bold))
                            Text(tx.note)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text("\(formatDate(tx.createdAt)) · \(tx.createdByRole)")
                                .font(.system(size: 10))
                                .foregroundStyle(.tertiary)
                        }

                        Spacer()

                        Text(tx.delta > 0 ? "+\(tx.delta)⭐" : "\(tx.delta)⭐")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(tx.delta > 0 ? Color.orange : Color.pink)

                        Button {
                            authenticateParent(reason: "[\(tx.title)] 스타 내역을 영구 회수(삭제)하고 아이 폰과 동기화할까요?") {
                                Task {
                                    await store.revokeStarTransaction(tx)
                                }
                            }
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.secondary)
                                .padding(7)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("스타 내역 삭제")
                    }
                    .padding(12)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .contextMenu {
                        Button(role: .destructive) {
                            authenticateParent(reason: "[\(tx.title)] 스타 내역을 영구 회수(삭제)하고 아이 폰과 동기화할까요?") {
                                Task {
                                    await store.revokeStarTransaction(tx)
                                }
                            }
                        } label: {
                            Label("이 스타 내역 회수/삭제", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    private func authenticateParent(reason: String, action: @escaping () -> Void) {
        if store.isParentModeUnlocked {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                action()
            }
        } else {
            pinPrompt = ParentPinPromptContext(
                mode: .authenticate(reason: reason) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        action()
                    }
                }
            )
        }
    }

    private func iconForTransaction(_ kind: StarTransactionKind) -> String {
        switch kind {
        case .dailyAllClear: return "star.fill"
        case .weeklyAllClearBonus: return "crown.fill"
        case .rewardRedemption: return "gift.fill"
        }
    }

    private func colorForTransaction(_ kind: StarTransactionKind) -> Color {
        switch kind {
        case .dailyAllClear: return .orange
        case .weeklyAllClearBonus: return .purple
        case .rewardRedemption: return .pink
        }
    }

    private func formatDate(_ ts: TimeInterval) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M/d(E) HH:mm"
        return formatter.string(from: Date(timeIntervalSince1970: ts))
    }
}

// MARK: - 4. 새 스타 보상 프리셋 추가 시트 (부모 전용)
struct AddStarRewardPresetSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var emoji: String = "🎁"
    @State private var title: String = ""
    @State private var subtitle: String = ""
    @State private var starCost: Int = 5
    @State private var actionType: StarRewardActionType = .customVoucher
    @State private var grantedHearts: Int = 5
    @State private var badgeTag: String = "스페셜 보상"

    var body: some View {
        NavigationStack {
            Form {
                Section("보상 기본 정보") {
                    HStack {
                        Text("이모지")
                        Spacer()
                        TextField("🎮", text: $emoji)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 60)
                    }
                    TextField("보상 이름 (예: 주말 보드게임 카페 가기)", text: $title)
                    TextField("설명 문구 (선택)", text: $subtitle)
                    TextField("배지 태그 (예: 스페셜 목표)", text: $badgeTag)
                }

                Section("필요 스타 및 보상 유형") {
                    Stepper("필요 스타: ⭐ \(starCost)개", value: $starCost, in: 1...100)

                    Picker("보상 방식", selection: $actionType) {
                        Text("일반 교환권 (로벅스·용돈·외출 등)").tag(StarRewardActionType.customVoucher)
                        Text("하트(❤️) 즉시 충전 상자").tag(StarRewardActionType.convertToHearts)
                    }

                    if actionType == .convertToHearts {
                        Stepper("충전할 하트: ❤️ \(grantedHearts)개", value: $grantedHearts, in: 1...100)
                    }
                }
            }
            .navigationTitle("새 스타 보상 추가")
            .inlineNavigationBarTitle()
            #if os(iOS)
            .dynamicTypeSize(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("추가") {
                        store.addStarRewardPreset(
                            emoji: emoji,
                            title: title,
                            subtitle: subtitle,
                            starCost: starCost,
                            actionType: actionType,
                            grantedHearts: grantedHearts,
                            badgeTag: badgeTag
                        )
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }
}
