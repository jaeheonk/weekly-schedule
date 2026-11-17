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
    let requiresServerURL: Bool = false

    private var blobs: [(item: VercelBlobItem, snapshot: CloudSyncSnapshot)] = []
    private var counter: Int64 = 1_794_740_000_000

    var shouldFailUploads = false
    var shouldFailFetches = false
    var uploadDelayNanoseconds: UInt64 = 0
    var onBeforeUpload: (() async -> Void)?
    private(set) var fetchCount: Int = 0
    private(set) var uploadCount: Int = 0

    func seed(snapshot: CloudSyncSnapshot, deviceId: String = "seed") {
        counter += 100
        let padded = String(format: "%014lld", counter)
        let pathname = "families/\(snapshot.familyCode)/state-\(padded)-\(deviceId).json"
        let item = VercelBlobItem(
            url: "redis://ws:family:\(snapshot.familyCode):latest#\(pathname)",
            pathname: pathname,
            size: 1024,
            uploadedAt: nil
        )
        blobs = [(item: item, snapshot: snapshot)]
    }

    func latestSnapshot() -> CloudSyncSnapshot? {
        blobs.sorted { $0.item.pathname > $1.item.pathname }.first?.snapshot
    }

    func fetchLatestSnapshot(
        serverURL: String,
        familyCode: String
    ) async throws -> SyncLatestResponse {
        fetchCount += 1
        if shouldFailFetches { throw MockSyncError.transientNetworkFailure }
        let sorted = blobs.sorted { $0.item.pathname > $1.item.pathname }
        return SyncLatestResponse(
            latest: sorted.first?.item,
            snapshot: sorted.first?.snapshot,
            allBlobs: sorted.map { $0.item }
        )
    }

    func uploadSnapshot(
        _ snapshot: CloudSyncSnapshot,
        serverURL: String,
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
        let url = "redis://ws:family:\(familyCode):latest#\(pathname)"
        let item = VercelBlobItem(url: url, pathname: pathname, size: 2048, uploadedAt: nil)

        let deletePathnames = Set(previousBlobsToDelete.map { $0.pathname })
        blobs.removeAll { deletePathnames.contains($0.item.pathname) }
        blobs.append((item: item, snapshot: snapshot))

        return VercelBlobPutResponse(url: url, pathname: pathname)
    }
}

// MARK: - Mock URLProtocol for HTTP Proxy Tests
final class MockSyncURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest, Data?) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: MockSyncError.transientNetworkFailure)
            return
        }
        let bodyData = request.httpBody ?? Self.readBodyStream(request.httpBodyStream)
        do {
            let (response, data) = try handler(request, bodyData)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    private static func readBodyStream(_ stream: InputStream?) -> Data? {
        guard let stream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read > 0 {
                data.append(buffer, count: read)
            } else {
                break
            }
        }
        return data
    }
}

@MainActor
func makeIsolatedStore(
    role: DeviceRole,
    transport: CloudSyncTransport,
    suiteSuffix: String = UUID().uuidString,
    syncPollingInterval: TimeInterval = ScheduleStore.foregroundSyncInterval
) -> ScheduleStore {
    let suiteName = "com.weeklyschedule.tests.\(suiteSuffix)"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    let store = ScheduleStore(
        userDefaults: defaults,
        syncTransport: transport,
        enableSystemSideEffects: false,
        autoStartBackgroundTasks: false,
        syncPollingInterval: syncPollingInterval
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

@MainActor
func testUpstashProxySyncServiceAndEmptyURLHandling() async {
    print("Running Scenario 6: Vercel /api/sync Upstash proxy transport, empty server URL, and WidgetSharedState backward compatibility...")

    // 1. URL normalization & error validation
    assertEqual(
        VercelBlobSyncService.normalizeServerURL("  https://weekly.vercel.app/api/sync/  "),
        "https://weekly.vercel.app",
        "Should strip trailing /api/sync and slashes"
    )
    assertEqual(VercelBlobSyncService.defaultServerURL, "https://weekly-schedule-six-seven.vercel.app", "Default server URL must point to weekly-schedule-six-seven.vercel.app")

    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockSyncURLProtocol.self]
    let mockSession = URLSession(configuration: config)
    let service = VercelBlobSyncService(session: mockSession)

    // Missing URL error
    do {
        _ = try await service.fetchLatestSnapshot(serverURL: "   ", familyCode: "family-main")
        assertTrue(false, "Expected missingServerURL error")
    } catch let error as VercelBlobSyncError {
        if case .missingServerURL = error {} else {
            assertTrue(false, "Expected missingServerURL, got \(error)")
        }
    } catch {
        assertTrue(false, "Unexpected error: \(error)")
    }

    // Invalid URL error
    do {
        _ = try await service.fetchLatestSnapshot(serverURL: "not-a-valid-url", familyCode: "family-main")
        assertTrue(false, "Expected invalidURL error")
    } catch let error as VercelBlobSyncError {
        if case .invalidURL = error {} else {
            assertTrue(false, "Expected invalidURL, got \(error)")
        }
    } catch {
        assertTrue(false, "Unexpected error: \(error)")
    }

    // 2. Single-round-trip /api/sync/latest and /api/sync/upload round-trip
    let seededSnapshot = makeSeededSnapshot(earnedHearts: 42, redemptions: [])
    var capturedPaths: [String] = []
    MockSyncURLProtocol.handler = { request, bodyData in
        let url = request.url!
        capturedPaths.append("\(request.httpMethod ?? "") \(url.path)")

        if url.path == "/api/sync/latest" {
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let familyQuery = components?.queryItems?.first(where: { $0.name == "familyCode" })?.value
            assertEqual(familyQuery, "my-family", "familyCode query param should be sanitized")

            let blobItem = VercelBlobItem(
                url: "redis://ws:family:my-family:latest#families/my-family/state-0001-seed.json",
                pathname: "families/my-family/state-0001-seed.json",
                size: 512,
                uploadedAt: "2026-01-01T00:00:00.000Z"
            )
            let responsePayload = SyncLatestResponse(
                latest: blobItem,
                snapshot: seededSnapshot,
                allBlobs: [blobItem]
            )
            let data = try JSONEncoder().encode(responsePayload)
            let http = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (http, data)
        } else if url.path == "/api/sync/upload" {
            guard let bodyData,
                  let json = try JSONSerialization.jsonObject(with: bodyData) as? [String: Any] else {
                assertTrue(false, "Upload request must carry JSON body")
                throw MockSyncError.transientNetworkFailure
            }
            assertEqual(json["familyCode"] as? String, "my-family")
            assertEqual(json["shortDeviceId"] as? String, "dev123")
            let putRes = VercelBlobPutResponse(
                url: "redis://ws:family:my-family:latest#families/my-family/state-0002-dev123.json",
                pathname: "families/my-family/state-0002-dev123.json"
            )
            let data = try JSONEncoder().encode(putRes)
            let http = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (http, data)
        } else {
            let errData = try JSONSerialization.data(withJSONObject: ["error": "Unexpected route"])
            let http = HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil)!
            return (http, errData)
        }
    }

    let latestRes = try! await service.fetchLatestSnapshot(
        serverURL: "https://sync.example.com/api/sync/",
        familyCode: "My-Family!"
    )
    assertEqual(latestRes.latest?.url, "redis://ws:family:my-family:latest#families/my-family/state-0001-seed.json")
    assertEqual(latestRes.snapshot?.praiseNotes.first?.hearts, 42)

    let uploadRes = try! await service.uploadSnapshot(
        seededSnapshot,
        serverURL: "https://sync.example.com",
        familyCode: "My-Family!",
        shortDeviceId: "dev123",
        previousBlobsToDelete: latestRes.allBlobs
    )
    assertEqual(uploadRes.pathname, "families/my-family/state-0002-dev123.json")
    assertEqual(capturedPaths, ["GET /api/sync/latest", "POST /api/sync/upload"])

    // Server { "error": "..." } propagation
    MockSyncURLProtocol.handler = { request, _ in
        let errData = try JSONSerialization.data(withJSONObject: ["error": "Redis unavailable"])
        let http = HTTPURLResponse(url: request.url!, statusCode: 503, httpVersion: nil, headerFields: nil)!
        return (http, errData)
    }
    do {
        _ = try await service.fetchLatestSnapshot(serverURL: "https://sync.example.com", familyCode: "family-main")
        assertTrue(false, "Expected httpError")
    } catch let error as VercelBlobSyncError {
        if case .httpError(let code, let message) = error {
            assertEqual(code, 503)
            assertEqual(message, "Redis unavailable")
        } else {
            assertTrue(false, "Expected httpError, got \(error)")
        }
    } catch {
        assertTrue(false, "Unexpected error: \(error)")
    }

    // 3. ScheduleStore with VercelBlobSyncService & default server URL
    var requestHosts: [String] = []
    MockSyncURLProtocol.handler = { request, _ in
        if let host = request.url?.host {
            requestHosts.append(host)
        }
        let emptyPayload = SyncLatestResponse(latest: nil, snapshot: nil, allBlobs: [])
        let data = try JSONEncoder().encode(emptyPayload)
        let http = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        return (http, data)
    }

    let realStore = makeIsolatedStore(role: .parent, transport: service)
    assertEqual(realStore.syncServerURL, "https://weekly-schedule-six-seven.vercel.app", "ScheduleStore starts with default server URL")
    assertEqual(realStore.isSyncServerConfigured, true)

    await realStore.syncNow(forceUploadIfEmpty: false)
    assertTrue(requestHosts.contains("weekly-schedule-six-seven.vercel.app"), "Default sync should target weekly-schedule-six-seven.vercel.app")

    // If syncServerURL is explicitly empty, background sync skips without error and manual sync informs user
    let countBeforeEmpty = requestHosts.count
    realStore.syncServerURL = ""
    await realStore.syncNow(forceUploadIfEmpty: false)
    assertEqual(requestHosts.count, countBeforeEmpty, "Background sync must skip network call when server URL is empty")
    assertTrue(realStore.syncErrorMessage == nil, "Background skip must not surface error banner")

    await realStore.syncNow(forceUploadIfEmpty: true)
    assertEqual(requestHosts.count, countBeforeEmpty, "Manual sync without URL must not make network call")
    assertTrue(realStore.syncErrorMessage != nil, "Manual sync without URL should inform user")

    // Configure server URL -> sync succeeds
    MockSyncURLProtocol.handler = { request, _ in
        if request.url!.path == "/api/sync/latest" {
            let res = SyncLatestResponse(
                latest: VercelBlobItem(
                    url: "redis://ws:family:family-main:latest#families/family-main/state-0001-seed.json",
                    pathname: "families/family-main/state-0001-seed.json",
                    size: 512,
                    uploadedAt: nil
                ),
                snapshot: seededSnapshot,
                allBlobs: []
            )
            let data = try JSONEncoder().encode(res)
            let http = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (http, data)
        }
        let putRes = VercelBlobPutResponse(
            url: "redis://ws:family:family-main:latest#families/family-main/state-0002.json",
            pathname: "families/family-main/state-0002.json"
        )
        let data = try JSONEncoder().encode(putRes)
        let http = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        return (http, data)
    }

    realStore.updateSyncSettings(serverURL: "https://sync.example.com/", familyCode: "family-main")
    assertEqual(realStore.syncServerURL, "https://sync.example.com")
    assertEqual(realStore.isSyncServerConfigured, true)
    await realStore.syncNow(forceUploadIfEmpty: true)
    assertTrue(realStore.syncErrorMessage == nil, "Configured server URL should clear sync error")
    assertEqual(realStore.availableHearts, 42, "Store should merge snapshot from Upstash proxy")

    // 4. WidgetSharedState legacy Codable backward compatibility
    let legacyJSON = """
    {
        "updatedAt": 1794000000,
        "vercelBlobToken": "vercel_blob_rw_legacy_secret",
        "familyCode": "family-main",
        "deviceId": "widget-1",
        "deviceRoleShortTitle": "👦 아이",
        "items": [],
        "deletedItemTimestamps": {},
        "weeklyOverrides": {},
        "completionFlags": {},
        "subTaskCompletionFlags": {},
        "parentVerifiedFlags": {},
        "parentVerifiedSubTaskFlags": {}
    }
    """.data(using: .utf8)!
    let decodedWidgetState = try! JSONDecoder().decode(WidgetSharedState.self, from: legacyJSON)
    assertEqual(decodedWidgetState.syncServerURL, "https://weekly-schedule-six-seven.vercel.app", "Legacy vercelBlobToken JSON must decode cleanly with default syncServerURL")
    assertEqual(decodedWidgetState.familyCode, "family-main")

    MockSyncURLProtocol.handler = nil
    print("✅ Scenario 6 passed!")
}

@MainActor
func testForegroundOnlyPollingImmediateReturnAndImmediatePush() async {
    print("Running Scenario 7: Foreground-only 60s polling, immediate return check, no background checks, and immediate push...")
    assertEqual(ScheduleStore.foregroundSyncInterval, 60, "Default foreground sync polling interval must be 60 seconds")

    let transport = InMemoryCloudSyncTransport()
    transport.seed(snapshot: makeSeededSnapshot(earnedHearts: 10, redemptions: []))

    let store = makeIsolatedStore(
        role: .parent,
        transport: transport,
        syncPollingInterval: 0.08
    )

    // Starts inactive with no timer and no background checks
    assertEqual(store.isForegroundSyncActive, false)
    assertEqual(store.isSyncTimerActive, false)
    try? await Task.sleep(nanoseconds: 120_000_000)
    assertEqual(transport.fetchCount, 0, "Inactive store must not poll in background")

    // Activate foreground: immediate check once + timer starts and polls while active
    store.setForegroundSyncActive(true)
    assertEqual(store.isForegroundSyncActive, true)
    assertEqual(store.isSyncTimerActive, true)
    try? await Task.sleep(nanoseconds: 40_000_000)
    assertTrue(transport.fetchCount >= 1, "Activating foreground must trigger an immediate check")

    let countAfterInitialActive = transport.fetchCount
    try? await Task.sleep(nanoseconds: 130_000_000)
    assertTrue(transport.fetchCount > countAfterInitialActive, "Foreground timer must continue polling while active")

    // Deactivate (background / screen off): timer stops and 0 background checks occur
    store.setForegroundSyncActive(false)
    assertEqual(store.isForegroundSyncActive, false)
    assertEqual(store.isSyncTimerActive, false)
    let countWhenBackgrounded = transport.fetchCount
    try? await Task.sleep(nanoseconds: 150_000_000)
    assertEqual(transport.fetchCount, countWhenBackgrounded, "Deactivated store must perform zero checks in background")

    // Return to foreground: immediate check once + timer restarts
    store.setForegroundSyncActive(true)
    assertEqual(store.isSyncTimerActive, true)
    try? await Task.sleep(nanoseconds: 40_000_000)
    assertTrue(transport.fetchCount > countWhenBackgrounded, "Returning to foreground must immediately check cloud once")

    // Local mutation pushes immediately without 0.35s debounce wait
    let uploadsBeforeMutation = transport.uploadCount
    store.sendFamilyPraise(hearts: 5, sticker: .star, message: "즉시 업로드 테스트")
    try? await Task.sleep(nanoseconds: 50_000_000)
    assertTrue(transport.uploadCount > uploadsBeforeMutation, "Local mutation must upload immediately without 0.35s wait")

    store.setForegroundSyncActive(false)
    print("✅ Scenario 7 passed!")
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
        await testUpstashProxySyncServiceAndEmptyURLHandling()
        await testForegroundOnlyPollingImmediateReturnAndImmediatePush()
        print("🎉 ALL CloudSyncDesyncTests PASSED!")
    }
}
