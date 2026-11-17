import Foundation
#if os(iOS)
import BackgroundTasks

/// 백그라운드 클라우드 확인 비활성화 매니저
/// - 백그라운드에서는 클라우드를 확인하지 않으며, 이전 버전에서 예약된 BGAppRefreshTask 요청만 안전하게 취소합니다.
@MainActor
final class BackgroundRefreshManager {
    static let shared = BackgroundRefreshManager()

    private init() {}

    /// 기존에 시스템에 예약되어 있던 모든 백그라운드 새로고침 요청 취소
    nonisolated func cancelAllPendingRefreshes() {
        BGTaskScheduler.shared.cancelAllTaskRequests()
    }
}
#else
// macOS 지원용 더미 스텁
@MainActor
final class BackgroundRefreshManager {
    static let shared = BackgroundRefreshManager()
    private init() {}
    nonisolated func cancelAllPendingRefreshes() {}
}
#endif
