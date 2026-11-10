import Foundation
import SwiftUI

// MARK: - Weekday
enum Weekday: Int, CaseIterable, Codable, Identifiable {
    case monday = 1
    case tuesday = 2
    case wednesday = 3
    case thursday = 4
    case friday = 5
    case saturday = 6
    case sunday = 7

    var id: Int { rawValue }

    var shortName: String {
        switch self {
        case .monday: return "월"
        case .tuesday: return "화"
        case .wednesday: return "수"
        case .thursday: return "목"
        case .friday: return "금"
        case .saturday: return "토"
        case .sunday: return "일"
        }
    }

    var fullName: String {
        "\(shortName)요일"
    }

    /// Calendar.current.component(.weekday, from: date) uses 1 = Sunday, 2 = Monday, ..., 7 = Saturday
    var calendarWeekday: Int {
        switch self {
        case .sunday: return 1
        case .monday: return 2
        case .tuesday: return 3
        case .wednesday: return 4
        case .thursday: return 5
        case .friday: return 6
        case .saturday: return 7
        }
    }

    static func from(date: Date = Date(), calendar: Calendar = .current) -> Weekday {
        let calWeekday = calendar.component(.weekday, from: date)
        switch calWeekday {
        case 1: return .sunday
        case 2: return .monday
        case 3: return .tuesday
        case 4: return .wednesday
        case 5: return .thursday
        case 6: return .friday
        case 7: return .saturday
        default: return .monday
        }
    }

    var isWeekend: Bool {
        self == .saturday || self == .sunday
    }

    /// 평일(월~금) 스타 적립 대상 요일 목록
    static let weekdaysOnly: [Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday]
}

// MARK: - ISO-8601 Calendar & WeekKey Utilities
public enum ScheduleCalendarUtils {
    public static var iso8601Calendar: Calendar = {
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        return cal
    }()

    public static func weekKey(for date: Date = Date()) -> String {
        let cal = iso8601Calendar
        let year = cal.component(.yearForWeekOfYear, from: date)
        let week = cal.component(.weekOfYear, from: date)
        return "\(year)-W\(week)"
    }
}

// MARK: - ScheduleCategory
enum ScheduleCategory: String, CaseIterable, Codable, Identifiable {
    case study = "study"           // 공부/숙제
    case academy = "academy"       // 수업/학원
    case music = "music"           // 악기/음악
    case sports = "sports"         // 운동/체육
    case routine = "routine"       // 생활/식사/취침
    case free = "free"             // 자유/주말활동

    var id: String { rawValue }

    var title: String {
        switch self {
        case .study: return "공부·숙제"
        case .academy: return "수업·학교"
        case .music: return "악기·음악"
        case .sports: return "운동·체육"
        case .routine: return "생활·습관"
        case .free: return "자유·여가"
        }
    }

    var color: Color {
        switch self {
        case .study:
            return Color(red: 0.22, green: 0.47, blue: 0.96) // 선명한 블루
        case .academy:
            return Color(red: 0.55, green: 0.32, blue: 0.92) // 퍼플
        case .music:
            return Color(red: 0.95, green: 0.50, blue: 0.16) // 오렌지
        case .sports:
            return Color(red: 0.16, green: 0.72, blue: 0.45) // 에메랄드 그린
        case .routine:
            return Color(red: 0.90, green: 0.36, blue: 0.55) // 핑크/코랄
        case .free:
            return Color(red: 0.12, green: 0.68, blue: 0.76) // 민트/틸
        }
    }

    var softBackgroundColor: Color {
        color.opacity(0.13)
    }

    var defaultIcon: String {
        switch self {
        case .study: return "book.fill"
        case .academy: return "graduationcap.fill"
        case .music: return "music.quarternote.3"
        case .sports: return "figure.run"
        case .routine: return "sparkles"
        case .free: return "face.smiling.fill"
        }
    }

    /// 완료 체크 및 부모 확인 대상 여부 (`생활·습관` 및 `자유·여가` 항목은 체크 기능에서 제외하고 단순 일정으로만 표시)
    var isCheckable: Bool {
        self != .routine && self != .free
    }

    /// 제목 텍스트를 분석해 자동으로 어울리는 카테고리와 SF Symbol 아이콘을 추천합니다.
    static func inferCategoryAndIcon(from text: String) -> (ScheduleCategory, String) {
        let lower = text.lowercased()

        // 악기/음악
        if lower.contains("바이올린") || lower.contains("오케스트라") || lower.contains("피아노") || lower.contains("악기") {
            if lower.contains("오케스트라") {
                return (.music, "music.mic")
            }
            return (.music, "music.quarternote.3")
        }

        // 운동/체육
        if lower.contains("수영") {
            return (.sports, "figure.pool.swim")
        }
        if lower.contains("축구") {
            return (.sports, "soccerball")
        }
        if lower.contains("농구") {
            return (.sports, "basketball.fill")
        }
        if lower.contains("운동") || lower.contains("체육") || lower.contains("태권도") || lower.contains("줄넘기") {
            return (.sports, "figure.run")
        }

        // 생활/식사/취침
        if lower.contains("취침") || lower.contains("잠") {
            return (.routine, "moon.stars.fill")
        }
        if lower.contains("저녁") || lower.contains("아침") || lower.contains("점심") || lower.contains("간식") || lower.contains("식사") {
            return (.routine, "fork.knife")
        }
        if lower.contains("코딱지") || lower.contains("기상") {
            return (.routine, "sun.and.horizon.fill")
        }
        if lower.contains("하교") || lower.contains("집 도착") || lower.contains("교회") {
            return (.routine, "house.fill")
        }

        // 자유/도서관
        if lower.contains("자유시간") || lower.contains("자유") || lower.contains("휴식") || lower.contains("게임") {
            return (.free, "gamecontroller.fill")
        }

        // 수업/학교/학원
        if lower.contains("학교") {
            return (.academy, "building.columns.fill")
        }
        if lower.contains("코딩") {
            return (.academy, "laptopcomputer")
        }
        if lower.contains("faye") || lower.contains("수업") || lower.contains("학원") {
            return (.academy, "person.wave.2.fill")
        }

        // 공부/숙제
        if lower.contains("과외") {
            return (.study, "person.2.fill")
        }
        if lower.contains("도서관") || lower.contains("책") || lower.contains("사전") || lower.contains("독서") {
            return (.study, "books.vertical.fill")
        }
        if lower.contains("수학") {
            return (.study, "function")
        }
        if lower.contains("words") || lower.contains("vocabulary") || lower.contains("영어") || lower.contains("국어") {
            return (.study, "character.book.closed.fill")
        }

        return (.study, "pencil.and.list.clipboard")
    }
}

// MARK: - Notification Lead Time Options
enum NotificationLeadTime: Int, CaseIterable, Codable, Identifiable {
    case atStart = 0
    case fifteenMin = 15
    case thirtyMin = 30
    case fortyFiveMin = 45
    case sixtyMin = 60

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .atStart: return "정각"
        case .fifteenMin: return "15분 전"
        case .thirtyMin: return "30분 전"
        case .fortyFiveMin: return "45분 전"
        case .sixtyMin: return "60분 전"
        }
    }

    var shortBadge: String {
        switch self {
        case .atStart: return "정각"
        case .fifteenMin: return "-15분"
        case .thirtyMin: return "-30분"
        case .fortyFiveMin: return "-45분"
        case .sixtyMin: return "-60분"
        }
    }

    /// 알림 시간 배열을 15분 단위(0, 15, 30, 45, 60분)로 정규화합니다.
    static func normalize(_ leads: [Int]) -> [Int] {
        let validValues = Set(allCases.map(\.rawValue))
        var result = Set<Int>()
        for lead in leads {
            if validValues.contains(lead) {
                result.insert(lead)
            } else if lead > 0 {
                let snapped = Swift.min(60, Swift.max(15, ((lead + 7) / 15) * 15))
                result.insert(snapped)
            } else {
                result.insert(0)
            }
        }
        if result.isEmpty {
            result.insert(0)
        }
        return result.sorted(by: >)
    }
}

// MARK: - SubTask (세부 할 일)
struct SubTask: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String
}

// MARK: - 스케줄 변경 적용 범위 (이번 주만 조정 vs 전체(매주) 스케줄 변경)
enum ScheduleEditScope: String, CaseIterable, Codable, Identifiable {
    case thisWeek = "thisWeek"   // 오늘 스케줄에서 조정 시: 이번 주에만 적용 (다음 주 자동 원복)
    case master = "master"       // 주간 시간표에서 수정 시: 매주 반복되는 전체 기본 시간표 변경

    var id: String { rawValue }

    var title: String {
        switch self {
        case .thisWeek: return "이번 주만 조정"
        case .master: return "전체 스케줄 변경 (매주)"
        }
    }

    var shortLabel: String {
        switch self {
        case .thisWeek: return "이번 주만 조정"
        case .master: return "전체 스케줄 변경"
        }
    }

    var shortBadge: String {
        switch self {
        case .thisWeek: return "이번 주만"
        case .master: return "전체(매주)"
        }
    }

    var iconName: String {
        switch self {
        case .thisWeek: return "calendar.badge.clock"
        case .master: return "calendar"
        }
    }

    var subtitle: String {
        description
    }

    var description: String {
        switch self {
        case .thisWeek:
            return "이번 주에만 임시로 시간·요일·할 일을 조정하거나 휴강 처리합니다. 다음 주가 되면 원래 정규 시간표로 자동 복구됩니다."
        case .master:
            return "매주 반복되는 전체 기본 주간 시간표 자체를 변경합니다."
        }
    }
}

// MARK: - ScheduleItem
struct ScheduleItem: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var weekday: Weekday
    var startHour: Int
    var startMinute: Int
    var endHour: Int
    var endMinute: Int
    var title: String
    var note: String
    var category: ScheduleCategory
    var iconName: String
    var subTasks: [SubTask]
    var isNotificationEnabled: Bool
    /// 시작 몇 분 전에 알림을 울릴지 (예: [15, 0] -> 15분 전 및 정각)
    var notificationLeadMinutes: [Int]
    /// nil이면 매주 반복되는 '전체(정규) 스케줄', 특정 주차 키(예: "2026-W42")가 들어있으면 '해당 주차에만 추가된 전용 일정'
    var targetWeekKey: String?
    /// 동기화 병합을 위한 마지막 수정 시각 (Unix epoch seconds)
    var updatedAt: TimeInterval

    enum CodingKeys: String, CodingKey {
        case id, weekday, startHour, startMinute, endHour, endMinute
        case title, note, category, iconName, subTasks
        case isNotificationEnabled, notificationLeadMinutes, targetWeekKey, updatedAt
    }

    init(
        id: UUID = UUID(),
        weekday: Weekday,
        startHour: Int,
        startMinute: Int = 0,
        endHour: Int,
        endMinute: Int = 0,
        title: String,
        note: String = "",
        category: ScheduleCategory? = nil,
        iconName: String? = nil,
        subTasks: [SubTask] = [],
        isNotificationEnabled: Bool = false,
        notificationLeadMinutes: [Int] = [15, 0],
        targetWeekKey: String? = nil,
        updatedAt: TimeInterval = Date().timeIntervalSince1970
    ) {
        self.id = id
        self.weekday = weekday
        self.startHour = startHour
        self.startMinute = startMinute
        self.endHour = endHour
        self.endMinute = endMinute
        self.title = title
        self.note = note

        let inferred = ScheduleCategory.inferCategoryAndIcon(from: title)
        self.category = category ?? inferred.0
        self.iconName = iconName ?? inferred.1
        self.subTasks = subTasks
        self.isNotificationEnabled = isNotificationEnabled
        self.notificationLeadMinutes = NotificationLeadTime.normalize(notificationLeadMinutes)
        self.targetWeekKey = targetWeekKey
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        weekday = try container.decode(Weekday.self, forKey: .weekday)
        startHour = try container.decode(Int.self, forKey: .startHour)
        startMinute = try container.decode(Int.self, forKey: .startMinute)
        endHour = try container.decode(Int.self, forKey: .endHour)
        endMinute = try container.decode(Int.self, forKey: .endMinute)
        title = try container.decode(String.self, forKey: .title)
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        let inferred = ScheduleCategory.inferCategoryAndIcon(from: title)
        category = try container.decodeIfPresent(ScheduleCategory.self, forKey: .category) ?? inferred.0
        iconName = try container.decodeIfPresent(String.self, forKey: .iconName) ?? inferred.1
        subTasks = try container.decodeIfPresent([SubTask].self, forKey: .subTasks) ?? []
        isNotificationEnabled = try container.decodeIfPresent(Bool.self, forKey: .isNotificationEnabled) ?? false
        let leads = try container.decodeIfPresent([Int].self, forKey: .notificationLeadMinutes) ?? [15, 0]
        notificationLeadMinutes = NotificationLeadTime.normalize(leads)
        targetWeekKey = try container.decodeIfPresent(String.self, forKey: .targetWeekKey)
        updatedAt = try container.decodeIfPresent(TimeInterval.self, forKey: .updatedAt) ?? 1_700_000_000
    }

    /// 특정 주차에만 임시로 추가된 전용 일정인지 여부
    var isThisWeekOnlyAddition: Bool {
        targetWeekKey != nil
    }

    /// 원본 정규 일정과 핵심 스케줄 속성이 동일한지 비교
    func hasSameScheduleContent(as other: ScheduleItem) -> Bool {
        weekday == other.weekday &&
        startHour == other.startHour &&
        startMinute == other.startMinute &&
        endHour == other.endHour &&
        endMinute == other.endMinute &&
        title == other.title &&
        note == other.note &&
        category == other.category &&
        iconName == other.iconName &&
        subTasks.map(\.title) == other.subTasks.map(\.title) &&
        isNotificationEnabled == other.isNotificationEnabled &&
        notificationLeadMinutes == other.notificationLeadMinutes
    }

    var startTotalMinutes: Int {
        startHour * 60 + startMinute
    }

    var endTotalMinutes: Int {
        endHour * 60 + endMinute
    }

    var durationMinutes: Int {
        max(15, endTotalMinutes - startTotalMinutes)
    }

    /// 완료 체크 및 부모 확인 도장 대상 여부 (`생활·습관` 및 `자유·여가` 카테고리는 제외)
    var isCheckable: Bool {
        category.isCheckable
    }

    var timeRangeString: String {
        "\(Self.formatTime(hour: startHour, minute: startMinute)) ~ \(Self.formatTime(hour: endHour, minute: endMinute))"
    }

    var startTimeString: String {
        Self.formatTime(hour: startHour, minute: startMinute)
    }

    var endTimeString: String {
        Self.formatTime(hour: endHour, minute: endMinute)
    }

    var notificationSummaryText: String {
        guard isNotificationEnabled else { return "알림 꺼짐" }
        let sorted = notificationLeadMinutes.sorted(by: >)
        if sorted.isEmpty { return "정각 알림" }
        return sorted.map { min in
            min == 0 ? "정각" : "\(min)분 전"
        }.joined(separator: ", ")
    }

    static func formatTime(hour: Int, minute: Int) -> String {
        let period = hour < 12 ? "오전" : "오후"
        let displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        if minute == 0 {
            return "\(period) \(displayHour)시"
        } else {
            return String(format: "%@ %d:%02d", period, displayHour, minute)
        }
    }

    static func formatCompactTime(hour: Int, minute: Int) -> String {
        let period = hour < 12 ? "AM" : "PM"
        let displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        return String(format: "%d:%02d %@", displayHour, minute, period)
    }
}

// MARK: - 주차별 임시 스케줄 조정 (이번 주만 시간·요일·내용 변경 또는 휴강/제외)
struct WeeklyItemOverride: Identifiable, Codable, Equatable {
    var id: String { "\(weekKey)_\(baseItemId.uuidString)" }
    var weekKey: String                  // 예: "2026-W42"
    var baseItemId: UUID                 // 원본 전체(정규) 일정의 ID
    var isActive: Bool                   // true: 이번 주 조정/휴강 적용 중, false: 원래 시간표로 되돌림(Tombstone)
    var isSkipped: Bool                  // true: 이번 주만 휴강·제외(숨김)
    var overriddenItem: ScheduleItem?    // 이번 주만 변경된 일정 데이터 (시간, 요일, 제목, 세부할일 등)
    var updatedAt: TimeInterval          // 동기화 병합용 타임스탬프
}

/// 특정 요일의 원래 정규 일정 중 이번 주에 휴강 처리되었거나 다른 요일로 이동된 항목 안내용 구조체
struct DayExcludedScheduleInfo: Identifiable, Equatable {
    var id: UUID { masterItem.id }
    let masterItem: ScheduleItem
    let isSkipped: Bool
    let movedToItem: ScheduleItem?

    var reasonText: String {
        if isSkipped {
            return "이번 주 휴강·제외"
        }
        if let moved = movedToItem {
            return "이번 주 \(moved.weekday.fullName) \(moved.startTimeString)(으)로 이동"
        }
        return "이번 주 조정됨"
    }
}

// MARK: - 기기 역할 모드 (아이의 폰 vs 부모님 폰)
enum DeviceRole: String, CaseIterable, Codable, Identifiable {
    case child = "child"
    case parent = "parent"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .child: return "아이의 폰 (아이 모드)"
        case .parent: return "부모님 폰 (부모 모드)"
        }
    }

    var shortBadgeTitle: String {
        switch self {
        case .child: return "👦 아이 폰"
        case .parent: return "👩👨 부모님 폰"
        }
    }

    var description: String {
        switch self {
        case .child:
            return "아이가 스스로 스케줄을 확인하고 체크리스트('다 했어요')를 직접 체크합니다. 시간표 시계 알람이 정상적으로 울립니다."
        case .parent:
            return "아이의 숙제 확인 도장을 찍어주고 ❤️ 칭찬 하트를 전송합니다. 부모님 폰에서는 알람이 발생하지 않으며, 체크리스트는 아이만 체크합니다."
        }
    }
}

// MARK: - 부모님 하트 및 응원 스티커
enum ReactionSticker: String, CaseIterable, Codable, Identifiable {
    case heart = "heart"
    case star = "star"
    case thumbsUp = "thumbsUp"
    case clap = "clap"
    case fire = "fire"
    case crown = "crown"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .heart: return "❤️"
        case .star: return "⭐"
        case .thumbsUp: return "👍"
        case .clap: return "👏"
        case .fire: return "🔥"
        case .crown: return "👑"
        }
    }

    var label: String {
        switch self {
        case .heart: return "사랑해 하트"
        case .star: return "최고예요"
        case .thumbsUp: return "엄지척 멋져요"
        case .clap: return "참 잘했어요"
        case .fire: return "끝까지 화이팅"
        case .crown: return "오늘의 챔피언"
        }
    }
}

/// 개별 일정에 부모님이 남긴 응원 메시지 단위
struct ScheduleItemComment: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var text: String
    var createdAt: TimeInterval = Date().timeIntervalSince1970
}

/// 개별 일정(숙제)에 부모님이 남긴 하트 수 + 스티커 + 한줄 칭찬 코멘트 및 메시지 목록
struct ItemParentReaction: Codable, Equatable {
    var itemKey: String          // "YYYY-Www_UUID"
    var heartCount: Int
    var sticker: ReactionSticker
    var comment: String
    var comments: [ScheduleItemComment] = []
    var updatedAt: TimeInterval

    enum CodingKeys: String, CodingKey {
        case itemKey, heartCount, sticker, comment, comments, messages, updatedAt
    }

    init(
        itemKey: String,
        heartCount: Int,
        sticker: ReactionSticker,
        comment: String,
        comments: [ScheduleItemComment] = [],
        updatedAt: TimeInterval = Date().timeIntervalSince1970
    ) {
        self.itemKey = itemKey
        self.heartCount = heartCount
        self.sticker = sticker
        self.comment = comment
        if comments.isEmpty && !comment.isEmpty {
            self.comments = [ScheduleItemComment(text: comment, createdAt: updatedAt)]
        } else {
            self.comments = comments
        }
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        itemKey = try container.decode(String.self, forKey: .itemKey)
        heartCount = try container.decode(Int.self, forKey: .heartCount)
        sticker = try container.decode(ReactionSticker.self, forKey: .sticker)
        comment = try container.decodeIfPresent(String.self, forKey: .comment) ?? ""
        if let decodedComments = try container.decodeIfPresent([ScheduleItemComment].self, forKey: .comments), !decodedComments.isEmpty {
            comments = decodedComments
        } else if let stringMessages = try container.decodeIfPresent([String].self, forKey: .messages), !stringMessages.isEmpty {
            comments = stringMessages.map { ScheduleItemComment(text: $0, createdAt: 0) }
        } else if !comment.isEmpty {
            comments = [ScheduleItemComment(text: comment, createdAt: 0)]
        } else {
            comments = []
        }
        updatedAt = try container.decodeIfPresent(TimeInterval.self, forKey: .updatedAt) ?? 0
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(itemKey, forKey: .itemKey)
        try container.encode(heartCount, forKey: .heartCount)
        try container.encode(sticker, forKey: .sticker)
        try container.encode(comment, forKey: .comment)
        try container.encode(comments, forKey: .comments)
        try container.encode(updatedAt, forKey: .updatedAt)
    }

    /// 모든 메시지 목록 (comments가 비어있으면 comment를 단일 항목으로 반환)
    var allComments: [ScheduleItemComment] {
        if comments.isEmpty && !comment.isEmpty {
            return [ScheduleItemComment(text: comment, createdAt: updatedAt)]
        }
        return comments
    }
}

/// 부모님이 아이에게 보내는 전체 응원 하트 & 칭찬 카드 (상단 배너 및 히스토리에 표시)
struct ParentPraiseNote: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var hearts: Int
    var sticker: ReactionSticker
    var message: String
    var createdAt: TimeInterval
}

/// 가족 맞춤 추천 보상 프리셋 모델 (부모님이 추가/수정/삭제 가능)
struct RewardPreset: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var emoji: String
    var title: String
    var hearts: Int
    var tag: String
    var updatedAt: TimeInterval = 1_700_000_000

    static let defaultPresets: [RewardPreset] = [
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1)), emoji: "🎮", title: "자유 놀이 / 게임 30분", hearts: 10, tag: "놀이"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2)), emoji: "🍦", title: "달콤한 간식 / 아이스크림", hearts: 5, tag: "간식"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3)), emoji: "🧸", title: "문구 / 장난감 선물", hearts: 20, tag: "선물"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4)), emoji: "🎡", title: "주말 특별 가족 나들이", hearts: 30, tag: "나들이"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5)), emoji: "💰", title: "용돈 2,000원 교환", hearts: 10, tag: "용돈"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6)), emoji: "🎬", title: "영화 / 만화 시청 1편", hearts: 15, tag: "미디어"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7)), emoji: "🛌", title: "30분 늦게 자기 쿠폰", hearts: 15, tag: "쿠폰"),
        RewardPreset(id: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8)), emoji: "🍳", title: "오늘 저녁 메뉴 고르기", hearts: 10, tag: "특별")
    ]
    func hasSameContent(as other: RewardPreset) -> Bool {
        emoji == other.emoji && title == other.title && hearts == other.hearts && tag == other.tag
    }

    /// Older releases generated a different UUID for each device's default rewards.
    var canonicalized: RewardPreset {
        var result = self
        if let original = Self.defaultPresets.first(where: { hasSameContent(as: $0) }) {
            result.id = original.id
        }
        return result
    }

    static func merged(
        _ presets: [RewardPreset],
        deleted: inout [String: TimeInterval]
    ) -> [RewardPreset] {
        var byID: [UUID: RewardPreset] = [:]
        var order: [UUID] = []
        for original in presets {
            let preset = original.canonicalized
            if let timestamp = deleted[original.id.uuidString] {
                deleted[preset.id.uuidString] = max(deleted[preset.id.uuidString] ?? 0, timestamp)
            }
            if let existing = byID[preset.id] {
                if preset.updatedAt > existing.updatedAt {
                    byID[preset.id] = preset
                }
            } else {
                order.append(preset.id)
                byID[preset.id] = preset
            }
        }
        var result: [RewardPreset] = []
        for id in order {
            guard let preset = byID[id],
                  preset.updatedAt > (deleted[id.uuidString] ?? 0) else { continue }
            if let index = result.firstIndex(where: { $0.hasSameContent(as: preset) }) {
                let existing = result[index]
                let keepPreset = preset.updatedAt > existing.updatedAt ||
                    (preset.updatedAt == existing.updatedAt && preset.id.uuidString < existing.id.uuidString)
                let discarded = keepPreset ? existing : preset
                deleted[discarded.id.uuidString] = max(deleted[discarded.id.uuidString] ?? 0, discarded.updatedAt)
                if keepPreset { result[index] = preset }
            } else {
                result.append(preset)
            }
        }
        return result
    }

}

/// 아이가 모은 하트로 보상을 교환(차감)한 내역 모델
struct HeartRewardRedemption: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String            // 교환한 보상 명칭 (예: "게임 30분", "포켓몬 카드 1팩", "용돈 2,000원")
    var hearts: Int              // 차감된 하트 개수
    var createdAt: TimeInterval  // 교환 일시
    var redeemedByRole: String   // "부모님"
}

/// 타임스탬프 기반 충돌 방지용 플래그 (완료 체크 / 부모 확인 도장 동기화용)
struct SyncTimestampedFlag: Codable, Equatable {
    var isSet: Bool
    var updatedAt: TimeInterval
}

// MARK: - ⭐ 스타(Star) 원장(Ledger) 및 보상 상점 모델

/// 스타 원장(Ledger) 트랜잭션 유형
enum StarTransactionKind: String, Codable, Equatable {
    case dailyAllClear = "dailyAllClear"           // 평일(월~금) 일일 퀘스트 올클리어 부모 수여 (+1⭐)
    case weeklyAllClearBonus = "weeklyAllClearBonus" // 월~금 5일 올클리어 주간 자동 보너스 (+2⭐)
    case rewardRedemption = "rewardRedemption"     // 보상 상점 교환 차감 (-1⭐, -10⭐ 등)
}

/// 변경 불가능한(Immutable) 스타 원장(Append-Only Ledger) 엔트리
/// - 결정론적 ID(`id`)를 사용하여 다중 기기 동시 동기화 시에도 중복 적립/차감을 100% 방지합니다.
struct StarTransaction: Identifiable, Codable, Equatable {
    /// 결정론적 고유 ID:
    /// - 일일 적립: "star_earn_{weekKey}_{weekdayRawValue}" (예: "star_earn_2026-W42_1")
    /// - 주간 올클리어 보너스: "star_bonus_weekly_{weekKey}" (예: "star_bonus_weekly_2026-W42")
    /// - 보상 차감: "star_spend_{redemptionRequestUUID}"
    var id: String
    var kind: StarTransactionKind
    var delta: Int                      // +1, +2, -1, -10 등
    var weekKey: String                 // "2026-W42"
    var weekdayRawValue: Int?           // 일일 적립 시 1(월)~5(금), 주간 보너스/차감 시 nil
    var title: String                   // 예: "월요일 일일 퀘스트 올클리어", "이번 주 평일 올클리어 보너스!"
    var note: String                    // 부가 설명 또는 교환 보상 상세
    var createdAt: TimeInterval
    var createdByRole: String           // "👩‍👨 부모님 폰" 등
    var linkedRedemptionId: UUID?       // 보상 차감 시 연결된 StarRedemptionRequest.id
    var linkedHeartGrantCount: Int?     // 1스타 -> 5하트 전환 시 함께 지급된 하트 개수 (5)

    static func dailyEarnId(weekKey: String, weekday: Weekday) -> String {
        "star_earn_\(weekKey)_\(weekday.rawValue)"
    }

    static func weeklyBonusId(weekKey: String) -> String {
        "star_bonus_weekly_\(weekKey)"
    }

    static func spendId(requestId: UUID) -> String {
        "star_spend_\(requestId.uuidString)"
    }
}

/// 특정 요일의 스타 달성 상태 (UI 배지 및 수여 버튼 판정용)
enum WeekdayStarState: Equatable {
    case weekendExcluded                            // 토·일요일 (스타 적립 대상 제외)
    case ineligibleEmpty                            // 평일이지만 활성 할 일(isCheckable)이 0개
    case inProgress(completed: Int, verified: Int, total: Int) // 진행 중 (일부 미완료 또는 부모 미확인)
    case claimable(total: Int)                      // 모든 할 일 아이 완료 + 부모 확인 완료 -> 부모의 '스타 수여 확인' 대기
    case awarded(transaction: StarTransaction)      // 이미 해당 요일 +1 스타 지급 완료
}

/// 스타 보상 아이템의 실행 유형
enum StarRewardActionType: String, Codable, Equatable {
    case convertToHearts = "convertToHearts"        // 스타 차감과 동시에 하트(❤️) 즉시 충전 (예: 1⭐ -> +5❤️)
    case customVoucher = "customVoucher"            // 실물/디지털 보상 교환권 발급 (예: 10⭐ -> 로블록스 로벅스 500개)
}

/// 스타 상점 보상 프리셋 모델
struct StarRewardPreset: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var emoji: String
    var title: String
    var subtitle: String
    var starCost: Int
    var actionType: StarRewardActionType
    var grantedHearts: Int              // convertToHearts일 때 지급할 하트 수 (기본 5), customVoucher면 0
    var badgeTag: String                // 예: "즉시 충전", "대형 목표"
    var updatedAt: TimeInterval = 1_700_000_000

    static let heartBonusPresetId = UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1))
    static let robux500PresetId   = UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2))

    static let defaultPresets: [StarRewardPreset] = [
        StarRewardPreset(
            id: heartBonusPresetId,
            emoji: "💝",
            title: "하트 5개 보너스 상자",
            subtitle: "스타 1개로 하트 5개를 즉시 충전해요!",
            starCost: 1,
            actionType: .convertToHearts,
            grantedHearts: 5,
            badgeTag: "즉시 충전"
        ),
        StarRewardPreset(
            id: robux500PresetId,
            emoji: "🎮",
            title: "로블록스 로벅스 500개",
            subtitle: "열심히 모은 스타 10개로 교환하는 스페셜 보상!",
            starCost: 10,
            actionType: .customVoucher,
            grantedHearts: 0,
            badgeTag: "스페셜 목표"
        )
    ]

    func hasSameContent(as other: StarRewardPreset) -> Bool {
        emoji == other.emoji &&
        title == other.title &&
        starCost == other.starCost &&
        actionType == other.actionType &&
        grantedHearts == other.grantedHearts
    }

    var canonicalized: StarRewardPreset {
        var result = self
        if let original = Self.defaultPresets.first(where: { hasSameContent(as: $0) }) {
            result.id = original.id
        }
        return result
    }

    static func merged(
        _ presets: [StarRewardPreset],
        deleted: inout [String: TimeInterval]
    ) -> [StarRewardPreset] {
        var byID: [UUID: StarRewardPreset] = [:]
        var order: [UUID] = []
        for original in presets {
            let preset = original.canonicalized
            if let timestamp = deleted[original.id.uuidString] {
                deleted[preset.id.uuidString] = max(deleted[preset.id.uuidString] ?? 0, timestamp)
            }
            if let existing = byID[preset.id] {
                if preset.updatedAt > existing.updatedAt {
                    byID[preset.id] = preset
                }
            } else {
                order.append(preset.id)
                byID[preset.id] = preset
            }
        }
        var result: [StarRewardPreset] = []
        for id in order {
            guard let preset = byID[id],
                  preset.updatedAt > (deleted[id.uuidString] ?? 0) else { continue }
            if let index = result.firstIndex(where: { $0.hasSameContent(as: preset) }) {
                let existing = result[index]
                let keepPreset = preset.updatedAt > existing.updatedAt ||
                    (preset.updatedAt == existing.updatedAt && preset.id.uuidString < existing.id.uuidString)
                let discarded = keepPreset ? existing : preset
                deleted[discarded.id.uuidString] = max(deleted[discarded.id.uuidString] ?? 0, discarded.updatedAt)
                if keepPreset { result[index] = preset }
            } else {
                result.append(preset)
            }
        }
        return result
    }
}

/// 아이의 스타 보상 교환 신청 및 부모 승인 상태
enum StarRedemptionStatus: String, Codable, Equatable {
    case pending = "pending"       // 아이가 신청함 (부모 승인 대기 중)
    case approved = "approved"     // 부모 인증 후 승인 및 지급 완료 (원장에 차감 트랜잭션 생성됨)
    case rejected = "rejected"     // 부모가 반려/취소함 (스타 차감 없음)
}

/// 스타 보상 교환 요청/이력 엔트리
struct StarRedemptionRequest: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var presetId: UUID
    var emoji: String
    var rewardTitle: String
    var starCost: Int
    var actionType: StarRewardActionType
    var grantedHearts: Int
    var status: StarRedemptionStatus
    var requestedAt: TimeInterval
    var requestedByRole: String         // "👦 아이 폰" 또는 "👩‍👨 부모님 폰"
    var resolvedAt: TimeInterval?
    var resolvedByRole: String?
    var updatedAt: TimeInterval
}

/// 스타 획득 축하 배너/모달 표시용 컨텍스트
struct StarCelebrationContext: Identifiable, Equatable {
    var id = UUID()
    var weekday: Weekday?
    var earnedDailyStar: Int            // +1
    var earnedWeeklyBonus: Int          // 0 또는 +2 (금요일까지 5일 올클리어 시)
    var totalAvailableStars: Int
}

// MARK: - Vercel Blob 클라우드 동기화 스냅샷 모델
struct CloudSyncSnapshot: Codable, Equatable {
    var schemaVersion: Int = 5
    var familyCode: String
    var updatedAt: TimeInterval
    var updatedByRole: String
    var updatedByDeviceId: String

    /// 6자리 부모님 마스터 PIN (기본값: 160125)
    var parentPinCode: String
    var parentPinUpdatedAt: TimeInterval

    /// 전체 주간 시간표(+주차별 전용 추가 일정) 및 삭제된 일정 기록 (타임스탬프 병합용)
    var items: [ScheduleItem]
    var deletedItemTimestamps: [String: TimeInterval]

    /// 주차별 임시 스케줄 조정 및 휴강 기록 ("YYYY-Www_UUID" -> WeeklyItemOverride)
    var weeklyOverrides: [String: WeeklyItemOverride]

    /// 주차별 아이 완료 체크 & 부모 확인 도장 기록 ("YYYY-Www_UUID" -> SyncTimestampedFlag)
    var completionFlags: [String: SyncTimestampedFlag]
    var subTaskCompletionFlags: [String: SyncTimestampedFlag]
    var parentVerifiedFlags: [String: SyncTimestampedFlag]
    var parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag]

    /// 일정별 하트·스티커·칭찬 코멘트 ("YYYY-Www_UUID" -> ItemParentReaction)
    var itemReactions: [String: ItemParentReaction]

    /// 부모님이 보낸 응원 카드 리스트 (최신순)
    var praiseNotes: [ParentPraiseNote]

    /// 하트 보상 교환(차감) 내역 리스트 (최신순)
    var rewardRedemptions: [HeartRewardRedemption]

    /// 아카이브된 누적 획득 하트 수 (노트 보관 한도 초과 시 하트 손실 방지용)
    var archivedEarnedHearts: Int

    /// 가족 맞춤 추천 보상 프리셋 리스트
    var rewardPresets: [RewardPreset]
    var deletedRewardPresetTimestamps: [String: TimeInterval]

    /// ⭐ 스타 원장(Append-Only Ledger) 트랜잭션 리스트 (v5 신규)
    var starTransactions: [StarTransaction]

    /// ⭐ 스타 보상 교환 신청 및 승인/반려 내역 (v5 신규)
    var starRedemptionRequests: [StarRedemptionRequest]

    /// ⭐ 스타 보상 상점 프리셋 및 삭제 타임스탬프 (v5 신규)
    var starRewardPresets: [StarRewardPreset]
    var deletedStarPresetTimestamps: [String: TimeInterval]

    /// 취소/원복된 스타 트랜잭션 ID 목록 (기기 로컬 원장에서도 영구 제거용)
    var revokedStarTransactionIds: [String] = []

    /// 취소/원복된 스타 보상 교환 신청 ID 목록
    var revokedStarRedemptionIds: [String] = []

    /// 취소/원복된 칭찬/응원 노트 ID 목록 (스타 환전 하트 원복용)
    var revokedPraiseNoteIds: [String] = []

    enum CodingKeys: String, CodingKey {
        case schemaVersion, familyCode, updatedAt, updatedByRole, updatedByDeviceId
        case parentPinCode, parentPinUpdatedAt
        case items, deletedItemTimestamps, weeklyOverrides
        case completionFlags, subTaskCompletionFlags, parentVerifiedFlags, parentVerifiedSubTaskFlags
        case itemReactions, praiseNotes
        case rewardRedemptions, archivedEarnedHearts, rewardPresets, deletedRewardPresetTimestamps
        case starTransactions, starRedemptionRequests, starRewardPresets, deletedStarPresetTimestamps
        case revokedStarTransactionIds, revokedStarRedemptionIds, revokedPraiseNoteIds
    }

    init(
        schemaVersion: Int = 5,
        familyCode: String,
        updatedAt: TimeInterval,
        updatedByRole: String,
        updatedByDeviceId: String,
        parentPinCode: String,
        parentPinUpdatedAt: TimeInterval,
        items: [ScheduleItem],
        deletedItemTimestamps: [String: TimeInterval],
        weeklyOverrides: [String: WeeklyItemOverride] = [:],
        completionFlags: [String: SyncTimestampedFlag],
        subTaskCompletionFlags: [String: SyncTimestampedFlag],
        parentVerifiedFlags: [String: SyncTimestampedFlag],
        parentVerifiedSubTaskFlags: [String: SyncTimestampedFlag],
        itemReactions: [String: ItemParentReaction],
        praiseNotes: [ParentPraiseNote],
        rewardRedemptions: [HeartRewardRedemption] = [],
        archivedEarnedHearts: Int = 0,
        rewardPresets: [RewardPreset] = RewardPreset.defaultPresets,
        deletedRewardPresetTimestamps: [String: TimeInterval] = [:],
        starTransactions: [StarTransaction] = [],
        starRedemptionRequests: [StarRedemptionRequest] = [],
        starRewardPresets: [StarRewardPreset] = StarRewardPreset.defaultPresets,
        deletedStarPresetTimestamps: [String: TimeInterval] = [:],
        revokedStarTransactionIds: [String] = [],
        revokedStarRedemptionIds: [String] = [],
        revokedPraiseNoteIds: [String] = []
    ) {
        self.schemaVersion = schemaVersion
        self.familyCode = familyCode
        self.updatedAt = updatedAt
        self.updatedByRole = updatedByRole
        self.updatedByDeviceId = updatedByDeviceId
        self.parentPinCode = parentPinCode
        self.parentPinUpdatedAt = parentPinUpdatedAt
        self.items = items
        self.deletedItemTimestamps = deletedItemTimestamps
        self.weeklyOverrides = weeklyOverrides
        self.completionFlags = completionFlags
        self.subTaskCompletionFlags = subTaskCompletionFlags
        self.parentVerifiedFlags = parentVerifiedFlags
        self.parentVerifiedSubTaskFlags = parentVerifiedSubTaskFlags
        self.itemReactions = itemReactions
        self.praiseNotes = praiseNotes
        self.rewardRedemptions = rewardRedemptions
        self.archivedEarnedHearts = archivedEarnedHearts
        self.rewardPresets = rewardPresets
        self.deletedRewardPresetTimestamps = deletedRewardPresetTimestamps
        self.starTransactions = starTransactions
        self.starRedemptionRequests = starRedemptionRequests
        self.starRewardPresets = starRewardPresets
        self.deletedStarPresetTimestamps = deletedStarPresetTimestamps
        self.revokedStarTransactionIds = revokedStarTransactionIds
        self.revokedStarRedemptionIds = revokedStarRedemptionIds
        self.revokedPraiseNoteIds = revokedPraiseNoteIds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 3
        familyCode = try container.decode(String.self, forKey: .familyCode)
        updatedAt = try container.decode(TimeInterval.self, forKey: .updatedAt)
        updatedByRole = try container.decode(String.self, forKey: .updatedByRole)
        updatedByDeviceId = try container.decode(String.self, forKey: .updatedByDeviceId)
        parentPinCode = try container.decode(String.self, forKey: .parentPinCode)
        parentPinUpdatedAt = try container.decode(TimeInterval.self, forKey: .parentPinUpdatedAt)
        items = try container.decode([ScheduleItem].self, forKey: .items)
        deletedItemTimestamps = try container.decodeIfPresent([String: TimeInterval].self, forKey: .deletedItemTimestamps) ?? [:]
        weeklyOverrides = try container.decodeIfPresent([String: WeeklyItemOverride].self, forKey: .weeklyOverrides) ?? [:]
        completionFlags = try container.decodeIfPresent([String: SyncTimestampedFlag].self, forKey: .completionFlags) ?? [:]
        subTaskCompletionFlags = try container.decodeIfPresent([String: SyncTimestampedFlag].self, forKey: .subTaskCompletionFlags) ?? [:]
        parentVerifiedFlags = try container.decodeIfPresent([String: SyncTimestampedFlag].self, forKey: .parentVerifiedFlags) ?? [:]
        parentVerifiedSubTaskFlags = try container.decodeIfPresent([String: SyncTimestampedFlag].self, forKey: .parentVerifiedSubTaskFlags) ?? [:]
        itemReactions = try container.decodeIfPresent([String: ItemParentReaction].self, forKey: .itemReactions) ?? [:]
        praiseNotes = try container.decodeIfPresent([ParentPraiseNote].self, forKey: .praiseNotes) ?? []
        rewardRedemptions = try container.decodeIfPresent([HeartRewardRedemption].self, forKey: .rewardRedemptions) ?? []
        archivedEarnedHearts = try container.decodeIfPresent(Int.self, forKey: .archivedEarnedHearts) ?? 0
        rewardPresets = try container.decodeIfPresent([RewardPreset].self, forKey: .rewardPresets) ?? []
        deletedRewardPresetTimestamps = try container.decodeIfPresent([String: TimeInterval].self, forKey: .deletedRewardPresetTimestamps) ?? [:]
        // v4 이하 스냅샷 하위 호환 디코딩 (키 누락 시 빈 배열/기본 프리셋 폴백)
        starTransactions = try container.decodeIfPresent([StarTransaction].self, forKey: .starTransactions) ?? []
        starRedemptionRequests = try container.decodeIfPresent([StarRedemptionRequest].self, forKey: .starRedemptionRequests) ?? []
        starRewardPresets = try container.decodeIfPresent([StarRewardPreset].self, forKey: .starRewardPresets) ?? StarRewardPreset.defaultPresets
        deletedStarPresetTimestamps = try container.decodeIfPresent([String: TimeInterval].self, forKey: .deletedStarPresetTimestamps) ?? [:]
        revokedStarTransactionIds = try container.decodeIfPresent([String].self, forKey: .revokedStarTransactionIds) ?? []
        revokedStarRedemptionIds = try container.decodeIfPresent([String].self, forKey: .revokedStarRedemptionIds) ?? []
        revokedPraiseNoteIds = try container.decodeIfPresent([String].self, forKey: .revokedPraiseNoteIds) ?? []
    }
}

// MARK: - 인쇄 전용 도메인 헬퍼 (Web printLayout.ts와 1:1 패리티)
enum SchedulePrintHelper {
    struct PrintableTimeSlot: Identifiable, Hashable {
        let hour: Int
        let minute: Int
        var id: Int { hour * 60 + minute }
        var totalMinutes: Int { hour * 60 + minute }

        var label: String {
            ScheduleItem.formatCompactTime(hour: hour, minute: minute)
        }
    }

    struct DayCellBlock: Identifiable {
        let id: String
        let startSlotIndex: Int
        let spanCount: Int
        let slot: PrintableTimeSlot
        let nextSlotMinutes: Int
        let items: [ScheduleItem]
        let isHighlightedSpanBlock: Bool
    }

    static let baseTimeSlots: [(Int, Int)] = [
        (7, 0),
        (9, 30),
        (10, 30),
        (12, 0),
        (13, 30),
        (14, 30),
        (15, 0),
        (16, 0),
        (17, 0),
        (18, 0),
        (19, 0),
        (20, 0),
        (21, 30),
        (22, 30)
    ]

    static func generateTimeSlots(for items: [ScheduleItem]) -> [PrintableTimeSlot] {
        var set = Set<PrintableTimeSlot>(baseTimeSlots.map { PrintableTimeSlot(hour: $0.0, minute: $0.1) })
        for item in items {
            set.insert(PrintableTimeSlot(hour: item.startHour, minute: item.startMinute))
        }
        return set.sorted { $0.totalMinutes < $1.totalMinutes }
    }

    static func activeItems(for weekday: Weekday, items: [ScheduleItem], slot: PrintableTimeSlot, nextSlotMinutes: Int) -> [ScheduleItem] {
        let dayItems = items
            .filter { $0.weekday == weekday }
            .sorted {
                if $0.startTotalMinutes == $1.startTotalMinutes {
                    return $0.endTotalMinutes < $1.endTotalMinutes
                }
                return $0.startTotalMinutes < $1.startTotalMinutes
            }
        return dayItems.filter { item in
            let startsInSlot = item.startTotalMinutes >= slot.totalMinutes && item.startTotalMinutes < nextSlotMinutes
            let spansAcrossSlot = item.startTotalMinutes < slot.totalMinutes && item.endTotalMinutes > slot.totalMinutes
            return startsInSlot || spansAcrossSlot
        }
    }

    /// 요일별 세로 컬럼 블록 계산 (2개 이상의 슬롯에 걸친 일정은 단일 확장 셀로 통합)
    static func buildColumnBlocks(
        for weekday: Weekday,
        items: [ScheduleItem],
        slots: [PrintableTimeSlot],
        mergeLongBlocks: Bool
    ) -> [DayCellBlock] {
        var blocks: [DayCellBlock] = []
        var idx = 0

        while idx < slots.count {
            let slot = slots[idx]
            let nextMinutes = (idx + 1 < slots.count) ? slots[idx + 1].totalMinutes : 24 * 60
            let currentItems = activeItems(for: weekday, items: items, slot: slot, nextSlotMinutes: nextMinutes)

            if currentItems.count == 1, let singleItem = currentItems.first {
                // 이 아이템이 단독으로 이어지는 연속 슬롯 개수 계산
                var span = 1
                while (idx + span) < slots.count {
                    let nextSlot = slots[idx + span]
                    let afterNextMinutes = (idx + span + 1 < slots.count) ? slots[idx + span + 1].totalMinutes : 24 * 60
                    let nextActive = activeItems(for: weekday, items: items, slot: nextSlot, nextSlotMinutes: afterNextMinutes)
                    if nextActive.count == 1 && nextActive.first?.id == singleItem.id {
                        span += 1
                    } else {
                        break
                    }
                }

                if shouldMergeAcrossSlots(item: singleItem, spannedSlotCount: span, mergeLongBlocks: mergeLongBlocks) {
                    let finalNextMinutes = (idx + span < slots.count) ? slots[idx + span].totalMinutes : 24 * 60
                    blocks.append(
                        DayCellBlock(
                            id: "\(weekday.rawValue)_\(idx)_span\(span)",
                            startSlotIndex: idx,
                            spanCount: span,
                            slot: slot,
                            nextSlotMinutes: finalNextMinutes,
                            items: [singleItem],
                            isHighlightedSpanBlock: true
                        )
                    )
                    idx += span
                    continue
                }
            }

            blocks.append(
                DayCellBlock(
                    id: "\(weekday.rawValue)_\(idx)",
                    startSlotIndex: idx,
                    spanCount: 1,
                    slot: slot,
                    nextSlotMinutes: nextMinutes,
                    items: currentItems,
                    isHighlightedSpanBlock: false
                )
            )
            idx += 1
        }

        return blocks
    }

    /// 2개 이상의 시간 슬롯에 걸친 일정이 단일 확장 셀로 병합될 대상인지 판별
    static func shouldMergeAcrossSlots(item: ScheduleItem, spannedSlotCount: Int, mergeLongBlocks: Bool) -> Bool {
        guard mergeLongBlocks, spannedSlotCount >= 2 else { return false }
        return true
    }

    /// 동일한 요일의 두 일정이 간격 0분, 제목(공백 제외), 카테고리가 일치하여 가상 병합 가능한지 검사
    static func canMergeContiguous(prev: ScheduleItem, next: ScheduleItem) -> Bool {
        guard prev.weekday == next.weekday else { return false }
        let isContiguous = prev.endTotalMinutes == next.startTotalMinutes
        let isSameTitle = prev.title.trimmingCharacters(in: .whitespacesAndNewlines) == next.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let isSameCategory = prev.category == next.category
        return isContiguous && isSameTitle && isSameCategory
    }

    private static func normalizeMergedItem(_ item: ScheduleItem) -> ScheduleItem {
        var copy = item
        copy.title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return copy
    }

    /// 동일 요일 내에서 0분 간격으로 이어지는 동일 제목/카테고리의 일정을 단일 가상 ScheduleItem으로 결합
    static func mergeContiguousItems(_ items: [ScheduleItem]) -> [ScheduleItem] {
        guard items.count > 1 else { return items }

        // 요일별 그룹화
        var byWeekday: [Weekday: [ScheduleItem]] = [:]
        for item in items {
            byWeekday[item.weekday, default: []].append(item)
        }

        var result: [ScheduleItem] = []
        let sortedWeekdays = Weekday.allCases.filter { byWeekday[$0] != nil }

        for weekday in sortedWeekdays {
            guard let dayItems = byWeekday[weekday], !dayItems.isEmpty else { continue }
            // 시간순 정렬 (시작 시각, 종료 시각)
            let sorted = dayItems.sorted {
                if $0.startTotalMinutes == $1.startTotalMinutes {
                    return $0.endTotalMinutes < $1.endTotalMinutes
                }
                return $0.startTotalMinutes < $1.startTotalMinutes
            }

            var current = normalizeMergedItem(sorted[0])

            for i in 1..<sorted.count {
                let next = sorted[i]

                if canMergeContiguous(prev: current, next: next) {
                    // next를 current에 병합
                    let notes = [current.note, next.note]
                        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }

                    current.endHour = next.endHour
                    current.endMinute = next.endMinute
                    current.note = notes.joined(separator: "\n")
                    current.subTasks += next.subTasks
                    current.updatedAt = max(current.updatedAt, next.updatedAt)
                } else {
                    result.append(current)
                    current = normalizeMergedItem(next)
                }
            }

            result.append(current)
        }

        return result
    }
}
