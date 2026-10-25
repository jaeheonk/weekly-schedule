import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct TodayTasksWidgetEntry: TimelineEntry {
    let date: Date
    let summary: TodayWidgetScheduleSummary
}

// MARK: - Timeline Provider

struct TodayTasksTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayTasksWidgetEntry {
        let now = Date()
        let summary = ScheduleWidgetDataManager.shared.loadImmediateSummaryForWidget(date: now)
        return TodayTasksWidgetEntry(date: now, summary: summary)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayTasksWidgetEntry) -> Void) {
        let now = Date()
        let summary = ScheduleWidgetDataManager.shared.loadImmediateSummaryForWidget(date: now)
        completion(TodayTasksWidgetEntry(date: now, summary: summary))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayTasksWidgetEntry>) -> Void) {
        Task {
            let now = Date()
            let summary = await ScheduleWidgetDataManager.shared.loadSummaryForWidget(
                date: now,
                allowNetworkRefresh: true
            )
            let currentEntry = TodayTasksWidgetEntry(date: now, summary: summary)

            let calendar = Calendar.current
            let nextRefresh = calendar.date(byAdding: .minute, value: 15, to: now)
                ?? now.addingTimeInterval(900)

            // 자정이 지나면 요일과 오늘의 할 일 목록이 즉시 전환되도록 자정 엔트리 예약
            if let tomorrowStart = calendar.nextDate(
                after: now,
                matching: DateComponents(hour: 0, minute: 0, second: 5),
                matchingPolicy: .nextTime
            ), tomorrowStart < nextRefresh {
                let tomorrowSummary = await ScheduleWidgetDataManager.shared.loadSummaryForWidget(
                    date: tomorrowStart,
                    allowNetworkRefresh: false
                )
                let midnightEntry = TodayTasksWidgetEntry(date: tomorrowStart, summary: tomorrowSummary)
                completion(Timeline(entries: [currentEntry, midnightEntry], policy: .after(tomorrowStart)))
            } else {
                completion(Timeline(entries: [currentEntry], policy: .after(nextRefresh)))
            }
        }
    }
}

// MARK: - Widget View (Apple 미리알림 스타일 '오늘의 할 일' 인터랙티브 위젯)

struct TodayTasksWidgetEntryView: View {
    var entry: TodayTasksWidgetEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    private var maxVisibleRows: Int {
        switch family {
        case .systemLarge:
            return 7
        default:
            return 3
        }
    }

    private var visibleItems: [WidgetTaskItem] {
        Array(entry.summary.incompleteItems.prefix(maxVisibleRows))
    }

    private var overflowCount: Int {
        max(0, entry.summary.incompleteItems.count - visibleItems.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 7) {
            headerView

            Divider()
                .overlay(theme.dividerOverlay)

            if entry.summary.totalCheckableCount == 0 {
                emptySchedulePlaceholder
            } else if entry.summary.incompleteItems.isEmpty {
                allCompletedPlaceholder
            } else {
                taskListView
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            ZStack {
                theme.baseBackground
                LinearGradient(
                    colors: theme.gradientColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(alignment: .center, spacing: 8) {
            // 남은 할 일 개수 배지 (미리알림 스타일)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(entry.summary.remainingIncompleteCount)")
                    .font(.system(size: family == .systemLarge ? 26 : 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(
                        entry.summary.remainingIncompleteCount == 0
                            ? Color.green
                            : theme.accentIndigo
                    )
                    .contentTransition(.numericText())

                Text("오늘의 할 일")
                    .font(.system(size: family == .systemLarge ? 16 : 14, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.primary)
            }

            Spacer(minLength: 4)

            // 요일 + 완료 진행률 캡슐
            HStack(spacing: 5) {
                Text(entry.summary.weekday.fullName)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.accentIndigo)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(theme.weekdayBadgeBackground, in: Capsule())

                if entry.summary.totalCheckableCount > 0 {
                    Text("\(entry.summary.completedCheckableCount)/\(entry.summary.totalCheckableCount) 완료")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.secondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(theme.secondaryBadgeBackground, in: Capsule())
                }
            }
        }
    }

    // MARK: - Interactive Task List

    private var taskListView: some View {
        VStack(alignment: .leading, spacing: family == .systemLarge ? 8 : 6) {
            ForEach(visibleItems) { item in
                taskRow(for: item)
            }

            if overflowCount > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "ellipsis.circle.fill")
                        .font(.system(size: 10, weight: .semibold))
                    Text("외 \(overflowCount)개의 할 일이 더 있어요")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                }
                .foregroundStyle(Color.secondary)
                .padding(.leading, 26)
                .padding(.top, 1)
            }
        }
    }

    private func taskRow(for item: WidgetTaskItem) -> some View {
        let categoryColor = theme.adaptiveCategoryColor(for: item.category)

        return HStack(spacing: 8) {
            // 원형 인터랙티브 체크 버튼 (탭 즉시 '다 했어요' 완료 처리)
            Button(
                intent: CompleteScheduleItemIntent(
                    itemId: item.id.uuidString,
                    weekKey: entry.summary.weekKey
                )
            ) {
                ZStack {
                    Circle()
                        .strokeBorder(categoryColor, lineWidth: 2)
                        .frame(width: 20, height: 20)
                    Circle()
                        .fill(categoryColor.opacity(theme.categoryFillOpacity))
                        .frame(width: 14, height: 14)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // 카테고리 컬러 점 + 할 일 제목 (1줄)
            HStack(spacing: 5) {
                Circle()
                    .fill(categoryColor)
                    .frame(width: 6, height: 6)

                Text(item.title)
                    .font(.system(size: family == .systemLarge ? 14 : 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.primary)
                    .lineLimit(1)

                if item.subTaskCount > 0 {
                    Text("세부 \(item.subTaskCount)")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(categoryColor)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(categoryColor.opacity(theme.categoryBadgeOpacity), in: Capsule())
                }
            }

            Spacer(minLength: 4)

            // 시작 시각 (HH:mm)
            Text(item.startTimeHHmm)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(theme.timeBadgeBackground, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
        }
    }

    // MARK: - Empty / All-Completed States

    private var allCompletedPlaceholder: some View {
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Color.green)

                VStack(alignment: .leading, spacing: 2) {
                    Text("오늘 할 일을 모두 끝냈어요! 🎉")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.primary)
                    Text("총 \(entry.summary.totalCheckableCount)개의 오늘 할 일 체크 완료")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
            Spacer(minLength: 0)
        }
    }

    private var emptySchedulePlaceholder: some View {
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(theme.accentIndigo)
                Text("오늘 등록된 체크 할 일이 없어요")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Widget Theme & Adaptive Colors

private extension TodayTasksWidgetEntryView {
    struct Theme {
        let colorScheme: ColorScheme

        var isDark: Bool { colorScheme == .dark }

        // Background
        var baseBackground: Color {
            isDark ? Color(red: 0.11, green: 0.11, blue: 0.13) : Color(red: 0.98, green: 0.98, blue: 1.0)
        }

        var gradientColors: [Color] {
            if isDark {
                return [
                    Color.indigo.opacity(0.14),
                    Color.mint.opacity(0.08),
                    Color.clear
                ]
            } else {
                return [
                    Color.indigo.opacity(0.06),
                    Color.mint.opacity(0.04),
                    Color.clear
                ]
            }
        }

        // Divider
        var dividerOverlay: Color {
            Color.primary.opacity(isDark ? 0.12 : 0.08)
        }

        // Accent / Indigo
        var accentIndigo: Color {
            isDark ? Color(red: 0.55, green: 0.62, blue: 1.0) : Color.indigo
        }

        var weekdayBadgeBackground: Color {
            accentIndigo.opacity(isDark ? 0.22 : 0.12)
        }

        // Secondary / Meta Badges
        var secondaryBadgeBackground: Color {
            Color.secondary.opacity(isDark ? 0.18 : 0.10)
        }

        var timeBadgeBackground: Color {
            Color.secondary.opacity(isDark ? 0.18 : 0.08)
        }

        // Category Adaptive Color
        func adaptiveCategoryColor(for category: ScheduleCategory) -> Color {
            guard isDark else { return category.color }
            switch category {
            case .study:
                // 다크 모드 배경(#1C1C21) 위 명암비 4.5:1 이상 확보를 위한 틴트 조정
                return Color(red: 0.40, green: 0.65, blue: 1.0)
            case .academy:
                return Color(red: 0.70, green: 0.52, blue: 1.0)
            case .music, .sports, .routine, .free:
                return category.color
            }
        }

        var categoryFillOpacity: Double {
            isDark ? 0.22 : 0.14
        }

        var categoryBadgeOpacity: Double {
            isDark ? 0.20 : 0.12
        }
    }

    var theme: Theme {
        Theme(colorScheme: colorScheme)
    }
}

// MARK: - Widget Configuration & Bundle

struct TodayTasksWidget: Widget {
    let kind: String = "TodayTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayTasksTimelineProvider()) { entry in
            TodayTasksWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 할 일")
        .description("오늘 해야 할 일 목록을 홈 화면에서 바로 확인하고 체크해 완료할 수 있어요.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct WeeklyScheduleWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayTasksWidget()
    }
}
