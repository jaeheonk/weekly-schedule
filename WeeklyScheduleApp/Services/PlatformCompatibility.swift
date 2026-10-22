import SwiftUI
import CoreGraphics
#if canImport(AppKit)
import AppKit
import PDFKit
#endif
#if canImport(UIKit)
import UIKit
#endif

// MARK: - 시스템 컬러 크로스 플랫폼 브릿지
#if os(macOS)
public enum AppSystemColor {
    case systemBackground
    case secondarySystemBackground
    case tertiarySystemBackground
    case systemGroupedBackground
    case secondarySystemGroupedBackground
    case tertiarySystemGroupedBackground
    case separator
    case link
    case systemFill
    case secondarySystemFill
    case tertiarySystemFill
}

public extension Color {
    init(_ systemColor: AppSystemColor) {
        switch systemColor {
        case .systemBackground:
            self = Color(nsColor: .windowBackgroundColor)
        case .secondarySystemBackground:
            self = Color(nsColor: .controlBackgroundColor)
        case .tertiarySystemBackground:
            self = Color(nsColor: .underPageBackgroundColor)
        case .systemGroupedBackground:
            self = Color(nsColor: .windowBackgroundColor)
        case .secondarySystemGroupedBackground:
            self = Color(nsColor: .controlBackgroundColor)
        case .tertiarySystemGroupedBackground:
            self = Color(nsColor: .underPageBackgroundColor)
        case .separator:
            self = Color(nsColor: .separatorColor)
        case .link:
            self = Color(nsColor: .linkColor)
        case .systemFill:
            self = Color(nsColor: .controlColor)
        case .secondarySystemFill:
            self = Color(nsColor: .controlColor.withAlphaComponent(0.5))
        case .tertiarySystemFill:
            self = Color(nsColor: .controlColor.withAlphaComponent(0.25))
        }
    }
}
#endif

// MARK: - 햅틱 피드백 크로스 플랫폼 헬퍼
enum HapticFeedbackHelper {
    static func light() {
        #if os(iOS)
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.generic, performanceTime: .now)
        #endif
    }

    static func selection() {
        #if os(iOS)
        let selection = UISelectionFeedbackGenerator()
        selection.selectionChanged()
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.generic, performanceTime: .now)
        #endif
    }

    static func success() {
        #if os(iOS)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
        #endif
    }

    static func warning() {
        #if os(iOS)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.levelChange, performanceTime: .now)
        #endif
    }

    static func error() {
        #if os(iOS)
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
        #elseif os(macOS)
        NSHapticFeedbackManager.defaultPerformer.perform(.levelChange, performanceTime: .now)
        #endif
    }
}

// MARK: - View Modifier & Toolbar 크로스 플랫폼 확장
extension ToolbarItemPlacement {
    static var appLeading: ToolbarItemPlacement {
        #if os(iOS)
        return .topBarLeading
        #else
        return .navigation
        #endif
    }

    static var appTrailing: ToolbarItemPlacement {
        #if os(iOS)
        return .topBarTrailing
        #else
        return .primaryAction
        #endif
    }
}

extension View {
    @ViewBuilder
    func inlineNavigationBarTitle() -> some View {
        #if os(iOS)
        self.navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }

    @ViewBuilder
    func adaptivePresentationDetents() -> some View {
        #if os(iOS)
        self.presentationDetents([.large])
            .presentationDragIndicator(.visible)
        #else
        self.frame(minWidth: 500, minHeight: 600)
        #endif
    }

    @ViewBuilder
    func neverAutocapitalization() -> some View {
        #if os(iOS)
        self.textInputAutocapitalization(.never)
        #else
        self
        #endif
    }
}

// MARK: - PDF & 인쇄 크로스 플랫폼 헬퍼
enum PrintExportHelper {
    @MainActor
    static func generatePDFData(from view: some View, size: CGSize) -> Data {
        let pdfData = NSMutableData()
        var mediaBox = CGRect(origin: .zero, size: size)
        guard let consumer = CGDataConsumer(data: pdfData as CFMutableData),
              let pdfContext = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            return Data()
        }
        let renderer = ImageRenderer(content: view)
        renderer.proposedSize = ProposedViewSize(size)
        pdfContext.beginPDFPage(nil)
        renderer.render { _, renderInContext in
            renderInContext(pdfContext)
        }
        pdfContext.endPDFPage()
        pdfContext.closePDF()
        return pdfData as Data
    }

    @MainActor
    static func generatePNGData(from view: some View, size: CGSize, scale: CGFloat = 3.0) -> Data? {
        let renderer = ImageRenderer(content: view)
        renderer.proposedSize = ProposedViewSize(size)
        renderer.scale = scale

        #if os(iOS)
        return renderer.uiImage?.pngData()
        #elseif os(macOS)
        guard let nsImage = renderer.nsImage,
              let tiffData = nsImage.tiffRepresentation,
              let bitmapRep = NSBitmapImageRep(data: tiffData) else {
            return nil
        }
        return bitmapRep.representation(using: .png, properties: [:])
        #endif
    }

    #if os(macOS)
    @MainActor
    static func printPDF(data: Data, window: NSWindow? = nil) {
        guard let document = PDFDocument(data: data) else { return }
        let printInfo = (NSPrintInfo.shared.copy() as? NSPrintInfo) ?? NSPrintInfo()
        printInfo.orientation = .landscape
        printInfo.horizontalPagination = .fit
        printInfo.verticalPagination = .fit
        printInfo.topMargin = 18
        printInfo.bottomMargin = 18
        printInfo.leftMargin = 18
        printInfo.rightMargin = 18

        if let printOp = document.printOperation(for: printInfo, scalingMode: .pageScaleToFit, autoRotate: true) {
            printOp.showsPrintPanel = true
            printOp.showsProgressPanel = true
            if let window = window ?? NSApplication.shared.keyWindow {
                printOp.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
            } else {
                printOp.run()
            }
        }
    }

    @MainActor
    static func saveFileWithPanel(data: Data, suggestedFileName: String, window: NSWindow? = nil) {
        let savePanel = NSSavePanel()
        savePanel.canCreateDirectories = true
        savePanel.nameFieldStringValue = suggestedFileName
        savePanel.showsHiddenFiles = false

        let handler: (NSApplication.ModalResponse) -> Void = { response in
            if response == .OK, let url = savePanel.url {
                try? data.write(to: url, options: .atomic)
            }
        }

        if let window = window ?? NSApplication.shared.keyWindow {
            savePanel.beginSheetModal(for: window, completionHandler: handler)
        } else {
            let response = savePanel.runModal()
            handler(response)
        }
    }
    #endif
}
