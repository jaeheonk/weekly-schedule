import Foundation
#if os(iOS)
import BackgroundTasks

/// iOS Background App Refresh (BGAppRefreshTask) 관리 매니저
/// - 시스템이 주기적으로 백그라운드에서 앱을 깨워 Vercel Blob 클라우드 시간표를 동기화하고
///   새로 등록·수정된 일정의 로컬 알림을 최신 상태로 유지합니다.
@MainActor
final class BackgroundRefreshManager {
    static let shared = BackgroundRefreshManager()
    nonisolated static let taskIdentifier = "com.jae.weeklyschedule.app.refresh"

    weak var store: ScheduleStore?

    private init() {}

    /// 앱 실행 초기(App init)에 반드시 호출되어 시스템에 태스크 식별자를 등록해야 합니다.
    nonisolated func register() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.taskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            Task { @MainActor in
                BackgroundRefreshManager.shared.handleAppRefresh(task: refreshTask)
            }
        }
    }

    /// 다음 백그라운드 새로고침 요청 등록
    /// - iOS 시스템에게 최소 15~30분 뒤 백그라운드 실행을 요청합니다.
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
        // iOS 권장 최소 간격: 15분 후
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)

        do {
            try BGTaskScheduler.shared.submit(request)
            #if DEBUG
            print("[BackgroundRefresh] Successfully submitted BGAppRefreshTaskRequest. Earliest: \(request.earliestBeginDate?.description ?? "nil")")
            #endif
        } catch {
            #if DEBUG
            print("[BackgroundRefresh] Failed to submit BGAppRefreshTaskRequest: \(error.localizedDescription)")
            #endif
        }
    }

    /// 시스템에 의해 백그라운드에서 앱이 깨어났을 때 호출되는 핸들러
    private func handleAppRefresh(task: BGAppRefreshTask) {
        // 다음 백그라운드 새로고침 스케줄을 먼저 예약
        scheduleAppRefresh()

        let syncTask = Task { @MainActor in
            guard let store = self.store else {
                task.setTaskCompleted(success: false)
                return
            }

            // 클라우드에서 최신 시간표 스냅샷 확인 및 알림 재스케줄링
            await store.syncNow(forceUploadIfEmpty: false)
            task.setTaskCompleted(success: true)
        }

        // iOS 시스템이 주어진 실행 시간을 초과할 경우 안전하게 작업 중단
        task.expirationHandler = {
            syncTask.cancel()
            task.setTaskCompleted(success: false)
        }
    }
}
#else
// macOS 지원용 더미 스텁
@MainActor
final class BackgroundRefreshManager {
    static let shared = BackgroundRefreshManager()
    weak var store: ScheduleStore?
    private init() {}
    nonisolated func register() {}
    func scheduleAppRefresh() {}
}
#endif
