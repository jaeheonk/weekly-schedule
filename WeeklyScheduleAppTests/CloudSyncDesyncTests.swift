import Foundation

// MARK: - Test Assertions
func assertTrue(_ condition: @autoclosure () -> Bool, _ message: String = "", file: StaticString = #file, line: UInt = #line) {
    if !condition() {
        print("❌ FAIL at \(file):\(line): \(message)")
        exit(1)
    }
}

func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String = "", file: StaticString = #file, line: UInt = #line) {
    if actual != expected {
        print("❌ FAIL at \(file):\(line): expected [\(expected)], got [\(actual)]. \(message)")
        exit(1)
    }
}

// MARK: - In-Memory Cloud Sync Mock
enum MockSyncError: LocalizedError {
    case transientNetworkFailure
    var errorDescription: String? { "Mock transient network failure" }
}

@MainActor
final class InMemoryCloudSyncTransport: CloudSyncTransport {
    private var blobs: [(item: VercelBlobItem, snapshot: CloudSyncSnapshot)] = []
    private var counter: Int64 = 1_794_740_000_000

    var shouldFailUploads = false
    var shouldFailFetches = false
    var uploadDelayNanoseconds: UInt64 = 0
    var onBeforeUpload: (() async -> Void)?
    private(set) var uploadCount: Int = 0

    func seed(snapshot: CloudSyncSnapshot, deviceId: String = "seed") {
        counter += 100
        let padded = String(format: "%014lld", counter)
        let pathname = "families/\(snapshot.familyCode)/state-\(padded)-\(deviceId).json"
        let item = VercelBlobItem(url: "https://mock.blob/\(pathname)", pathname: pathname, size: 1024, uploadedAt: nil)
        blobs = [(item: item, snapshot: snapshot)]
    }

    func latestSnapshot() -> CloudSyncSnapshot? {
        blobs.sorted { $0.item.pathname > $1.item.pathname }.first?.snapshot
    }

    func fetchLatestBlobMetadata(token: String, familyCode: String) async throws -> (latest: VercelBlobItem?, allBlobs: [VercelBlobItem]) {
        if shouldFailFetches { throw MockSyncError.transientNetworkFailure }
        let sorted = blobs.map { $0.item }.sorted { $0.pathname > $1.pathname }
        return (sorted.first, sorted)
    }

    func downloadSnapshot(from blobURLString: String, token: String) async throws -> CloudSyncSnapshot {
        if shouldFailFetches { throw MockSyncError.transientNetworkFailure }
        guard let snapshot = blobs.first(where: { $0.item.url == blobURLString })?.snapshot else {
            throw VercelBlobSyncError.invalidURL
        }
        return snapshot
    }

    func uploadSnapshot(
        _ snapshot: CloudSyncSnapshot,
        token: String,
        familyCode: String,
        shortDeviceId: String,
        previousBlobsToDelete: [VercelBlobItem]
    ) async throws -> VercelBlobPutResponse {
        if let hook = onBeforeUpload {
            await hook()
        }
        if uploadDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: uploadDelayNanoseconds)
        }

        if shouldFailUploads {
            throw MockSyncError.transientNetworkFailure
        }

        uploadCount += 1
        counter += 100
        let padded = String(format: "%014lld", counter)
        let pathname = "families/\(familyCode)/state-\(padded)-\(shortDeviceId).json"
        let url = "https://mock.blob/\(pathname)"
        let item = VercelBlobItem(url: url, pathname: pathname, size: 2048, uploadedAt: nil)

        let deleteUrls = Set(previousBlobsToDelete.map { $0.url })
        blobs.removeAll { deleteUrls.contains($0.item.url) }
        blobs.append((item: item, snapshot: snapshot))

        return VercelBlobPutResponse(url: url, pathname: pathname)
    }
}

@MainActor
func makeIsolatedStore(
    role: DeviceRole,
    transport: InMemoryCloudSyncTransport,
    suiteSuffix: String = UUID().uuidString
) -> ScheduleStore {
    let suiteName = "com.weeklyschedule.tests.\(suiteSuffix)"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    let store = ScheduleStore(
        userDefaults: defaults,
        syncTransport: transport,
        enableSystemSideEffects: false,
        autoStartBackgroundTasks: false
    )
    store.setDeviceRole(role)
    return store
}

@MainActor
func makeSeededSnapshot(earnedHearts: Int, redemptions: [HeartRewardRedemption]) -> CloudSyncSnapshot {
    let note = ParentPraiseNote(
        id: UUID(uuidString: "11111111-2222-3333-4444-555555555555")!,
        hearts: earnedHearts,
        sticker: .heart,
        message: "초기 시드 하트",
        createdAt: 1_794_000_000
    )
    return CloudSyncSnapshot(
        schemaVersion: 5,
        familyCode: "family-main",
        updatedAt: 1_794_000_100,
        updatedByRole: "👩👨 부모님 폰",
        updatedByDeviceId: "seed-parent",
        parentPinCode: "160125",
        parentPinUpdatedAt: 1_700_000_000,
        items: DefaultScheduleData.makeDefaultItems(),
        deletedItemTimestamps: [:],
        weeklyOverrides: [:],
        completionFlags: [:],
        subTaskCompletionFlags: [:],
        parentVerifiedFlags: [:],
        parentVerifiedSubTaskFlags: [:],
        itemReactions: [:],
        praiseNotes: [note],
        rewardRedemptions: redemptions,
        archivedEarnedHearts: 0,
        rewardPresets: RewardPreset.defaultPresets,
        deletedRewardPresetTimestamps: [:]
    )
}

@MainActor
func testStrandedPushAfterTransientFailureAndRemoteOverwrite() async {
    print("Running Scenario 1: Stranded 10-heart redemption after push failure + subsequent remote sync...")
    let transport = InMemoryCloudSyncTransport()
    let initialRedemption = HeartRewardRedemption(
        id: UUID(uuidString: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")!,
        title: "기존 보상",
        hearts: 10,
        createdAt: 1_794_600_000,
        redeemedByRole: "👩👨 부모님 폰"
    )
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 35, redemptions: [initialRedemption]))

    let parentStore = makeIsolatedStore(role: .parent, transport: transport)
    let childStore = makeIsolatedStore(role: .child, transport: transport)

    await parentStore.syncNow(forceUploadIfEmpty: false)
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(parentStore.availableHearts, 25, "Parent initial synced hearts")
    assertEqual(childStore.availableHearts, 25, "Child initial synced hearts")

    // Parent redeems 10 hearts while upload fails (e.g. network drop or background suspension)
    transport.shouldFailUploads = true
    let redeemed = parentStore.redeemReward(title: "자유 놀이 / 게임 15분", hearts: 10)
    assertTrue(redeemed, "Redemption should succeed locally")
    assertEqual(parentStore.availableHearts, 15, "Parent local hearts should immediately be 15")

    // Simulate failed debounced flush
    await parentStore.flushPendingPush()

    // Network recovers, and another device (e.g. Web or Child) uploads a 25-heart snapshot
    transport.shouldFailUploads = false
    await childStore.pushImmediateToCloud()

    // Now Parent triggers manual/periodic sync (pullLatestFromCloud / syncNow)
    await parentStore.syncNow(forceUploadIfEmpty: false)
    // And Child pulls latest from cloud
    await childStore.syncNow(forceUploadIfEmpty: false)

    assertEqual(parentStore.availableHearts, 15, "Parent should still have 15 hearts")
    assertEqual(childStore.availableHearts, 15, "Child MUST converge to 15 hearts after Parent syncs!")
    print("✅ Scenario 1 passed!")
}

@MainActor
func testCancelledRedemptionDoesNotResurrectAcrossDevices() async {
    print("Running Scenario 2: Cancelled redemption tombstone across devices...")
    let transport = InMemoryCloudSyncTransport()
    let r1 = HeartRewardRedemption(
        id: UUID(uuidString: "BBBBBBBB-CCCC-DDDD-EEEE-FFFFFFFFFFFF")!,
        title: "취소할 보상",
        hearts: 10,
        createdAt: 1_794_650_000,
        redeemedByRole: "👩👨 부모님 폰"
    )
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 25, redemptions: [r1]))

    let parentStore = makeIsolatedStore(role: .parent, transport: transport)
    let childStore = makeIsolatedStore(role: .child, transport: transport)

    await parentStore.syncNow(forceUploadIfEmpty: false)
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(parentStore.availableHearts, 15)
    assertEqual(childStore.availableHearts, 15)

    // Parent cancels the redemption -> 25 hearts
    parentStore.cancelRedemption(r1)
    assertEqual(parentStore.availableHearts, 25)
    await parentStore.flushPendingPush()

    // Child syncs (still holding r1 locally before pulling)
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(childStore.availableHearts, 25, "Child must drop cancelled redemption instead of resurrecting it!")
    print("✅ Scenario 2 passed!")
}

@MainActor
func testRedemptionArchiveBeyondFiftyPreservesSpentHearts() async {
    print("Running Scenario 3: >50 rewardRedemptions archives spent hearts without granting free hearts...")
    let transport = InMemoryCloudSyncTransport()
    var fiftyRedemptions: [HeartRewardRedemption] = []
    for i in 0..<50 {
        fiftyRedemptions.append(
            HeartRewardRedemption(
                id: UUID(),
                title: "보상 #\(i)",
                hearts: 10,
                createdAt: 1_794_000_000 + Double(i * 100),
                redeemedByRole: "👩👨 부모님 폰"
            )
        )
    }
    // 525 earned - 500 spent = 25 available
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 525, redemptions: fiftyRedemptions))

    let parentStore = makeIsolatedStore(role: .parent, transport: transport)
    let childStore = makeIsolatedStore(role: .child, transport: transport)
    await parentStore.syncNow(forceUploadIfEmpty: false)
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(parentStore.availableHearts, 25)

    // Redeem 51st reward (10 hearts) -> MUST become 15, NOT stay 25!
    let ok = parentStore.redeemReward(title: "51번째 보상", hearts: 10)
    assertTrue(ok)
    assertEqual(parentStore.availableHearts, 15, "51st redemption must leave 15 hearts, not drop oldest 10!")

    await parentStore.flushPendingPush()
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(childStore.availableHearts, 15, "Child must also show 15 hearts after syncing >50 redemptions!")
    print("✅ Scenario 3 passed!")
}

@MainActor
func testPreExistingStrandedUserDefaultsHealsWithoutPendingFlagAndConvergesWithoutPingPong() async {
    print("Running Scenario 1B/1C: Pre-existing stranded UserDefaults heals on sync without upload ping-pong...")
    let transport = InMemoryCloudSyncTransport()
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 25, redemptions: []))

    let suiteName = "com.weeklyschedule.tests.legacy.\(UUID().uuidString)"
    let legacyDefaults = UserDefaults(suiteName: suiteName)!
    legacyDefaults.removePersistentDomain(forName: suiteName)

    let strandedRedemption = HeartRewardRedemption(
        id: UUID(uuidString: "CCCCCCCC-DDDD-EEEE-FFFF-111111111111")!,
        title: "미리 차감된 보상",
        hearts: 10,
        createdAt: 1_794_654_678,
        redeemedByRole: "👩👨 부모님 폰"
    )
    let praiseNote = ParentPraiseNote(
        id: UUID(uuidString: "11111111-2222-3333-4444-555555555555")!,
        hearts: 25,
        sticker: .heart,
        message: "초기 시드 하트",
        createdAt: 1_794_000_000
    )
    legacyDefaults.set(try! JSONEncoder().encode([praiseNote]), forKey: "weekly_schedule_praise_notes_v1")
    legacyDefaults.set(try! JSONEncoder().encode([strandedRedemption]), forKey: "weekly_schedule_reward_redemptions_v1")
    legacyDefaults.set(try! JSONEncoder().encode(DefaultScheduleData.makeDefaultItems()), forKey: "weekly_schedule_items_v1")
    legacyDefaults.set("parent", forKey: "weekly_schedule_device_role_v1")
    legacyDefaults.set(true, forKey: "weekly_schedule_device_role_confirmed_v1")
    // Note: weekly_schedule_pending_cloud_push_v1 is intentionally NOT set (simulates pre-fix app data)

    let parentStore = ScheduleStore(
        userDefaults: legacyDefaults,
        syncTransport: transport,
        enableSystemSideEffects: false,
        autoStartBackgroundTasks: false
    )
    let childStore = makeIsolatedStore(role: .child, transport: transport)

    assertEqual(parentStore.availableHearts, 15, "Parent starts with legacy stranded 15 hearts")
    let initialUploads = transport.uploadCount

    // Parent syncs once -> must detect post-merge divergence vs 25-heart cloud and auto-upload 15-heart state!
    await parentStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(transport.uploadCount, initialUploads + 1, "Parent must auto-upload post-merge divergence")
    assertEqual(parentStore.availableHearts, 15)

    // Child syncs -> must converge to 15 without re-uploading!
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(childStore.availableHearts, 15, "Child must converge to 15 hearts")
    assertEqual(transport.uploadCount, initialUploads + 1, "Child must NOT ping-pong upload after converging")

    // Subsequent syncs on already-converged devices must produce ZERO uploads
    await parentStore.syncNow(forceUploadIfEmpty: false)
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(transport.uploadCount, initialUploads + 1, "Converged devices must NOT upload on repeat sync")
    print("✅ Scenario 1B/1C passed!")
}

@MainActor
func testInFlightMutationDuringUploadIsNotDropped() async {
    print("Running Scenario 4: In-flight mutation during upload is serialized and preserved...")
    let transport = InMemoryCloudSyncTransport()
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 35, redemptions: []))

    let parentStore = makeIsolatedStore(role: .parent, transport: transport)
    let childStore = makeIsolatedStore(role: .child, transport: transport)
    await parentStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(parentStore.availableHearts, 35)

    assertTrue(parentStore.redeemReward(title: "1차 교환", hearts: 10))
    var injectedSecondMutation = false
    transport.onBeforeUpload = { @MainActor in
        if !injectedSecondMutation {
            injectedSecondMutation = true
            // Trigger a second mutation right while the first upload is in flight!
            _ = parentStore.redeemReward(title: "2차 교환", hearts: 10)
        }
    }

    await parentStore.flushPendingPush()
    transport.onBeforeUpload = nil
    // Wait briefly so any queued debounced push or pending flush finishes
    await parentStore.flushPendingPush()

    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(parentStore.availableHearts, 15, "Parent should have 15 hearts after both mutations")
    assertEqual(childStore.availableHearts, 15, "Child MUST receive both 1차 and 2차 redemptions without losing the in-flight mutation!")
    print("✅ Scenario 4 passed!")
}

@MainActor
func testParentPhoneCompletionWithoutUnlockAndSyncsToChild() async {
    print("Running Scenario 5: Parent phone completion works without parent unlock and syncs to child...")
    let transport = InMemoryCloudSyncTransport()
    let parentStore = makeIsolatedStore(role: .parent, transport: transport)
    let childStore = makeIsolatedStore(role: .child, transport: transport)

    guard let checkableItem = parentStore.items.first(where: { $0.isCheckable && !$0.subTasks.isEmpty })
        ?? parentStore.items.first(where: { $0.isCheckable }) else {
        assertTrue(false, "Expected at least one checkable schedule item")
        return
    }

    parentStore.lockParentMode()
    assertEqual(parentStore.isParentModeUnlocked, false, "Parent phone starts locked")
    assertEqual(parentStore.toggleCompletion(for: checkableItem), true, "Parent phone can toggle completion without unlock")
    assertEqual(parentStore.isCompleted(checkableItem), true)

    if let firstSub = checkableItem.subTasks.first {
        assertEqual(
            parentStore.toggleSubTaskCompletion(firstSub, in: checkableItem),
            true,
            "Parent phone can toggle subtask completion without unlock"
        )
        assertEqual(parentStore.isSubTaskCompleted(firstSub), false, "Toggling completed subtask should uncheck it")
        assertEqual(parentStore.isCompleted(checkableItem), false, "Parent item should uncheck when subtask is unchecked")
        assertEqual(parentStore.toggleSubTaskCompletion(firstSub, in: checkableItem), true)
    }

    await parentStore.flushPendingPush()
    await childStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(childStore.isCompleted(checkableItem), true, "Child phone should receive parent's completion check")
    print("✅ Scenario 5 passed!")
}

@main
struct CloudSyncDesyncTestRunner {
    static func main() async {
        await testStrandedPushAfterTransientFailureAndRemoteOverwrite()
        await testCancelledRedemptionDoesNotResurrectAcrossDevices()
        await testRedemptionArchiveBeyondFiftyPreservesSpentHearts()
        await testPreExistingStrandedUserDefaultsHealsWithoutPendingFlagAndConvergesWithoutPingPong()
        await testInFlightMutationDuringUploadIsNotDropped()
        await testParentPhoneCompletionWithoutUnlockAndSyncsToChild()
        print("🎉 ALL CloudSyncDesyncTests PASSED!")
    }
}
