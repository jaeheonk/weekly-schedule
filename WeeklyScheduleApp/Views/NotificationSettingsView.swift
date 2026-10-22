import SwiftUI
import UserNotifications

struct NotificationSettingsView: View {
    @EnvironmentObject var store: ScheduleStore
    @StateObject private var notificationManager = NotificationManager.shared
    @State private var selectedFilterDay: Weekday? = nil
    @State private var showOnlyEnabled: Bool = false
    @State private var editingItem: ScheduleItem? = nil
    @State private var showingResetScheduleConfirm: Bool = false
    @State private var pinPrompt: ParentPinPromptContext? = nil
    @State private var praisePrompt: PraiseHeartPromptContext? = nil
    @State private var showingRewardExchangeSheet: Bool = false
    @State private var pinUpdateSuccessMessage: String? = nil

    @State private var showingAdvancedSyncConfig: Bool = false
    @State private var draftFamilyCode: String = ""
    @State private var draftVercelToken: String = ""
    @State private var showingPrintSheet: Bool = false

    private var filteredItems: [ScheduleItem] {
        var result = store.effectiveItems
        if let day = selectedFilterDay {
            result = result.filter { $0.weekday == day }
        }
        if showOnlyEnabled {
            result = result.filter { $0.isNotificationEnabled }
        }
        return result.sorted {
            if $0.weekday.rawValue == $1.weekday.rawValue {
                return $0.startTotalMinutes < $1.startTotalMinutes
            }
            return $0.weekday.rawValue < $1.weekday.rawValue
        }
    }

    private var lastSyncFormatted: String {
        guard let date = store.lastSyncedAt else {
            return "아직 동기화 기록 없음"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "a h:mm:ss"
        if let by = store.lastRemoteUpdatedBy {
            return "\(formatter.string(from: date)) (최근 반영: \(by))"
        }
        return formatter.string(from: date)
    }

    var body: some View {
        NavigationStack {
            List {
                // 0. 이 기기의 역할 (아이의 폰 vs 부모님 폰) & 실시간 동기화 섹션
                Section {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(store.deviceRole == .parent ? Color.indigo.opacity(0.15) : Color.blue.opacity(0.15))
                                .frame(width: 44, height: 44)
                            Image(systemName: store.deviceRole == .parent ? "person.badge.shield.checkmark.fill" : "figure.child")
                                .font(.title2)
                                .foregroundStyle(store.deviceRole == .parent ? .indigo : .blue)
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(store.deviceRole.title)
                                    .font(.subheadline.weight(.bold))
                                Text(store.deviceRole == .parent ? "Face ID 활성" : "6자리 PIN 보호")
                                    .font(.system(size: 10, weight: .heavy))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background((store.deviceRole == .parent ? Color.indigo : Color.blue).opacity(0.14))
                                    .foregroundStyle(store.deviceRole == .parent ? .indigo : .blue)
                                    .clipShape(Capsule())
                            }
                            Text(store.deviceRole.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)

                    // 역할 전환 버튼 (아이 폰 -> 부모님 폰 전환 시 6자리 마스터 PIN 필수)
                    HStack(spacing: 10) {
                        Button {
                            store.setDeviceRole(.child)
                        } label: {
                            HStack(spacing: 4) {
                                if store.deviceRole == .child {
                                    Image(systemName: "checkmark.circle.fill")
                                }
                                Text("👦 아이의 폰")
                                    .font(.caption.weight(.bold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(store.deviceRole == .child ? Color.blue : Color(.tertiarySystemFill))
                            .foregroundStyle(store.deviceRole == .child ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)

                        Button {
                            if store.deviceRole == .parent { return }
                            pinPrompt = ParentPinPromptContext(
                                mode: .authenticate(
                                    reason: "이 기기를 '부모님 폰(부모 모드)'으로 전환하려면 6자리 마스터 PIN을 입력해 주세요."
                                ) {
                                    store.setDeviceRole(.parent)
                                }
                            )
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: store.deviceRole == .parent ? "checkmark.circle.fill" : "lock.fill")
                                Text("👩👨 부모님 폰")
                                    .font(.caption.weight(.bold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(store.deviceRole == .parent ? Color.indigo : Color(.tertiarySystemFill))
                            .foregroundStyle(store.deviceRole == .parent ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }

                    // Vercel Blob 실시간 동기화 상태 표시
                    HStack(spacing: 12) {
                        Image(systemName: store.syncErrorMessage == nil ? "icloud.and.arrow.up.fill" : "exclamationmark.icloud.fill")
                            .font(.title3)
                            .foregroundStyle(store.syncErrorMessage == nil ? .blue : .red)
                            .frame(width: 38, height: 38)
                            .background((store.syncErrorMessage == nil ? Color.blue : Color.red).opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        VStack(alignment: .leading, spacing: 2) {
                            Text(store.isSyncing ? "클라우드 동기화 중..." : "Vercel Blob 실시간 동기화 중")
                                .font(.subheadline.weight(.bold))
                            if let err = store.syncErrorMessage {
                                Text(err)
                                    .font(.caption2)
                                    .foregroundStyle(.red)
                                    .lineLimit(2)
                            } else {
                                Text("최근 동기화: \(lastSyncFormatted)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer()

                        Button {
                            Task {
                                await store.syncNow(forceUploadIfEmpty: true)
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.clockwise")
                                Text("동기화")
                            }
                            .font(.caption.weight(.bold))
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(store.isSyncing)
                    }
                    .padding(.vertical, 2)

                    // 클라우드 고급 설정 (부모 인증 후 열람/수정 가능)
                    if showingAdvancedSyncConfig {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("가족 동기화 채널 코드")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            TextField("family-main", text: $draftFamilyCode)
                                .font(.subheadline)
                                .neverAutocapitalization()
                                .autocorrectionDisabled()
                                .padding(8)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                            Text("Vercel Blob Read/Write 토큰")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            SecureField("vercel_blob_rw_...", text: $draftVercelToken)
                                .font(.subheadline)
                                .neverAutocapitalization()
                                .autocorrectionDisabled()
                                .padding(8)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                            HStack {
                                Button("닫기") {
                                    showingAdvancedSyncConfig = false
                                }
                                .font(.caption)
                                .buttonStyle(.bordered)

                                Spacer()

                                Button("동기화 설정 저장") {
                                    store.updateSyncSettings(token: draftVercelToken, familyCode: draftFamilyCode)
                                    showingAdvancedSyncConfig = false
                                }
                                .font(.caption.weight(.bold))
                                .buttonStyle(.borderedProminent)
                            }
                            .padding(.top, 4)
                        }
                        .padding(.vertical, 4)
                    } else {
                        Button {
                            performParentAction(
                                reason: "클라우드 동기화 토큰 및 가족 코드를 확인·변경하려면 6자리 마스터 PIN을 입력해 주세요."
                            ) {
                                draftFamilyCode = store.familyCode
                                draftVercelToken = store.vercelBlobToken
                                showingAdvancedSyncConfig = true
                            }
                        } label: {
                            HStack {
                                Label("동기화 채널 코드 (\(store.familyCode)) · 토큰 관리", systemImage: "gearshape.2.fill")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Image(systemName: "lock.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: {
                    Text("아이 폰 ↔ 부모님 폰 실시간 동기화")
                } footer: {
                    Text("아이가 '다 했어요'를 체크하거나 스케줄을 조정하면 부모님 폰에 자동 반영되고, 부모님이 찍어준 확인 도장과 ❤️ 하트도 아이 폰에 즉시 동기화됩니다.")
                }

                // 1. 부모 확인 & 6자리 마스터 PIN 잠금 섹션
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: store.isParentModeUnlocked ? "lock.open.fill" : "lock.shield.fill")
                            .font(.title2)
                            .foregroundStyle(store.isParentModeUnlocked ? .green : .indigo)
                            .frame(width: 42, height: 42)
                            .background((store.isParentModeUnlocked ? Color.green : Color.indigo).opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        VStack(alignment: .leading, spacing: 3) {
                            Text("부모님 6자리 마스터 PIN 보호 중")
                                .font(.subheadline.weight(.bold))
                            Text(
                                store.isParentModeUnlocked
                                    ? "현재 부모 확인 모드가 열려 있어요 (앱 전환 시 자동 잠금)"
                                    : (store.deviceRole == .parent
                                        ? "부모님 폰에서는 Face ID 또는 6자리 마스터 PIN으로 승인합니다"
                                        : "아이 폰에서는 오직 6자리 마스터 PIN으로만 부모 확인이 가능합니다")
                            )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Button {
                            if store.isParentModeUnlocked {
                                store.lockParentMode()
                            } else {
                                performParentAction(
                                    reason: "부모 확인 모드를 켜면 여러 숙제를 바로 확인 도장 찍고 ❤️ 하트를 보낼 수 있어요."
                                ) {}
                            }
                        } label: {
                            Text(store.isParentModeUnlocked ? "잠그기" : "잠금 해제")
                                .font(.caption.weight(.bold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(store.isParentModeUnlocked ? .green : .indigo)
                    }
                    .padding(.vertical, 4)

                    Button {
                        pinUpdateSuccessMessage = nil
                        pinPrompt = ParentPinPromptContext(
                            mode: .setupOrChange {
                                pinUpdateSuccessMessage = "새 6자리 마스터 PIN이 저장되어 클라우드에 동기화되었습니다!"
                            }
                        )
                    } label: {
                        HStack {
                            Label("부모님 6자리 마스터 PIN 변경하기", systemImage: "key.fill")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let pinMsg = pinUpdateSuccessMessage {
                        Text(pinMsg)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.green)
                    }
                } header: {
                    Text("숙제 부모님 확인 · 6자리 마스터 보안")
                } footer: {
                    Text("10세 아이가 우회할 수 없도록 산수 문제 초기화 기능을 제거하고, 6자리 마스터 PIN + 5회 오류 시 시간 잠금 + Keychain 암호화 저장이 적용되어 있습니다.")
                }

                // 2. ❤️ 아이에게 응원 하트 & 보상 교환 섹션
                Section {
                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color.pink.opacity(0.15))
                                    .frame(width: 42, height: 42)
                                Image(systemName: "heart.fill")
                                    .font(.title3)
                                    .foregroundStyle(.pink)
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text("보유 하트 \(store.availableHearts)개")
                                        .font(.subheadline.weight(.bold))
                                }
                                Text("누적 획득 \(store.totalEarnedHearts)개 · 교환 사용 \(store.totalSpentHearts)개")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Button {
                                showingRewardExchangeSheet = true
                            } label: {
                                Label("보상 교환", systemImage: "gift.fill")
                                    .font(.caption.weight(.bold))
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.purple)
                        }

                        Divider()

                        HStack {
                            if let latest = store.latestPraiseNote {
                                Text("최근 응원: \(latest.sticker.emoji) \(latest.message)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            } else {
                                Text("아이에게 ❤️ 하트와 응원 스티커를 보내 칭찬해 주세요!")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Button {
                                performParentAction(
                                    reason: "아이에게 ❤️ 응원 하트를 보내려면 부모 인증이 필요해요."
                                ) {
                                    praisePrompt = PraiseHeartPromptContext(target: .familyBanner)
                                }
                            } label: {
                                Label("하트 보내기", systemImage: "heart.circle.fill")
                                    .font(.caption.weight(.bold))
                            }
                            .buttonStyle(.bordered)
                            .tint(.pink)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("❤️ 칭찬 하트 & 보상 교환")
                } footer: {
                    Text("부모님이 보낸 하트는 계속 누적되며, 부모폰에서 아이가 원하는 보상(게임 시간, 간식 등)으로 차감 교환할 수 있습니다.")
                }

                // 3. 시계 알람 모드 상태, 벨소리 선택 및 테스트 섹션
                if store.deviceRole == .parent {
                    Section {
                        HStack(spacing: 12) {
                            Image(systemName: "bell.slash.circle.fill")
                                .font(.title)
                                .foregroundStyle(.purple)
                                .frame(width: 42, height: 42)
                                .background(Color.purple.opacity(0.14))
                                .clipShape(RoundedRectangle(cornerRadius: 12))

                            VStack(alignment: .leading, spacing: 3) {
                                Text("부모님 폰은 알림 비활성화됨")
                                    .font(.subheadline.weight(.bold))
                                Text("부모님 폰에서는 시계 알람 및 알림이 발생하지 않습니다.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)

                        HStack(spacing: 8) {
                            Image(systemName: "info.circle.fill")
                                .foregroundStyle(.indigo)
                            Text("시간표 시계 알람과 체크리스트는 아이 폰에서만 작동합니다. 아래 목록에서 아이 폰에 적용될 스케줄을 확인하거나 변경할 수 있습니다.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    } header: {
                        Text("🔕 부모님 폰 알림 상태")
                    } footer: {
                        Text("부모님 폰은 방해 없이 조용히 유지되며, 아이의 완료 현황을 확인하고 도장과 ❤️ 칭찬 하트를 전송할 수 있습니다.")
                    }
                } else {
                    Section {
                        HStack(spacing: 12) {
                            Image(systemName: statusIconName)
                            .font(.title2)
                            .foregroundStyle(statusColor)
                            .frame(width: 42, height: 42)
                            .background(statusColor.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        VStack(alignment: .leading, spacing: 3) {
                            Text(statusTitle)
                                .font(.subheadline.weight(.bold))
                            Text("시계 알람 \(notificationManager.scheduledCount)개 예약됨 (알림 켜진 일정 \(store.effectiveItems.filter { $0.isNotificationEnabled }.count)개)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        if notificationManager.authorizationStatus == .notDetermined {
                            Button("권한 허용") {
                                Task {
                                    _ = await notificationManager.requestPermission()
                                    await notificationManager.syncAllNotifications(for: store.effectiveItems)
                                }
                            }
                            .font(.caption.weight(.bold))
                            .buttonStyle(.borderedProminent)
                        } else if notificationManager.authorizationStatus == .denied {
                            Button("설정 열기") {
                                #if os(iOS)
                                if let url = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(url)
                                }
                                #elseif os(macOS)
                                if let url = URL(string: "x-apple.systempreferences:com.apple.preference.notifications") {
                                    NSWorkspace.shared.open(url)
                                }
                                #endif
                            }
                            .font(.caption.weight(.bold))
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(.vertical, 4)

                    // 알람 벨소리 스타일 선택 (27초 연속 울림 + 미리 듣기)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label("시계 알람 벨소리 (27초 연속 울림)", systemImage: "speaker.wave.3.fill")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                            Spacer()
                            if notificationManager.isPreviewingSound {
                                Button("미리듣기 정지") {
                                    notificationManager.stopPreviewSound()
                                }
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.red)
                            }
                        }

                        ForEach(AlarmSoundStyle.allCases) { style in
                            let isSelected = notificationManager.selectedSoundStyle == style
                            HStack(spacing: 10) {
                                Button {
                                    notificationManager.selectedSoundStyle = style
                                    Task {
                                        await notificationManager.syncAllNotifications(for: store.effectiveItems)
                                    }
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                            .font(.title3)
                                            .foregroundStyle(isSelected ? .orange : .secondary)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(style.title)
                                                .font(.subheadline.weight(.bold))
                                                .foregroundStyle(.primary)
                                            Text(style.subtitle)
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)

                                Spacer()

                                Button {
                                    let wasSelected = notificationManager.selectedSoundStyle == style
                                    notificationManager.togglePreviewSound(style: style)
                                    if !wasSelected {
                                        Task {
                                            await notificationManager.syncAllNotifications(for: store.effectiveItems)
                                        }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(
                                            systemName: (notificationManager.isPreviewingSound && isSelected)
                                                ? "stop.fill"
                                                : "play.fill"
                                        )
                                        Text((notificationManager.isPreviewingSound && isSelected) ? "정지" : "들어보기")
                                    }
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(isSelected ? Color.orange.opacity(0.16) : Color(.tertiarySystemFill))
                                    .foregroundStyle(isSelected ? .orange : .primary)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .padding(.vertical, 4)

                    // 잠금 화면 연속 벨 옵션 (정각 알람 + 30초 뒤 후속 벨로 약 1분간 연속 울림)
                    Toggle(
                        isOn: Binding(
                            get: { notificationManager.isCascadeRepeatEnabled },
                            set: { newValue in
                                notificationManager.isCascadeRepeatEnabled = newValue
                                Task {
                                    await notificationManager.syncAllNotifications(for: store.effectiveItems)
                                }
                            }
                        )
                    ) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("잠금 화면 2회 연속 벨 울림 (최대 1분)")
                                .font(.subheadline.weight(.semibold))
                            Text("정각 알람을 놓치지 않도록 27초 벨이 끝난 직후 한 번 더 연속으로 울립니다.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tint(.orange)

                    // 다시 알림(Snooze) 대기 중인 항목이 있으면 표시
                    if !notificationManager.snoozedAlarms.isEmpty {
                        ForEach(notificationManager.snoozedAlarms) { snooze in
                            HStack(spacing: 10) {
                                Image(systemName: "zzz")
                                    .foregroundStyle(.orange)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("다시 알림 예약됨: \(snooze.title)")
                                        .font(.caption.weight(.bold))
                                    Text("\(snooze.snoozeMinutes)분 뒤 다시 울림")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("취소") {
                                    notificationManager.cancelSnooze(snooze)
                                }
                                .font(.caption.weight(.bold))
                                .buttonStyle(.bordered)
                                .tint(.red)
                            }
                        }
                    }

                    // 1) 즉시 전체 화면 시계 알람 체험 버튼
                    Button {
                        notificationManager.triggerImmediateClockAlarmDemo()
                    } label: {
                        HStack {
                            Label("시계 알람 화면 지금 바로 띄우기 (전체 화면 + 연속 벨)", systemImage: "alarm.waves.left.and.right.fill")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.orange)
                            Spacer()
                            Image(systemName: "play.circle.fill")
                                .foregroundStyle(.orange)
                        }
                    }

                    // 2) 3초 뒤 잠금 화면 / 백그라운드 알람 테스트 버튼
                    Button {
                        Task {
                            await notificationManager.sendTestNotification()
                        }
                    } label: {
                        HStack {
                            Label("잠금 화면 시계 알람 테스트 (3초 뒤 27초 연속 울림)", systemImage: "bell.and.waves.left.and.right.fill")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Image(systemName: "paperplane.fill")
                                .font(.caption)
                        }
                    }

                    if let msg = notificationManager.lastTestNotificationMessage {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                } header: {
                    Text("⏰ 아이폰 시계 알람 모드 설정")
                } footer: {
                    Text("앱이 켜져 있을 때는 아이폰 시계 알람처럼 전체 화면과 무한 반복 벨소리·진동이 울리며, 화면이 잠겨 있을 때도 27초 연속 벨소리와 '5분/9분 뒤 다시 알림(Snooze)' 버튼이 작동합니다.")
                }
            }

                // 4. 요일 필터 및 알림 켜진 항목만 보기
                Section {
                    Toggle("알림 켜진 스케줄만 보기", isOn: $showOnlyEnabled.animation())
                        .font(.subheadline.weight(.medium))

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            Button {
                                selectedFilterDay = nil
                            } label: {
                                Text("전체 요일")
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 11)
                                    .padding(.vertical, 6)
                                    .background(selectedFilterDay == nil ? Color.accentColor : Color(.tertiarySystemFill))
                                    .foregroundStyle(selectedFilterDay == nil ? .white : .primary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)

                            ForEach(Weekday.allCases) { day in
                                let isSelected = selectedFilterDay == day
                                Button {
                                    selectedFilterDay = isSelected ? nil : day
                                } label: {
                                    Text(day.fullName)
                                        .font(.caption.weight(.bold))
                                        .padding(.horizontal, 11)
                                        .padding(.vertical, 6)
                                        .background(isSelected ? Color.accentColor : Color(.tertiarySystemFill))
                                        .foregroundStyle(isSelected ? .white : .primary)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 2)
                    }

                    ForEach(filteredItems) { item in
                        NotificationItemRow(
                            item: item,
                            onTapDetail: { editingItem = item }
                        )
                    }
                } header: {
                    Text("일정별 알림 빠른 설정")
                } footer: {
                    Text("항목을 탭하면 알림 시간(정각, 15분 전, 30분 전, 45분 전, 60분 전)을 세부 조정할 수 있습니다.")
                }

                // 5. 주간 시간표 1페이지 출력 및 데이터 관리
                Section {
                    Button {
                        showingPrintSheet = true
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "printer.fill")
                                .font(.title3)
                                .foregroundStyle(.indigo)
                                .frame(width: 38, height: 38)
                                .background(Color.indigo.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 10))

                            VStack(alignment: .leading, spacing: 2) {
                                Text("주간 시간표 1페이지 인쇄 / PDF 내보내기")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.primary)
                                Text("동기화된 최신 시간표를 A4 가로 1페이지에 맞춰 바로 인쇄하거나 PDF·이미지로 저장합니다.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }

                    if store.currentWeekAdjustmentCount > 0 {
                        Button {
                            withAnimation {
                                store.resetThisWeekAdjustments(for: nil)
                            }
                        } label: {
                            HStack {
                                Label(
                                    "이번 주 임시 조정(\(store.currentWeekAdjustmentCount)건) 모두 원래 시간표로 되돌리기",
                                    systemImage: "arrow.uturn.backward.circle.fill"
                                )
                                .foregroundStyle(.orange)
                                Spacer()
                            }
                        }
                    }

                    Button(role: .destructive) {
                        performParentAction(
                            reason: "전체 주간 시간표를 초기 기본 상태로 되돌리려면 부모님 6자리 마스터 PIN이 필요합니다."
                        ) {
                            showingResetScheduleConfirm = true
                        }
                    } label: {
                        HStack {
                            Label("기본 주간 시간표(초기 상태)로 복원", systemImage: "arrow.counterclockwise")
                            Spacer()
                            Image(systemName: "lock.fill")
                                .font(.caption)
                        }
                    }
                } header: {
                    Text("1페이지 시간표 출력 · 데이터 관리")
                }
            }
            .navigationTitle("동기화 및 관리")
            .inlineNavigationBarTitle()
            .refreshable {
                await store.syncNow(forceUploadIfEmpty: false)
            }
            .task {
                await notificationManager.refreshAuthorizationStatus()
            }
            .sheet(item: $editingItem) { item in
                ScheduleEditSheet(mode: .edit(item), defaultWeekday: item.weekday)
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
            .sheet(isPresented: $showingPrintSheet) {
                SchedulePrintPreviewSheet()
            }
            .confirmationDialog(
                "시간표를 초기 기본 상태로 되돌릴까요?",
                isPresented: $showingResetScheduleConfirm,
                titleVisibility: .visible
            ) {
                Button("기본 시간표로 복원", role: .destructive) {
                    store.resetToDefaultSchedule()
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("직접 추가하거나 수정한 내용이 처음 기본 주간 시간표로 되돌아가며 클라우드에도 반영됩니다.")
            }
        }
    }

    private func performParentAction(reason: String, action: @escaping () -> Void) {
        if store.isParentModeUnlocked {
            action()
        } else {
            pinPrompt = ParentPinPromptContext(
                mode: .authenticate(reason: reason) {
                    action()
                }
            )
        }
    }

    private var statusIconName: String {
        switch notificationManager.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return "bell.badge.fill"
        case .denied:
            return "bell.slash.fill"
        default:
            return "bell.circle.fill"
        }
    }

    private var statusColor: Color {
        switch notificationManager.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return .green
        case .denied:
            return .red
        default:
            return .orange
        }
    }

    private var statusTitle: String {
        switch notificationManager.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return "알림이 정상 작동 중이에요"
        case .denied:
            return "알림 권한이 꺼져 있어요 (설정에서 켜주세요)"
        default:
            return "알림 권한 허용이 필요해요"
        }
    }
}

private struct NotificationItemRow: View {
    @EnvironmentObject var store: ScheduleStore
    let item: ScheduleItem
    let onTapDetail: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button(action: onTapDetail) {
                    HStack(spacing: 10) {
                        Image(systemName: item.iconName)
                            .font(.subheadline)
                            .foregroundStyle(item.category.color)
                            .frame(width: 32, height: 32)
                            .background(item.category.softBackgroundColor)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(item.weekday.shortName)
                                    .font(.caption2.weight(.heavy))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1.5)
                                    .background(Color(.tertiarySystemFill))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))

                                Text(item.startTimeString)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            Text(item.title)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                Toggle(
                    "",
                    isOn: Binding(
                        get: { item.isNotificationEnabled },
                        set: { _ in
                            withAnimation {
                                store.toggleNotification(for: item)
                            }
                        }
                    )
                )
                .labelsHidden()
                .tint(.orange)
            }

            if item.isNotificationEnabled {
                HStack(spacing: 5) {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.caption2)
                        .foregroundStyle(.orange)

                    ForEach(NotificationLeadTime.allCases) { lead in
                        let isSelected = item.notificationLeadMinutes.contains(lead.rawValue)
                        Button {
                            var current = Set(NotificationLeadTime.normalize(item.notificationLeadMinutes))
                            if isSelected {
                                if current.count > 1 {
                                    current.remove(lead.rawValue)
                                }
                            } else {
                                current.insert(lead.rawValue)
                            }
                            store.updateNotificationSettings(
                                for: item,
                                enabled: true,
                                leadMinutes: Array(current)
                            )
                        } label: {
                            Text(lead.label)
                                .font(.system(size: 11, weight: .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(isSelected ? Color.orange : Color(.tertiarySystemFill))
                                .foregroundStyle(isSelected ? .white : .secondary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.leading, 42)
            }
        }
        .padding(.vertical, 3)
    }
}
