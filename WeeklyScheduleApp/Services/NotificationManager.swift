import Foundation
import UserNotifications
import AVFoundation
import AudioToolbox
#if canImport(UIKit)
import UIKit
#endif
import SwiftUI

// MARK: - 시계 알람 벨소리 스타일 (27초 연속 울림 WAV)
enum AlarmSoundStyle: String, CaseIterable, Codable, Identifiable {
    case classic = "classic"
    case marimba = "marimba"
    case bell = "bell"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .classic: return "디지털 시계 알람 (기본)"
        case .marimba: return "마림바 멜로디 알람"
        case .bell: return "자명종 트윈벨 알람"
        }
    }

    var subtitle: String {
        switch self {
        case .classic: return "삐비비빅! 아이폰 시계 스타일 정통 전자 알람음"
        case .marimba: return "밝고 경쾌하게 반복되는 마림바 리듬 알람음"
        case .bell: return "절대 놓치지 않는 강력한 따르릉 자명종 벨소리"
        }
    }

    var iconName: String {
        switch self {
        case .classic: return "alarm.waves.left.and.right.fill"
        case .marimba: return "music.quarternote.3"
        case .bell: return "bell.and.waves.left.and.right.fill"
        }
    }

    var fileName: String {
        switch self {
        case .classic: return "alarm_classic_27s.wav"
        case .marimba: return "alarm_marimba_27s.wav"
        case .bell: return "alarm_bell_27s.wav"
        }
    }
}

// MARK: - 현재 울리고 있는 전체 화면 시계 알람 세션
struct ActiveAlarmSession: Identifiable, Equatable {
    var id: UUID = UUID()
    var scheduleItemId: UUID?
    var title: String
    var subtitle: String
    var timeRangeText: String
    var note: String
    var subTasks: [String]
    var category: ScheduleCategory
    var iconName: String
    var leadMinutes: Int
    var triggeredAt: Date = Date()
    var isSnoozed: Bool = false
}

// MARK: - 다시 알림(Snooze) 대기 항목
struct SnoozedAlarmEntry: Identifiable, Codable, Equatable {
    var id: String
    var scheduleItemId: UUID?
    var title: String
    var timeRangeText: String
    var note: String
    var subTasks: [String]
    var category: ScheduleCategory
    var iconName: String
    var leadMinutes: Int
    var fireDate: Date
    var snoozeMinutes: Int
}

// MARK: - 비동기 오디오 세션 & 플레이어 엔진 (메인 스레드 블로킹 방지)
private final class AlarmAudioEngine: @unchecked Sendable {
    static let shared = AlarmAudioEngine()
    private let queue = DispatchQueue(label: "com.weeklyschedule.alarmAudioEngine", qos: .userInitiated)
    private var audioPlayer: AVAudioPlayer?

    func play(url: URL?, loops: Int, fallbackAlertSound: Bool = false) {
        queue.async { [weak self] in
            guard let self else { return }
            self.stopInternal(deactivateSession: false)

            #if os(iOS)
            do {
                let session = AVAudioSession.sharedInstance()
                // .playback 카테고리는 아이폰 벨소리/무음 스위치가 무음이어도 시계 알람처럼 소리를 출력합니다.
                try session.setCategory(.playback, mode: .default, options: [.duckOthers])
                try session.setActive(true)
            } catch {
                print("Failed to configure AVAudioSession: \(error)")
            }
            #endif

            if let url, let player = try? AVAudioPlayer(contentsOf: url) {
                player.numberOfLoops = loops
                player.volume = 1.0
                player.prepareToPlay()
                player.play()
                self.audioPlayer = player
            } else if fallbackAlertSound {
                AudioServicesPlayAlertSound(1005)
            }
        }
    }

    func stop() {
        queue.async { [weak self] in
            self?.stopInternal(deactivateSession: true)
        }
    }

    private func stopInternal(deactivateSession: Bool) {
        if let player = audioPlayer {
            player.stop()
            audioPlayer = nil
        }
        if deactivateSession {
            #if os(iOS)
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            #endif
        }
    }
}

@MainActor
final class NotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    static let alarmCategoryIdentifier = "SCHEDULE_CLOCK_ALARM_CATEGORY"
    static let snooze5ActionIdentifier = "ALARM_SNOOZE_5_MIN"
    static let snooze9ActionIdentifier = "ALARM_SNOOZE_9_MIN"
    static let stopActionIdentifier = "ALARM_STOP_ACTION"

    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var scheduledCount: Int = 0
    @Published var lastTestNotificationMessage: String?

    /// 부모님 폰 여부 (부모 폰 모드에서는 시계 알람 및 로컬 알림이 발생하지 않음)
    @Published var isParentDevice: Bool = false

    /// 현재 화면 전체에 울리고 있는 시계 알람 세션
    @Published var activeAlarm: ActiveAlarmSession? = nil
    /// 현재 대기 중인 다시 알림(Snooze) 목록
    @Published var snoozedAlarms: [SnoozedAlarmEntry] = []
    /// 설정 화면에서 벨소리 미리듣기 재생 중인지 여부
    @Published var isPreviewingSound: Bool = false

    /// 선택된 시계 알람 벨소리 스타일
    @Published var selectedSoundStyle: AlarmSoundStyle = .classic {
        didSet {
            UserDefaults.standard.set(selectedSoundStyle.rawValue, forKey: soundStyleStorageKey)
        }
    }

    /// 잠금 화면에서도 1분 이상 길게 울리도록 정각 알람에 후속 연속 벨(+30초)을 추가할지 여부
    @Published var isCascadeRepeatEnabled: Bool = true {
        didSet {
            UserDefaults.standard.set(isCascadeRepeatEnabled, forKey: cascadeRepeatStorageKey)
        }
    }

    private let soundStyleStorageKey = "weekly_schedule_alarm_sound_style_v1"
    private let cascadeRepeatStorageKey = "weekly_schedule_alarm_cascade_repeat_v1"
    private let snoozedAlarmsStorageKey = "weekly_schedule_snoozed_alarms_v1"

    private var vibrationTimer: Timer?
    private var previewStopTask: Task<Void, Never>?
    private var triggeredMinuteKeys: Set<String> = []
    private var cachedScheduleItems: [ScheduleItem] = []

    private override init() {
        super.init()
        if let savedRole = UserDefaults.standard.string(forKey: "weekly_schedule_device_role_v1") {
            self.isParentDevice = (savedRole == "parent")
        }
        if let savedStyle = UserDefaults.standard.string(forKey: soundStyleStorageKey),
           let style = AlarmSoundStyle(rawValue: savedStyle) {
            self.selectedSoundStyle = style
        }
        if UserDefaults.standard.object(forKey: cascadeRepeatStorageKey) != nil {
            self.isCascadeRepeatEnabled = UserDefaults.standard.bool(forKey: cascadeRepeatStorageKey)
        }
        loadSnoozedAlarms()

        // 27초 시계 알람 사운드 파일들을 Library/Sounds에 즉시 준비
        Self.ensureAlarmSoundFilesReady()
        registerAlarmNotificationCategory()

        UNUserNotificationCenter.current().delegate = self
        Task {
            await refreshAuthorizationStatus()
        }
    }

    // MARK: - 알림 카테고리 등록 (잠금 화면 '다시 알림' & '알람 끄기' 버튼)

    private func registerAlarmNotificationCategory() {
        let snooze5Action = UNNotificationAction(
            identifier: Self.snooze5ActionIdentifier,
            title: "💤 5분 뒤 다시 알림 (Snooze)",
            options: []
        )
        let snooze9Action = UNNotificationAction(
            identifier: Self.snooze9ActionIdentifier,
            title: "💤 9분 뒤 다시 알림",
            options: []
        )
        let stopAction = UNNotificationAction(
            identifier: Self.stopActionIdentifier,
            title: "⏹️ 알람 끄기",
            options: [.destructive]
        )

        let alarmCategory = UNNotificationCategory(
            identifier: Self.alarmCategoryIdentifier,
            actions: [snooze5Action, snooze9Action, stopAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        UNUserNotificationCenter.current().setNotificationCategories([alarmCategory])
    }

    func refreshAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        self.authorizationStatus = settings.authorizationStatus
        let pending = await UNUserNotificationCenter.current().pendingNotificationRequests()
        self.scheduledCount = pending.count
    }

    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            await refreshAuthorizationStatus()
            return granted
        } catch {
            await refreshAuthorizationStatus()
            return false
        }
    }

    // MARK: - 기기 역할 모드 제어 (부모 폰 vs 아이 폰)

    /// 기기 역할에 따른 알림 모드 업데이트
    func updateDeviceRole(_ role: DeviceRole) async {
        self.isParentDevice = (role == .parent)
        if role == .parent {
            await disableAllNotificationsForParent()
        }
    }

    /// 부모님 폰 모드: 모든 예약된 로컬 알림, 진행 중인 알람, 다시 알림을 즉시 제거하고 완전 무음 유지
    func disableAllNotificationsForParent() async {
        self.isParentDevice = true
        stopActiveAlarm()
        stopPreviewSound()
        clearAllSnoozes()

        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        self.scheduledCount = 0
        self.activeAlarm = nil
        self.snoozedAlarms = []
    }

    /// 모든 다시 알림(Snooze) 해제
    func clearAllSnoozes() {
        snoozedAlarms.removeAll()
        saveSnoozedAlarms()
    }

    // MARK: - 주간 시간표 시계 알람 스케줄링

    /// 모든 활성화된 일정의 주간 반복 시계 알람을 다시 스케줄링합니다.
    func syncAllNotifications(for items: [ScheduleItem]) async {
        if isParentDevice {
            await disableAllNotificationsForParent()
            return
        }
        self.cachedScheduleItems = items
        Self.ensureAlarmSoundFilesReady()
        registerAlarmNotificationCategory()

        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        self.authorizationStatus = settings.authorizationStatus

        let enabledItems = items.filter { $0.isNotificationEnabled }
        if settings.authorizationStatus == .notDetermined && !enabledItems.isEmpty {
            _ = await requestPermission()
        }

        // 기존 스케줄 알림 제거 (진행 중인 다시 알림(Snooze)은 보존)
        let pendingRequests = await center.pendingNotificationRequests()
        let scheduleIdsToRemove = pendingRequests
            .map(\.identifier)
            .filter { $0.hasPrefix("schedule_") }
        if !scheduleIdsToRemove.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: scheduleIdsToRemove)
        }

        let updatedSettings = await center.notificationSettings()
        guard updatedSettings.authorizationStatus == .authorized || updatedSettings.authorizationStatus == .provisional else {
            self.scheduledCount = 0
            return
        }

        let alarmSound = UNNotificationSound(named: UNNotificationSoundName(selectedSoundStyle.fileName))
        var count = snoozedAlarms.count
        var zeroLeadCandidatesForCascade: [(ScheduleItem, Int, Int, Int)] = []

        for item in enabledItems {
            let offsets = item.notificationLeadMinutes.isEmpty ? [0] : item.notificationLeadMinutes
            for lead in offsets {
                // iOS 로컬 알림 최대 64개 제한 보호
                guard count < 60 else { break }

                let (calWeekday, triggerHour, triggerMinute) = Self.computeTriggerTime(
                    weekday: item.weekday,
                    hour: item.startHour,
                    minute: item.startMinute,
                    leadMinutes: lead
                )

                let content = makeAlarmNotificationContent(
                    for: item,
                    leadMinutes: lead,
                    sound: alarmSound,
                    isCascadeFollowUp: false
                )

                var dateComponents = DateComponents()
                dateComponents.weekday = calWeekday
                dateComponents.hour = triggerHour
                dateComponents.minute = triggerMinute
                dateComponents.second = 0

                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
                let identifier = "schedule_\(item.id.uuidString)_lead_\(lead)"
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

                do {
                    try await center.add(request)
                    count += 1
                    if lead == 0 {
                        zeroLeadCandidatesForCascade.append((item, calWeekday, triggerHour, triggerMinute))
                    }
                } catch {
                    print("Failed to schedule alarm notification: \(error)")
                }
            }
        }

        // 연속 알람(Cascade Repeat)이 켜져 있으면 남은 슬롯 한도 내에서 정각 알람 30초 뒤에 2차 연속 벨을 등록하여
        // 잠금 화면에서도 약 1분(27초 + 27초) 동안 시계 알람처럼 계속 울리도록 설정
        if isCascadeRepeatEnabled {
            let todayWeekday = Weekday.from(date: Date())
            // 오늘 요일 일정을 최우선으로 배치
            let sortedCandidates = zeroLeadCandidatesForCascade.sorted { lhs, rhs in
                let lhsIsToday = lhs.0.weekday == todayWeekday
                let rhsIsToday = rhs.0.weekday == todayWeekday
                if lhsIsToday != rhsIsToday { return lhsIsToday }
                return lhs.0.startTotalMinutes < rhs.0.startTotalMinutes
            }

            for (item, calWeekday, triggerHour, triggerMinute) in sortedCandidates {
                guard count < 61 else { break }

                let content = makeAlarmNotificationContent(
                    for: item,
                    leadMinutes: 0,
                    sound: alarmSound,
                    isCascadeFollowUp: true
                )

                var dateComponents = DateComponents()
                dateComponents.weekday = calWeekday
                dateComponents.hour = triggerHour
                dateComponents.minute = triggerMinute
                dateComponents.second = 30

                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
                let identifier = "schedule_\(item.id.uuidString)_lead_0_cascade"
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

                do {
                    try await center.add(request)
                    count += 1
                } catch {
                    print("Failed to schedule cascade alarm: \(error)")
                }
            }
        }

        let pending = await center.pendingNotificationRequests()
        self.scheduledCount = pending.count
    }

    private func makeAlarmNotificationContent(
        for item: ScheduleItem,
        leadMinutes: Int,
        sound: UNNotificationSound,
        isCascadeFollowUp: Bool
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        if leadMinutes == 0 {
            content.title = isCascadeFollowUp
                ? "🚨 [알람 계속 울림] \(item.title) 시작 시간!"
                : "⏰ [시계 알람] \(item.title) 시작 시간이에요!"
            content.subtitle = "\(item.weekday.fullName) \(item.timeRangeString)"
            if !item.note.isEmpty {
                content.body = "\(item.note) · 길게 눌러 '다시 알림' 또는 '알람 끄기'를 선택하세요."
            } else {
                content.body = "지금 [\(item.title)] 시작할 시간이에요! 길게 눌러 '다시 알림' 또는 '알람 끄기'를 선택하세요."
            }
        } else {
            content.title = "🔔 [\(leadMinutes)분 전 알람] \(item.title) 준비!"
            content.subtitle = "\(item.startTimeString) 시작 (\(item.weekday.fullName))"
            if !item.note.isEmpty {
                content.body = "준비물/메모: \(item.note) · 미리 준비해 볼까요?"
            } else {
                content.body = "\(item.startTimeString)에 시작해요. 지금 미리 준비해 볼까요?"
            }
        }

        content.sound = sound
        content.categoryIdentifier = Self.alarmCategoryIdentifier
        content.interruptionLevel = .timeSensitive
        content.relevanceScore = 1.0
        content.userInfo = [
            "isScheduleAlarm": true,
            "scheduleItemId": item.id.uuidString,
            "title": item.title,
            "timeRangeText": item.timeRangeString,
            "note": item.note,
            "subTasks": item.subTasks.map(\.title),
            "category": item.category.rawValue,
            "iconName": item.iconName,
            "leadMinutes": leadMinutes
        ]
        return content
    }

    // MARK: - 실시간 시계 감시 (앱 실행 중 정각/예약 시간 도달 시 즉시 전체 화면 시계 알람 실행)

    func checkLiveScheduleAlarms(now: Date, items: [ScheduleItem]) {
        guard !isParentDevice else { return }
        self.cachedScheduleItems = items

        // 1. 만료된 다시 알림(Snooze) 확인 및 실행
        let dueSnoozes = snoozedAlarms.filter { $0.fireDate <= now }
        if let firstDue = dueSnoozes.first {
            snoozedAlarms.removeAll { $0.id == firstDue.id }
            saveSnoozedAlarms()

            if activeAlarm == nil {
                let session = ActiveAlarmSession(
                    scheduleItemId: firstDue.scheduleItemId,
                    title: firstDue.title,
                    subtitle: "💤 다시 알림 (Snooze) · \(firstDue.timeRangeText)",
                    timeRangeText: firstDue.timeRangeText,
                    note: firstDue.note,
                    subTasks: firstDue.subTasks,
                    category: firstDue.category,
                    iconName: firstDue.iconName,
                    leadMinutes: firstDue.leadMinutes,
                    triggeredAt: now,
                    isSnoozed: true
                )
                presentClockAlarm(session)
            }
            return
        }

        // 2. 주간 시간표 예약 시간 도달 여부 확인 (초 단위가 0~4초 사이일 때 트리거)
        let calendar = Calendar.current
        let second = calendar.component(.second, from: now)
        guard second < 5 else { return }

        let currentCalWeekday = calendar.component(.weekday, from: now)
        let currentHour = calendar.component(.hour, from: now)
        let currentMinute = calendar.component(.minute, from: now)
        let dayOrdinal = calendar.ordinality(of: .day, in: .year, for: now) ?? 0

        for item in items where item.isNotificationEnabled {
            let offsets = item.notificationLeadMinutes.isEmpty ? [0] : item.notificationLeadMinutes
            for lead in offsets {
                let (calWeekday, triggerHour, triggerMinute) = Self.computeTriggerTime(
                    weekday: item.weekday,
                    hour: item.startHour,
                    minute: item.startMinute,
                    leadMinutes: lead
                )

                if calWeekday == currentCalWeekday && triggerHour == currentHour && triggerMinute == currentMinute {
                    let minuteKey = "\(dayOrdinal)_\(currentHour):\(currentMinute)_\(item.id.uuidString)_lead_\(lead)"
                    guard !triggeredMinuteKeys.contains(minuteKey) else { continue }
                    triggeredMinuteKeys.insert(minuteKey)

                    triggerInAppClockAlarm(for: item, leadMinutes: lead, isSnoozed: false)
                    return
                }
            }
        }
    }

    // MARK: - 시계 알람 실행 / 정지 / 다시 알림(Snooze)

    func triggerInAppClockAlarm(for item: ScheduleItem, leadMinutes: Int, isSnoozed: Bool = false) {
        guard !isParentDevice else { return }
        let subtitle: String
        if isSnoozed {
            subtitle = "💤 다시 알림 (Snooze) · \(item.timeRangeString)"
        } else if leadMinutes == 0 {
            subtitle = "⏰ 정각 시작 알람 · \(item.timeRangeString)"
        } else {
            subtitle = "🔔 \(leadMinutes)분 전 준비 알람 · \(item.startTimeString) 시작"
        }

        let session = ActiveAlarmSession(
            scheduleItemId: item.id,
            title: item.title,
            subtitle: subtitle,
            timeRangeText: item.timeRangeString,
            note: item.note,
            subTasks: item.subTasks.map(\.title),
            category: item.category,
            iconName: item.iconName,
            leadMinutes: leadMinutes,
            triggeredAt: Date(),
            isSnoozed: isSnoozed
        )
        presentClockAlarm(session)
    }

    /// 지금 즉시 전체 화면 시계 알람 UI + 연속 벨소리/진동을 실행하여 체험합니다.
    func triggerImmediateClockAlarmDemo() {
        guard !isParentDevice else {
            self.lastTestNotificationMessage = "부모님 폰 모드에서는 알림이 발생하지 않습니다."
            return
        }
        let nowFormatted = ScheduleItem.formatTime(
            hour: Calendar.current.component(.hour, from: Date()),
            minute: Calendar.current.component(.minute, from: Date())
        )
        let demoSession = ActiveAlarmSession(
            scheduleItemId: nil,
            title: "바이올린 · 학원 갈 시간!",
            subtitle: "⏰ 정각 시작 알람 · \(nowFormatted) 시계 알람 테스트",
            timeRangeText: "\(nowFormatted) ~ 1시간 진행",
            note: "악보 가방과 교재를 챙겨서 출발해요! 🎻",
            subTasks: ["악보 및 교재 챙기기", "물통 챙기기"],
            category: .music,
            iconName: "music.quarternote.3",
            leadMinutes: 0,
            triggeredAt: Date(),
            isSnoozed: false
        )
        presentClockAlarm(demoSession)
    }

    func presentClockAlarm(_ session: ActiveAlarmSession) {
        stopPreviewSound()
        withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) {
            self.activeAlarm = session
        }
        startContinuousAlarmAudioAndVibration()
    }

    /// 알람 끄기 (소리 및 진동 즉시 정지 + 잠금 화면 후속 연속 알람 취소)
    func stopActiveAlarm() {
        let currentSession = activeAlarm
        stopContinuousAlarmAudioAndVibration()
        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
            self.activeAlarm = nil
        }

        // 전달된 알림 배너 및 같은 일정의 직후 연속(cascade) 알림 정리
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        if let itemId = currentSession?.scheduleItemId {
            UNUserNotificationCenter.current().removePendingNotificationRequests(
                withIdentifiers: ["snooze_cascade_\(itemId.uuidString)"]
            )
        }
    }

    /// 다시 알림 (Snooze) 예약 (예: 5분 뒤 또는 9분 뒤 다시 울림)
    func snoozeActiveAlarm(minutes: Int = 5) async {
        guard let session = activeAlarm else { return }
        stopActiveAlarm()
        await scheduleSnooze(from: session, minutes: minutes)
    }

    func scheduleSnooze(from session: ActiveAlarmSession, minutes: Int) async {
        Self.ensureAlarmSoundFilesReady()
        let fireDate = Date().addingTimeInterval(TimeInterval(minutes * 60))
        let snoozeId = "snooze_\(session.scheduleItemId?.uuidString ?? UUID().uuidString)_\(Int(fireDate.timeIntervalSince1970))"

        let entry = SnoozedAlarmEntry(
            id: snoozeId,
            scheduleItemId: session.scheduleItemId,
            title: session.title,
            timeRangeText: session.timeRangeText,
            note: session.note,
            subTasks: session.subTasks,
            category: session.category,
            iconName: session.iconName,
            leadMinutes: session.leadMinutes,
            fireDate: fireDate,
            snoozeMinutes: minutes
        )

        snoozedAlarms.removeAll { $0.title == session.title }
        snoozedAlarms.append(entry)
        snoozedAlarms.sort { $0.fireDate < $1.fireDate }
        saveSnoozedAlarms()

        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = "⏰ [다시 알림] \(session.title) 시작 시간!"
        content.subtitle = "\(minutes)분 뒤 다시 알림 · \(session.timeRangeText)"
        content.body = session.note.isEmpty
            ? "다시 알림 시간이 되었어요! 지금 바로 시작해 볼까요? 💪"
            : "\(session.note) · 지금 바로 시작해 볼까요?"
        content.sound = UNNotificationSound(named: UNNotificationSoundName(selectedSoundStyle.fileName))
        content.categoryIdentifier = Self.alarmCategoryIdentifier
        content.interruptionLevel = .timeSensitive
        content.relevanceScore = 1.0
        content.userInfo = [
            "isScheduleAlarm": true,
            "isSnoozed": true,
            "scheduleItemId": session.scheduleItemId?.uuidString ?? "",
            "title": session.title,
            "timeRangeText": session.timeRangeText,
            "note": session.note,
            "subTasks": session.subTasks,
            "category": session.category.rawValue,
            "iconName": session.iconName,
            "leadMinutes": session.leadMinutes
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(minutes * 60), repeats: false)
        let request = UNNotificationRequest(identifier: snoozeId, content: content, trigger: trigger)
        try? await center.add(request)

        // 잠금 화면에서도 길게 울리도록 30초 뒤 후속 벨 추가
        if isCascadeRepeatEnabled {
            let cascadeTrigger = UNTimeIntervalNotificationTrigger(
                timeInterval: TimeInterval(minutes * 60 + 30),
                repeats: false
            )
            let cascadeRequest = UNNotificationRequest(
                identifier: "\(snoozeId)_cascade",
                content: content,
                trigger: cascadeTrigger
            )
            try? await center.add(cascadeRequest)
        }

        await refreshAuthorizationStatus()
    }

    func cancelSnooze(_ entry: SnoozedAlarmEntry) {
        snoozedAlarms.removeAll { $0.id == entry.id }
        saveSnoozedAlarms()
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [entry.id, "\(entry.id)_cascade"]
        )
        Task {
            await refreshAuthorizationStatus()
        }
    }

    // MARK: - 3초 뒤 잠금 화면 / 백그라운드 시계 알람 테스트

    func sendTestNotification() async {
        guard !isParentDevice else {
            lastTestNotificationMessage = "부모님 폰 모드에서는 알림이 발생하지 않습니다."
            return
        }
        Self.ensureAlarmSoundFilesReady()
        registerAlarmNotificationCategory()

        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = await requestPermission()
        }

        let currentSettings = await center.notificationSettings()
        guard currentSettings.authorizationStatus == .authorized || currentSettings.authorizationStatus == .provisional else {
            lastTestNotificationMessage = "아이폰 설정에서 알림 권한을 허용해 주세요."
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "⏰ [시계 알람 테스트] 바이올린 · 학원 갈 시간!"
        content.subtitle = "27초 연속 알람 벨소리 + 다시 알림(Snooze) 지원"
        content.body = "잠금 화면에서는 27초 동안 알람 벨이 계속 울리며, 길게 누르면 '5분 뒤 다시 알림' 또는 '알람 끄기'를 누를 수 있어요!"
        content.sound = UNNotificationSound(named: UNNotificationSoundName(selectedSoundStyle.fileName))
        content.categoryIdentifier = Self.alarmCategoryIdentifier
        content.interruptionLevel = .timeSensitive
        content.relevanceScore = 1.0
        content.userInfo = [
            "isScheduleAlarm": true,
            "title": "바이올린 · 학원 갈 시간!",
            "timeRangeText": "시계 알람 테스트",
            "note": "악보 가방과 교재를 챙겨서 출발해요! 🎻",
            "subTasks": ["악보 및 교재 챙기기", "물통 챙기기"],
            "category": ScheduleCategory.music.rawValue,
            "iconName": "music.quarternote.3",
            "leadMinutes": 0
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        let request = UNNotificationRequest(
            identifier: "test_clock_alarm_\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
            lastTestNotificationMessage = "3초 뒤 시계 알람이 울립니다! (지금 화면을 잠그면 27초 연속 벨소리를, 앱을 켜두면 전체 화면 시계 알람을 확인할 수 있어요)"
        } catch {
            lastTestNotificationMessage = "알람 등록 실패: \(error.localizedDescription)"
        }
    }

    /// 동기화로 새로운 하트/응원 또는 숙제 완료 소식이 도착했을 때 즉시 로컬 알림 표시
    func sendInstantSyncEventNotification(title: String, body: String) async {
        guard !isParentDevice else { return }
        let center = UNUserNotificationCenter.current()
        let currentSettings = await center.notificationSettings()
        guard currentSettings.authorizationStatus == .authorized || currentSettings.authorizationStatus == .provisional else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.interruptionLevel = .timeSensitive

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        let request = UNNotificationRequest(identifier: "sync_event_\(UUID().uuidString)", content: content, trigger: trigger)
        try? await center.add(request)
    }

    // MARK: - 연속 알람 오디오 & 진동 엔진 (무음 모드에서도 시계 알람처럼 소리 재생)

    private func startContinuousAlarmAudioAndVibration() {
        stopContinuousAlarmAudioAndVibration()
        Self.ensureAlarmSoundFilesReady()

        let soundURL = Self.soundFileURL(for: selectedSoundStyle)
        AlarmAudioEngine.shared.play(url: soundURL, loops: -1, fallbackAlertSound: true)

        // 즉시 1회 진동/햅틱 후 알람 진동 반복
        #if os(iOS)
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        let feedback = UINotificationFeedbackGenerator()
        feedback.notificationOccurred(.warning)

        vibrationTimer = Timer.scheduledTimer(withTimeInterval: 1.4, repeats: true) { _ in
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
        #elseif os(macOS)
        HapticFeedbackHelper.warning()
        #endif
    }

    private func stopContinuousAlarmAudioAndVibration() {
        vibrationTimer?.invalidate()
        vibrationTimer = nil
        AlarmAudioEngine.shared.stop()
    }

    /// 설정 화면에서 선택한 알람 벨소리를 4초간 미리 들어봅니다.
    func togglePreviewSound(style: AlarmSoundStyle? = nil) {
        if let style {
            selectedSoundStyle = style
        }
        if isPreviewingSound {
            stopPreviewSound()
            return
        }

        Self.ensureAlarmSoundFilesReady()
        stopPreviewSound()

        if let url = Self.soundFileURL(for: selectedSoundStyle) {
            AlarmAudioEngine.shared.play(url: url, loops: 0, fallbackAlertSound: false)
            self.isPreviewingSound = true

            previewStopTask = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 4_500_000_000)
                guard !Task.isCancelled else { return }
                self?.stopPreviewSound()
            }
        }
    }

    func stopPreviewSound() {
        previewStopTask?.cancel()
        previewStopTask = nil
        if isPreviewingSound {
            isPreviewingSound = false
            AlarmAudioEngine.shared.stop()
        }
    }

    // MARK: - Snooze 저장소

    private func loadSnoozedAlarms() {
        guard let data = UserDefaults.standard.data(forKey: snoozedAlarmsStorageKey),
              let decoded = try? JSONDecoder().decode([SnoozedAlarmEntry].self, from: data) else {
            return
        }
        let now = Date()
        self.snoozedAlarms = decoded.filter { $0.fireDate > now.addingTimeInterval(-60) }
    }

    private func saveSnoozedAlarms() {
        if let data = try? JSONEncoder().encode(snoozedAlarms) {
            UserDefaults.standard.set(data, forKey: snoozedAlarmsStorageKey)
        }
    }

    // MARK: - 시간 계산 헬퍼

    private static func computeTriggerTime(weekday: Weekday, hour: Int, minute: Int, leadMinutes: Int) -> (Int, Int, Int) {
        var totalMinutes = hour * 60 + minute - leadMinutes
        var calWeekday = weekday.calendarWeekday

        if totalMinutes < 0 {
            totalMinutes += 24 * 60
            calWeekday = calWeekday == 1 ? 7 : (calWeekday - 1)
        }

        let finalHour = (totalMinutes / 60) % 24
        let finalMinute = totalMinutes % 60
        return (calWeekday, finalHour, finalMinute)
    }

    // MARK: - UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        let isScheduleAlarm = (userInfo["isScheduleAlarm"] as? Bool) ?? false

        if isScheduleAlarm {
            Task { @MainActor in
                let session = Self.makeSession(from: userInfo)
                NotificationManager.shared.presentClockAlarm(session)
            }
            // 앱 내부에서 즉시 전체 화면 시계 알람과 무한 루프 사운드를 재생하므로 배너만 표시
            completionHandler([.banner, .list])
        } else {
            completionHandler([.banner, .list, .sound])
        }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let isScheduleAlarm = (userInfo["isScheduleAlarm"] as? Bool) ?? false
        let actionId = response.actionIdentifier

        guard isScheduleAlarm else {
            completionHandler()
            return
        }

        Task { @MainActor in
            let session = Self.makeSession(from: userInfo)
            switch actionId {
            case Self.snooze5ActionIdentifier:
                NotificationManager.shared.stopActiveAlarm()
                await NotificationManager.shared.scheduleSnooze(from: session, minutes: 5)
            case Self.snooze9ActionIdentifier:
                NotificationManager.shared.stopActiveAlarm()
                await NotificationManager.shared.scheduleSnooze(from: session, minutes: 9)
            case Self.stopActionIdentifier, UNNotificationDismissActionIdentifier:
                NotificationManager.shared.stopActiveAlarm()
            default:
                // 알림 배너를 탭해서 앱을 열었을 때 전체 화면 시계 알람 표시
                NotificationManager.shared.presentClockAlarm(session)
            }
            completionHandler()
        }
    }

    nonisolated private static func makeSession(from userInfo: [AnyHashable: Any]) -> ActiveAlarmSession {
        let idStr = userInfo["scheduleItemId"] as? String ?? ""
        let itemId = UUID(uuidString: idStr)
        let title = userInfo["title"] as? String ?? "스케줄 알람"
        let timeRangeText = userInfo["timeRangeText"] as? String ?? ""
        let note = userInfo["note"] as? String ?? ""
        let subTasks = userInfo["subTasks"] as? [String] ?? []
        let catRaw = userInfo["category"] as? String ?? ScheduleCategory.study.rawValue
        let category = ScheduleCategory(rawValue: catRaw) ?? .study
        let iconName = userInfo["iconName"] as? String ?? category.defaultIcon
        let leadMinutes = userInfo["leadMinutes"] as? Int ?? 0
        let isSnoozed = userInfo["isSnoozed"] as? Bool ?? false

        let subtitle: String
        if isSnoozed {
            subtitle = "💤 다시 알림 (Snooze) · \(timeRangeText)"
        } else if leadMinutes == 0 {
            subtitle = "⏰ 정각 시작 알람 · \(timeRangeText)"
        } else {
            subtitle = "🔔 \(leadMinutes)분 전 준비 알람 · \(timeRangeText)"
        }

        return ActiveAlarmSession(
            scheduleItemId: itemId,
            title: title,
            subtitle: subtitle,
            timeRangeText: timeRangeText,
            note: note,
            subTasks: subTasks,
            category: category,
            iconName: iconName,
            leadMinutes: leadMinutes,
            triggeredAt: Date(),
            isSnoozed: isSnoozed
        )
    }

    // MARK: - 27초 연속 시계 알람 WAV 사운드 생성기 (Library/Sounds)

    nonisolated static func soundsDirectoryURL() -> URL? {
        guard let libraryURL = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else {
            return nil
        }
        let soundsURL = libraryURL.appendingPathComponent("Sounds", isDirectory: true)
        if !FileManager.default.fileExists(atPath: soundsURL.path) {
            try? FileManager.default.createDirectory(at: soundsURL, withIntermediateDirectories: true)
        }
        return soundsURL
    }

    nonisolated static func soundFileURL(for style: AlarmSoundStyle) -> URL? {
        soundsDirectoryURL()?.appendingPathComponent(style.fileName)
    }

    /// iOS 로컬 알림이 잠금 화면에서도 27초 동안 연속으로 울릴 수 있도록 Library/Sounds 폴더에 WAV 파일을 생성합니다.
    nonisolated static func ensureAlarmSoundFilesReady() {
        for style in AlarmSoundStyle.allCases {
            guard let fileURL = soundFileURL(for: style) else { continue }
            if !FileManager.default.fileExists(atPath: fileURL.path) {
                let wavData = generate27SecondAlarmWAV(style: style)
                try? wavData.write(to: fileURL, options: .atomic)
            }
        }
    }

    /// 3초 주기의 고음질 알람 패턴을 9회 반복(총 27.0초, 16-bit Linear PCM)하여 즉시 WAV 데이터를 생성합니다.
    nonisolated private static func generate27SecondAlarmWAV(style: AlarmSoundStyle) -> Data {
        let sampleRate = 22050
        let cycleSeconds = 3
        let repeatCycles = 9 // 3초 * 9회 = 27.0초 (iOS 30초 제한 준수)
        let samplesPerCycle = sampleRate * cycleSeconds
        let totalSamples = samplesPerCycle * repeatCycles

        var cycleSamples = [Int16](repeating: 0, count: samplesPerCycle)

        for i in 0..<samplesPerCycle {
            let t = Double(i) / Double(sampleRate)
            let localT = t.truncatingRemainder(dividingBy: 1.0) // 1초 단위 서브 패턴
            var sampleValue: Double = 0.0

            switch style {
            case .classic:
                // 아이폰 디지털 시계 알람 스타일: 1초 중 앞 0.52초 동안 4회 '삐-비-비-빅!' (960Hz + 1920Hz 배음)
                if localT < 0.52 {
                    let beepIndex = Int(localT / 0.13)
                    let beepPhase = localT - Double(beepIndex) * 0.13
                    if beepPhase < 0.085 {
                        let attack = min(1.0, beepPhase / 0.008)
                        let release = min(1.0, (0.085 - beepPhase) / 0.012)
                        let env = attack * release
                        let f1 = sin(2.0 * .pi * 987.77 * t) // B5
                        let f2 = 0.45 * sin(2.0 * .pi * 1975.53 * t) // B6
                        sampleValue = env * (f1 + f2) * 0.65
                    }
                }

            case .marimba:
                // 밝고 경쾌한 마림바 아르페지오 멜로디 (C5 - E5 - G5 - C6 - G5 - E5 - G5 - C6)
                let notes: [Double] = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25, 880.00, 1046.50]
                let stepDuration = 0.1875 // 1.5초에 8음계
                let phraseT = t.truncatingRemainder(dividingBy: 1.5)
                let noteIdx = min(notes.count - 1, Int(phraseT / stepDuration))
                let noteTime = phraseT - Double(noteIdx) * stepDuration
                let freq = notes[noteIdx]

                let env = exp(-noteTime * 16.0) * min(1.0, noteTime / 0.004)
                let fundamental = sin(2.0 * .pi * freq * noteTime)
                let woodOvertone = 0.35 * sin(2.0 * .pi * (freq * 4.0) * noteTime) * exp(-noteTime * 35.0)
                sampleValue = env * (fundamental + woodOvertone) * 0.78

            case .bell:
                // 강력한 트윈벨 자명종: 1.5초 주기 중 1.05초 동안 빠른 해머 트레몰로 벨소리
                let bellCycle = t.truncatingRemainder(dividingBy: 1.5)
                if bellCycle < 1.05 {
                    let hammerMod = 0.55 + 0.45 * sin(2.0 * .pi * 20.0 * bellCycle)
                    let bellA = sin(2.0 * .pi * 1174.66 * t) // D6
                    let bellB = 0.6 * sin(2.0 * .pi * 1567.98 * t) // G6
                    let metallic = 0.25 * sin(2.0 * .pi * 2637.02 * t) // E7
                    sampleValue = hammerMod * (bellA + bellB + metallic) * 0.55
                }
            }

            let clamped = max(-0.98, min(0.98, sampleValue))
            cycleSamples[i] = Int16(clamped * 32767.0)
        }

        let cycleByteCount = samplesPerCycle * 2
        let totalDataBytes = totalSamples * 2
        let riffChunkSize = 36 + totalDataBytes

        var wavData = Data(capacity: 44 + totalDataBytes)

        // RIFF WAVE Header (44 bytes)
        wavData.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
        wavData.append(littleEndianUInt32(UInt32(riffChunkSize)))
        wavData.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"
        wavData.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
        wavData.append(littleEndianUInt32(16))               // PCM chunk size
        wavData.append(littleEndianUInt16(1))                // AudioFormat = 1 (Linear PCM)
        wavData.append(littleEndianUInt16(1))                // NumChannels = 1 (Mono)
        wavData.append(littleEndianUInt32(UInt32(sampleRate)))
        wavData.append(littleEndianUInt32(UInt32(sampleRate * 2))) // ByteRate
        wavData.append(littleEndianUInt16(2))                // BlockAlign
        wavData.append(littleEndianUInt16(16))               // BitsPerSample = 16
        wavData.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        wavData.append(littleEndianUInt32(UInt32(totalDataBytes)))

        let singleCycleData = cycleSamples.withUnsafeBufferPointer { buffer in
            Data(buffer: buffer)
        }
        assert(singleCycleData.count == cycleByteCount)

        for _ in 0..<repeatCycles {
            wavData.append(singleCycleData)
        }

        return wavData
    }

    nonisolated private static func littleEndianUInt32(_ value: UInt32) -> Data {
        var le = value.littleEndian
        return Data(bytes: &le, count: 4)
    }

    nonisolated private static func littleEndianUInt16(_ value: UInt16) -> Data {
        var le = value.littleEndian
        return Data(bytes: &le, count: 2)
    }
}
