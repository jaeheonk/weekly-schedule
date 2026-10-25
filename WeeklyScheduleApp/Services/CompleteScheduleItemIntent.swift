import Foundation
#if canImport(AppIntents)
import AppIntents

/// iOS 홈 화면 '오늘의 할 일' 인터랙티브 위젯에서 원형 체크 버튼을 탭했을 때
/// 즉시 해당 일정을 완료(`다 했어요`) 처리하고 위젯 타임라인 및 클라우드를 갱신하는 AppIntent
struct CompleteScheduleItemIntent: AppIntent {
    static var title: LocalizedStringResource = "할 일 완료 체크"
    static var description = IntentDescription("오늘의 할 일 항목을 '다 했어요' 완료 상태로 체크하고 위젯 목록에서 숨깁니다.")
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "일정 ID")
    var itemId: String

    @Parameter(title: "주차 키")
    var weekKey: String?

    init() {
        self.itemId = ""
        self.weekKey = nil
    }

    init(itemId: String, weekKey: String? = nil) {
        self.itemId = itemId
        self.weekKey = weekKey
    }

    func perform() async throws -> some IntentResult {
        guard let uuid = UUID(uuidString: itemId) else {
            return .result()
        }
        await ScheduleWidgetDataManager.shared.handleWidgetCompleteIntent(
            itemId: uuid,
            weekKey: weekKey
        )
        return .result()
    }
}
#endif
