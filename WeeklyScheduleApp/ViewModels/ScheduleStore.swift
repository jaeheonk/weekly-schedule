import Foundation
import SwiftUI

@MainActor
final class ScheduleStore: ObservableObject {
    static let defaultMasterPin = "160125"

    @Published var items: [ScheduleItem] = [] {
        didSet {
            saveItems()
        }
    }

    /// 주차별 임시 스케줄 조정 및 휴강 내역 ("YYYY-Www_UUID" -> WeeklyItemOverride)
    @Published var weeklyOverrides: [String: WeeklyItemOverride] = [:] {
        didSet {
            saveWeeklyOverrides()
        }
    }

    /// 이번 주 아이가 '다 했어요' 체크한 일정 ID 키 집합 ("YYYY-Www_UUID")
    @Published var completedItemKeys: Set<String> = [] {
        didSet {
            saveCompletions()
        }
    }

    /// 이번 주 아이가 '다 했어요' 체크한 세부 할 일(SubTask) ID 키 집합 ("YYYY-Www_UUID")
    @Published var completedSubTaskKeys: Set<String> = [] {
        didSet {
            saveCompletions()
        }
    }

    /// 이번 주 어른(부모님)이 최종 확인 완료한 일정 ID 키 집합 ("YYYY-Www_UUID")
    @Published var parentVerifiedItemKeys: Set<String> = [] {
        didSet {
            saveParentVerifications()
        }
    }

    /// 이번 주 어른(부모님)이 최종 확인 완료한 세부 할 일(SubTask) ID 키 집합 ("YYYY-Www_UUID")
    @Published var parentVerifiedSubTaskKeys: Set<String> = [] {
        didSet {
            saveParentVerifications()
        }
    }

    /// 일정별 부모님 하트·스티커·칭찬 코멘트 ("YYYY-Www_UUID" -> ItemParentReaction)
    @Published var itemReactions: [String: ItemParentReaction] = [:] {
        didSet {
            saveReactionsAndPraises()
        }
    }

    /// 부모님이 보낸 전체 응원/하트 메시지 목록
    @Published var praiseNotes: [ParentPraiseNote] = [] {
        didSet {
            saveReactionsAndPraises()
        }
    }

    /// 하트로 보상을 교환(차감)한 내역 목록 (최신순)
    @Published var rewardRedemptions: [HeartRewardRedemption] = [] {
        didSet {
            saveReactionsAndPraises()
        }
    }

    /// 아카이브된 누적 획득 하트 (노트 개수 제한 초과 시에도 하트 총액 보존)
    @Published var archivedEarnedHearts: Int = 0 {
        didSet {
            saveReactionsAndPraises()
        }
    }

    /// 가족 맞춤 추천 보상 프리셋 목록 (부모님이 추가/수정/삭제 가능)
    @Published var rewardPresets: [RewardPreset] = RewardPreset.defaultPresets {
        didSet {
            saveRewardPresets()
        }
    }

    /// 현재 기기 역할 모드 (.child: 아이의 폰, .parent: 부모님 폰)
    @Published private(set) var deviceRole: DeviceRole = .child
    @Published private(set) var hasConfirmedDeviceRole: Bool = false

    /// 어른 인증용 6자리 마스터 PIN 번호 (기본값: 160125)
    @Published private(set) var parentPinCode: String = ScheduleStore.defaultMasterPin
    private var parentPinUpdatedAt: TimeInterval = 1_700_000_000

    /// PIN 연속 실패 횟수 및 입력 잠금 만료 시각 (10세 아이 무차별 대입 방지)
    @Published private(set) var failedPinAttempts: Int = 0
    @Published private(set) var pinLockoutUntil: Date? = nil

    /// 현재 '부모 확인 모드' 잠금 해제 여부
    @Published private(set) var isParentModeUnlocked: Bool = false
    @Published private(set) var parentModeUnlockedUntil: Date? = nil

    /// Vercel Blob 동기화 설정 및 상태
    @Published var vercelBlobToken: String = VercelBlobSyncService.defaultToken
    @Published var familyCode: String = VercelBlobSyncService.defaultFamilyCode
    @Published var isCloudSyncEnabled: Bool = true
    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var lastSyncedAt: Date? = nil
    @Published private(set) var lastRemoteUpdatedBy: String? = nil
    @Published private(set) var syncErrorMessage: String? = nil
    @Published var syncToastMessage: String? = nil

    @Published var selectedWeekday: Weekday = Weekday.from(date: Date())
    @Published var now: Date = Date()

    // 타임스탬프 기반 스마트 병합(Smart Merge)용 내부 딕셔너리
    private var deletedItemTimestamps: [String: TimeInterval] = [:]
    private var completionFlags: [String: SyncTimestampedFlag] = [:]
    private var subTaskCompletionFlags: [String: SyncTimestampedFlag] = [:]
    private var parentVerifiedFlags: [String: SyncTimestampedFlag] = [:]
    private var parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag] = [:]

    // 저장된 여러 속성을 복원하는 동안 didSet이 아직 읽지 않은 내역을 덮어쓰지 않도록 합니다.
    private var isRestoringLocalState = true

    private let itemsStorageKey = "weekly_schedule_items_v1"
    private let weeklyOverridesStorageKey = "weekly_schedule_overrides_v1"
    private let completedItemsStorageKey = "weekly_schedule_completed_items_v1"
    private let completedSubTasksStorageKey = "weekly_schedule_completed_subtasks_v1"
    private let parentVerifiedItemsStorageKey = "weekly_schedule_parent_verified_items_v1"
    private let parentVerifiedSubTasksStorageKey = "weekly_schedule_parent_verified_subtasks_v1"
    private let parentPinStorageKey = "weekly_schedule_parent_pin_v2_6digit"
    private let parentPinUpdatedAtKey = "weekly_schedule_parent_pin_updated_at_v2"
    private let deviceRoleStorageKey = "weekly_schedule_device_role_v1"
    private let deviceRoleConfirmedKey = "weekly_schedule_device_role_confirmed_v1"
    private let deviceIdStorageKey = "weekly_schedule_device_id_v1"
    private let reactionsStorageKey = "weekly_schedule_item_reactions_v1"
    private let praiseNotesStorageKey = "weekly_schedule_praise_notes_v1"
    private let rewardRedemptionsStorageKey = "weekly_schedule_reward_redemptions_v1"
    private let archivedEarnedHeartsStorageKey = "weekly_schedule_archived_earned_hearts_v1"
    private var deletedRewardPresetTimestamps: [String: TimeInterval] = [:]
    private let deletedRewardPresetsStorageKey = "weekly_schedule_deleted_reward_presets_v1"
    private let rewardPresetsStorageKey = "weekly_schedule_reward_presets_v1"
    private let syncFlagsStorageKey = "weekly_schedule_sync_flags_v1"
    private let vercelTokenStorageKey = "weekly_schedule_vercel_blob_token_v1"
    private let familyCodeStorageKey = "weekly_schedule_family_code_v1"

    private let deviceId: String
    private var lastSyncedBlobPathname: String? = nil
    private var lastObservedWeekPrefix: String = ""
    private var lastObservedDay: Date = Calendar.current.startOfDay(for: Date())
    private var dayChangedObserver: NSObjectProtocol?
    private var clockTimer: Timer?
    private var syncTimer: Timer?
    private var pushDebounceTask: Task<Void, Never>?
    private var toastDismissTask: Task<Void, Never>?

    init() {
        if let savedId = UserDefaults.standard.string(forKey: deviceIdStorageKey), !savedId.isEmpty {
            self.deviceId = savedId
        } else {
            let newId = String(UUID().uuidString.prefix(6)).lowercased()
            UserDefaults.standard.set(newId, forKey: deviceIdStorageKey)
            self.deviceId = newId
        }

        loadSecurityAndRoleSettings()
        loadSyncSettings()
        loadItems()
        loadWeeklyOverrides()
        loadCompletions()
        loadParentVerifications()
        loadReactionsAndPraises()
        loadSyncFlags()
        reconcileFlagsWithSets()
        normalizeAndDeduplicateLocalItems()
        isRestoringLocalState = false

        let currentDate = Date()
        now = currentDate
        selectedWeekday = Weekday.from(date: currentDate)
        lastObservedDay = Calendar.current.startOfDay(for: currentDate)
        lastObservedWeekPrefix = currentWeekPrefix
        startTimers()
        setupDateChangeObserver()

        Task {
            await NotificationManager.shared.updateDeviceRole(deviceRole)
            if deviceRole == .child {
                await NotificationManager.shared.syncAllNotifications(for: effectiveItems)
            } else {
                await NotificationManager.shared.disableAllNotificationsForParent()
            }
            await pullLatestFromCloud(isInitialLaunch: true)
        }
    }

    private func setupDateChangeObserver() {
        dayChangedObserver = NotificationCenter.default.addObserver(
            forName: .NSCalendarDayChanged,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.refreshDateAndDayChange()
            }
        }
    }

    /// 날짜 변경(자정 경과 또는 다음날 앱 복귀) 감지 시 현재 날짜 갱신 및 오늘 요일 자동 선택
    func refreshDateAndDayChange() {
        let currentDate = Date()
        self.now = currentDate
        let currentDay = Calendar.current.startOfDay(for: currentDate)
        if currentDay != self.lastObservedDay {
            self.lastObservedDay = currentDay
            let newWeekday = Weekday.from(date: currentDate)
            if self.selectedWeekday != newWeekday {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    self.selectedWeekday = newWeekday
                }
            }
            if self.currentWeekPrefix != self.lastObservedWeekPrefix {
                self.lastObservedWeekPrefix = self.currentWeekPrefix
                self.syncNotifications()
            }
        }
    }

    private func startTimers() {
        clockTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.refreshDateAndDayChange()
                self.checkParentModeExpiration()
                self.checkPinLockoutExpiration()
                if self.deviceRole == .child {
                    NotificationManager.shared.checkLiveScheduleAlarms(now: self.now, items: self.effectiveItems)
                }
            }
        }

        // 8초마다 클라우드 변경사항 확인 (가벼운 메타데이터 조회 후 변경 시에만 다운로드)
        syncTimer = Timer.scheduledTimer(withTimeInterval: 8, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.isCloudSyncEnabled, !self.isSyncing else { return }
                await self.pullLatestFromCloud(isInitialLaunch: false)
            }
        }
    }

    // MARK: - Device Role (아이의 폰 vs 부모님 폰) & 6-Digit Master PIN Security

    var hasParentPin: Bool {
        parentPinCode.count == 6
    }

    var isPinLockedOut: Bool {
        guard let until = pinLockoutUntil else { return false }
        return now < until
    }

    var remainingLockoutSeconds: Int {
        guard let until = pinLockoutUntil else { return 0 }
        return max(0, Int(ceil(until.timeIntervalSince(now))))
    }

    /// 기기 역할 변경 (아이 폰 -> 부모님 폰 전환은 호출 전 6자리 마스터 PIN 인증 필수)
    func setDeviceRole(_ role: DeviceRole) {
        deviceRole = role
        hasConfirmedDeviceRole = true
        UserDefaults.standard.set(role.rawValue, forKey: deviceRoleStorageKey)
        UserDefaults.standard.set(true, forKey: deviceRoleConfirmedKey)
        KeychainHelper.saveString(role.rawValue, forKey: deviceRoleStorageKey)

        if role == .child {
            lockParentMode()
        } else {
            unlockParentMode()
        }

        Task {
            await NotificationManager.shared.updateDeviceRole(role)
            if role == .child {
                await NotificationManager.shared.syncAllNotifications(for: effectiveItems)
                showToast("👦 아이 폰 모드로 전환되었습니다. 시간표 알람이 활성화됩니다.")
            } else {
                await NotificationManager.shared.disableAllNotificationsForParent()
                showToast("👩‍👦 부모님 폰 모드로 전환되었습니다. 알림이 발생하지 않습니다.")
            }
        }
    }

    func setParentPin(_ newPin: String) {
        let digitsOnly = newPin.filter { $0.isNumber }
        guard digitsOnly.count == 6 else { return }
        let ts = Date().timeIntervalSince1970
        parentPinCode = digitsOnly
        parentPinUpdatedAt = ts
        UserDefaults.standard.set(digitsOnly, forKey: parentPinStorageKey)
        UserDefaults.standard.set(ts, forKey: parentPinUpdatedAtKey)
        KeychainHelper.saveString(digitsOnly, forKey: parentPinStorageKey)
        KeychainHelper.saveString(String(ts), forKey: parentPinUpdatedAtKey)

        resetPinLockout()
        unlockParentMode()
        scheduleCloudPush()
    }

    func verifyParentPin(_ inputPin: String) -> Bool {
        guard !isPinLockedOut else { return false }
        let cleanInput = inputPin.filter { $0.isNumber }
        if cleanInput.count == 6 && cleanInput == parentPinCode {
            resetPinLockout()
            unlockParentMode()
            return true
        } else {
            recordFailedPinAttempt()
            return false
        }
    }

    private func recordFailedPinAttempt() {
        failedPinAttempts += 1
        KeychainHelper.saveString("\(failedPinAttempts)", forKey: "pin_failed_attempts")

        // 5회 이상 실패 시 단계별 입력 잠금 (5회: 60초, 10회 이상: 300초)
        if failedPinAttempts >= 5 && failedPinAttempts % 5 == 0 {
            let lockSeconds: TimeInterval = failedPinAttempts >= 10 ? 300 : 60
            let until = Date().addingTimeInterval(lockSeconds)
            pinLockoutUntil = until
            KeychainHelper.saveString(String(until.timeIntervalSince1970), forKey: "pin_lockout_until")
        }
    }

    private func resetPinLockout() {
        failedPinAttempts = 0
        pinLockoutUntil = nil
        KeychainHelper.saveString("0", forKey: "pin_failed_attempts")
        KeychainHelper.saveString("0", forKey: "pin_lockout_until")
    }

    private func checkPinLockoutExpiration() {
        if let until = pinLockoutUntil, now >= until {
            pinLockoutUntil = nil
            KeychainHelper.saveString("0", forKey: "pin_lockout_until")
        }
    }

    func unlockParentMode() {
        isParentModeUnlocked = true
        // 부모님 폰에서는 15분간 유지, 아이 폰에서 임시 잠금 해제 시에는 3분 후 자동 잠금
        let duration: TimeInterval = (deviceRole == .parent) ? (15 * 60) : (3 * 60)
        parentModeUnlockedUntil = Date().addingTimeInterval(duration)
    }

    func lockParentMode() {
        isParentModeUnlocked = false
        parentModeUnlockedUntil = nil
    }

    private func checkParentModeExpiration() {
        guard isParentModeUnlocked else { return }
        if let until = parentModeUnlockedUntil, now >= until {
            lockParentMode()
        }
    }

    // MARK: - Queries (전체 기본 시간표 vs 이번 주 조정 반영 시간표)

    var todayWeekday: Weekday {
        Weekday.from(date: now)
    }

    var currentMinutesOfDay: Int {
        let cal = Calendar.current
        let hour = cal.component(.hour, from: now)
        let minute = cal.component(.minute, from: now)
        return hour * 60 + minute
    }

    /// 매주 반복되는 전체 기본(정규) 시간표 목록
    var masterItems: [ScheduleItem] {
        items
            .filter { $0.targetWeekKey == nil }
            .sorted {
                if $0.weekday.rawValue == $1.weekday.rawValue {
                    if $0.startTotalMinutes == $1.startTotalMinutes {
                        return $0.endTotalMinutes < $1.endTotalMinutes
                    }
                    return $0.startTotalMinutes < $1.startTotalMinutes
                }
                return $0.weekday.rawValue < $1.weekday.rawValue
            }
    }

    /// 특정 요일의 매주 반복 전체 기본(정규) 시간표
    func masterItems(for weekday: Weekday) -> [ScheduleItem] {
        masterItems.filter { $0.weekday == weekday }
    }

    /// 특정 ID의 원본 정규 일정 조회
    func masterItem(withId id: UUID) -> ScheduleItem? {
        items.first { $0.id == id && $0.targetWeekKey == nil }
    }

    /// 특정 정규 일정에 대해 이번 주(또는 지정 주차)에 활성화된 임시 조정 정보 반환
    func activeOverride(for baseItemId: UUID, weekKey: String? = nil) -> WeeklyItemOverride? {
        let wk = weekKey ?? currentWeekPrefix
        let key = "\(wk)_\(baseItemId.uuidString)"
        guard let override = weeklyOverrides[key], override.isActive else { return nil }
        return override
    }

    /// 이번 주에 실제로 적용되는 전체 스케줄 (정규 시간표 + 이번 주 시간/요일/내용 조정 + 이번 주 휴강 제외 + 이번 주 전용 추가 일정)
    var effectiveItems: [ScheduleItem] {
        var result: [ScheduleItem] = []
        let wk = currentWeekPrefix

        for base in masterItems {
            if let override = activeOverride(for: base.id, weekKey: wk) {
                if override.isSkipped {
                    continue
                }
                if var modified = override.overriddenItem {
                    modified.id = base.id
                    modified.targetWeekKey = nil
                    result.append(modified)
                    continue
                }
            }
            result.append(base)
        }

        // 이번 주에만 임시로 추가된 전용 일정 합산
        let thisWeekAdditions = items.filter { $0.targetWeekKey == wk }
        result.append(contentsOf: thisWeekAdditions)

        return result.sorted {
            if $0.weekday.rawValue == $1.weekday.rawValue {
                if $0.startTotalMinutes == $1.startTotalMinutes {
                    return $0.endTotalMinutes < $1.endTotalMinutes
                }
                return $0.startTotalMinutes < $1.startTotalMinutes
            }
            return $0.weekday.rawValue < $1.weekday.rawValue
        }
    }

    /// 특정 요일의 이번 주 실제 적용 스케줄 (오늘 스케줄 탭 및 라이브 현황에서 사용)
    func items(for weekday: Weekday) -> [ScheduleItem] {
        effectiveItems.filter { $0.weekday == weekday }
    }

    /// 해당 일정이 이번 주에만 임시 추가되었거나 이번 주 조정이 적용된 일정인지 여부
    func isAdjustedThisWeek(_ item: ScheduleItem) -> Bool {
        if item.targetWeekKey == currentWeekPrefix {
            return true
        }
        return activeOverride(for: item.id) != nil
    }

    /// 정규 일정이 이번 주에 임시 조정(시간/요일/내용 변경 또는 휴강)되어 있는지 여부
    func hasThisWeekOverride(for itemId: UUID) -> Bool {
        activeOverride(for: itemId) != nil
    }

    /// 정규 일정이 이번 주에 휴강(제외) 처리되어 있는지 여부
    func isSkippedThisWeek(_ itemId: UUID) -> Bool {
        activeOverride(for: itemId)?.isSkipped == true
    }

    /// 일정 카드에 표시할 '이번 주 조정' 배지 문구 (조정 사항이 없으면 nil)
    func adjustmentBadgeText(for item: ScheduleItem) -> String? {
        if item.targetWeekKey == currentWeekPrefix {
            return "이번 주 추가 일정"
        }
        guard let override = activeOverride(for: item.id) else { return nil }
        if override.isSkipped {
            return "이번 주 휴강·제외"
        }
        if let base = masterItem(withId: item.id) {
            let dayChanged = base.weekday != item.weekday
            let timeChanged = base.startTotalMinutes != item.startTotalMinutes || base.endTotalMinutes != item.endTotalMinutes
            if dayChanged && timeChanged {
                return "이번 주 요일·시간 조정 (원래 \(base.weekday.shortName) \(base.startTimeString))"
            } else if dayChanged {
                return "이번 주 요일 이동 (원래 \(base.weekday.fullName) \(base.startTimeString))"
            } else if timeChanged {
                return "이번 주 시간 조정 (원래 \(base.startTimeString))"
            } else {
                return "이번 주 내용 조정됨"
            }
        }
        return "이번 주 조정됨"
    }

    /// 원래 해당 요일에 있던 정규 일정 중, 이번 주에 휴강 처리되었거나 다른 요일로 이동된 일정 목록
    func excludedMasterItemsForThisWeek(on weekday: Weekday) -> [DayExcludedScheduleInfo] {
        var result: [DayExcludedScheduleInfo] = []
        for base in masterItems(for: weekday) {
            guard let override = activeOverride(for: base.id) else { continue }
            if override.isSkipped {
                result.append(DayExcludedScheduleInfo(masterItem: base, isSkipped: true, movedToItem: nil))
            } else if let modified = override.overriddenItem, modified.weekday != weekday {
                result.append(DayExcludedScheduleInfo(masterItem: base, isSkipped: false, movedToItem: modified))
            }
        }
        return result
    }

    /// 이번 주 전체(월~일)에서 조정·추가·휴강된 스케줄 총 건수
    var currentWeekAdjustmentCount: Int {
        let wk = currentWeekPrefix
        let activeOverrideCount = weeklyOverrides.values.filter { ov in
            ov.weekKey == wk && ov.isActive && (ov.isSkipped || ov.overriddenItem != nil) && masterItem(withId: ov.baseItemId) != nil
        }.count
        let addedThisWeekCount = items.filter { $0.targetWeekKey == wk }.count
        return activeOverrideCount + addedThisWeekCount
    }

    /// 특정 요일에 관련된 이번 주 조정 건수 (해당 요일에 표시된 조정/추가 일정 + 원래 해당 요일이었으나 휴강/이동된 일정)
    func adjustmentCount(for weekday: Weekday) -> Int {
        let adjustedOnDay = items(for: weekday).filter { isAdjustedThisWeek($0) }.count
        let excludedFromDay = excludedMasterItemsForThisWeek(on: weekday).count
        return adjustedOnDay + excludedFromDay
    }

    var currentActiveItems: [ScheduleItem] {
        let todayItems = items(for: todayWeekday)
        let curMin = currentMinutesOfDay
        return todayItems.filter { item in
            curMin >= item.startTotalMinutes && curMin < item.endTotalMinutes
        }
    }

    var nextUpcomingItem: ScheduleItem? {
        let todayItems = items(for: todayWeekday)
        let curMin = currentMinutesOfDay
        return todayItems.first { item in
            item.startTotalMinutes > curMin
        }
    }

    func isCurrentlyActive(_ item: ScheduleItem) -> Bool {
        guard item.weekday == todayWeekday else { return false }
        let curMin = currentMinutesOfDay
        return curMin >= item.startTotalMinutes && curMin < item.endTotalMinutes
    }

    func isPastToday(_ item: ScheduleItem) -> Bool {
        guard item.weekday == todayWeekday else { return false }
        return currentMinutesOfDay >= item.endTotalMinutes
    }

    func progress(for item: ScheduleItem) -> Double {
        guard isCurrentlyActive(item) else { return 0 }
        let elapsed = Double(currentMinutesOfDay - item.startTotalMinutes)
        let total = Double(max(1, item.durationMinutes))
        return min(1.0, max(0.0, elapsed / total))
    }

    func remainingMinutes(forActive item: ScheduleItem) -> Int {
        max(0, item.endTotalMinutes - currentMinutesOfDay)
    }

    func minutesUntilStart(for item: ScheduleItem) -> Int {
        max(0, item.startTotalMinutes - currentMinutesOfDay)
    }

    // MARK: - 2-Step Completion Tracking (아이 체크 + 부모님 최종 확인)

    var currentWeekPrefix: String {
        let cal = Calendar(identifier: .iso8601)
        let year = cal.component(.yearForWeekOfYear, from: now)
        let week = cal.component(.weekOfYear, from: now)
        return "\(year)-W\(week)"
    }

    func itemKey(for itemId: UUID) -> String {
        "\(currentWeekPrefix)_\(itemId.uuidString)"
    }

    private func subTaskKey(for subTaskId: UUID) -> String {
        "\(currentWeekPrefix)_\(subTaskId.uuidString)"
    }

    func isCompleted(_ item: ScheduleItem) -> Bool {
        guard item.isCheckable else { return false }
        let key = itemKey(for: item.id)
        return completedItemKeys.contains(key) || parentVerifiedItemKeys.contains(key)
    }

    func isParentVerified(_ item: ScheduleItem) -> Bool {
        guard item.isCheckable else { return false }
        return parentVerifiedItemKeys.contains(itemKey(for: item.id))
    }

    func isWaitingParentVerification(_ item: ScheduleItem) -> Bool {
        guard item.isCheckable else { return false }
        return isCompleted(item) && !isParentVerified(item)
    }

    func isSubTaskCompleted(_ subTask: SubTask) -> Bool {
        let key = subTaskKey(for: subTask.id)
        return completedSubTaskKeys.contains(key) || parentVerifiedSubTaskKeys.contains(key)
    }

    func isSubTaskParentVerified(_ subTask: SubTask) -> Bool {
        parentVerifiedSubTaskKeys.contains(subTaskKey(for: subTask.id))
    }

    /// 아이의 '다 했어요' 완료 토글 (체크리스트는 아이만 체크 가능)
    @discardableResult
    func toggleCompletion(for item: ScheduleItem) -> Bool {
        guard item.isCheckable else { return false }
        guard deviceRole == .child else {
            showToast("체크리스트는 아이 폰에서만 완료 체크할 수 있어요 😊")
            return false
        }
        let key = itemKey(for: item.id)
        let ts = Date().timeIntervalSince1970

        if parentVerifiedItemKeys.contains(key) && !isParentModeUnlocked {
            return false
        }

        if isCompleted(item) {
            completedItemKeys.remove(key)
            parentVerifiedItemKeys.remove(key)
            completionFlags[key] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            for sub in item.subTasks {
                let sKey = subTaskKey(for: sub.id)
                completedSubTaskKeys.remove(sKey)
                parentVerifiedSubTaskKeys.remove(sKey)
                subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            }
        } else {
            completedItemKeys.insert(key)
            completionFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            for sub in item.subTasks {
                let sKey = subTaskKey(for: sub.id)
                completedSubTaskKeys.insert(sKey)
                subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            }
        }
        saveSyncFlags()
        scheduleCloudPush()
        return true
    }

    /// 아이의 세부 할 일(SubTask) 완료 토글 (체크리스트는 아이만 체크 가능)
    @discardableResult
    func toggleSubTaskCompletion(_ subTask: SubTask, in parentItem: ScheduleItem) -> Bool {
        guard parentItem.isCheckable else { return false }
        guard deviceRole == .child else {
            showToast("세부 할 일은 아이 폰에서만 체크할 수 있어요 😊")
            return false
        }
        let pKey = itemKey(for: parentItem.id)
        let sKey = subTaskKey(for: subTask.id)
        let ts = Date().timeIntervalSince1970

        if (parentVerifiedItemKeys.contains(pKey) || parentVerifiedSubTaskKeys.contains(sKey)) && !isParentModeUnlocked {
            return false
        }

        if isSubTaskCompleted(subTask) {
            completedSubTaskKeys.remove(sKey)
            parentVerifiedSubTaskKeys.remove(sKey)
            subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
        } else {
            completedSubTaskKeys.insert(sKey)
            subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
        }

        if !parentItem.subTasks.isEmpty {
            let allDone = parentItem.subTasks.allSatisfy { isSubTaskCompleted($0) }
            if allDone {
                completedItemKeys.insert(pKey)
                completionFlags[pKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            } else {
                completedItemKeys.remove(pKey)
                parentVerifiedItemKeys.remove(pKey)
                completionFlags[pKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                parentVerifiedFlags[pKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            }
        }
        saveSyncFlags()
        scheduleCloudPush()
        return true
    }

    /// 부모 확인은 아이가 직접 완료한 항목에만 허용합니다.
    func canParentVerify(_ item: ScheduleItem) -> Bool {
        item.isCheckable
            && completedItemKeys.contains(itemKey(for: item.id))
            && item.subTasks.allSatisfy { completedSubTaskKeys.contains(subTaskKey(for: $0.id)) }
    }

    func canParentVerifySubTask(_ subTask: SubTask) -> Bool {
        completedSubTaskKeys.contains(subTaskKey(for: subTask.id))
    }

    /// 어른(부모님)의 최종 숙제 확인 토글
    func toggleParentVerification(for item: ScheduleItem) {
        guard item.isCheckable else { return }
        let key = itemKey(for: item.id)
        let ts = Date().timeIntervalSince1970

        if parentVerifiedItemKeys.contains(key) {
            parentVerifiedItemKeys.remove(key)
            parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            for sub in item.subTasks {
                let sKey = subTaskKey(for: sub.id)
                parentVerifiedSubTaskKeys.remove(sKey)
                parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            }
        } else {
            guard canParentVerify(item) else {
                showToast("아이가 먼저 완료 체크한 항목만 부모 확인할 수 있어요.")
                return
            }
            completedItemKeys.insert(key)
            parentVerifiedItemKeys.insert(key)
            completionFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            for sub in item.subTasks {
                let sKey = subTaskKey(for: sub.id)
                completedSubTaskKeys.insert(sKey)
                parentVerifiedSubTaskKeys.insert(sKey)
                subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
                parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            }
        }
        if isParentModeUnlocked {
            unlockParentMode()
        }
        saveSyncFlags()
        scheduleCloudPush()
    }

    /// 어른(부모님)의 세부 할 일(SubTask) 개별 확인 토글
    func toggleSubTaskParentVerification(_ subTask: SubTask, in parentItem: ScheduleItem) {
        guard parentItem.isCheckable else { return }
        let sKey = subTaskKey(for: subTask.id)
        let pKey = itemKey(for: parentItem.id)
        let ts = Date().timeIntervalSince1970

        if parentVerifiedSubTaskKeys.contains(sKey) {
            parentVerifiedSubTaskKeys.remove(sKey)
            parentVerifiedItemKeys.remove(pKey)
            parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
            parentVerifiedFlags[pKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
        } else {
            guard parentItem.subTasks.contains(where: { $0.id == subTask.id }),
                  canParentVerifySubTask(subTask) else {
                showToast("아이가 먼저 완료 체크한 세부 항목만 부모 확인할 수 있어요.")
                return
            }
            completedSubTaskKeys.insert(sKey)
            parentVerifiedSubTaskKeys.insert(sKey)
            subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)

            if !parentItem.subTasks.isEmpty {
                let allVerified = parentItem.subTasks.allSatisfy { isSubTaskParentVerified($0) }
                if allVerified {
                    completedItemKeys.insert(pKey)
                    parentVerifiedItemKeys.insert(pKey)
                    completionFlags[pKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
                    parentVerifiedFlags[pKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
                }
            }
        }
        if isParentModeUnlocked {
            unlockParentMode()
        }
        saveSyncFlags()
        scheduleCloudPush()
    }

    /// 특정 요일에 아이가 '다 했어요' 체크한 모든 일정을 한 번에 부모 확인 + 하트 선물 처리
    func verifyAllWaitingItems(for weekday: Weekday, giveHeartToEach: Bool = true) {
        let dayItems = items(for: weekday).filter { $0.isCheckable }
        let ts = Date().timeIntervalSince1970
        for item in dayItems where isWaitingParentVerification(item) && canParentVerify(item) {
            let key = itemKey(for: item.id)
            completedItemKeys.insert(key)
            parentVerifiedItemKeys.insert(key)
            completionFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            for sub in item.subTasks {
                let sKey = subTaskKey(for: sub.id)
                completedSubTaskKeys.insert(sKey)
                parentVerifiedSubTaskKeys.insert(sKey)
                subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
                parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: true, updatedAt: ts)
            }
            if giveHeartToEach {
                var existing = itemReactions[key] ?? ItemParentReaction(
                    itemKey: key,
                    heartCount: 0,
                    sticker: .heart,
                    comment: "",
                    updatedAt: ts
                )
                existing.heartCount += 1
                existing.updatedAt = ts
                itemReactions[key] = existing
            }
        }
        if isParentModeUnlocked {
            unlockParentMode()
        }
        saveSyncFlags()
        scheduleCloudPush()
    }

    func completionStats(for weekday: Weekday) -> (completed: Int, verified: Int, waiting: Int, total: Int) {
        let checkableItems = items(for: weekday).filter { $0.isCheckable }
        let done = checkableItems.filter { isCompleted($0) }.count
        let verified = checkableItems.filter { isParentVerified($0) }.count
        let waiting = max(0, done - verified)
        return (done, verified, waiting, checkableItems.count)
    }

    func resetCompletions(for weekday: Weekday, includeParentVerified: Bool = false) {
        let dayItems = items(for: weekday)
        let ts = Date().timeIntervalSince1970
        for item in dayItems {
            let key = itemKey(for: item.id)
            if includeParentVerified || !parentVerifiedItemKeys.contains(key) {
                completedItemKeys.remove(key)
                completionFlags[key] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                if includeParentVerified {
                    parentVerifiedItemKeys.remove(key)
                    parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                }
                for sub in item.subTasks {
                    let sKey = subTaskKey(for: sub.id)
                    completedSubTaskKeys.remove(sKey)
                    subTaskCompletionFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                    if includeParentVerified {
                        parentVerifiedSubTaskKeys.remove(sKey)
                        parentVerifiedSubTaskFlags[sKey] = SyncTimestampedFlag(isSet: false, updatedAt: ts)
                    }
                }
            }
        }
        saveSyncFlags()
        scheduleCloudPush()
    }

    // MARK: - ❤️ Hearts, Stickers & Parent Praise Management

    func reaction(for item: ScheduleItem) -> ItemParentReaction? {
        let key = itemKey(for: item.id)
        guard let reaction = itemReactions[key],
              (reaction.heartCount > 0 || !reaction.comment.isEmpty || !reaction.comments.isEmpty) else {
            return nil
        }
        return reaction
    }

    /// 전체 기간 동안 아이가 획득한 총 하트 수 (일정별 하트 + 응원 메시지 하트 + 아카이브 하트 합산)
    var totalEarnedHearts: Int {
        let itemHeartSum = itemReactions.values.reduce(0) { $0 + $1.heartCount }
        let noteHeartSum = praiseNotes.reduce(0) { $0 + $1.hearts }
        return itemHeartSum + noteHeartSum + archivedEarnedHearts
    }

    /// 보상 교환 등으로 차감된 총 하트 수
    var totalSpentHearts: Int {
        rewardRedemptions.reduce(0) { $0 + $1.hearts }
    }

    /// 현재 아이가 사용 가능한 잔여 하트 개수 (보상 교환 가능 잔액)
    var availableHearts: Int {
        max(0, totalEarnedHearts - totalSpentHearts)
    }

    /// 이번 주 아이가 새로 받은 하트 수 (주간 달성도 참고용)
    var thisWeekEarnedHearts: Int {
        let prefix = currentWeekPrefix
        let itemHeartSum = itemReactions
            .filter { $0.key.hasPrefix(prefix) }
            .values
            .reduce(0) { $0 + $1.heartCount }
        let cal = Calendar(identifier: .iso8601)
        let currentWeekOfYear = cal.component(.weekOfYear, from: now)
        let currentYear = cal.component(.yearForWeekOfYear, from: now)
        let noteHeartSum = praiseNotes.filter { note in
            let d = Date(timeIntervalSince1970: note.createdAt)
            return cal.component(.weekOfYear, from: d) == currentWeekOfYear &&
                   cal.component(.yearForWeekOfYear, from: d) == currentYear
        }.reduce(0) { $0 + $1.hearts }
        return itemHeartSum + noteHeartSum
    }

    /// 기존 코드 및 UI 호환: 사용 가능한 잔여 보유 하트 수 반환
    var totalHeartsThisWeek: Int {
        availableHearts
    }

    var latestPraiseNote: ParentPraiseNote? {
        praiseNotes.sorted { $0.createdAt > $1.createdAt }.first
    }

    /// 일정 카드에서 원터치로 ❤️ 하트 +1 보내기
    func quickSendHeart(for item: ScheduleItem) {
        let key = itemKey(for: item.id)
        let ts = Date().timeIntervalSince1970
        var current = itemReactions[key] ?? ItemParentReaction(
            itemKey: key,
            heartCount: 0,
            sticker: .heart,
            comment: "",
            updatedAt: ts
        )
        current.heartCount += 1
        current.updatedAt = ts
        itemReactions[key] = current

        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("❤️ [\(item.title)]에 하트를 보냈어요!")
        scheduleCloudPush()
    }

    /// 일정별 하트·응원 스티커·한줄 칭찬 메시지 저장 및 동기화 (하트 0개 메시지 전송 및 다회 메시지 지원)
    func sendItemReaction(
        for item: ScheduleItem,
        addHearts: Int,
        sticker: ReactionSticker,
        comment: String,
        alsoVerify: Bool
    ) {
        let key = itemKey(for: item.id)
        let ts = Date().timeIntervalSince1970
        let cleanComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)

        var current = itemReactions[key] ?? ItemParentReaction(
            itemKey: key,
            heartCount: 0,
            sticker: sticker,
            comment: "",
            comments: [],
            updatedAt: ts
        )
        current.heartCount = max(0, current.heartCount + max(0, addHearts))
        current.sticker = sticker
        if !cleanComment.isEmpty {
            current.comment = cleanComment
            current.comments.append(ScheduleItemComment(text: cleanComment, createdAt: ts))
        }
        current.updatedAt = ts
        itemReactions[key] = current

        if alsoVerify && !isParentVerified(item) {
            toggleParentVerification(for: item)
        } else {
            if isParentModeUnlocked {
                unlockParentMode()
            }
            scheduleCloudPush()
        }
        if addHearts > 0 {
            showToast("\(sticker.emoji) 하트 +\(addHearts)개와 응원 메시지를 전송했어요!")
        } else {
            showToast("\(sticker.emoji) 응원 메시지를 아이 폰으로 전송했어요!")
        }
    }

    /// 가족 전체 응원 배너용 하트 폭죽 & 칭찬 메시지 전송 (하트 0개 전송 지원)
    func sendFamilyPraise(hearts: Int, sticker: ReactionSticker, message: String) {
        let cleanMsg = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalMsg = cleanMsg.isEmpty ? "\(sticker.label)! 엄마 아빠가 항상 응원해 ❤️" : cleanMsg
        let note = ParentPraiseNote(
            hearts: max(0, hearts),
            sticker: sticker,
            message: finalMsg,
            createdAt: Date().timeIntervalSince1970
        )
        praiseNotes.insert(note, at: 0)
        if praiseNotes.count > 40 {
            let overflow = Array(praiseNotes.suffix(from: 40))
            archivedEarnedHearts += overflow.reduce(0) { $0 + $1.hearts }
            praiseNotes = Array(praiseNotes.prefix(40))
        }
        if isParentModeUnlocked {
            unlockParentMode()
        }
        if note.hearts > 0 {
            showToast("❤️ 하트 +\(note.hearts)개와 응원 메시지를 보냈어요!")
        } else {
            showToast("\(sticker.emoji) 응원 메시지를 보냈어요!")
        }
        scheduleCloudPush()
    }

    /// 부모폰에서 보상 교환(하트 차감) 처리
    @discardableResult
    func redeemReward(title: String, hearts: Int) -> Bool {
        guard hearts > 0, availableHearts >= hearts else { return false }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalTitle = cleanTitle.isEmpty ? "보상 교환" : cleanTitle

        let redemption = HeartRewardRedemption(
            title: finalTitle,
            hearts: hearts,
            createdAt: Date().timeIntervalSince1970,
            redeemedByRole: deviceRole.shortBadgeTitle
        )
        rewardRedemptions.insert(redemption, at: 0)
        if rewardRedemptions.count > 50 {
            rewardRedemptions = Array(rewardRedemptions.prefix(50))
        }

        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("🎁 [\(finalTitle)] 교환 완료! 하트 \(hearts)개가 차감되었어요.")
        scheduleCloudPush()
        return true
    }

    /// 보상 교환 내역 취소(하트 환급) - 부모 모드 전용
    func cancelRedemption(_ redemption: HeartRewardRedemption) {
        guard let index = rewardRedemptions.firstIndex(where: { $0.id == redemption.id }) else { return }
        let removed = rewardRedemptions.remove(at: index)
        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("↩️ [\(removed.title)] 교환이 취소되어 하트 \(removed.hearts)개가 복구되었어요.")
        scheduleCloudPush()
    }

    // MARK: - 🎁 추천 보상 프리셋 관리 (추가, 수정, 삭제, 기본값 복원)

    func addRewardPreset(emoji: String, title: String, hearts: Int, tag: String) {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, hearts > 0 else { return }
        let cleanEmoji = emoji.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalEmoji = cleanEmoji.isEmpty ? "🎁" : cleanEmoji
        let cleanTag = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalTag = cleanTag.isEmpty ? "보상" : cleanTag

        let newPreset = RewardPreset(
            emoji: finalEmoji,
            title: cleanTitle,
            hearts: hearts,
            tag: finalTag,
            updatedAt: Date().timeIntervalSince1970
        )
        guard !rewardPresets.contains(where: { $0.hasSameContent(as: newPreset) }) else { return }
        rewardPresets.append(newPreset.canonicalized)
        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("🎁 [\(cleanTitle)] 추천 보상이 추가되었어요.")
        scheduleCloudPush()
    }

    func updateRewardPreset(_ preset: RewardPreset) {
        guard let index = rewardPresets.firstIndex(where: { $0.id == preset.id }) else { return }
        var updated = preset
        updated.updatedAt = Date().timeIntervalSince1970
        guard !rewardPresets.contains(where: { $0.id != preset.id && $0.hasSameContent(as: updated) }) else { return }
        rewardPresets[index] = updated
        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("✏️ [\(preset.title)] 보상이 수정되었어요.")
        scheduleCloudPush()
    }

    func deleteRewardPreset(id: UUID) {
        guard let index = rewardPresets.firstIndex(where: { $0.id == id }) else { return }
        let removed = rewardPresets[index]
        deletedRewardPresetTimestamps[removed.id.uuidString] = Date().timeIntervalSince1970
        rewardPresets.remove(at: index)
        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("🗑️ [\(removed.title)] 보상이 삭제되었어요.")
        scheduleCloudPush()
    }

    func resetRewardPresetsToDefault() {
        let timestamp = Date().timeIntervalSince1970
        for preset in rewardPresets {
            deletedRewardPresetTimestamps[preset.id.uuidString] = timestamp
        }
        rewardPresets = RewardPreset.defaultPresets.map {
            var preset = $0
            preset.updatedAt = timestamp.nextUp
            deletedRewardPresetTimestamps.removeValue(forKey: preset.id.uuidString)
            return preset
        }
        if isParentModeUnlocked {
            unlockParentMode()
        }
        showToast("🔄 추천 보상이 기본값으로 초기화되었어요.")
        scheduleCloudPush()
    }

    // MARK: - CRUD & Notifications (이번 주 스케줄 조정 vs 전체 기본 스케줄 변경)

    func addItem(_ item: ScheduleItem, targetWeekdays: Set<Weekday> = [], scope: ScheduleEditScope = .master) {
        let days = targetWeekdays.isEmpty ? [item.weekday] : targetWeekdays
        let ts = Date().timeIntervalSince1970
        let wk = scope == .thisWeek ? currentWeekPrefix : nil

        for day in days.sorted(by: { $0.rawValue < $1.rawValue }) {
            var copy = item
            copy.id = UUID()
            copy.weekday = day
            copy.subTasks = item.subTasks.map { SubTask(title: $0.title) }
            copy.targetWeekKey = wk
            copy.updatedAt = ts
            items.append(copy)
        }
        if scope == .thisWeek {
            showToast("✨ [\(item.title)] 일정을 이번 주 스케줄에 추가했어요!")
        } else {
            showToast("📅 [\(item.title)] 일정을 전체 기본 시간표에 등록했어요!")
        }
        syncNotifications()
        scheduleCloudPush()
    }

    func updateItem(_ updated: ScheduleItem, scope: ScheduleEditScope = .master) {
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix

        switch scope {
        case .thisWeek:
            // 1. 정규(전체) 일정인 경우 -> 원본은 보존하고 이번 주 임시 조정(WeeklyItemOverride)으로 저장
            if let base = masterItem(withId: updated.id) {
                let key = "\(wk)_\(base.id.uuidString)"
                var adjustedCopy = updated
                adjustedCopy.id = base.id
                adjustedCopy.targetWeekKey = nil
                adjustedCopy.updatedAt = ts

                // 원래 정규 일정과 완전히 동일하게 되돌린 경우 오버라이드 비활성화
                if adjustedCopy.hasSameScheduleContent(as: base) {
                    weeklyOverrides[key] = WeeklyItemOverride(
                        weekKey: wk,
                        baseItemId: base.id,
                        isActive: false,
                        isSkipped: false,
                        overriddenItem: nil,
                        updatedAt: ts
                    )
                    showToast("↩️ [\(updated.title)] 일정이 원래 기본 시간표대로 복구되었어요!")
                } else {
                    weeklyOverrides[key] = WeeklyItemOverride(
                        weekKey: wk,
                        baseItemId: base.id,
                        isActive: true,
                        isSkipped: false,
                        overriddenItem: adjustedCopy,
                        updatedAt: ts
                    )
                    showToast("🔄 [\(updated.title)] 일정을 이번 주만 조정했어요!")
                }
                syncNotifications()
                scheduleCloudPush()
            } else if let idx = items.firstIndex(where: { $0.id == updated.id }) {
                // 2. 이미 이번 주 전용으로 추가된 일정인 경우 -> 그대로 이번 주 일정으로 업데이트
                var copy = updated
                copy.targetWeekKey = wk
                copy.updatedAt = ts
                items[idx] = copy
                showToast("🔄 [\(updated.title)] 이번 주 일정을 수정했어요!")
                syncNotifications()
                scheduleCloudPush()
            }

        case .master:
            // 전체(매주) 기본 시간표 변경
            if let idx = items.firstIndex(where: { $0.id == updated.id }) {
                var copy = updated
                copy.targetWeekKey = nil // 이번 주 추가 일정이었더라도 전체 정규 일정으로 승격
                copy.updatedAt = ts
                items[idx] = copy

                // 이번 주 임시 조정이 걸려 있었다면 새 정규 시간표가 즉시 반영되도록 오버라이드 해제
                let key = "\(wk)_\(updated.id.uuidString)"
                if weeklyOverrides[key]?.isActive == true {
                    weeklyOverrides[key] = WeeklyItemOverride(
                        weekKey: wk,
                        baseItemId: updated.id,
                        isActive: false,
                        isSkipped: false,
                        overriddenItem: nil,
                        updatedAt: ts
                    )
                }
                showToast("📅 [\(updated.title)] 전체 기본 시간표를 변경했어요!")
                syncNotifications()
                scheduleCloudPush()
            }
        }
    }

    /// 이번 주만 휴강·제외 처리 (다음 주가 되면 원래 정규 시간표로 자동 복구)
    @discardableResult
    func skipItemForThisWeek(_ item: ScheduleItem) -> Bool {
        if isParentVerified(item) && !isParentModeUnlocked {
            return false
        }
        // 이번 주 전용으로 임시 추가했던 일정이면 바로 삭제 처리
        if item.isThisWeekOnlyAddition {
            return deleteItem(item)
        }
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix
        let key = "\(wk)_\(item.id.uuidString)"
        weeklyOverrides[key] = WeeklyItemOverride(
            weekKey: wk,
            baseItemId: item.id,
            isActive: true,
            isSkipped: true,
            overriddenItem: nil,
            updatedAt: ts
        )
        showToast("⏭️ [\(item.title)] 일정을 이번 주만 휴강·제외했어요.")
        syncNotifications()
        scheduleCloudPush()
        return true
    }

    /// 이번 주에 조정하거나 휴강 처리한 정규 일정을 원래 기본 시간표 상태로 복구
    func revertThisWeekOverride(for itemId: UUID) {
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix
        let key = "\(wk)_\(itemId.uuidString)"
        let title = masterItem(withId: itemId)?.title ?? "일정"
        weeklyOverrides[key] = WeeklyItemOverride(
            weekKey: wk,
            baseItemId: itemId,
            isActive: false,
            isSkipped: false,
            overriddenItem: nil,
            updatedAt: ts
        )
        showToast("↩️ [\(title)] 일정을 원래 시간표대로 되돌렸어요!")
        syncNotifications()
        scheduleCloudPush()
    }

    /// 이번 주 스케줄 조정 내역을 한 번에 원래 기본 시간표로 되돌리기 (특정 요일 또는 이번 주 전체)
    func resetThisWeekAdjustments(for weekday: Weekday? = nil) {
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix

        if let targetDay = weekday {
            // 1. 해당 요일과 관련된 이번 주 오버라이드 해제
            for (key, ov) in weeklyOverrides where ov.weekKey == wk && ov.isActive {
                let baseDay = masterItem(withId: ov.baseItemId)?.weekday
                let modDay = ov.overriddenItem?.weekday
                if baseDay == targetDay || modDay == targetDay {
                    weeklyOverrides[key] = WeeklyItemOverride(
                        weekKey: wk,
                        baseItemId: ov.baseItemId,
                        isActive: false,
                        isSkipped: false,
                        overriddenItem: nil,
                        updatedAt: ts
                    )
                }
            }
            // 2. 해당 요일에 이번 주 전용으로 추가된 일정 제거 (부모 확인된 항목은 부모 모드 아닐 시 유지)
            let toRemove = items.filter { item in
                item.targetWeekKey == wk &&
                item.weekday == targetDay &&
                (!isParentVerified(item) || isParentModeUnlocked)
            }
            for rem in toRemove {
                deletedItemTimestamps[rem.id.uuidString] = ts
            }
            let removeIds = Set(toRemove.map(\.id))
            items.removeAll { removeIds.contains($0.id) }
            showToast("↩️ \(targetDay.fullName)의 이번 주 조정을 원래 시간표로 되돌렸어요!")
        } else {
            // 이번 주 전체(월~일) 오버라이드 모두 해제
            for (key, ov) in weeklyOverrides where ov.weekKey == wk && ov.isActive {
                weeklyOverrides[key] = WeeklyItemOverride(
                    weekKey: wk,
                    baseItemId: ov.baseItemId,
                    isActive: false,
                    isSkipped: false,
                    overriddenItem: nil,
                    updatedAt: ts
                )
            }
            // 이번 주 전용으로 추가된 모든 일정 제거
            let toRemove = items.filter { item in
                item.targetWeekKey == wk &&
                (!isParentVerified(item) || isParentModeUnlocked)
            }
            for rem in toRemove {
                deletedItemTimestamps[rem.id.uuidString] = ts
            }
            let removeIds = Set(toRemove.map(\.id))
            items.removeAll { removeIds.contains($0.id) }
            showToast("🔄 이번 주 조정 내역을 모두 초기화하고 원래 시간표로 되돌렸어요!")
        }

        saveSyncFlags()
        syncNotifications()
        scheduleCloudPush()
    }

    /// 전체 스케줄에서 일정 영구 삭제 (이미 부모 확인 완료된 숙제는 부모 모드가 아니면 삭제 차단)
    @discardableResult
    func deleteItem(_ item: ScheduleItem) -> Bool {
        if isParentVerified(item) && !isParentModeUnlocked {
            return false
        }
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix
        deletedItemTimestamps[item.id.uuidString] = ts
        items.removeAll { $0.id == item.id }

        let key = "\(wk)_\(item.id.uuidString)"
        if weeklyOverrides[key] != nil {
            weeklyOverrides[key] = WeeklyItemOverride(
                weekKey: wk,
                baseItemId: item.id,
                isActive: false,
                isSkipped: false,
                overriddenItem: nil,
                updatedAt: ts
            )
        }
        saveSyncFlags()
        syncNotifications()
        scheduleCloudPush()
        return true
    }

    func toggleNotification(for item: ScheduleItem) {
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix
        let key = "\(wk)_\(item.id.uuidString)"
        let newEnabled = !item.isNotificationEnabled

        if var ov = weeklyOverrides[key], ov.isActive, var mod = ov.overriddenItem {
            mod.isNotificationEnabled = newEnabled
            if mod.isNotificationEnabled && mod.notificationLeadMinutes.isEmpty {
                mod.notificationLeadMinutes = [15, 0]
            } else {
                mod.notificationLeadMinutes = NotificationLeadTime.normalize(mod.notificationLeadMinutes)
            }
            mod.updatedAt = ts
            ov.overriddenItem = mod
            ov.updatedAt = ts
            weeklyOverrides[key] = ov
        }

        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx].isNotificationEnabled = newEnabled
            if items[idx].isNotificationEnabled && items[idx].notificationLeadMinutes.isEmpty {
                items[idx].notificationLeadMinutes = [15, 0]
            } else {
                items[idx].notificationLeadMinutes = NotificationLeadTime.normalize(items[idx].notificationLeadMinutes)
            }
            items[idx].updatedAt = ts
        }
        syncNotifications()
        scheduleCloudPush()
    }

    func updateNotificationSettings(for item: ScheduleItem, enabled: Bool, leadMinutes: [Int]) {
        let ts = Date().timeIntervalSince1970
        let wk = currentWeekPrefix
        let key = "\(wk)_\(item.id.uuidString)"
        let normalizedLeads = NotificationLeadTime.normalize(leadMinutes)

        if var ov = weeklyOverrides[key], ov.isActive, var mod = ov.overriddenItem {
            mod.isNotificationEnabled = enabled
            mod.notificationLeadMinutes = normalizedLeads
            mod.updatedAt = ts
            ov.overriddenItem = mod
            ov.updatedAt = ts
            weeklyOverrides[key] = ov
        }

        if let idx = items.firstIndex(where: { $0.id == item.id }) {
            items[idx].isNotificationEnabled = enabled
            items[idx].notificationLeadMinutes = normalizedLeads
            items[idx].updatedAt = ts
        }
        syncNotifications()
        scheduleCloudPush()
    }

    func resetToDefaultSchedule() {
        let ts = Date().timeIntervalSince1970
        for old in items {
            deletedItemTimestamps[old.id.uuidString] = ts
        }
        for (key, var ov) in weeklyOverrides {
            ov.isActive = false
            ov.isSkipped = false
            ov.overriddenItem = nil
            ov.updatedAt = ts + 1
            weeklyOverrides[key] = ov
        }
        var defaults = DefaultScheduleData.makeDefaultItems()
        for i in defaults.indices {
            defaults[i].updatedAt = ts + 1
        }
        items = defaults
        completedItemKeys.removeAll()
        completedSubTaskKeys.removeAll()
        parentVerifiedItemKeys.removeAll()
        parentVerifiedSubTaskKeys.removeAll()
        completionFlags.removeAll()
        subTaskCompletionFlags.removeAll()
        parentVerifiedFlags.removeAll()
        parentVerifiedSubTaskFlags.removeAll()
        saveSyncFlags()
        syncNotifications()
        scheduleCloudPush()
    }

    func syncNotifications() {
        guard deviceRole == .child else {
            Task {
                await NotificationManager.shared.disableAllNotificationsForParent()
            }
            return
        }
        let snapshot = effectiveItems
        Task {
            await NotificationManager.shared.syncAllNotifications(for: snapshot)
        }
    }

    // MARK: - ☁️ Vercel Blob Real-Time Cloud Sync Engine

    func updateSyncSettings(token: String, familyCode: String) {
        let cleanToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanFamily = familyCode.trimmingCharacters(in: .whitespacesAndNewlines)
        self.vercelBlobToken = cleanToken.isEmpty ? VercelBlobSyncService.defaultToken : cleanToken
        self.familyCode = cleanFamily.isEmpty ? VercelBlobSyncService.defaultFamilyCode : cleanFamily
        UserDefaults.standard.set(self.vercelBlobToken, forKey: vercelTokenStorageKey)
        UserDefaults.standard.set(self.familyCode, forKey: familyCodeStorageKey)
        lastSyncedBlobPathname = nil

        Task {
            await syncNow(forceUploadIfEmpty: true)
        }
    }

    func scheduleCloudPush() {
        guard isCloudSyncEnabled else { return }
        pushDebounceTask?.cancel()
        pushDebounceTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000) // 0.35초 디바운스
            guard !Task.isCancelled, let self else { return }
            await self.pushMergedStateToCloud()
        }
    }

    /// 수동 새로고침 / 즉시 동기화
    func syncNow(forceUploadIfEmpty: Bool = true) async {
        guard isCloudSyncEnabled else { return }
        await pullLatestFromCloud(isInitialLaunch: forceUploadIfEmpty, forceDownload: true)
    }

    private func pullLatestFromCloud(isInitialLaunch: Bool, forceDownload: Bool = false) async {
        guard !vercelBlobToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if isSyncing && !forceDownload { return }
        isSyncing = true
        syncErrorMessage = nil
        defer { isSyncing = false }

        do {
            let (latest, _) = try await VercelBlobSyncService.shared.fetchLatestBlobMetadata(
                token: vercelBlobToken,
                familyCode: familyCode
            )

            guard let latestBlob = latest else {
                // 클라우드에 아직 가족 스냅샷이 하나도 없으면 현재 기기 데이터를 최초 업로드
                if isInitialLaunch {
                    await pushMergedStateToCloud()
                }
                return
            }

            if !forceDownload, latestBlob.pathname == lastSyncedBlobPathname {
                // 이미 최신 스냅샷과 동일한 상태
                if lastSyncedAt == nil {
                    lastSyncedAt = Date()
                }
                return
            }

            let remoteSnapshot = try await VercelBlobSyncService.shared.downloadSnapshot(
                from: latestBlob.url,
                token: vercelBlobToken
            )
            let prevHearts = availableHearts
            let prevSpent = totalSpentHearts
            let prevVerifiedCount = parentVerifiedItemKeys.count
            let prevCompletedCount = completedItemKeys.count
            let prevItems = self.items
            let prevOverrides = self.weeklyOverrides

            applyMergedRemoteSnapshot(remoteSnapshot)
            lastSyncedBlobPathname = latestBlob.pathname
            lastSyncedAt = Date()
            lastRemoteUpdatedBy = remoteSnapshot.updatedByRole

            // 다른 기기에서 보낸 새로운 이벤트가 있으면 반가운 토스트 & 로컬 알림 표시
            if !isInitialLaunch && remoteSnapshot.updatedByDeviceId != deviceId {
                let newHearts = totalHeartsThisWeek
                let newVerifiedCount = parentVerifiedItemKeys.count
                let newCompletedCount = completedItemKeys.count
                let scheduleChanged = (self.items != prevItems) || (self.weeklyOverrides != prevOverrides)

                let newSpent = totalSpentHearts
                if newSpent > prevSpent, let latest = rewardRedemptions.first {
                    let diff = newSpent - prevSpent
                    let msg = "🎁 [\(latest.title)] 보상 교환으로 하트 \(diff)개가 사용되었어요!"
                    showToast(msg)
                    await NotificationManager.shared.sendInstantSyncEventNotification(
                        title: "🎁 보상 교환 완료!",
                        body: "[\(latest.title)] (하트 \(diff)개 차감)"
                    )
                } else if newHearts > prevHearts {
                    let diff = newHearts - prevHearts
                    let msg = "❤️ 부모님이 하트 +\(diff)개와 응원을 보내주셨어요!"
                    showToast(msg)
                    await NotificationManager.shared.sendInstantSyncEventNotification(
                        title: "❤️ 부모님의 하트가 도착했어요!",
                        body: latestPraiseNote?.message ?? "오늘 스케줄을 확인해 보세요!"
                    )
                } else if newVerifiedCount > prevVerifiedCount {
                    let diff = newVerifiedCount - prevVerifiedCount
                    let msg = "✅ 부모님이 숙제 \(diff)개에 확인 도장을 찍어주셨어요!"
                    showToast(msg)
                    await NotificationManager.shared.sendInstantSyncEventNotification(
                        title: "✅ 부모님 숙제 확인 완료!",
                        body: "부모님이 숙제 \(diff)개를 확인하고 도장을 찍어주셨어요."
                    )
                } else if newCompletedCount > prevCompletedCount && deviceRole == .parent {
                    let diff = newCompletedCount - prevCompletedCount
                    let msg = "👦 아이가 숙제 \(diff)개를 '다 했어요' 체크했어요!"
                    showToast(msg)
                } else if scheduleChanged {
                    showToast("📅 \(remoteSnapshot.updatedByRole)에서 변경한 스케줄이 동기화되었어요!")
                }
            }
        } catch {
            syncErrorMessage = error.localizedDescription
        }
    }

    private func pushMergedStateToCloud() async {
        guard !vercelBlobToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        isSyncing = true
        syncErrorMessage = nil
        defer { isSyncing = false }

        do {
            // 1. 업로드 직전 원격 최신 상태를 먼저 조회해 충돌 없이 병합
            let (latest, allBlobs) = try await VercelBlobSyncService.shared.fetchLatestBlobMetadata(
                token: vercelBlobToken,
                familyCode: familyCode
            )

            if let latestBlob = latest, latestBlob.pathname != lastSyncedBlobPathname {
                if let remoteSnapshot = try? await VercelBlobSyncService.shared.downloadSnapshot(
                    from: latestBlob.url,
                    token: vercelBlobToken
                ) {
                    applyMergedRemoteSnapshot(remoteSnapshot)
                }
            }

            // 2. 병합 완료된 최신 스냅샷 생성 및 업로드
            let snapshot = makeCurrentSnapshot()
            let putResult = try await VercelBlobSyncService.shared.uploadSnapshot(
                snapshot,
                token: vercelBlobToken,
                familyCode: familyCode,
                shortDeviceId: deviceId,
                previousBlobsToDelete: allBlobs
            )

            lastSyncedBlobPathname = putResult.pathname
            lastSyncedAt = Date()
            lastRemoteUpdatedBy = snapshot.updatedByRole
        } catch {
            syncErrorMessage = error.localizedDescription
        }
    }

    private func makeCurrentSnapshot() -> CloudSyncSnapshot {
        CloudSyncSnapshot(
            schemaVersion: 4,
            familyCode: familyCode,
            updatedAt: Date().timeIntervalSince1970,
            updatedByRole: deviceRole.shortBadgeTitle,
            updatedByDeviceId: deviceId,
            parentPinCode: parentPinCode,
            parentPinUpdatedAt: parentPinUpdatedAt,
            items: items,
            deletedItemTimestamps: deletedItemTimestamps,
            weeklyOverrides: weeklyOverrides,
            completionFlags: completionFlags,
            subTaskCompletionFlags: subTaskCompletionFlags,
            parentVerifiedFlags: parentVerifiedFlags,
            parentVerifiedSubTaskFlags: parentVerifiedSubTaskFlags,
            itemReactions: itemReactions,
            praiseNotes: praiseNotes,
            rewardRedemptions: rewardRedemptions,
            archivedEarnedHearts: archivedEarnedHearts,
            rewardPresets: rewardPresets,
            deletedRewardPresetTimestamps: deletedRewardPresetTimestamps
        )
    }

    /// 원격 스냅샷과 로컬 데이터를 타임스탬프 기준으로 유실 없이 스마트 병합
    private func applyMergedRemoteSnapshot(_ remote: CloudSyncSnapshot) {
        // 0. 아이 완료 체크 & 부모 확인 플래그 및 하트 리액션 먼저 병합 (아이템 정규화 시 함께 마이그레이션되도록)
        self.completionFlags = Self.mergeFlagDict(local: self.completionFlags, remote: remote.completionFlags)
        self.subTaskCompletionFlags = Self.mergeFlagDict(local: self.subTaskCompletionFlags, remote: remote.subTaskCompletionFlags)
        self.parentVerifiedFlags = Self.mergeFlagDict(local: self.parentVerifiedFlags, remote: remote.parentVerifiedFlags)
        self.parentVerifiedSubTaskFlags = Self.mergeFlagDict(local: self.parentVerifiedSubTaskFlags, remote: remote.parentVerifiedSubTaskFlags)

        var mergedReactions = self.itemReactions
        for (key, rReact) in remote.itemReactions {
            if let lReact = mergedReactions[key] {
                var updated = (rReact.updatedAt >= lReact.updatedAt) ? rReact : lReact
                updated.heartCount = max(lReact.heartCount, rReact.heartCount)
                var combinedComments = lReact.comments
                for c in rReact.comments {
                    if !combinedComments.contains(where: { $0.id == c.id || ($0.text == c.text && abs($0.createdAt - c.createdAt) < 1.0) }) {
                        combinedComments.append(c)
                    }
                }
                combinedComments.sort { $0.createdAt < $1.createdAt }
                updated.comments = combinedComments
                if let last = combinedComments.last {
                    updated.comment = last.text
                }
                mergedReactions[key] = updated
            } else {
                mergedReactions[key] = rReact
            }
        }
        self.itemReactions = mergedReactions

        // 0-1. 주차별 임시 조정(weeklyOverrides) 타임스탬프 기준 병합
        var mergedOverrides = self.weeklyOverrides
        for (key, rOv) in remote.weeklyOverrides {
            if let lOv = mergedOverrides[key] {
                if rOv.updatedAt >= lOv.updatedAt {
                    mergedOverrides[key] = rOv
                }
            } else {
                mergedOverrides[key] = rOv
            }
        }
        let overridesChanged = (mergedOverrides != self.weeklyOverrides)
        if overridesChanged {
            self.weeklyOverrides = mergedOverrides
        }

        // 1. 마스터 PIN 병합 (6자리 유효 PIN 중 더 최신 시각 채택)
        if remote.parentPinCode.count == 6 && remote.parentPinUpdatedAt > self.parentPinUpdatedAt {
            self.parentPinCode = remote.parentPinCode
            self.parentPinUpdatedAt = remote.parentPinUpdatedAt
            UserDefaults.standard.set(remote.parentPinCode, forKey: parentPinStorageKey)
            UserDefaults.standard.set(remote.parentPinUpdatedAt, forKey: parentPinUpdatedAtKey)
            KeychainHelper.saveString(remote.parentPinCode, forKey: parentPinStorageKey)
            KeychainHelper.saveString(String(remote.parentPinUpdatedAt), forKey: parentPinUpdatedAtKey)
        }

        // 2. 삭제된 일정 기록 병합
        for (idStr, remoteDelTs) in remote.deletedItemTimestamps {
            let localDelTs = deletedItemTimestamps[idStr] ?? 0
            if remoteDelTs > localDelTs {
                deletedItemTimestamps[idStr] = remoteDelTs
            }
        }

        // 3. 일정(ScheduleItem) 목록 병합 + 레거시 랜덤 UUID 정규화 및 중복 제거
        let normalizedRemoteItems = normalizeItemsToCanonicalIDs(remote.items)
        var itemDict: [UUID: ScheduleItem] = [:]
        for item in self.items {
            itemDict[item.id] = item
        }
        for rItem in normalizedRemoteItems {
            if let existing = itemDict[rItem.id] {
                if rItem.updatedAt > existing.updatedAt {
                    itemDict[rItem.id] = rItem
                }
            } else {
                itemDict[rItem.id] = rItem
            }
        }
        // 삭제 시각이 아이템 수정 시각보다 최신이면 삭제 유지
        let activeItems = itemDict.values.filter { item in
            let delTs = deletedItemTimestamps[item.id.uuidString] ?? 0
            return delTs < item.updatedAt
        }
        let mergedItems = deduplicateItemsBySignature(Array(activeItems)).sorted {
            if $0.weekday.rawValue == $1.weekday.rawValue {
                return $0.startTotalMinutes < $1.startTotalMinutes
            }
            return $0.weekday.rawValue < $1.weekday.rawValue
        }

        if mergedItems != self.items {
            self.items = mergedItems
            syncNotifications()
        } else if overridesChanged {
            syncNotifications()
        }

        // 4. 플래그 딕셔너리 -> Set 반영
        refreshFlagSetsFromDictionaries()

        // 5. 전체 응원 노트 병합
        var noteDict: [UUID: ParentPraiseNote] = [:]
        for n in self.praiseNotes { noteDict[n.id] = n }
        for n in remote.praiseNotes { noteDict[n.id] = n }
        let mergedNotes = Array(noteDict.values.sorted { $0.createdAt > $1.createdAt }.prefix(40))
        if mergedNotes != self.praiseNotes {
            self.praiseNotes = mergedNotes
        }

        // 5-1. 하트 보상 교환(차감) 내역 병합 (최신 50개 유지)
        var redemptionDict: [UUID: HeartRewardRedemption] = [:]
        for r in self.rewardRedemptions { redemptionDict[r.id] = r }
        for r in remote.rewardRedemptions { redemptionDict[r.id] = r }
        let mergedRedemptions = Array(redemptionDict.values.sorted { $0.createdAt > $1.createdAt }.prefix(50))
        if mergedRedemptions != self.rewardRedemptions {
            self.rewardRedemptions = mergedRedemptions
        }

        // 5-2. 아카이브된 누적 하트 병합 (더 큰 값 유지)
        if remote.archivedEarnedHearts > self.archivedEarnedHearts {
            self.archivedEarnedHearts = remote.archivedEarnedHearts
        }

        // Deletions must survive merging with an older device snapshot, including empty lists.
        for (id, timestamp) in remote.deletedRewardPresetTimestamps {
            deletedRewardPresetTimestamps[id] = max(deletedRewardPresetTimestamps[id] ?? 0, timestamp)
        }
        rewardPresets = RewardPreset.merged(
            remote.rewardPresets + rewardPresets,
            deleted: &deletedRewardPresetTimestamps
        )

        saveSyncFlags()
    }

    private func refreshFlagSetsFromDictionaries() {
        self.completedItemKeys = Set(self.completionFlags.filter { $0.value.isSet }.map { $0.key })
        self.completedSubTaskKeys = Set(self.subTaskCompletionFlags.filter { $0.value.isSet }.map { $0.key })
        self.parentVerifiedItemKeys = Set(self.parentVerifiedFlags.filter { $0.value.isSet }.map { $0.key })
        self.parentVerifiedSubTaskKeys = Set(self.parentVerifiedSubTaskFlags.filter { $0.value.isSet }.map { $0.key })

        for key in self.parentVerifiedItemKeys {
            self.completedItemKeys.insert(key)
        }
        for key in self.parentVerifiedSubTaskKeys {
            self.completedSubTaskKeys.insert(key)
        }
    }

    /// 로컬에 저장된 레거시 랜덤 UUID 기본 일정을 결정론적 ID로 정규화하고 중복 일정을 정리
    private func normalizeAndDeduplicateLocalItems() {
        let normalized = normalizeItemsToCanonicalIDs(self.items)
        let active = normalized.filter { item in
            let delTs = deletedItemTimestamps[item.id.uuidString] ?? 0
            return delTs < item.updatedAt
        }
        let deduped = deduplicateItemsBySignature(active).sorted {
            if $0.weekday.rawValue == $1.weekday.rawValue {
                return $0.startTotalMinutes < $1.startTotalMinutes
            }
            return $0.weekday.rawValue < $1.weekday.rawValue
        }
        if deduped != self.items {
            self.items = deduped
        }
        refreshFlagSetsFromDictionaries()
        saveSyncFlags()
    }

    private func normalizeItemsToCanonicalIDs(_ inputItems: [ScheduleItem]) -> [ScheduleItem] {
        let defaults = DefaultScheduleData.makeDefaultItems()
        var canonicalByStartSig: [String: ScheduleItem] = [:]
        for def in defaults {
            let startSig = "\(def.weekday.rawValue)|\(def.startHour):\(def.startMinute)|\(def.title.trimmingCharacters(in: .whitespacesAndNewlines))"
            canonicalByStartSig[startSig] = def
        }

        var result: [ScheduleItem] = []
        for var item in inputItems {
            // 특정 주차 전용 추가 일정은 기본 정규 일정 정규화 대상에서 제외
            guard item.targetWeekKey == nil else {
                result.append(item)
                continue
            }
            let startSig = "\(item.weekday.rawValue)|\(item.startHour):\(item.startMinute)|\(item.title.trimmingCharacters(in: .whitespacesAndNewlines))"
            if let canonical = canonicalByStartSig[startSig] {
                if item.id != canonical.id {
                    let oldId = item.id
                    migrateItemStateKeys(from: oldId, to: canonical.id)
                    deletedItemTimestamps[oldId.uuidString] = max(
                        deletedItemTimestamps[oldId.uuidString] ?? 0,
                        Date().timeIntervalSince1970
                    )
                    item.id = canonical.id
                    // 토요일 주간 미션이 이전 버전(21:30 종료)으로 되어 있으면 22:30으로 함께 보정
                    if item.weekday == .saturday && item.startHour == 12 && item.endHour == 21 && item.endMinute == 30 {
                        item.endHour = 22
                        item.endMinute = 30
                    }
                    // 수정되지 않은 초기 기본 일정이면 기준 시각(baselineTimestamp)으로 맞춰 다른 기기의 수정/삭제가 우선되도록 함
                    let isUnmodified = item.endHour == canonical.endHour &&
                        item.endMinute == canonical.endMinute &&
                        item.note == canonical.note &&
                        item.subTasks.map(\.title) == canonical.subTasks.map(\.title)
                    if isUnmodified {
                        item.updatedAt = DefaultScheduleData.baselineTimestamp
                    }
                }
                if item.subTasks.count == canonical.subTasks.count {
                    for sIdx in item.subTasks.indices {
                        let oldSubId = item.subTasks[sIdx].id
                        let newSubId = canonical.subTasks[sIdx].id
                        if oldSubId != newSubId {
                            migrateSubTaskStateKeys(from: oldSubId, to: newSubId)
                            item.subTasks[sIdx].id = newSubId
                        }
                    }
                }
            }
            result.append(item)
        }
        return result
    }

    private func deduplicateItemsBySignature(_ inputItems: [ScheduleItem]) -> [ScheduleItem] {
        let canonicalIds = Set(DefaultScheduleData.makeDefaultItems().map { $0.id })
        var grouped: [String: [ScheduleItem]] = [:]
        for item in inputItems {
            let sig = DefaultScheduleData.signature(for: item)
            grouped[sig, default: []].append(item)
        }

        var keptItems: [ScheduleItem] = []
        for (_, group) in grouped {
            guard group.count > 1 else {
                if let single = group.first {
                    keptItems.append(single)
                }
                continue
            }
            let sortedGroup = group.sorted { a, b in
                let aCanonical = canonicalIds.contains(a.id)
                let bCanonical = canonicalIds.contains(b.id)
                if aCanonical != bCanonical { return aCanonical }
                return a.updatedAt > b.updatedAt
            }
            var winner = sortedGroup[0]
            for loser in sortedGroup.dropFirst() {
                if loser.updatedAt > winner.updatedAt {
                    winner.updatedAt = loser.updatedAt
                }
                migrateItemStateKeys(from: loser.id, to: winner.id)
                if loser.id != winner.id {
                    deletedItemTimestamps[loser.id.uuidString] = max(
                        deletedItemTimestamps[loser.id.uuidString] ?? 0,
                        Date().timeIntervalSince1970
                    )
                }
            }
            keptItems.append(winner)
        }
        return keptItems
    }

    private func migrateItemStateKeys(from oldId: UUID, to newId: UUID) {
        guard oldId != newId else { return }
        let oldSuffix = "_\(oldId.uuidString)"
        let newSuffix = "_\(newId.uuidString)"

        for (key, flag) in completionFlags where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            if let existing = completionFlags[newKey] {
                if flag.isSet || flag.updatedAt > existing.updatedAt {
                    completionFlags[newKey] = SyncTimestampedFlag(
                        isSet: existing.isSet || flag.isSet,
                        updatedAt: max(existing.updatedAt, flag.updatedAt)
                    )
                }
            } else {
                completionFlags[newKey] = flag
            }
        }

        for (key, flag) in parentVerifiedFlags where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            if let existing = parentVerifiedFlags[newKey] {
                if flag.isSet || flag.updatedAt > existing.updatedAt {
                    parentVerifiedFlags[newKey] = SyncTimestampedFlag(
                        isSet: existing.isSet || flag.isSet,
                        updatedAt: max(existing.updatedAt, flag.updatedAt)
                    )
                }
            } else {
                parentVerifiedFlags[newKey] = flag
            }
        }

        for (key, react) in itemReactions where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            var migrated = react
            migrated.itemKey = newKey
            if let existing = itemReactions[newKey] {
                migrated.heartCount = max(existing.heartCount, react.heartCount)
                if migrated.comment.isEmpty { migrated.comment = existing.comment }
                var combined = existing.comments
                for c in react.comments {
                    if !combined.contains(where: { $0.id == c.id }) { combined.append(c) }
                }
                combined.sort { $0.createdAt < $1.createdAt }
                migrated.comments = combined
                migrated.updatedAt = max(existing.updatedAt, react.updatedAt)
            }
            itemReactions[newKey] = migrated
        }

        for (key, ov) in weeklyOverrides where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            var migrated = ov
            migrated.baseItemId = newId
            if var mod = migrated.overriddenItem {
                mod.id = newId
                migrated.overriddenItem = mod
            }
            if let existing = weeklyOverrides[newKey] {
                if migrated.updatedAt >= existing.updatedAt {
                    weeklyOverrides[newKey] = migrated
                }
            } else {
                weeklyOverrides[newKey] = migrated
            }
        }
    }

    private func migrateSubTaskStateKeys(from oldId: UUID, to newId: UUID) {
        guard oldId != newId else { return }
        let oldSuffix = "_\(oldId.uuidString)"
        let newSuffix = "_\(newId.uuidString)"

        for (key, flag) in subTaskCompletionFlags where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            if let existing = subTaskCompletionFlags[newKey] {
                subTaskCompletionFlags[newKey] = SyncTimestampedFlag(
                    isSet: existing.isSet || flag.isSet,
                    updatedAt: max(existing.updatedAt, flag.updatedAt)
                )
            } else {
                subTaskCompletionFlags[newKey] = flag
            }
        }

        for (key, flag) in parentVerifiedSubTaskFlags where key.hasSuffix(oldSuffix) {
            let newKey = key.replacingOccurrences(of: oldSuffix, with: newSuffix)
            if let existing = parentVerifiedSubTaskFlags[newKey] {
                parentVerifiedSubTaskFlags[newKey] = SyncTimestampedFlag(
                    isSet: existing.isSet || flag.isSet,
                    updatedAt: max(existing.updatedAt, flag.updatedAt)
                )
            } else {
                parentVerifiedSubTaskFlags[newKey] = flag
            }
        }
    }

    private static func mergeFlagDict(
        local: [String: SyncTimestampedFlag],
        remote: [String: SyncTimestampedFlag]
    ) -> [String: SyncTimestampedFlag] {
        var result = local
        for (key, rFlag) in remote {
            if let lFlag = result[key] {
                if rFlag.updatedAt >= lFlag.updatedAt {
                    result[key] = rFlag
                }
            } else {
                result[key] = rFlag
            }
        }
        return result
    }

    func showToast(_ message: String) {
        toastDismissTask?.cancel()
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            syncToastMessage = message
        }
        toastDismissTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            guard !Task.isCancelled, let self else { return }
            withAnimation(.easeOut(duration: 0.25)) {
                self.syncToastMessage = nil
            }
        }
    }

    // MARK: - Persistence

    private func loadSecurityAndRoleSettings() {
        // 1. 6자리 마스터 PIN 로드 (Keychain 우선 -> UserDefaults -> 기본값 160125)
        if let kcPin = KeychainHelper.readString(forKey: parentPinStorageKey), kcPin.count == 6 {
            self.parentPinCode = kcPin
        } else if let udPin = UserDefaults.standard.string(forKey: parentPinStorageKey), udPin.count == 6 {
            self.parentPinCode = udPin
            KeychainHelper.saveString(udPin, forKey: parentPinStorageKey)
        } else {
            self.parentPinCode = Self.defaultMasterPin
            UserDefaults.standard.set(Self.defaultMasterPin, forKey: parentPinStorageKey)
            KeychainHelper.saveString(Self.defaultMasterPin, forKey: parentPinStorageKey)
        }

        if let kcTsStr = KeychainHelper.readString(forKey: parentPinUpdatedAtKey),
           let kcTs = TimeInterval(kcTsStr) {
            self.parentPinUpdatedAt = kcTs
        } else {
            let udTs = UserDefaults.standard.double(forKey: parentPinUpdatedAtKey)
            self.parentPinUpdatedAt = udTs > 0 ? udTs : 1_700_000_000
        }

        // 2. 오입력 잠금 상태 복원 (앱 강제 종료 후 재실행 시에도 잠금 유지)
        if let attemptsStr = KeychainHelper.readString(forKey: "pin_failed_attempts"),
           let attempts = Int(attemptsStr) {
            self.failedPinAttempts = attempts
        }
        if let lockStr = KeychainHelper.readString(forKey: "pin_lockout_until"),
           let lockTs = TimeInterval(lockStr), lockTs > Date().timeIntervalSince1970 {
            self.pinLockoutUntil = Date(timeIntervalSince1970: lockTs)
        }

        // 3. 기기 역할 로드 (아이의 폰 vs 부모님 폰)
        if let roleRaw = UserDefaults.standard.string(forKey: deviceRoleStorageKey),
           let role = DeviceRole(rawValue: roleRaw) {
            self.deviceRole = role
            self.hasConfirmedDeviceRole = UserDefaults.standard.bool(forKey: deviceRoleConfirmedKey)
        } else if let kcRoleRaw = KeychainHelper.readString(forKey: deviceRoleStorageKey),
                  let role = DeviceRole(rawValue: kcRoleRaw) {
            self.deviceRole = role
            self.hasConfirmedDeviceRole = true
        } else {
            self.deviceRole = .child
            self.hasConfirmedDeviceRole = false
        }
    }

    private func loadSyncSettings() {
        if let savedToken = UserDefaults.standard.string(forKey: vercelTokenStorageKey), !savedToken.isEmpty {
            self.vercelBlobToken = savedToken
        } else {
            self.vercelBlobToken = VercelBlobSyncService.defaultToken
        }

        if let savedFamily = UserDefaults.standard.string(forKey: familyCodeStorageKey), !savedFamily.isEmpty {
            self.familyCode = savedFamily
        } else {
            self.familyCode = VercelBlobSyncService.defaultFamilyCode
        }
    }

    private func loadItems() {
        if let data = UserDefaults.standard.data(forKey: itemsStorageKey),
           let decoded = try? JSONDecoder().decode([ScheduleItem].self, from: data),
           !decoded.isEmpty {
            self.items = decoded
        } else {
            self.items = DefaultScheduleData.makeDefaultItems()
        }
    }

    private func saveItems() {
        if let encoded = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(encoded, forKey: itemsStorageKey)
        }
    }

    private func loadWeeklyOverrides() {
        if let data = UserDefaults.standard.data(forKey: weeklyOverridesStorageKey),
           let decoded = try? JSONDecoder().decode([String: WeeklyItemOverride].self, from: data) {
            self.weeklyOverrides = decoded
        }
    }

    private func saveWeeklyOverrides() {
        if let encoded = try? JSONEncoder().encode(weeklyOverrides) {
            UserDefaults.standard.set(encoded, forKey: weeklyOverridesStorageKey)
        }
    }

    private func loadCompletions() {
        if let data = UserDefaults.standard.data(forKey: completedItemsStorageKey),
           let decoded = try? JSONDecoder().decode(Set<String>.self, from: data) {
            self.completedItemKeys = decoded
        }
        if let data = UserDefaults.standard.data(forKey: completedSubTasksStorageKey),
           let decoded = try? JSONDecoder().decode(Set<String>.self, from: data) {
            self.completedSubTaskKeys = decoded
        }
    }

    private func saveCompletions() {
        guard !isRestoringLocalState else { return }
        if let encoded = try? JSONEncoder().encode(completedItemKeys) {
            UserDefaults.standard.set(encoded, forKey: completedItemsStorageKey)
        }
        if let encoded = try? JSONEncoder().encode(completedSubTaskKeys) {
            UserDefaults.standard.set(encoded, forKey: completedSubTasksStorageKey)
        }
    }

    private func loadParentVerifications() {
        if let data = UserDefaults.standard.data(forKey: parentVerifiedItemsStorageKey),
           let decoded = try? JSONDecoder().decode(Set<String>.self, from: data) {
            self.parentVerifiedItemKeys = decoded
        }
        if let data = UserDefaults.standard.data(forKey: parentVerifiedSubTasksStorageKey),
           let decoded = try? JSONDecoder().decode(Set<String>.self, from: data) {
            self.parentVerifiedSubTaskKeys = decoded
        }
    }

    private func saveParentVerifications() {
        guard !isRestoringLocalState else { return }
        if let encoded = try? JSONEncoder().encode(parentVerifiedItemKeys) {
            UserDefaults.standard.set(encoded, forKey: parentVerifiedItemsStorageKey)
        }
        if let encoded = try? JSONEncoder().encode(parentVerifiedSubTaskKeys) {
            UserDefaults.standard.set(encoded, forKey: parentVerifiedSubTasksStorageKey)
        }
    }

    private func loadReactionsAndPraises() {
        if let data = UserDefaults.standard.data(forKey: reactionsStorageKey),
           let decoded = try? JSONDecoder().decode([String: ItemParentReaction].self, from: data) {
            self.itemReactions = decoded
        }
        if let data = UserDefaults.standard.data(forKey: praiseNotesStorageKey),
           let decoded = try? JSONDecoder().decode([ParentPraiseNote].self, from: data) {
            self.praiseNotes = decoded
        }
        if let data = UserDefaults.standard.data(forKey: rewardRedemptionsStorageKey),
           let decoded = try? JSONDecoder().decode([HeartRewardRedemption].self, from: data) {
            self.rewardRedemptions = decoded
        }
        self.archivedEarnedHearts = UserDefaults.standard.integer(forKey: archivedEarnedHeartsStorageKey)
        if let data = UserDefaults.standard.data(forKey: deletedRewardPresetsStorageKey),
           let decoded = try? JSONDecoder().decode([String: TimeInterval].self, from: data) {
            deletedRewardPresetTimestamps = decoded
        }
        if let data = UserDefaults.standard.data(forKey: rewardPresetsStorageKey),
           let decoded = try? JSONDecoder().decode([RewardPreset].self, from: data) {
            self.rewardPresets = RewardPreset.merged(decoded, deleted: &deletedRewardPresetTimestamps)
        } else {
            self.rewardPresets = RewardPreset.merged(RewardPreset.defaultPresets, deleted: &deletedRewardPresetTimestamps)
        }
    }

    private func saveRewardPresets() {
        if let encoded = try? JSONEncoder().encode(deletedRewardPresetTimestamps) {
            UserDefaults.standard.set(encoded, forKey: deletedRewardPresetsStorageKey)
        }
        if let encoded = try? JSONEncoder().encode(rewardPresets) {
            UserDefaults.standard.set(encoded, forKey: rewardPresetsStorageKey)
        }
    }

    private func saveReactionsAndPraises() {
        guard !isRestoringLocalState else { return }
        if let encoded = try? JSONEncoder().encode(itemReactions) {
            UserDefaults.standard.set(encoded, forKey: reactionsStorageKey)
        }
        if let encoded = try? JSONEncoder().encode(praiseNotes) {
            UserDefaults.standard.set(encoded, forKey: praiseNotesStorageKey)
        }
        if let encoded = try? JSONEncoder().encode(rewardRedemptions) {
            UserDefaults.standard.set(encoded, forKey: rewardRedemptionsStorageKey)
        }
        UserDefaults.standard.set(archivedEarnedHearts, forKey: archivedEarnedHeartsStorageKey)
    }

    private struct LocalSyncFlagsBundle: Codable {
        var deletedItemTimestamps: [String: TimeInterval]
        var completionFlags: [String: SyncTimestampedFlag]
        var subTaskCompletionFlags: [String: SyncTimestampedFlag]
        var parentVerifiedFlags: [String: SyncTimestampedFlag]
        var parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag]
    }

    private func loadSyncFlags() {
        guard let data = UserDefaults.standard.data(forKey: syncFlagsStorageKey),
              let bundle = try? JSONDecoder().decode(LocalSyncFlagsBundle.self, from: data) else {
            return
        }
        self.deletedItemTimestamps = bundle.deletedItemTimestamps
        self.completionFlags = bundle.completionFlags
        self.subTaskCompletionFlags = bundle.subTaskCompletionFlags
        self.parentVerifiedFlags = bundle.parentVerifiedFlags
        self.parentVerifiedSubTaskFlags = bundle.parentVerifiedSubTaskFlags
    }

    private func saveSyncFlags() {
        let bundle = LocalSyncFlagsBundle(
            deletedItemTimestamps: deletedItemTimestamps,
            completionFlags: completionFlags,
            subTaskCompletionFlags: subTaskCompletionFlags,
            parentVerifiedFlags: parentVerifiedFlags,
            parentVerifiedSubTaskFlags: parentVerifiedSubTaskFlags
        )
        if let encoded = try? JSONEncoder().encode(bundle) {
            UserDefaults.standard.set(encoded, forKey: syncFlagsStorageKey)
        }
    }

    private func reconcileFlagsWithSets() {
        let baseTs: TimeInterval = 1_700_000_000
        for key in completedItemKeys where completionFlags[key] == nil {
            completionFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: baseTs)
        }
        for key in completedSubTaskKeys where subTaskCompletionFlags[key] == nil {
            subTaskCompletionFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: baseTs)
        }
        for key in parentVerifiedItemKeys where parentVerifiedFlags[key] == nil {
            parentVerifiedFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: baseTs)
        }
        for key in parentVerifiedSubTaskKeys where parentVerifiedSubTaskFlags[key] == nil {
            parentVerifiedSubTaskFlags[key] = SyncTimestampedFlag(isSet: true, updatedAt: baseTs)
        }
    }
}
