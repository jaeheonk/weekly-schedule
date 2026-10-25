import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct PraiseHeartPromptContext: Identifiable {
    enum Target {
        case scheduleItem(ScheduleItem)
        case familyBanner
    }

    let id = UUID()
    let target: Target
}

struct PraiseHeartSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    let context: PraiseHeartPromptContext

    @State private var selectedSticker: ReactionSticker = .heart
    @State private var selectedHeartCount: Int = 1
    @State private var commentText: String = ""
    @State private var alsoMarkParentVerified: Bool = false

    private let quickPresets: [String] = [
        "스스로 다 해내다니 정말 기특해! ❤️",
        "오늘도 약속 지킨 우리 아이 최고! ⭐",
        "어려운 숙제였는데 끝까지 해냈네! 👍",
        "집중해서 열심히 한 모습 멋져요! 👏",
        "남은 일정도 화이팅! 엄마 아빠가 응원해 🔥",
        "오늘의 숙제 챔피언! 정말 사랑해 👑"
    ]

    private var targetItem: ScheduleItem? {
        if case .scheduleItem(let item) = context.target {
            return item
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 상단 미리보기 헤더
                    headerCard

                    // 1. 스티커 선택
                    VStack(alignment: .leading, spacing: 10) {
                        Text("1. 응원 아이콘 선택")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.secondary)

                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 10)], spacing: 10) {
                            ForEach(ReactionSticker.allCases) { sticker in
                                let isSelected = selectedSticker == sticker
                                Button {
                                    HapticFeedbackHelper.light()
                                    withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                        selectedSticker = sticker
                                    }
                                } label: {
                                    VStack(spacing: 4) {
                                        Text(sticker.emoji)
                                            .font(.system(size: 26))
                                        Text(sticker.label)
                                            .font(.caption.weight(.bold))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(
                                        isSelected
                                            ? Color.pink.opacity(0.18)
                                            : Color(.secondarySystemGroupedBackground)
                                    )
                                    .foregroundStyle(isSelected ? Color.pink : Color.primary)
                                    .clipShape(RoundedRectangle(cornerRadius: 14))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14)
                                            .stroke(isSelected ? Color.pink : Color.clear, lineWidth: 2)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // 2. 보낼 하트 개수 가변 조절 (하트 0개 전송 지원)
                    heartCountSection

                    // 3. 메시지 입력 및 다중 메시지 히스토리
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(selectedHeartCount == 0 ? "3. 아이에게 보낼 응원 메시지 (필수)" : "3. 아이에게 보낼 칭찬 한마디 (선택)")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.secondary)
                            Spacer()
                        }

                        TextField(selectedHeartCount == 0 ? "응원 메시지를 입력해 주세요 (예: 잘하고 있어!)" : "예: 오늘 스스로 숙제 챙긴 모습 최고야! ❤️", text: $commentText)
                            .font(.subheadline)
                            .padding(13)
                            .background(Color(.secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 14))

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(quickPresets, id: \.self) { preset in
                                    Button {
                                        commentText = preset
                                    } label: {
                                        Text(preset)
                                            .font(.caption.weight(.semibold))
                                            .padding(.horizontal, 11)
                                            .padding(.vertical, 7)
                                            .background(selectedHeartCount == 0 ? Color.blue.opacity(0.11) : Color.pink.opacity(0.11))
                                            .foregroundStyle(selectedHeartCount == 0 ? Color.blue : Color.pink)
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        // 이전에 남긴 메시지 목록
                        if let item = targetItem, let existing = store.reaction(for: item), !existing.allComments.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text("이전에 남긴 메시지 (\(existing.allComments.count)개)")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.secondary)
                                }
                                VStack(alignment: .leading, spacing: 6) {
                                    ForEach(existing.allComments) { c in
                                        HStack(alignment: .top, spacing: 6) {
                                            Image(systemName: "bubble.left.fill")
                                                .font(.caption2)
                                                .foregroundStyle(.blue.opacity(0.8))
                                                .padding(.top, 2)
                                            Text(c.text)
                                                .font(.caption)
                                                .foregroundStyle(.primary)
                                            Spacer()
                                            if c.createdAt > 0 {
                                                Text(Date(timeIntervalSince1970: c.createdAt), style: .time)
                                                    .font(.system(size: 10))
                                                    .foregroundStyle(.tertiary)
                                            }
                                        }
                                        .padding(.vertical, 2)
                                    }
                                }
                                .padding(12)
                                .background(Color(.secondarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .padding(.top, 4)
                        } else if targetItem == nil && !store.praiseNotes.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text("최근 보낸 전체 응원 (\(store.praiseNotes.count)개)")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.secondary)
                                }
                                VStack(alignment: .leading, spacing: 6) {
                                    ForEach(store.praiseNotes.prefix(3)) { note in
                                        HStack(alignment: .top, spacing: 6) {
                                            Text(note.sticker.emoji)
                                                .font(.caption)
                                            if note.hearts > 0 {
                                                Text("❤️ +\(note.hearts)")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundStyle(.pink)
                                            }
                                            Text(note.message)
                                                .font(.caption)
                                                .foregroundStyle(.primary)
                                                .lineLimit(2)
                                            Spacer()
                                            if note.createdAt > 0 {
                                                Text(Date(timeIntervalSince1970: note.createdAt), style: .time)
                                                    .font(.system(size: 10))
                                                    .foregroundStyle(.tertiary)
                                            }
                                        }
                                        .padding(.vertical, 2)
                                    }
                                }
                                .padding(12)
                                .background(Color(.secondarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .padding(.top, 4)
                        }
                    }

                    // 4. 일정 대상일 경우: 부모 확인 도장도 함께 찍기 토글
                    if let item = targetItem, !store.isParentVerified(item) {
                        Toggle(isOn: $alsoMarkParentVerified) {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundStyle(.green)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("응원 전송 시 '부모 확인 완료' 도장도 함께 찍기")
                                        .font(.subheadline.weight(.bold))
                                    Text("[\(item.title)] 숙제를 확인 완료 상태로 변경합니다")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(14)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .tint(.green)
                    }

                    // 전송 버튼
                    let isZeroHearts = selectedHeartCount == 0
                    let isCommentEmpty = commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    let canSend = !isZeroHearts || !isCommentEmpty

                    VStack(spacing: 8) {
                        Button {
                            sendAction()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: isZeroHearts ? "bubble.left.fill" : "heart.fill")
                                if isZeroHearts {
                                    Text("아이 폰으로 \(selectedSticker.emoji) 응원 메시지만 보내기")
                                        .fontWeight(.bold)
                                } else if isCommentEmpty {
                                    Text("아이 폰으로 \(selectedSticker.emoji) 하트 +\(selectedHeartCount)개 보내기")
                                        .fontWeight(.bold)
                                } else {
                                    Text("아이 폰으로 \(selectedSticker.emoji) 하트 +\(selectedHeartCount)개와 메시지 보내기")
                                        .fontWeight(.bold)
                                }
                            }
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                canSend
                                    ? (isZeroHearts
                                        ? LinearGradient(colors: [Color.blue, Color.indigo], startPoint: .leading, endPoint: .trailing)
                                        : LinearGradient(colors: [Color.pink, Color.orange], startPoint: .leading, endPoint: .trailing))
                                    : LinearGradient(colors: [Color.gray.opacity(0.5), Color.gray.opacity(0.4)], startPoint: .leading, endPoint: .trailing)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                            .shadow(color: canSend ? (isZeroHearts ? Color.blue.opacity(0.3) : Color.pink.opacity(0.3)) : Color.clear, radius: 8, x: 0, y: 4)
                        }
                        .disabled(!canSend)
                        .buttonStyle(.plain)

                        if isZeroHearts && isCommentEmpty {
                            Text("하트 0개일 때는 보낼 응원 메시지를 입력해 주세요.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(targetItem != nil ? "숙제 칭찬 & 메시지 남기기" : "아이에게 응원 메시지 보내기")
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                if let item = targetItem, let existing = store.reaction(for: item) {
                    selectedSticker = existing.sticker
                    // 새로운 메시지를 추가로 남길 수 있도록 commentText는 빈 상태로 시작
                }
            }
        }
        .adaptivePresentationDetents()
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }

    // MARK: - 하트 개수 가변 조절 섹션
    private var heartCountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("2. 보낼 하트 개수")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                if selectedHeartCount > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(.pink)
                        Text("+\(selectedHeartCount)개")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(.pink)
                    }
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.left.fill")
                            .foregroundStyle(.blue)
                        Text("0개 (하트 없이 메시지만 전송)")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(.blue)
                    }
                }
            }

            // 하트 없이 메시지만 남기기 전용 토글
            Toggle(isOn: Binding(
                get: { selectedHeartCount == 0 },
                set: { isZero in
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                        selectedHeartCount = isZero ? 0 : 1
                    }
                }
            )) {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("하트 없이 메시지만 남기기")
                            .font(.subheadline.weight(.bold))
                        Text("하트를 추가로 지급하지 않고 응원 메시지만 보냅니다")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .tint(.blue)
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14))

            VStack(spacing: 10) {
                // Stepper 및 슬라이더로 가변 조절
                HStack(spacing: 12) {
                    Button {
                        HapticFeedbackHelper.light()
                        if selectedHeartCount > 0 {
                            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                selectedHeartCount -= 1
                            }
                        }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(selectedHeartCount > 0 ? (selectedHeartCount == 1 ? Color.blue : Color.pink) : Color.secondary.opacity(0.3))
                    }
                    .disabled(selectedHeartCount <= 0)
                    .buttonStyle(.plain)

                    Slider(
                        value: Binding(
                            get: { Double(selectedHeartCount) },
                            set: { selectedHeartCount = max(0, Int($0)) }
                        ),
                        in: 0...30,
                        step: 1
                    )
                    .tint(selectedHeartCount == 0 ? .blue : .pink)

                    Button {
                        HapticFeedbackHelper.light()
                        if selectedHeartCount < 100 {
                            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                selectedHeartCount += 1
                            }
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(selectedHeartCount < 100 ? Color.pink : Color.secondary.opacity(0.3))
                    }
                    .disabled(selectedHeartCount >= 100)
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))

                // 빠른 선택 프리셋 버튼 (0개 메시지만 포함)
                HStack(spacing: 8) {
                    ForEach([0, 1, 2, 3, 5, 10], id: \.self) { count in
                        let isSelected = selectedHeartCount == count
                        Button {
                            HapticFeedbackHelper.light()
                            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                                selectedHeartCount = count
                            }
                        } label: {
                            HStack(spacing: 2) {
                                if count == 0 {
                                    Image(systemName: "bubble.left.fill")
                                        .font(.caption2)
                                        .foregroundStyle(isSelected ? .white : .blue)
                                    Text("0개")
                                        .fontWeight(.heavy)
                                } else {
                                    Image(systemName: "heart.fill")
                                        .font(.caption2)
                                        .foregroundStyle(isSelected ? .white : .pink)
                                    Text("+\(count)")
                                        .fontWeight(.heavy)
                                }
                            }
                            .font(.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                isSelected
                                    ? (count == 0
                                        ? LinearGradient(colors: [.blue, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing)
                                        : LinearGradient(colors: [.pink, .red], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    : LinearGradient(colors: [Color(.secondarySystemGroupedBackground)], startPoint: .top, endPoint: .bottom)
                            )
                            .foregroundStyle(isSelected ? .white : (count == 0 ? .blue : .primary))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var headerCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.pink.opacity(0.25), .orange.opacity(0.2)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)

                Text(selectedSticker.emoji)
                    .font(.system(size: 32))
            }

            VStack(alignment: .leading, spacing: 4) {
                if let item = targetItem {
                    Text("\(item.weekday.fullName) · \(item.title)")
                        .font(.headline.weight(.bold))
                    Text("아이가 숙제 카드에서 부모님의 응원과 메시지를 바로 볼 수 있어요!")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("오늘도 열심히 하는 아이에게 응원 전송!")
                        .font(.headline.weight(.bold))
                    Text("아이 폰 메인 상단 배너에 응원 메시지가 즉시 동기화됩니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private func sendAction() {
        HapticFeedbackHelper.success()

        if let item = targetItem {
            store.sendItemReaction(
                for: item,
                addHearts: selectedHeartCount,
                sticker: selectedSticker,
                comment: commentText,
                alsoVerify: alsoMarkParentVerified
            )
        } else {
            store.sendFamilyPraise(
                hearts: selectedHeartCount,
                sticker: selectedSticker,
                message: commentText
            )
        }
        dismiss()
    }
}
