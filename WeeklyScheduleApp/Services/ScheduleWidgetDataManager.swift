import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

extension Notification.Name {
    static let widgetDidCompleteScheduleItem = Notification.Name("com.jae.weeklyschedule.widgetDidCompleteScheduleItem")
}

/// 위젯 리스트의 개별 할 일 표시 모델
struct WidgetTaskItem: Codable, Identifiable, Equatable, Sendable {
    var id: UUID
    var title: String
    var startHour: Int
    var startMinute: Int
    var endHour: Int
    var endMinute: Int
    var category: ScheduleCategory
    var note: String
    var subTaskCount: Int
    var isAdjustedThisWeek: Bool

    var startTotalMinutes: Int {
        startHour * 60 + startMinute
    }

    var endTotalMinutes: Int {
        endHour * 60 + endMinute
    }

    /// HH:mm 포맷 시작 시간 (예: "14:30", "08:00")
    var startTimeHHmm: String {
        String(format: "%02d:%02d", startHour, startMinute)
    }

    /// HH:mm ~ HH:mm 포맷 시간 범위
    var timeRangeHHmm: String {
        String(format: "%02d:%02d ~ %02d:%02d", startHour, startMinute, endHour, endMinute)
    }
}

/// 본 앱(`ScheduleStore`)과 위젯(`TodayTasksWidget`) 간 공유 상태 스냅샷
struct WidgetSharedState: Codable, Sendable {
    var updatedAt: TimeInterval
    var vercelBlobToken: String
    var familyCode: String
    var deviceId: String
    var deviceRoleShortTitle: String
    var items: [ScheduleItem]
    var deletedItemTimestamps: [String: TimeInterval]
    var weeklyOverrides: [String: WeeklyItemOverride]
    var completionFlags: [String: SyncTimestampedFlag]
    var subTaskCompletionFlags: [String: SyncTimestampedFlag]
    var parentVerifiedFlags: [String: SyncTimestampedFlag]
    var parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag]

    static func makeDefault() -> WidgetSharedState {
        WidgetSharedState(
            updatedAt: DefaultScheduleData.baselineTimestamp,
            vercelBlobToken: VercelBlobSyncService.defaultToken,
            familyCode: VercelBlobSyncService.defaultFamilyCode,
            deviceId: "widget",
            deviceRoleShortTitle: "👦 아이",
            items: DefaultScheduleData.makeDefaultItems(),
            deletedItemTimestamps: [:],
            weeklyOverrides: [:],
            completionFlags: [:],
            subTaskCompletionFlags: [:],
            parentVerifiedFlags: [:],
            parentVerifiedSubTaskFlags: [:]
        )
    }
}

/// 위젯에서 체크한 완료 플래그를 유실 없이 즉시 반영·병합하기 위한 브릿지 페이로드
struct WidgetPendingCompletions: Codable, Sendable {
    var completionFlags: [String: SyncTimestampedFlag]
    var subTaskCompletionFlags: [String: SyncTimestampedFlag]
    var lastWidgetTapAt: TimeInterval

    static let empty = WidgetPendingCompletions(
        completionFlags: [:],
        subTaskCompletionFlags: [:],
        lastWidgetTapAt: 0
    )
}

/// 오늘 요일 위젯용 계산 결과 (본 앱 `TodayScheduleView`와 100% 동일한 필터링 정합성 보장)
struct TodayWidgetScheduleSummary: Sendable {
    var date: Date
    var weekKey: String
    var weekday: Weekday
    var incompleteItems: [WidgetTaskItem]
    var totalCheckableCount: Int
    var completedCheckableCount: Int

    /// 남은 미완료 할 일 개수 (`TodayScheduleView`의 `stats.total - stats.completed`와 동일)
    var remainingIncompleteCount: Int {
        incompleteItems.count
    }
}

/// 무료 Apple ID(App Groups 불필요) 호환 위젯 데이터 & 클라우드 동기화 매니저
/// - 동일 기기(시뮬레이터/공유 키체인)에서는 `KeychainHelper` + `UserDefaults` 브릿지로 0ms 즉시 동기화
/// - 실기기 프로세스 간 및 가족 기기 간에는 `VercelBlobSyncService` 스냅샷 병합으로 양방향 동기화
final class ScheduleWidgetDataManager: @unchecked Sendable {
    static let shared = ScheduleWidgetDataManager()

    private let stateStorageKey = "weekly_schedule_widget_state_v1"
    private let pendingCompletionsKey = "weekly_schedule_widget_pending_completions_v1"
    private let cachedRemoteSnapshotKey = "weekly_schedule_widget_cached_remote_snapshot_v1"
    private let lock = NSLock()

    private init() {}

    // MARK: - ISO-8601 주차 키 (`ScheduleStore.currentWeekPrefix`와 동일)

    static func weekKey(for date: Date = Date()) -> String {
        ScheduleCalendarUtils.weekKey(for: date)
    }

    // MARK: - 위젯 타임라인 리로드

    func reloadWidgetTimelines() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }

    // MARK: - 본 앱(`ScheduleStore`) -> 위젯 상태 저장

    func saveStateFromMainApp(
        vercelBlobToken: String,
        familyCode: String,
        deviceId: String,
        deviceRoleShortTitle: String,
        items: [ScheduleItem],
        deletedItemTimestamps: [String: TimeInterval],
        weeklyOverrides: [String: WeeklyItemOverride],
        completionFlags: [String: SyncTimestampedFlag],
        subTaskCompletionFlags: [String: SyncTimestampedFlag],
        parentVerifiedFlags: [String: SyncTimestampedFlag],
        parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag],
        reloadWidget: Bool = true
    ) {
        let pending = loadPendingCompletions()
        let mergedCompletionFlags = Self.mergeFlagDict(local: completionFlags, remote: pending.completionFlags)
        let mergedSubTaskFlags = Self.mergeFlagDict(local: subTaskCompletionFlags, remote: pending.subTaskCompletionFlags)

        let state = WidgetSharedState(
            updatedAt: Date().timeIntervalSince1970,
            vercelBlobToken: vercelBlobToken.isEmpty ? VercelBlobSyncService.defaultToken : vercelBlobToken,
            familyCode: familyCode.isEmpty ? VercelBlobSyncService.defaultFamilyCode : familyCode,
            deviceId: deviceId,
            deviceRoleShortTitle: deviceRoleShortTitle,
            items: items,
            deletedItemTimestamps: deletedItemTimestamps,
            weeklyOverrides: weeklyOverrides,
            completionFlags: mergedCompletionFlags,
            subTaskCompletionFlags: mergedSubTaskFlags,
            parentVerifiedFlags: parentVerifiedFlags,
            parentVerifiedSubTaskFlags: parentVerifiedSubTaskFlags
        )

        persistSharedState(state)
        if reloadWidget {
            reloadWidgetTimelines()
        }
    }

    // MARK: - 본 앱에서 위젯 완료 내역 즉시 흡수

    func consumePendingCompletionsForMainApp() -> WidgetPendingCompletions {
        loadPendingCompletions()
    }

    // MARK: - 위젯 `CompleteScheduleItemIntent` 실행 처리

    func handleWidgetCompleteIntent(itemId: UUID, weekKey: String?) async {
        let now = Date()
        let ts = now.timeIntervalSince1970
        let wk = (weekKey?.isEmpty == false) ? weekKey! : Self.weekKey(for: now)
        let itemKey = "\(wk)_\(itemId.uuidString)"

        // 1. 로컬 & 키체인 상태에 즉시 완료 플래그 기록
        var state = loadBestAvailableLocalState()
        let newFlag = SyncTimestampedFlag(isSet: true, updatedAt: ts)
        state.completionFlags[itemKey] = newFlag
        state.updatedAt = ts

        var pending = loadPendingCompletions()
        pending.completionFlags[itemKey] = newFlag
        pending.lastWidgetTapAt = ts

        // 해당 항목에 세부 체크리스트(subTasks)가 있으면 함께 완료 플래그 설정 (`ScheduleStore.toggleCompletion`과 동일)
        let effectiveToday = Self.computeEffectiveItems(
            items: state.items,
            deletedItemTimestamps: state.deletedItemTimestamps,
            weeklyOverrides: state.weeklyOverrides,
            weekKey: wk
        )
        if let targetItem = effectiveToday.first(where: { $0.id == itemId }) ?? state.items.first(where: { $0.id == itemId }) {
            for sub in targetItem.subTasks {
                let subKey = "\(wk)_\(sub.id.uuidString)"
                state.subTaskCompletionFlags[subKey] = newFlag
                pending.subTaskCompletionFlags[subKey] = newFlag
            }
        }

        savePendingCompletions(pending)
        persistSharedState(state)

        // 2. 호스트 앱 프로세스에서 실행된 경우 즉시 인메모리 `ScheduleStore`에 알림
        await MainActor.run {
            NotificationCenter.default.post(
                name: .widgetDidCompleteScheduleItem,
                object: nil,
                userInfo: [
                    "itemId": itemId.uuidString,
                    "weekKey": wk,
                    "updatedAt": ts
                ]
            )
        }

        // 3. 위젯 타임라인 즉시 리로드 (체크된 항목이 위젯 리스트에서 즉시 사라지고 다음 항목이 올라옴)
        reloadWidgetTimelines()

        // 4. Vercel Blob 클라우드에 최신 완료 상태 병합 업로드
        await pushWidgetCompletionToCloud(
            state: state,
            pending: pending
        )
    }

    // MARK: - 위젯 타임라인용 상태 로드 및 원격 스냅샷 동기화

    func loadSummaryForWidget(date: Date = Date(), allowNetworkRefresh: Bool = true) async -> TodayWidgetScheduleSummary {
        var state = loadBestAvailableLocalState()
        let pending = loadPendingCompletions()

        // 방금 위젯 체크 버튼을 누른 직후(2.5초 이내)에는 로컬 즉시 반영 상태를 우선 사용하여
        // 클라우드 업로드 완료 전 구버전 스냅샷이 덮어씌워지는 플리커링을 방지합니다.
        let justTappedLocally = (Date().timeIntervalSince1970 - pending.lastWidgetTapAt) < 2.5

        if allowNetworkRefresh && !justTappedLocally {
            if let remoteUpdated = await fetchAndMergeFromCloud(baseState: state, pending: pending) {
                state = remoteUpdated
            }
        } else {
            state.completionFlags = Self.mergeFlagDict(local: state.completionFlags, remote: pending.completionFlags)
            state.subTaskCompletionFlags = Self.mergeFlagDict(local: state.subTaskCompletionFlags, remote: pending.subTaskCompletionFlags)
        }

        return Self.computeTodaySummary(for: date, state: state)
    }

    /// 동기(Synchronous) 즉시 요약 계산 (placeholder / snapshot 용)
    func loadImmediateSummaryForWidget(date: Date = Date()) -> TodayWidgetScheduleSummary {
        var state = loadBestAvailableLocalState()
        let pending = loadPendingCompletions()
        state.completionFlags = Self.mergeFlagDict(local: state.completionFlags, remote: pending.completionFlags)
        state.subTaskCompletionFlags = Self.mergeFlagDict(local: state.subTaskCompletionFlags, remote: pending.subTaskCompletionFlags)
        return Self.computeTodaySummary(for: date, state: state)
    }

    // MARK: - 오늘 요일 미완료 할 일 계산 엔진 (`ScheduleStore`와 100% 동일한 규칙)

    static func computeTodaySummary(for date: Date, state: WidgetSharedState) -> TodayWidgetScheduleSummary {
        let wk = weekKey(for: date)
        let todayWeekday = Weekday.from(date: date)

        let effective = computeEffectiveItems(
            items: state.items,
            deletedItemTimestamps: state.deletedItemTimestamps,
            weeklyOverrides: state.weeklyOverrides,
            weekKey: wk
        )

        let todayEffectiveItems = effective.filter { $0.weekday == todayWeekday }
        let checkableItems = todayEffectiveItems.filter { $0.isCheckable }

        var completedCount = 0
        var incompleteTaskItems: [WidgetTaskItem] = []

        for item in checkableItems {
            let key = "\(wk)_\(item.id.uuidString)"
            let isDone = (state.completionFlags[key]?.isSet == true) || (state.parentVerifiedFlags[key]?.isSet == true)
            if isDone {
                completedCount += 1
            } else {
                let isAdjusted: Bool = {
                    if item.targetWeekKey == wk { return true }
                    if let ov = state.weeklyOverrides[key], ov.isActive { return true }
                    return false
                }()
                incompleteTaskItems.append(
                    WidgetTaskItem(
                        id: item.id,
                        title: item.title,
                        startHour: item.startHour,
                        startMinute: item.startMinute,
                        endHour: item.endHour,
                        endMinute: item.endMinute,
                        category: item.category,
                        note: item.note,
                        subTaskCount: item.subTasks.count,
                        isAdjustedThisWeek: isAdjusted
                    )
                )
            }
        }

        return TodayWidgetScheduleSummary(
            date: date,
            weekKey: wk,
            weekday: todayWeekday,
            incompleteItems: incompleteTaskItems,
            totalCheckableCount: checkableItems.count,
            completedCheckableCount: completedCount
        )
    }

    static func computeEffectiveItems(
        items: [ScheduleItem],
        deletedItemTimestamps: [String: TimeInterval],
        weeklyOverrides: [String: WeeklyItemOverride],
        weekKey wk: String
    ) -> [ScheduleItem] {
        // 삭제된 아이템 필터링
        let activeItems = items.filter { item in
            let delTs = deletedItemTimestamps[item.id.uuidString] ?? 0
            return delTs < item.updatedAt
        }

        // 정규(매주 반복) 일정 정렬
        let masterItems = activeItems
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

        var result: [ScheduleItem] = []

        for base in masterItems {
            let key = "\(wk)_\(base.id.uuidString)"
            if let override = weeklyOverrides[key], override.isActive {
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

        // 이번 주 전용 추가 일정 합산
        let thisWeekAdditions = activeItems.filter { $0.targetWeekKey == wk }
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

    // MARK: - Cloud Sync (`VercelBlobSyncService`)

    private func fetchAndMergeFromCloud(
        baseState: WidgetSharedState,
        pending: WidgetPendingCompletions
    ) async -> WidgetSharedState? {
        let token = baseState.vercelBlobToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? VercelBlobSyncService.defaultToken
            : baseState.vercelBlobToken
        let familyCode = baseState.familyCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? VercelBlobSyncService.defaultFamilyCode
            : baseState.familyCode

        do {
            let (latest, _) = try await VercelBlobSyncService.shared.fetchLatestBlobMetadata(
                token: token,
                familyCode: familyCode
            )
            guard let latestBlob = latest else { return nil }
            let remote = try await VercelBlobSyncService.shared.downloadSnapshot(
                from: latestBlob.url,
                token: token
            )
            saveCachedRemoteSnapshot(remote)

            let merged = Self.mergeRemoteSnapshotIntoState(
                baseState: baseState,
                remote: remote,
                pending: pending
            )
            persistSharedState(merged)
            return merged
        } catch {
            return nil
        }
    }

    private func pushWidgetCompletionToCloud(
        state: WidgetSharedState,
        pending: WidgetPendingCompletions
    ) async {
        let token = state.vercelBlobToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? VercelBlobSyncService.defaultToken
            : state.vercelBlobToken
        let familyCode = state.familyCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? VercelBlobSyncService.defaultFamilyCode
            : state.familyCode

        do {
            let (latest, allBlobs) = try await VercelBlobSyncService.shared.fetchLatestBlobMetadata(
                token: token,
                familyCode: familyCode
            )

            var baseSnapshot: CloudSyncSnapshot
            if let latestBlob = latest,
               let downloaded = try? await VercelBlobSyncService.shared.downloadSnapshot(
                   from: latestBlob.url,
                   token: token
               ) {
                baseSnapshot = downloaded
            } else if let cached = loadCachedRemoteSnapshot() {
                baseSnapshot = cached
            } else {
                // 원격에 이미 최신 스냅샷이 존재하지만 네트워크 오류 등으로 다운로드/캐시 로드에 실패한 경우,
                // 스타 원장(starTransactions) 및 보상 이력(starRedemptionRequests)이 빈 배열로 덮어쓰여지는 유실을 차단하기 위해 업로드를 건너뜁니다.
                if latest != nil {
                    return
                }
                baseSnapshot = CloudSyncSnapshot(
                    schemaVersion: 5,
                    familyCode: familyCode,
                    updatedAt: Date().timeIntervalSince1970,
                    updatedByRole: state.deviceRoleShortTitle,
                    updatedByDeviceId: state.deviceId,
                    parentPinCode: "160125",
                    parentPinUpdatedAt: DefaultScheduleData.baselineTimestamp,
                    items: state.items,
                    deletedItemTimestamps: state.deletedItemTimestamps,
                    weeklyOverrides: state.weeklyOverrides,
                    completionFlags: state.completionFlags,
                    subTaskCompletionFlags: state.subTaskCompletionFlags,
                    parentVerifiedFlags: state.parentVerifiedFlags,
                    parentVerifiedSubTaskFlags: state.parentVerifiedSubTaskFlags,
                    itemReactions: [:],
                    praiseNotes: [],
                    rewardRedemptions: [],
                    archivedEarnedHearts: 0,
                    rewardPresets: RewardPreset.defaultPresets,
                    deletedRewardPresetTimestamps: [:],
                    starTransactions: [],
                    starRedemptionRequests: [],
                    starRewardPresets: StarRewardPreset.defaultPresets,
                    deletedStarPresetTimestamps: [:]
                )
            }

            baseSnapshot.updatedAt = Date().timeIntervalSince1970
            baseSnapshot.updatedByRole = state.deviceRoleShortTitle
            baseSnapshot.updatedByDeviceId = state.deviceId.isEmpty ? "widget" : state.deviceId
            baseSnapshot.completionFlags = Self.mergeFlagDict(
                local: Self.mergeFlagDict(local: baseSnapshot.completionFlags, remote: state.completionFlags),
                remote: pending.completionFlags
            )
            baseSnapshot.subTaskCompletionFlags = Self.mergeFlagDict(
                local: Self.mergeFlagDict(local: baseSnapshot.subTaskCompletionFlags, remote: state.subTaskCompletionFlags),
                remote: pending.subTaskCompletionFlags
            )

            _ = try await VercelBlobSyncService.shared.uploadSnapshot(
                baseSnapshot,
                token: token,
                familyCode: familyCode,
                shortDeviceId: baseSnapshot.updatedByDeviceId,
                previousBlobsToDelete: allBlobs
            )
            saveCachedRemoteSnapshot(baseSnapshot)
        } catch {
            // 네트워크 일시 오류 시에도 로컬 및 Keychain의 pendingCompletions에 보존되어
            // 다음 타임라인 갱신 또는 본 앱 실행 시 자동 병합·업로드됩니다.
        }
    }

    private static func mergeRemoteSnapshotIntoState(
        baseState: WidgetSharedState,
        remote: CloudSyncSnapshot,
        pending: WidgetPendingCompletions
    ) -> WidgetSharedState {
        var merged = baseState
        merged.updatedAt = max(baseState.updatedAt, remote.updatedAt)

        // 삭제 시각 병합
        for (idStr, rDelTs) in remote.deletedItemTimestamps {
            let lDelTs = merged.deletedItemTimestamps[idStr] ?? 0
            if rDelTs > lDelTs {
                merged.deletedItemTimestamps[idStr] = rDelTs
            }
        }

        // 아이템 병합
        var itemDict: [UUID: ScheduleItem] = [:]
        for item in merged.items {
            itemDict[item.id] = item
        }
        for rItem in remote.items {
            if let existing = itemDict[rItem.id] {
                if rItem.updatedAt >= existing.updatedAt {
                    itemDict[rItem.id] = rItem
                }
            } else {
                itemDict[rItem.id] = rItem
            }
        }
        merged.items = Array(itemDict.values)

        // 이번 주 오버라이드 병합
        for (key, rOv) in remote.weeklyOverrides {
            if let lOv = merged.weeklyOverrides[key] {
                if rOv.updatedAt >= lOv.updatedAt {
                    merged.weeklyOverrides[key] = rOv
                }
            } else {
                merged.weeklyOverrides[key] = rOv
            }
        }

        // 완료 & 부모확인 플래그 병합 + 위젯 로컬 탭(pending) 최우선 반영
        merged.completionFlags = mergeFlagDict(
            local: mergeFlagDict(local: merged.completionFlags, remote: remote.completionFlags),
            remote: pending.completionFlags
        )
        merged.subTaskCompletionFlags = mergeFlagDict(
            local: mergeFlagDict(local: merged.subTaskCompletionFlags, remote: remote.subTaskCompletionFlags),
            remote: pending.subTaskCompletionFlags
        )
        merged.parentVerifiedFlags = mergeFlagDict(
            local: merged.parentVerifiedFlags,
            remote: remote.parentVerifiedFlags
        )
        merged.parentVerifiedSubTaskFlags = mergeFlagDict(
            local: merged.parentVerifiedSubTaskFlags,
            remote: remote.parentVerifiedSubTaskFlags
        )

        return merged
    }

    static func mergeFlagDict(
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

    // MARK: - Persistence (`UserDefaults` + `KeychainHelper` 이중 브릿지)

    private func loadBestAvailableLocalState() -> WidgetSharedState {
        lock.lock()
        defer { lock.unlock() }

        var udState: WidgetSharedState?
        if let data = UserDefaults.standard.data(forKey: stateStorageKey),
           let decoded = try? JSONDecoder().decode(WidgetSharedState.self, from: data) {
            udState = decoded
        }

        var kcState: WidgetSharedState?
        if let jsonStr = KeychainHelper.readString(forKey: stateStorageKey),
           let data = jsonStr.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WidgetSharedState.self, from: data) {
            kcState = decoded
        }

        let base: WidgetSharedState
        switch (udState, kcState) {
        case let (u?, k?):
            var newer = (k.updatedAt >= u.updatedAt) ? k : u
            newer.completionFlags = Self.mergeFlagDict(local: u.completionFlags, remote: k.completionFlags)
            newer.subTaskCompletionFlags = Self.mergeFlagDict(local: u.subTaskCompletionFlags, remote: k.subTaskCompletionFlags)
            newer.parentVerifiedFlags = Self.mergeFlagDict(local: u.parentVerifiedFlags, remote: k.parentVerifiedFlags)
            newer.parentVerifiedSubTaskFlags = Self.mergeFlagDict(local: u.parentVerifiedSubTaskFlags, remote: k.parentVerifiedSubTaskFlags)
            base = newer
        case let (u?, nil):
            base = u
        case let (nil, k?):
            base = k
        case (nil, nil):
            base = reconstructFromMainAppUserDefaultsIfAvailable() ?? WidgetSharedState.makeDefault()
        }

        return base
    }

    private func persistSharedState(_ state: WidgetSharedState) {
        lock.lock()
        defer { lock.unlock() }

        guard let encoded = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(encoded, forKey: stateStorageKey)
        if let jsonStr = String(data: encoded, encoding: .utf8) {
            KeychainHelper.saveString(jsonStr, forKey: stateStorageKey)
        }
    }

    private func loadPendingCompletions() -> WidgetPendingCompletions {
        lock.lock()
        defer { lock.unlock() }

        var udPending: WidgetPendingCompletions?
        if let data = UserDefaults.standard.data(forKey: pendingCompletionsKey),
           let decoded = try? JSONDecoder().decode(WidgetPendingCompletions.self, from: data) {
            udPending = decoded
        }

        var kcPending: WidgetPendingCompletions?
        if let jsonStr = KeychainHelper.readString(forKey: pendingCompletionsKey),
           let data = jsonStr.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WidgetPendingCompletions.self, from: data) {
            kcPending = decoded
        }

        switch (udPending, kcPending) {
        case let (u?, k?):
            return WidgetPendingCompletions(
                completionFlags: Self.mergeFlagDict(local: u.completionFlags, remote: k.completionFlags),
                subTaskCompletionFlags: Self.mergeFlagDict(local: u.subTaskCompletionFlags, remote: k.subTaskCompletionFlags),
                lastWidgetTapAt: max(u.lastWidgetTapAt, k.lastWidgetTapAt)
            )
        case let (u?, nil):
            return u
        case let (nil, k?):
            return k
        case (nil, nil):
            return .empty
        }
    }

    private func savePendingCompletions(_ pending: WidgetPendingCompletions) {
        lock.lock()
        defer { lock.unlock() }

        guard let encoded = try? JSONEncoder().encode(pending) else { return }
        UserDefaults.standard.set(encoded, forKey: pendingCompletionsKey)
        if let jsonStr = String(data: encoded, encoding: .utf8) {
            KeychainHelper.saveString(jsonStr, forKey: pendingCompletionsKey)
        }
    }

    func cacheRemoteSnapshot(_ snapshot: CloudSyncSnapshot) {
        saveCachedRemoteSnapshot(snapshot)
    }

    private func saveCachedRemoteSnapshot(_ snapshot: CloudSyncSnapshot) {
        lock.lock()
        defer { lock.unlock() }

        if let encoded = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(encoded, forKey: cachedRemoteSnapshotKey)
        }
    }

    private func loadCachedRemoteSnapshot() -> CloudSyncSnapshot? {
        lock.lock()
        defer { lock.unlock() }

        guard let data = UserDefaults.standard.data(forKey: cachedRemoteSnapshotKey),
              let decoded = try? JSONDecoder().decode(CloudSyncSnapshot.self, from: data) else {
            return nil
        }
        return decoded
    }

    private func reconstructFromMainAppUserDefaultsIfAvailable() -> WidgetSharedState? {
        guard let itemsData = UserDefaults.standard.data(forKey: "weekly_schedule_items_v1"),
              let decodedItems = try? JSONDecoder().decode([ScheduleItem].self, from: itemsData),
              !decodedItems.isEmpty else {
            return nil
        }

        var overrides: [String: WeeklyItemOverride] = [:]
        if let ovData = UserDefaults.standard.data(forKey: "weekly_schedule_overrides_v1"),
           let decodedOv = try? JSONDecoder().decode([String: WeeklyItemOverride].self, from: ovData) {
            overrides = decodedOv
        }

        var completionFlags: [String: SyncTimestampedFlag] = [:]
        var subTaskFlags: [String: SyncTimestampedFlag] = [:]
        var verifiedFlags: [String: SyncTimestampedFlag] = [:]
        var verifiedSubFlags: [String: SyncTimestampedFlag] = [:]
        var deletedTimestamps: [String: TimeInterval] = [:]

        struct SyncFlagsMirror: Codable {
            var deletedItemTimestamps: [String: TimeInterval]
            var completionFlags: [String: SyncTimestampedFlag]
            var subTaskCompletionFlags: [String: SyncTimestampedFlag]
            var parentVerifiedFlags: [String: SyncTimestampedFlag]
            var parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag]
        }

        if let flagsData = UserDefaults.standard.data(forKey: "weekly_schedule_sync_flags_v1"),
           let bundle = try? JSONDecoder().decode(SyncFlagsMirror.self, from: flagsData) {
            deletedTimestamps = bundle.deletedItemTimestamps
            completionFlags = bundle.completionFlags
            subTaskFlags = bundle.subTaskCompletionFlags
            verifiedFlags = bundle.parentVerifiedFlags
            verifiedSubFlags = bundle.parentVerifiedSubTaskFlags
        }

        let token = UserDefaults.standard.string(forKey: "weekly_schedule_vercel_blob_token_v1") ?? VercelBlobSyncService.defaultToken
        let family = UserDefaults.standard.string(forKey: "weekly_schedule_family_code_v1") ?? VercelBlobSyncService.defaultFamilyCode
        let deviceId = UserDefaults.standard.string(forKey: "weekly_schedule_device_id_v1") ?? "app"

        return WidgetSharedState(
            updatedAt: Date().timeIntervalSince1970,
            vercelBlobToken: token,
            familyCode: family,
            deviceId: deviceId,
            deviceRoleShortTitle: "👦 아이",
            items: decodedItems,
            deletedItemTimestamps: deletedTimestamps,
            weeklyOverrides: overrides,
            completionFlags: completionFlags,
            subTaskCompletionFlags: subTaskFlags,
            parentVerifiedFlags: verifiedFlags,
            parentVerifiedSubTaskFlags: verifiedSubFlags
        )
    }
}
