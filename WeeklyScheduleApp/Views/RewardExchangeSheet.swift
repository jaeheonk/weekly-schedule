import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// 아이가 모은 하트로 보상을 교환(차감)하는 시트
/// 부모 모드에서는 즉시 차감할 수 있으며, 아이 모드에서는 부모 마스터 PIN 확인 후 차감됩니다.
struct RewardExchangeSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var customTitle: String = ""
    @State private var heartsToSpend: Int = 10
    @State private var showingConfirmAlert: Bool = false
    @State private var redemptionToCancel: HeartRewardRedemption? = nil
    @State private var showingCancelAlert: Bool = false
    @State private var pinPrompt: ParentPinPromptContext? = nil
    @State private var showingManagePresetsSheet: Bool = false

    private var isParentAuthorized: Bool {
        store.deviceRole == .parent || store.isParentModeUnlocked
    }

    private var effectiveTitle: String {
        let clean = customTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? "보상 교환" : clean
    }

    private var canRedeem: Bool {
        heartsToSpend > 0 && store.availableHearts >= heartsToSpend && !effectiveTitle.isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 상단 하트 잔액 히어로 카드
                    balanceHeroCard

                    // 1. 추천 보상 선택 (프리셋) & 편집 버튼
                    presetSection

                    // 2. 보상 내용 및 차감할 하트 설정
                    exchangeFormSection

                    // 3. 최근 교환 내역
                    historySection
                }
                .padding()
            }
            .navigationTitle("🎁 하트 보상 교환")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .dynamicTypeSize(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                if customTitle.isEmpty {
                    if let firstPreset = store.rewardPresets.first {
                        customTitle = firstPreset.title
                        heartsToSpend = min(firstPreset.hearts, max(1, store.availableHearts))
                    } else {
                        customTitle = "자유 놀이 / 게임 30분"
                        heartsToSpend = 10
                    }
                }
            }
            .alert("보상 교환 확인", isPresented: $showingConfirmAlert) {
                Button("교환하기 (하트 차감)", role: .none) {
                    performRedemption()
                }
                Button("취소", role: .cancel) {}
            } message: {
                let remaining = max(0, store.availableHearts - heartsToSpend)
                Text("[\(effectiveTitle)] 보상을 위해 하트 \(heartsToSpend)개를 차감할까요?\n(남은 하트: \(remaining)개)")
            }
            .alert("보상 교환 취소 및 하트 환급", isPresented: $showingCancelAlert) {
                if let item = redemptionToCancel {
                    Button("하트 환급하기", role: .destructive) {
                        store.cancelRedemption(item)
                        HapticFeedbackHelper.success()
                        redemptionToCancel = nil
                    }
                }
                Button("닫기", role: .cancel) {
                    redemptionToCancel = nil
                }
            } message: {
                if let item = redemptionToCancel {
                    Text("[\(item.title)] 교환을 취소하고 하트 \(item.hearts)개를 복구하시겠습니까?")
                } else {
                    Text("교환을 취소하시겠습니까?")
                }
            }
            .sheet(item: $pinPrompt) { prompt in
                ParentPinSheet(context: prompt)
            }
            .sheet(isPresented: $showingManagePresetsSheet) {
                RewardPresetsManageSheet()
            }
        }
    }

    // MARK: - 하트 잔액 히어로 카드
    private var balanceHeroCard: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("현재 사용 가능한 하트")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.85))
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(.white)
                        Text("\(store.availableHearts)")
                            .font(.system(size: 38, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                        Text("개")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }

                Spacer()

                // 기기 역할 뱃지
                VStack(alignment: .trailing, spacing: 4) {
                    Text(isParentAuthorized ? "부모님 모드" : "아이 모드")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .foregroundStyle(.white)

                    Text(isParentAuthorized ? "즉시 교환 가능" : "부모 확인 필요")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.8))
                }
            }

            Divider()
                .background(.white.opacity(0.3))

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles")
                        .font(.caption2)
                    Text("누적 획득: \(store.totalEarnedHearts)개")
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(.white.opacity(0.9))

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: "gift")
                        .font(.caption2)
                    Text("교환 사용: \(store.totalSpentHearts)개")
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(.white.opacity(0.9))
            }
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [Color.pink, Color.orange],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.pink.opacity(0.3), radius: 8, x: 0, y: 4)
    }

    // MARK: - 추천 보상 프리셋 섹션
    private var presetSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("자주 쓰는 추천 보상")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.secondary)

                Spacer()

                // 부모 권한이 있거나 잠금 해제된 경우 편집 버튼 표시
                if isParentAuthorized {
                    Button {
                        showingManagePresetsSheet = true
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "slider.horizontal.3")
                            Text("보상 목록 편집")
                        }
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.pink.opacity(0.12))
                        .foregroundStyle(Color.pink)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                } else {
                    Button {
                        pinPrompt = ParentPinPromptContext(
                            mode: .authenticate(
                                reason: "추천 보상 목록을 편집하려면 부모님 PIN을 입력해주세요.",
                                onSuccess: {
                                    showingManagePresetsSheet = true
                                }
                            )
                        )
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "lock.shield")
                            Text("보상 편집")
                        }
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            if store.rewardPresets.isEmpty {
                VStack(spacing: 8) {
                    Text("등록된 추천 보상이 없습니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("기본 추천 보상 불러오기") {
                        store.resetRewardPresetsToDefault()
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.pink)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 155), spacing: 10)], spacing: 10) {
                    ForEach(store.rewardPresets) { preset in
                        presetButton(preset)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func presetButton(_ preset: RewardPreset) -> some View {
        let isSelected = customTitle == preset.title && heartsToSpend == preset.hearts
        Button {
            HapticFeedbackHelper.selection()
            customTitle = preset.title
            heartsToSpend = preset.hearts
        } label: {
            HStack(spacing: 10) {
                Text(preset.emoji)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 2) {
                    Text(preset.title)
                        .font(.footnote.weight(.semibold))
                        .lineLimit(1)
                        .foregroundStyle(Color.primary)

                    HStack(spacing: 2) {
                        Image(systemName: "heart.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.pink)
                        Text("\(preset.hearts)개")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.pink)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .background(
                isSelected
                    ? Color.pink.opacity(0.12)
                    : Color(.secondarySystemGroupedBackground)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.pink : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - 교환 내용 및 차감 하트 설정
    private var exchangeFormSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("보상 내용 및 차감할 하트")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 12) {
                // 보상 명칭 직접 입력
                VStack(alignment: .leading, spacing: 6) {
                    Text("보상 이름")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    TextField("예: 게임 30분, 원하는 간식, 포켓몬 카드", text: $customTitle)
                        .padding(12)
                        .background(Color(.tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                // 차감할 하트 개수
                heartCountEditor

                // 실행 버튼
                redeemActionButton
            }
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - 하트 개수 에디터
    private var heartCountEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("차감할 하트 수")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "heart.fill")
                        .font(.caption)
                        .foregroundStyle(.pink)
                    Text("\(heartsToSpend)개")
                        .font(.subheadline.weight(.black))
                        .foregroundStyle(.pink)
                }
            }

            // Stepper & +/- 버튼
            HStack(spacing: 8) {
                Button {
                    HapticFeedbackHelper.light()
                    if heartsToSpend > 1 {
                        heartsToSpend -= 1
                    }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(heartsToSpend > 1 ? Color.pink : Color.secondary.opacity(0.3))
                }
                .disabled(heartsToSpend <= 1)

                let maxSliderBound = Double(max(1, max(30, store.availableHearts)))
                Slider(
                    value: Binding(
                        get: { Double(heartsToSpend) },
                        set: { heartsToSpend = Int($0) }
                    ),
                    in: 1...maxSliderBound,
                    step: 1
                )
                .tint(.pink)

                Button {
                    HapticFeedbackHelper.light()
                    if heartsToSpend < max(1, store.availableHearts) {
                        heartsToSpend += 1
                    }
                } label: {
                    let canIncrease = heartsToSpend < store.availableHearts
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(canIncrease ? Color.pink : Color.secondary.opacity(0.3))
                }
                .disabled(heartsToSpend >= store.availableHearts && store.availableHearts > 0)
            }

            // 빠른 개수 선택 칩
            quickHeartChips

            // 잔여 하트 미리보기
            HStack {
                Text("교환 후 잔여 하트")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                let remaining = max(0, store.availableHearts - heartsToSpend)
                Text("\(remaining)개")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(store.availableHearts >= heartsToSpend ? Color.primary : Color.red)
            }
            .padding(.top, 4)

            if store.availableHearts < heartsToSpend {
                Text("⚠️ 보유 하트(\(store.availableHearts)개)가 부족합니다.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
            }
        }
    }

    private var quickHeartChips: some View {
        HStack(spacing: 8) {
            ForEach([5, 10, 15, 20], id: \.self) { count in
                chipButton(count: count)
            }

            Spacer()

            if store.availableHearts > 0 {
                allInChipButton
            }
        }
    }

    @ViewBuilder
    private func chipButton(count: Int) -> some View {
        let isSelected = (heartsToSpend == count)
        Button {
            HapticFeedbackHelper.selection()
            heartsToSpend = count
        } label: {
            Text("\(count)개")
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isSelected ? Color.pink : Color(.tertiarySystemGroupedBackground))
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var allInChipButton: some View {
        let isSelected = (heartsToSpend == store.availableHearts)
        return Button {
            HapticFeedbackHelper.selection()
            heartsToSpend = store.availableHearts
        } label: {
            Text("전액(\(store.availableHearts)개)")
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isSelected ? Color.pink : Color.pink.opacity(0.12))
                .foregroundStyle(isSelected ? Color.white : Color.pink)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - 실행 액션 버튼
    private var redeemActionButton: some View {
        Button {
            handleRedeemTap()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: isParentAuthorized ? "gift.fill" : "lock.shield.fill")
                Text(
                    isParentAuthorized
                        ? "하트 \(heartsToSpend)개 차감하고 보상 교환하기"
                        : "부모님 확인(PIN) 후 보상 교환하기"
                )
                .font(.headline.weight(.bold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                canRedeem
                    ? (isParentAuthorized ? Color.pink : Color.indigo)
                    : Color.secondary.opacity(0.3)
            )
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!canRedeem)
        .padding(.top, 6)
    }

    // MARK: - 최근 교환 내역 섹션
    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("최근 보상 교환 내역")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(store.rewardRedemptions.count)건")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if store.rewardRedemptions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "gift")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary.opacity(0.5))
                    Text("아직 교환한 보상이 없어요.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("하트를 모아서 원하는 보상으로 교환해 보세요!")
                        .font(.caption)
                        .foregroundStyle(.secondary.opacity(0.8))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            } else {
                VStack(spacing: 8) {
                    ForEach(store.rewardRedemptions) { item in
                        redemptionRow(item)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func redemptionRow(_ item: HeartRewardRedemption) -> some View {
        HStack(spacing: 12) {
            Text("🎁")
                .font(.title3)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.primary)
                Text(formatDate(item.createdAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 4) {
                Text("-\(item.hearts)개")
                    .font(.subheadline.weight(.black))
                    .foregroundStyle(.pink)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.pink.opacity(0.12))
            .clipShape(Capsule())

            // 부모 모드인 경우 교환 취소(환급) 버튼 제공
            if isParentAuthorized {
                Button {
                    redemptionToCancel = item
                    showingCancelAlert = true
                } label: {
                    Image(systemName: "arrow.uturn.backward.circle")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("교환 취소 및 하트 환급")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Action Handlers
    private func handleRedeemTap() {
        guard canRedeem else { return }

        if isParentAuthorized {
            showingConfirmAlert = true
        } else {
            // 아이 모드: 부모 마스터 PIN 인증 요청
            pinPrompt = ParentPinPromptContext(
                mode: .authenticate(
                    reason: "하트 \(heartsToSpend)개를 차감하여 [\(effectiveTitle)] 보상으로 교환합니다. 부모님 PIN을 입력해주세요.",
                    onSuccess: {
                        performRedemption()
                    }
                )
            )
        }
    }

    private func performRedemption() {
        let success = store.redeemReward(title: effectiveTitle, hearts: heartsToSpend)
        if success {
            HapticFeedbackHelper.success()
            dismiss()
        }
    }

    private func formatDate(_ timestamp: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: timestamp)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) a h:mm"
        return formatter.string(from: date)
    }
}

// MARK: - 🎁 추천 보상 목록 관리 시트 (부모 전용)
struct RewardPresetsManageSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var editingPreset: RewardPreset? = nil
    @State private var showingAddSheet: Bool = false
    @State private var showingResetAlert: Bool = false
    @State private var presetToDelete: RewardPreset? = nil
    @State private var showingDeleteAlert: Bool = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(store.rewardPresets) { preset in
                        HStack(spacing: 12) {
                            Text(preset.emoji)
                                .font(.title2)
                                .frame(width: 36, height: 36)
                                .background(Color(.tertiarySystemGroupedBackground))
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text(preset.title)
                                        .font(.subheadline.weight(.semibold))

                                    Text(preset.tag)
                                        .font(.caption2.weight(.bold))
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.15))
                                        .clipShape(Capsule())
                                }

                                HStack(spacing: 3) {
                                    Image(systemName: "heart.fill")
                                        .font(.caption2)
                                        .foregroundStyle(Color.pink)
                                    Text("하트 \(preset.hearts)개 차감")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Color.pink)
                                }
                            }

                            Spacer()

                            Button {
                                editingPreset = preset
                            } label: {
                                Image(systemName: "pencil.circle")
                                    .font(.title3)
                                    .foregroundStyle(Color.accentColor)
                            }
                            .buttonStyle(.plain)

                            Button {
                                presetToDelete = preset
                                showingDeleteAlert = true
                            } label: {
                                Image(systemName: "trash")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.red.opacity(0.8))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 2)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let preset = store.rewardPresets[index]
                            store.deleteRewardPreset(id: preset.id)
                        }
                    }
                } header: {
                    Text("등록된 추천 보상 (\(store.rewardPresets.count)개)")
                } footer: {
                    Text("이 목록은 아이폰과 부모폰의 '하트 보상 교환' 화면에 실시간 추천 항목으로 표시됩니다.")
                }

                Section {
                    Button(role: .destructive) {
                        showingResetAlert = true
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                            Text("기본 추천 보상 목록으로 초기화")
                        }
                    }
                }
            }
            .navigationTitle("추천 보상 목록 관리")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .dynamicTypeSize(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Label("새 보상 추가", systemImage: "plus")
                            .fontWeight(.bold)
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                EditRewardPresetSheet(mode: .add)
            }
            .sheet(item: $editingPreset) { preset in
                EditRewardPresetSheet(mode: .edit(preset))
            }
            .alert("추천 보상 삭제", isPresented: $showingDeleteAlert) {
                if let target = presetToDelete {
                    Button("삭제", role: .destructive) {
                        store.deleteRewardPreset(id: target.id)
                        presetToDelete = nil
                    }
                }
                Button("취소", role: .cancel) {
                    presetToDelete = nil
                }
            } message: {
                if let target = presetToDelete {
                    Text("[\(target.title)] 항목을 추천 보상 목록에서 삭제하시겠습니까?")
                }
            }
            .alert("기본값으로 초기화", isPresented: $showingResetAlert) {
                Button("초기화", role: .destructive) {
                    store.resetRewardPresetsToDefault()
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("추천 보상 목록을 처음 기본 추천 항목들(게임 30분, 간식, 나들이 등)로 되돌릴까요?")
            }
        }
    }
}

// MARK: - ✏️ 추천 보상 추가 / 수정 시트
struct EditRewardPresetSheet: View {
    enum Mode {
        case add
        case edit(RewardPreset)
    }

    let mode: Mode

    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var emoji: String = "🎁"
    @State private var title: String = ""
    @State private var hearts: Int = 10
    @State private var tag: String = "놀이"

    private let availableEmojis: [String] = [
        "🎮", "🍦", "🧸", "🎡", "💰", "🎬", "🛌", "🍳",
        "🍕", "📚", "⚽", "🎨", "🚲", "🧁", "📱", "🎁"
    ]

    private let availableTags: [String] = [
        "놀이", "간식", "선물", "나들이", "용돈", "미디어", "쿠폰", "특별"
    ]

    var isEditMode: Bool {
        if case .edit = mode { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            Form {
                // 1. 대표 이모지 선택
                Section("대표 아이콘 / 이모지") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(availableEmojis, id: \.self) { item in
                                Button {
                                    HapticFeedbackHelper.selection()
                                    emoji = item
                                } label: {
                                    Text(item)
                                        .font(.title2)
                                        .frame(width: 44, height: 44)
                                        .background(emoji == item ? Color.pink.opacity(0.18) : Color(.tertiarySystemGroupedBackground))
                                        .clipShape(Circle())
                                        .overlay(
                                            Circle().stroke(emoji == item ? Color.pink : Color.clear, lineWidth: 2)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                // 2. 보상 내용 및 분류 태그
                Section("보상 정보") {
                    TextField("보상 이름 (예: 보드게임 1시간, 치킨 파티)", text: $title)

                    Picker("분류 태그", selection: $tag) {
                        ForEach(availableTags, id: \.self) { t in
                            Text(t).tag(t)
                        }
                    }
                }

                // 3. 차감할 하트 개수
                Section("필요 하트 개수") {
                    HStack {
                        Text("필요 하트")
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: "heart.fill")
                                .font(.caption)
                                .foregroundStyle(Color.pink)
                            Text("\(hearts)개")
                                .font(.headline.weight(.black))
                                .foregroundStyle(Color.pink)
                        }
                    }

                    Stepper("하트: \(hearts)개", value: $hearts, in: 1...100)

                    HStack(spacing: 8) {
                        ForEach([5, 10, 15, 20, 30], id: \.self) { count in
                            Button {
                                HapticFeedbackHelper.selection()
                                hearts = count
                            } label: {
                                Text("\(count)개")
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(hearts == count ? Color.pink : Color(.tertiarySystemGroupedBackground))
                                    .foregroundStyle(hearts == count ? Color.white : Color.primary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .navigationTitle(isEditMode ? "추천 보상 수정" : "새 추천 보상 추가")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .dynamicTypeSize(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        savePreset()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                if case .edit(let p) = mode {
                    emoji = p.emoji
                    title = p.title
                    hearts = p.hearts
                    tag = p.tag
                }
            }
        }
    }

    private func savePreset() {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty else { return }

        switch mode {
        case .add:
            store.addRewardPreset(emoji: emoji, title: cleanTitle, hearts: hearts, tag: tag)
        case .edit(var p):
            p.emoji = emoji
            p.title = cleanTitle
            p.hearts = hearts
            p.tag = tag
            store.updateRewardPreset(p)
        }
        HapticFeedbackHelper.success()
        dismiss()
    }
}
