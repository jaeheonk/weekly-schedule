import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// 부모님 6자리 마스터 PIN 및 Face ID 인증 / 변경 시트 요청 모델
struct ParentPinPromptContext: Identifiable {
    enum Mode {
        case authenticate(reason: String, onSuccess: () -> Void)
        case setupOrChange(onSuccess: (() -> Void)? = nil)
    }

    let id = UUID()
    let mode: Mode
}

struct ParentPinSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    let context: ParentPinPromptContext

    private enum Step {
        case verifyCurrentPin   // 기존 6자리 마스터 PIN 입력 (또는 부모 폰에서 Face ID)
        case enterNewPin        // 새 6자리 마스터 PIN 입력
        case confirmNewPin      // 새 6자리 마스터 PIN 한 번 더 입력
    }

    @State private var step: Step = .verifyCurrentPin
    @State private var inputDigits: String = ""
    @State private var firstNewPin: String = ""
    @State private var errorMessage: String? = nil
    @State private var shakeTrigger: CGFloat = 0
    @State private var didAttemptAutoBiometric: Bool = false

    private var biometricInfo: (available: Bool, name: String, icon: String) {
        // 아이의 폰(.child)에서는 아이 본인의 Face ID로 뚫릴 수 있으므로 생체인증을 절대 허용하지 않음!
        guard store.deviceRole == .parent else {
            return (false, "", "lock.shield.fill")
        }
        return BiometricAuthHelper.biometricInfo()
    }

    private var reasonText: String {
        switch context.mode {
        case .authenticate(let reason, _):
            return reason
        case .setupOrChange:
            return "현재 6자리 마스터 PIN을 확인한 후 새로운 6자리 비밀번호로 변경합니다. (변경 시 클라우드로 동기화됩니다)"
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Spacer(minLength: 4)

                headerView

                if store.isPinLockedOut {
                    lockoutWarningView
                } else {
                    pinDotsView
                        .modifier(ShakeEffect(animatableData: shakeTrigger))

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                            .transition(.opacity)
                    } else {
                        Text(stepHelperText)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }

                    // 부모님 폰(.parent)일 때 Face ID / Touch ID 빠른 인증 버튼 표시
                    if step == .verifyCurrentPin && biometricInfo.available {
                        Button {
                            Task {
                                await runBiometricAuth()
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: biometricInfo.icon)
                                    .font(.headline)
                                Text("\(biometricInfo.name)로 1초 만에 부모 인증하기")
                                    .font(.subheadline.weight(.bold))
                            }
                            .padding(.horizontal, 18)
                            .padding(.vertical, 11)
                            .background(Color.indigo.opacity(0.14))
                            .foregroundStyle(Color.indigo)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }

                    Spacer(minLength: 4)

                    numberPadView
                }

                Spacer(minLength: 12)
            }
            .padding(.horizontal, 20)
            .background(Color(.systemGroupedBackground))
            .navigationTitle(navigationTitleText)
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                if step == .verifyCurrentPin && biometricInfo.available && !didAttemptAutoBiometric && !store.isPinLockedOut {
                    didAttemptAutoBiometric = true
                    Task {
                        await runBiometricAuth()
                    }
                }
            }
            .onKeyPress { keyPress in
                if keyPress.characters == "\u{7F}" || keyPress.key == .delete {
                    deleteLastDigit()
                    return .handled
                } else if let char = keyPress.characters.first, char.isNumber {
                    appendDigit(String(char))
                    return .handled
                }
                return .ignored
            }
        }
        .adaptivePresentationDetents()
        #if os(iOS)
        .dynamicTypeSize(.large)
        #endif
    }

    private var navigationTitleText: String {
        switch step {
        case .verifyCurrentPin:
            return "부모님 마스터 인증 (6자리)"
        case .enterNewPin, .confirmNewPin:
            return "6자리 마스터 PIN 변경"
        }
    }

    private var headerView: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: store.isPinLockedOut
                                ? [Color.red, Color.orange]
                                : [Color.indigo, Color.blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)
                    .shadow(color: Color.indigo.opacity(0.25), radius: 8, x: 0, y: 4)

                Image(
                    systemName: store.isPinLockedOut
                        ? "lock.trianglebadge.exclamationmark.fill"
                        : (step == .verifyCurrentPin ? "lock.shield.fill" : "key.fill")
                )
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(.white)
            }

            Text(stepTitleText)
                .font(.title3.weight(.bold))
                .multilineTextAlignment(.center)

            Text(reasonText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
        }
    }

    private var stepTitleText: String {
        if store.isPinLockedOut {
            return "비밀번호 입력 일시 잠금"
        }
        switch step {
        case .verifyCurrentPin:
            return "부모님 6자리 마스터 PIN 입력"
        case .enterNewPin:
            return "새 6자리 마스터 PIN을 입력해 주세요"
        case .confirmNewPin:
            return "확인을 위해 한 번 더 입력해 주세요"
        }
    }

    private var stepHelperText: String {
        switch step {
        case .verifyCurrentPin:
            let remainTries = max(1, 5 - (store.failedPinAttempts % 5))
            if store.failedPinAttempts > 0 {
                return "연속 \(store.failedPinAttempts)회 틀렸습니다. (\(remainTries)회 더 틀리면 입력이 일시 잠깁니다)"
            }
            return store.deviceRole == .parent
                ? "부모님 폰에서는 Face ID 또는 6자리 마스터 PIN으로 승인할 수 있어요."
                : "아이 폰에서는 오직 부모님 6자리 마스터 PIN으로만 확인할 수 있어요."
        case .enterNewPin:
            return "부모님만 알고 있는 숫자 6자리를 입력해 주세요."
        case .confirmNewPin:
            return "방금 입력한 6자리 숫자를 다시 한 번 눌러주세요."
        }
    }

    private var lockoutWarningView: some View {
        VStack(spacing: 14) {
            Text("\(store.remainingLockoutSeconds)초")
                .font(.system(size: 44, weight: .heavy, design: .rounded))
                .foregroundStyle(.red)
                .contentTransition(.numericText())

            Text("비밀번호를 5회 연속 잘못 입력하여\n보안을 위해 입력이 일시 잠겼습니다.")
                .font(.subheadline.weight(.semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(.primary)

            Text("잠금 시간이 끝난 뒤 부모님께서 정확한 6자리 마스터 PIN을 입력해 주세요.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.red.opacity(0.35), lineWidth: 1.5)
        )
        .padding(.vertical, 16)
    }

    // MARK: - 6-Dot PIN Indicator

    private var pinDotsView: some View {
        HStack(spacing: 14) {
            ForEach(0..<6, id: \.self) { index in
                let isFilled = index < inputDigits.count
                Circle()
                    .fill(isFilled ? Color.indigo : Color(.tertiarySystemFill))
                    .frame(width: 18, height: 18)
                    .overlay(
                        Circle()
                            .stroke(isFilled ? Color.indigo : Color.secondary.opacity(0.4), lineWidth: 1.5)
                    )
                    .scaleEffect(isFilled ? 1.12 : 1.0)
                    .animation(.spring(response: 0.2, dampingFraction: 0.6), value: inputDigits.count)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - 6-Digit Number Pad

    private var numberPadView: some View {
        VStack(spacing: 12) {
            ForEach([[1, 2, 3], [4, 5, 6], [7, 8, 9]], id: \.self) { row in
                HStack(spacing: 16) {
                    ForEach(row, id: \.self) { num in
                        keypadButton(label: "\(num)") {
                            appendDigit("\(num)")
                        }
                    }
                }
            }

            HStack(spacing: 16) {
                if step == .verifyCurrentPin && biometricInfo.available {
                    Button {
                        Task {
                            await runBiometricAuth()
                        }
                    } label: {
                        Image(systemName: biometricInfo.icon)
                            .font(.title2)
                            .foregroundStyle(.indigo)
                            .frame(width: 76, height: 56)
                            .background(Color.indigo.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                } else {
                    Color.clear
                        .frame(width: 76, height: 56)
                }

                keypadButton(label: "0") {
                    appendDigit("0")
                }

                Button {
                    deleteLastDigit()
                } label: {
                    Image(systemName: "delete.left.fill")
                        .font(.title3)
                        .foregroundStyle(.primary)
                        .frame(width: 76, height: 56)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func keypadButton(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)
                .frame(width: 76, height: 56)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Logic

    private func runBiometricAuth() async {
        guard biometricInfo.available else { return }
        let success = await BiometricAuthHelper.authenticate(reason: reasonText)
        guard success else { return }

        await MainActor.run {
            store.unlockParentMode()
            HapticFeedbackHelper.success()

            switch context.mode {
            case .authenticate(_, let onSuccess):
                onSuccess()
                dismiss()
            case .setupOrChange:
                withAnimation {
                    inputDigits = ""
                    errorMessage = nil
                    step = .enterNewPin
                }
            }
        }
    }

    private func appendDigit(_ digit: String) {
        guard !store.isPinLockedOut, inputDigits.count < 6 else { return }
        HapticFeedbackHelper.light()

        errorMessage = nil
        inputDigits.append(digit)

        if inputDigits.count == 6 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                handleSixDigitsCompleted()
            }
        }
    }

    private func deleteLastDigit() {
        guard !inputDigits.isEmpty else { return }
        HapticFeedbackHelper.light()
        inputDigits.removeLast()
        errorMessage = nil
    }

    private func handleSixDigitsCompleted() {
        switch step {
        case .verifyCurrentPin:
            if store.verifyParentPin(inputDigits) {
                HapticFeedbackHelper.success()

                switch context.mode {
                case .authenticate(_, let onSuccess):
                    onSuccess()
                    dismiss()
                case .setupOrChange:
                    withAnimation {
                        inputDigits = ""
                        errorMessage = nil
                        step = .enterNewPin
                    }
                }
            } else {
                let remain = max(0, 5 - (store.failedPinAttempts % 5))
                if store.isPinLockedOut {
                    triggerError("비밀번호 5회 오류로 입력이 잠겼습니다.")
                } else {
                    triggerError("6자리 마스터 PIN이 맞지 않아요. (남은 기회 \(remain)회)")
                }
                inputDigits = ""
            }

        case .enterNewPin:
            firstNewPin = inputDigits
            withAnimation {
                inputDigits = ""
                errorMessage = nil
                step = .confirmNewPin
            }

        case .confirmNewPin:
            if inputDigits == firstNewPin {
                store.setParentPin(inputDigits)
                HapticFeedbackHelper.success()

                switch context.mode {
                case .authenticate(_, let onSuccess):
                    onSuccess()
                case .setupOrChange(let onSuccess):
                    onSuccess?()
                }
                dismiss()
            } else {
                triggerError("두 번 입력한 6자리 PIN이 서로 달라요. 다시 입력해 주세요.")
                firstNewPin = ""
                inputDigits = ""
                step = .enterNewPin
            }
        }
    }

    private func triggerError(_ message: String) {
        HapticFeedbackHelper.error()
        errorMessage = message
        withAnimation(.default) {
            shakeTrigger += 1
        }
    }
}

private struct ShakeEffect: GeometryEffect {
    var amount: CGFloat = 10
    var shakesPerUnit = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = amount * sin(animatableData * .pi * CGFloat(shakesPerUnit))
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}
