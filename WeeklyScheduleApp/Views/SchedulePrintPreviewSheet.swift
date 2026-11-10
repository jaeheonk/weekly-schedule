import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - 프린트 테마 스타일 옵션
enum SchedulePrintTheme: String, CaseIterable, Identifiable {
    case classicMint = "classicMint"     // 첨부 PDF 스타일 (세이지 그린 헤더 + 깔끔한 표 + 장기 일정 민트 강조)
    case categoryColor = "categoryColor" // 과목·활동 카테고리 파스텔 컬러 스타일
    case monoInkSaver = "monoInkSaver"   // 흑백 프린터 잉크 절약 고대비 스타일

    var id: String { rawValue }

    var title: String {
        switch self {
        case .classicMint: return "클래식 민트 (PDF 원본 스타일)"
        case .categoryColor: return "과목별 컬러 스타일"
        case .monoInkSaver: return "흑백 프린트 (잉크 절약)"
        }
    }

    var shortLabel: String {
        switch self {
        case .classicMint: return "PDF 클래식"
        case .categoryColor: return "컬러풀"
        case .monoInkSaver: return "흑백"
        }
    }
}

// MARK: - 1페이지 출력 미리보기 및 인쇄/PDF 내보내기 시트
struct SchedulePrintPreviewSheet: View {
    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    @State private var printScope: ScheduleEditScope = .master
    @State private var theme: SchedulePrintTheme = .classicMint
    @State private var documentTitle: String = "WEEKLY SCHEDULE | 주간 시간표"
    @State private var mergeLongBlocks: Bool = true
    @State private var showCompletionStamps: Bool = false
    @State private var showNotesAndSubtasks: Bool = true

    @State private var isGeneratingPDF: Bool = false
    @State private var exportedPDFURL: URL? = nil
    @State private var exportedImageURL: URL? = nil
    @State private var statusMessage: String? = nil

    // 표준 A4 가로(Landscape) 비율 크기 (72 DPI 기준 842 x 595 pt)
    static let a4LandscapeSize = CGSize(width: 842, height: 595)

    private var printableItems: [ScheduleItem] {
        let baseItems = printScope == .master ? store.masterItems : store.effectiveItems
        return SchedulePrintHelper.mergeContiguousItems(baseItems)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    // 1. 실시간 1페이지 A4 가로 미리보기 카드
                    previewSection

                    // 2. 바로 인쇄(AirPrint) & PDF/이미지 공유 액션 버튼
                    actionButtonsSection

                    // 3. 1페이지 출력 맞춤 설정
                    customizationSection
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("1페이지 시간표 출력")
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        printOnePageSchedule()
                    } label: {
                        Label("인쇄", systemImage: "printer.fill")
                            .fontWeight(.bold)
                    }
                }
            }
            .task(id: renderConfigKey) {
                await regenerateExportFiles()
            }
            #if os(iOS)
            .dynamicTypeSize(.large)
            #endif
        }
    }

    private var renderConfigKey: String {
        "\(printScope.rawValue)_\(theme.rawValue)_\(documentTitle)_\(mergeLongBlocks)_\(showCompletionStamps)_\(showNotesAndSubtasks)_\(printableItems.count)_\(store.weeklyOverrides.count)_\(store.completedItemKeys.count)_\(store.parentVerifiedItemKeys.count)"
    }

    // MARK: - 1. 실시간 A4 1페이지 미리보기 영역
    private var previewSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("A4 가로 1페이지 실시간 미리보기", systemImage: "doc.viewfinder")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)

                Spacer()

                Text(printScope == .master ? "전체 기본 시간표" : "이번 주 조정 반영됨")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background((printScope == .master ? Color.blue : Color.orange).opacity(0.12))
                    .foregroundStyle(printScope == .master ? .blue : .orange)
                    .clipShape(Capsule())
            }

            // 화면 폭에 맞춰 A4(842x595) 뷰를 정확히 축소 렌더링
            GeometryReader { geo in
                let availableWidth = max(200, geo.size.width)
                let scale = availableWidth / Self.a4LandscapeSize.width

                ZStack {
                    OnePagePrintableScheduleView(
                        items: printableItems,
                        documentTitle: documentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? "WEEKLY SCHEDULE | 주간 시간표"
                            : documentTitle,
                        theme: theme,
                        mergeLongBlocks: mergeLongBlocks,
                        showCompletionStamps: showCompletionStamps,
                        showNotesAndSubtasks: showNotesAndSubtasks,
                        isCompleted: { store.isCompleted($0) },
                        isParentVerified: { store.isParentVerified($0) },
                        heartCount: { store.reaction(for: $0)?.heartCount ?? 0 },
                        totalHeartsThisWeek: store.totalHeartsThisWeek
                    )
                    .frame(
                        width: Self.a4LandscapeSize.width,
                        height: Self.a4LandscapeSize.height
                    )
                    .environment(\.colorScheme, .light)
                    .scaleEffect(scale, anchor: .topLeading)
                }
                .frame(
                    width: availableWidth,
                    height: Self.a4LandscapeSize.height * scale,
                    alignment: .topLeading
                )
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color(.separator), lineWidth: 0.8)
                )
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
            }
            .aspectRatio(Self.a4LandscapeSize.width / Self.a4LandscapeSize.height, contentMode: .fit)

            if let msg = statusMessage {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text(msg)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
        }
    }

    // MARK: - 2. 인쇄 및 PDF/이미지 내보내기 버튼 영역
    private var actionButtonsSection: some View {
        VStack(spacing: 10) {
            // 바로 프린터로 1페이지 인쇄 (AirPrint)
            Button {
                printOnePageSchedule()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "printer.fill")
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("바로 1페이지 인쇄하기 (AirPrint)")
                            .font(.subheadline.weight(.bold))
                        Text("A4 가로 1장에 표 전체가 잘리지 않고 딱 맞게 출력됩니다")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.88))
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.20, green: 0.44, blue: 0.92), Color.indigo],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                // 1페이지 벡터 PDF 파일 공유/저장
                if let pdfURL = exportedPDFURL {
                    ShareLink(
                        item: pdfURL,
                        subject: Text("주간 시간표 (Weekly Schedule)"),
                        message: Text("1페이지 주간 시간표 PDF 파일입니다.")
                    ) {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.richtext.fill")
                            Text("1페이지 PDF 공유·저장")
                                .font(.caption.weight(.bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color(.secondarySystemGroupedBackground))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(.separator), lineWidth: 0.8)
                        )
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }

                // 고화질 이미지(PNG) 공유/사진첩 저장
                if let imgURL = exportedImageURL {
                    ShareLink(
                        item: imgURL,
                        subject: Text("주간 시간표 이미지"),
                        message: Text("주간 시간표 고화질 이미지입니다.")
                    ) {
                        HStack(spacing: 6) {
                            Image(systemName: "photo.fill")
                            Text("고화질 이미지 공유")
                                .font(.caption.weight(.bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color(.secondarySystemGroupedBackground))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(.separator), lineWidth: 0.8)
                        )
                    }
                }
            }

            #if os(macOS)
            Button {
                let pdfData = generateOnePagePDFData()
                PrintExportHelper.saveFileWithPanel(data: pdfData, suggestedFileName: "주간시간표_A4.pdf")
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "square.and.arrow.down")
                    Text("Mac 파일로 PDF 저장...")
                        .font(.caption.weight(.bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemGroupedBackground))
                .foregroundStyle(.primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(.separator), lineWidth: 0.8)
                )
            }
            .buttonStyle(.plain)
            #endif
        }
    }

    // MARK: - 3. 출력 스타일 및 표시 항목 커스텀 영역
    private var customizationSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("출력 스타일 및 표시 옵션")
                .font(.subheadline.weight(.bold))

            // 출력할 시간표 기준 (전체 기본 시간표 vs 이번 주 조정 반영 시간표)
            VStack(alignment: .leading, spacing: 6) {
                Text("출력할 시간표 기준")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            printScope = .master
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                            Text("전체 기본 시간표 (매주)")
                        }
                        .font(.caption.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(printScope == .master ? Color.indigo : Color(.tertiarySystemFill))
                        .foregroundStyle(printScope == .master ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)

                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            printScope = .thisWeek
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar.badge.clock")
                            Text("이번 주 조정 반영 (\(store.currentWeekAdjustmentCount)건)")
                        }
                        .font(.caption.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(printScope == .thisWeek ? Color.orange : Color(.tertiarySystemFill))
                        .foregroundStyle(printScope == .thisWeek ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            }

            Divider()

            // 테마 선택
            VStack(alignment: .leading, spacing: 6) {
                Text("디자인 테마")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    ForEach(SchedulePrintTheme.allCases) { itemTheme in
                        let isSelected = theme == itemTheme
                        Button {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                theme = itemTheme
                            }
                        } label: {
                            Text(itemTheme.shortLabel)
                                .font(.caption.weight(.bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(isSelected ? Color.accentColor : Color(.tertiarySystemFill))
                                .foregroundStyle(isSelected ? .white : .primary)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Divider()

            // 상단 제목 편집
            VStack(alignment: .leading, spacing: 6) {
                Text("상단 제목 문구")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                HStack {
                    TextField("WEEKLY SCHEDULE | 주간 시간표", text: $documentTitle)
                        .font(.subheadline)
                        .padding(9)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    if documentTitle != "WEEKLY SCHEDULE | 주간 시간표" {
                        Button("기본값") {
                            documentTitle = "WEEKLY SCHEDULE | 주간 시간표"
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
            }

            Divider()

            Toggle(isOn: $mergeLongBlocks.animation()) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("장기 일정 셀 하나로 병합하기")
                        .font(.subheadline.weight(.medium))
                    Text("토요일 주간 미션(12:00~22:30), 일요일 자유시간(20:00~22:00) 등 여러 칸에 걸친 일정을 깔끔하게 한 칸으로 합칩니다.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Toggle(isOn: $showNotesAndSubtasks.animation()) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("세부 할 일 목록 & 시간 메모 표시")
                        .font(.subheadline.weight(.medium))
                    Text("토요일 1~4번 체크리스트와 수업 시간(9:30-10:10 등)을 표 안에 함께 출력합니다.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Toggle(isOn: $showCompletionStamps.animation()) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("이번 주 완료 체크 & 부모 확인 도장·하트 표시")
                        .font(.subheadline.weight(.medium))
                    Text("벽에 붙여둘 기본 시간표로 뽑을 때는 끄고, 주간 칭찬 리포트로 뽑을 때는 켜보세요.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - PDF & Image Rendering + AirPrint
    @MainActor
    private func makePrintableView() -> some View {
        OnePagePrintableScheduleView(
            items: printableItems,
            documentTitle: documentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "WEEKLY SCHEDULE | 주간 시간표"
                : documentTitle,
            theme: theme,
            mergeLongBlocks: mergeLongBlocks,
            showCompletionStamps: showCompletionStamps,
            showNotesAndSubtasks: showNotesAndSubtasks,
            isCompleted: { store.isCompleted($0) },
            isParentVerified: { store.isParentVerified($0) },
            heartCount: { store.reaction(for: $0)?.heartCount ?? 0 },
            totalHeartsThisWeek: store.totalHeartsThisWeek
        )
        .frame(
            width: Self.a4LandscapeSize.width,
            height: Self.a4LandscapeSize.height
        )
        .environment(\.colorScheme, .light)
    }

    @MainActor
    private func generateOnePagePDFData() -> Data {
        PrintExportHelper.generatePDFData(from: makePrintableView(), size: Self.a4LandscapeSize)
    }

    @MainActor
    private func regenerateExportFiles() async {
        let pdfData = generateOnePagePDFData()
        let tempDir = FileManager.default.temporaryDirectory

        let pdfURL = tempDir.appendingPathComponent("WeeklySchedule_1Page.pdf")
        try? pdfData.write(to: pdfURL, options: .atomic)
        self.exportedPDFURL = pdfURL

        if let pngData = PrintExportHelper.generatePNGData(from: makePrintableView(), size: Self.a4LandscapeSize, scale: 3.0) {
            let imgURL = tempDir.appendingPathComponent("WeeklySchedule_1Page.png")
            try? pngData.write(to: imgURL, options: .atomic)
            self.exportedImageURL = imgURL
        }
    }

    @MainActor
    private func printOnePageSchedule() {
        let pdfData = generateOnePagePDFData()
        #if os(iOS)
        guard UIPrintInteractionController.canPrint(pdfData) else {
            statusMessage = "이 기기에서 프린터 기능을 열 수 없습니다. PDF 공유 버튼을 이용해 주세요."
            return
        }

        let printController = UIPrintInteractionController.shared
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.jobName = "주간 시간표 (Weekly Schedule - 1 Page)"
        printInfo.outputType = .general
        printInfo.orientation = .landscape
        printController.printInfo = printInfo
        printController.showsNumberOfCopies = true
        printController.printingItem = pdfData

        printController.present(animated: true) { _, completed, error in
            if completed {
                statusMessage = "🖨️ 1페이지 주간 시간표 인쇄가 전송되었습니다!"
            } else if let error {
                statusMessage = "인쇄 오류: \(error.localizedDescription)"
            }
        }
        #elseif os(macOS)
        PrintExportHelper.printPDF(data: pdfData)
        statusMessage = "🖨️ macOS 인쇄 대화상자가 열렸습니다."
        #endif
    }
}

// MARK: - 1페이지 A4 가로 주간 시간표 렌더링 뷰 (PDF 참고 레이아웃 완벽 구현)
struct OnePagePrintableScheduleView: View {
    let items: [ScheduleItem]
    let documentTitle: String
    let theme: SchedulePrintTheme
    let mergeLongBlocks: Bool
    let showCompletionStamps: Bool
    let showNotesAndSubtasks: Bool
    let isCompleted: (ScheduleItem) -> Bool
    let isParentVerified: (ScheduleItem) -> Bool
    let heartCount: (ScheduleItem) -> Int
    let totalHeartsThisWeek: Int

    typealias PrintableTimeSlot = SchedulePrintHelper.PrintableTimeSlot
    typealias DayCellBlock = SchedulePrintHelper.DayCellBlock

    /// 기본 14개 시간 슬롯 + 사용자가 추가한 커스텀 시간대 자동 병합
    private var timeSlots: [PrintableTimeSlot] {
        SchedulePrintHelper.generateTimeSlots(for: items)
    }

    /// 요일별 세로 컬럼 블록 계산 (병합된 셀은 spanCount만큼의 높이를 차지하여 표 테두리가 끊기지 않음)
    private func buildColumnBlocks(for weekday: Weekday, slots: [PrintableTimeSlot]) -> [DayCellBlock] {
        SchedulePrintHelper.buildColumnBlocks(
            for: weekday,
            items: items,
            slots: slots,
            mergeLongBlocks: mergeLongBlocks
        )
    }

    // MARK: - 테마별 색상 팔레트
    private var headerBackgroundColor: Color {
        switch theme {
        case .classicMint:
            return Color(red: 0.855, green: 0.914, blue: 0.886) // PDF 원본 세이지 그린 (#DAE9E2)
        case .categoryColor:
            return Color(red: 0.23, green: 0.36, blue: 0.68)
        case .monoInkSaver:
            return Color(white: 0.90)
        }
    }

    private var headerTextColor: Color {
        switch theme {
        case .classicMint, .monoInkSaver:
            return Color(red: 0.14, green: 0.20, blue: 0.18)
        case .categoryColor:
            return Color.white
        }
    }

    private var timeColumnBackgroundColor: Color {
        switch theme {
        case .classicMint:
            return Color(red: 0.925, green: 0.945, blue: 0.937) // PDF 좌측 시간 열 연한 그레이-민트 (#ECF1EF)
        case .categoryColor:
            return Color(red: 0.95, green: 0.96, blue: 0.98)
        case .monoInkSaver:
            return Color(white: 0.95)
        }
    }

    private var gridLineColor: Color {
        switch theme {
        case .classicMint:
            return Color(red: 0.78, green: 0.82, blue: 0.80)
        case .categoryColor:
            return Color(red: 0.80, green: 0.83, blue: 0.88)
        case .monoInkSaver:
            return Color(white: 0.45)
        }
    }

    private var spanBlockHighlightColor: Color {
        switch theme {
        case .classicMint:
            return Color(red: 0.914, green: 0.957, blue: 0.937) // PDF 토요일/일요일 병합 셀 연민트 (#E9F4EF)
        case .categoryColor:
            return Color(red: 0.91, green: 0.96, blue: 0.94)
        case .monoInkSaver:
            return Color(white: 0.97)
        }
    }

    var body: some View {
        GeometryReader { geo in
            let horizontalPad: CGFloat = 26
            let verticalPad: CGFloat = 22
            let totalW = geo.size.width
            let totalH = geo.size.height

            let contentW = totalW - horizontalPad * 2
            let titleAreaH: CGFloat = 38
            let tableH = totalH - verticalPad * 2 - titleAreaH
            let headerRowH: CGFloat = 27
            let slots = timeSlots
            let slotCount = max(1, slots.count)
            let rowH = (tableH - headerRowH) / CGFloat(slotCount)

            let timeColW: CGFloat = 64
            let dayColW = (contentW - timeColW) / 7.0

            VStack(spacing: 0) {
                // 상단 타이틀 영역
                ZStack {
                    Text(documentTitle)
                        .font(.system(size: 16.5, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Color(red: 0.16, green: 0.25, blue: 0.22))

                    if showCompletionStamps {
                        HStack {
                            Spacer()
                            HStack(spacing: 8) {
                                Label("아이 완료", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(Color.blue)
                                Label("부모 확인", systemImage: "checkmark.seal.fill")
                                    .foregroundStyle(Color.green)
                                if totalHeartsThisWeek > 0 {
                                    Label("하트 \(totalHeartsThisWeek)", systemImage: "heart.fill")
                                        .foregroundStyle(Color.pink)
                                }
                            }
                            .font(.system(size: 8.5, weight: .bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color(white: 0.95))
                            .clipShape(Capsule())
                        }
                    }
                }
                .frame(width: contentW, height: titleAreaH)

                // 메인 주간 시간표 테이블 (항상 1페이지에 정확히 수렴)
                VStack(spacing: 0) {
                    // 1. 헤더 행 (시간 | 월요일 ~ 일요일)
                    HStack(spacing: 0) {
                        Text("시간")
                            .font(.system(size: 9.2, weight: .bold))
                            .foregroundStyle(headerTextColor)
                            .frame(width: timeColW, height: headerRowH)
                            .background(headerBackgroundColor)
                            .overlay(Rectangle().stroke(gridLineColor, lineWidth: 0.5))

                        ForEach(Weekday.allCases) { day in
                            Text(day.fullName)
                                .font(.system(size: 9.2, weight: .bold))
                                .foregroundStyle(headerTextColor)
                                .frame(width: dayColW, height: headerRowH)
                                .background(headerBackgroundColor)
                                .overlay(Rectangle().stroke(gridLineColor, lineWidth: 0.5))
                        }
                    }
                    .frame(width: contentW, height: headerRowH)

                    // 2. 본문 영역 (좌측 시간 열 + 월~일 7개 요일 열)
                    HStack(alignment: .top, spacing: 0) {
                        // 좌측 시간 열
                        VStack(spacing: 0) {
                            ForEach(slots) { slot in
                                Text(slot.label)
                                    .font(.system(size: 8.5, weight: .bold))
                                    .foregroundStyle(Color(red: 0.15, green: 0.20, blue: 0.18))
                                    .frame(width: timeColW, height: rowH)
                                    .background(timeColumnBackgroundColor)
                                    .overlay(Rectangle().stroke(gridLineColor, lineWidth: 0.5))
                            }
                        }
                        .frame(width: timeColW, height: rowH * CGFloat(slotCount))

                        // 월~일 각 요일 열 (장기 일정 셀 병합 지원)
                        ForEach(Weekday.allCases) { day in
                            let blocks = buildColumnBlocks(for: day, slots: slots)
                            VStack(spacing: 0) {
                                ForEach(blocks) { block in
                                    dayCellView(
                                        block: block,
                                        width: dayColW,
                                        height: rowH * CGFloat(block.spanCount)
                                    )
                                }
                            }
                            .frame(width: dayColW, height: rowH * CGFloat(slotCount))
                        }
                    }
                    .frame(width: contentW, height: rowH * CGFloat(slotCount))
                }
                .overlay(
                    Rectangle()
                        .stroke(gridLineColor, lineWidth: 0.8)
                )
            }
            .padding(.horizontal, horizontalPad)
            .padding(.vertical, verticalPad)
            .frame(width: totalW, height: totalH)
            .background(Color.white)
        }
    }

    // MARK: - 개별 셀 (단일 행 또는 다중 행 병합 셀) 렌더링
    @ViewBuilder
    private func dayCellView(block: DayCellBlock, width: CGFloat, height: CGFloat) -> some View {
        let cellBg: Color = {
            if block.items.isEmpty {
                return Color.white
            }
            if block.isHighlightedSpanBlock {
                return spanBlockHighlightColor
            }
            if theme == .categoryColor, let first = block.items.first {
                return first.category.color.opacity(0.11)
            }
            return Color.white
        }()

        ZStack {
            if block.items.isEmpty {
                Color.clear
            } else if block.isHighlightedSpanBlock, let item = block.items.first {
                spannedBlockContentView(item: item)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 4)
            } else {
                VStack(spacing: 2) {
                    ForEach(block.items) { item in
                        let isContinuation = item.startTotalMinutes < block.slot.totalMinutes
                        regularCellItemContentView(
                            item: item,
                            slot: block.slot,
                            nextSlotMinutes: block.nextSlotMinutes,
                            isContinuation: isContinuation
                        )
                    }
                }
                .padding(.horizontal, 3)
                .padding(.vertical, 1.5)
            }
        }
        .frame(width: width, height: height)
        .background(cellBg)
        .overlay(Rectangle().stroke(gridLineColor, lineWidth: 0.5))
    }

    /// 다중 행 병합 셀 내부 콘텐츠 (예: 토요일 주간 미션 & 도서관 체크리스트, 일요일 자유시간 등)
    @ViewBuilder
    private func spannedBlockContentView(item: ScheduleItem) -> some View {
        let lines = formattedChecklistLines(for: item)

        VStack(spacing: 4) {
            if !lines.isEmpty && showNotesAndSubtasks {
                VStack(spacing: 3.5) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                        Text(line.text)
                            .font(.system(size: line.isSubBullet ? 7.8 : 8.4, weight: line.isSubBullet ? .medium : .bold))
                            .foregroundStyle(Color(red: 0.14, green: 0.20, blue: 0.18))
                            .multilineTextAlignment(.center)
                    }
                }
            } else {
                Text(formatDisplayLines(for: item, isContinuation: false, nextSlotMinutes: 24 * 60).titleText)
                    .font(.system(size: 9.0, weight: .bold))
                    .foregroundStyle(Color(red: 0.14, green: 0.20, blue: 0.18))
                    .multilineTextAlignment(.center)

                if showNotesAndSubtasks,
                   let sub = formatDisplayLines(for: item, isContinuation: false, nextSlotMinutes: 24 * 60).subtitleText {
                    Text(sub)
                        .font(.system(size: 8.2, weight: .semibold))
                        .foregroundStyle(Color(red: 0.22, green: 0.30, blue: 0.27))
                        .multilineTextAlignment(.center)
                }
            }

            if showCompletionStamps {
                stampBadgeRow(for: item)
            }
        }
    }

    /// 일반 1칸 셀 내부 콘텐츠 (줄바꿈 및 시간 표시 최적화)
    @ViewBuilder
    private func regularCellItemContentView(
        item: ScheduleItem,
        slot: PrintableTimeSlot,
        nextSlotMinutes: Int,
        isContinuation: Bool
    ) -> some View {
        let formatted = formatDisplayLines(
            for: item,
            isContinuation: isContinuation,
            nextSlotMinutes: nextSlotMinutes
        )

        VStack(spacing: 1) {
            HStack(spacing: 2) {
                if showCompletionStamps {
                    if isParentVerified(item) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 7.5))
                            .foregroundStyle(Color.green)
                    } else if isCompleted(item) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 7.5))
                            .foregroundStyle(Color.blue)
                    }
                }

                Text(formatted.titleText)
                    .font(.system(size: 8.0, weight: .semibold))
                    .foregroundStyle(Color(red: 0.15, green: 0.18, blue: 0.17))
                    .multilineTextAlignment(.center)
                    .lineSpacing(0.5)
                    .fixedSize(horizontal: false, vertical: true)

                if showCompletionStamps && !isContinuation && heartCount(item) > 0 {
                    HStack(spacing: 0.5) {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 6.5))
                        Text("\(heartCount(item))")
                            .font(.system(size: 6.5, weight: .bold))
                    }
                    .foregroundStyle(Color.pink)
                }
            }

            if showNotesAndSubtasks, let subtitle = formatted.subtitleText {
                Text(subtitle)
                    .font(.system(size: 7.4, weight: .medium))
                    .foregroundStyle(Color(red: 0.25, green: 0.30, blue: 0.28))
                    .multilineTextAlignment(.center)
            }
        }
    }

    @ViewBuilder
    private func stampBadgeRow(for item: ScheduleItem) -> some View {
        HStack(spacing: 3) {
            if isParentVerified(item) {
                Label("부모확인", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.green)
            } else if isCompleted(item) {
                Label("완료", systemImage: "checkmark.circle.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.blue)
            }
            if heartCount(item) > 0 {
                Label("\(heartCount(item))", systemImage: "heart.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.pink)
            }
        }
    }

    // MARK: - 텍스트 줄바꿈 & 시간 보조 문구 스마트 포매터 (참고 PDF 스타일)
    private struct ChecklistLine {
        let text: String
        let isSubBullet: Bool
    }

    /// 토요일 미션 등 세부 할 일(SubTasks)이 있는 장기 블록을 참고 PDF처럼 계층형 텍스트로 변환
    private func formattedChecklistLines(for item: ScheduleItem) -> [ChecklistLine] {
        guard !item.subTasks.isEmpty else { return [] }
        var lines: [ChecklistLine] = []
        var emittedGroupHeaders = Set<String>()

        for sub in item.subTasks {
            let raw = sub.title.trimmingCharacters(in: .whitespacesAndNewlines)
            if raw.contains(" - ") {
                let parts = raw.components(separatedBy: " - ")
                if parts.count == 2 {
                    let groupHeader = parts[0].trimmingCharacters(in: .whitespaces)
                    let childText = parts[1].trimmingCharacters(in: .whitespaces)
                    if !emittedGroupHeaders.contains(groupHeader) {
                        emittedGroupHeaders.insert(groupHeader)
                        lines.append(ChecklistLine(text: groupHeader, isSubBullet: false))
                    }
                    lines.append(ChecklistLine(text: "· \(childText)", isSubBullet: true))
                    continue
                }
            }
            lines.append(ChecklistLine(text: raw, isSubBullet: false))
        }
        return lines
    }

    private func formatDisplayLines(
        for item: ScheduleItem,
        isContinuation: Bool,
        nextSlotMinutes: Int
    ) -> (titleText: String, subtitleText: String?) {
        var title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)

        // 긴 제목이 1페이지 표 셀 안에서 예쁘게 2줄로 표시되도록 자연스러운 줄바꿈 적용
        if title.contains("Vocabulary for Reading + ") {
            title = title.replacingOccurrences(of: "Vocabulary for Reading + ", with: "Vocabulary for Reading\n+ ")
        } else if title.contains(" 읽고 ") {
            title = title.replacingOccurrences(of: " 읽고 ", with: " 읽고\n")
        } else if title.contains(" · ") {
            title = title.replacingOccurrences(of: " · ", with: "\n")
        } else if title.contains(" + ") && title.count >= 16 {
            title = title.replacingOccurrences(of: " + ", with: "\n")
        }

        // 이전 시간대에서 이어지는 일정인데 이번 슬롯 중간에 끝나는 경우 (예: 오케스트라 연습 (~17:30))
        if isContinuation {
            if item.endTotalMinutes < nextSlotMinutes && item.endMinute != 0 {
                let endStr = String(format: "(~%d:%02d)", item.endHour, item.endMinute)
                return (title, endStr)
            }
            return (title, nil)
        }

        // 메모에 시간 범위(예: "9:30 - 10:10", "10:30 - 11:20", "16:00 - 17:30", "20:00 - 22:00")가 있으면 깔끔하게 표시
        let cleanNote = item.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if let rangeMatch = extractTimeRangeToken(from: cleanNote) {
            return (title, rangeMatch)
        }

        return (title, nil)
    }

    private func extractTimeRangeToken(from note: String) -> String? {
        guard !note.isEmpty else { return nil }
        // "9:30 - 10:10", "20:00 - 22:00 신나는 자유시간!" 등에서 시간 구간 추출
        let compact = note.replacingOccurrences(of: " - ", with: "-")
            .replacingOccurrences(of: " ~ ", with: "-")
        let tokens = compact.components(separatedBy: .whitespaces)
        if let first = tokens.first, first.contains(":") && first.contains("-") {
            return first
        }
        return nil
    }
}
