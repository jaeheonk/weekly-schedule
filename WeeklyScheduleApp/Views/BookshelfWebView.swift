import SwiftUI
import WebKit

// MARK: - Bookshelf Web ViewModel
@MainActor
final class BookshelfWebViewModel: ObservableObject {
    static let targetURL = URL(string: "https://gyogwa-books.grok.me")!

    @Published var isLoading: Bool = false
    @Published var estimatedProgress: Double = 0.0
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false
    @Published var errorMessage: String? = nil
    @Published var hasLoadedOnce: Bool = false

    weak var webView: WKWebView?

    func makeConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        #endif
        return config
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func loadIfNeeded() {
        if webView?.url == nil {
            load(url: Self.targetURL)
        }
    }

    func load(url: URL) {
        errorMessage = nil
        let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        webView?.load(request)
    }

    func reload() {
        errorMessage = nil
        if let webView = webView {
            if webView.url != nil {
                webView.reload()
            } else {
                load(url: Self.targetURL)
            }
        }
    }

    func retry() {
        reload()
    }

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }
}

// MARK: - WKNavigationDelegate Coordinator
final class BookshelfWebCoordinator: NSObject, WKNavigationDelegate {
    private weak var viewModel: BookshelfWebViewModel?
    private var progressObservation: NSKeyValueObservation?
    private var canGoBackObservation: NSKeyValueObservation?
    private var canGoForwardObservation: NSKeyValueObservation?

    init(viewModel: BookshelfWebViewModel) {
        self.viewModel = viewModel
        super.init()
    }

    func setupObservers(for webView: WKWebView) {
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            Task { @MainActor [weak self] in
                self?.viewModel?.estimatedProgress = webView.estimatedProgress
            }
        }
        canGoBackObservation = webView.observe(\.canGoBack, options: [.new]) { [weak self] webView, _ in
            Task { @MainActor [weak self] in
                self?.viewModel?.canGoBack = webView.canGoBack
            }
        }
        canGoForwardObservation = webView.observe(\.canGoForward, options: [.new]) { [weak self] webView, _ in
            Task { @MainActor [weak self] in
                self?.viewModel?.canGoForward = webView.canGoForward
            }
        }
    }

    deinit {
        progressObservation?.invalidate()
        canGoBackObservation?.invalidate()
        canGoForwardObservation?.invalidate()
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        Task { @MainActor [weak self] in
            self?.viewModel?.isLoading = true
            self?.viewModel?.errorMessage = nil
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor [weak self] in
            guard let viewModel = self?.viewModel else { return }
            viewModel.isLoading = false
            viewModel.errorMessage = nil
            viewModel.hasLoadedOnce = true
            viewModel.canGoBack = webView.canGoBack
            viewModel.canGoForward = webView.canGoForward
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        Task { @MainActor [weak self] in
            guard let viewModel = self?.viewModel else { return }
            viewModel.isLoading = false
            if nsError.code != NSURLErrorCancelled {
                viewModel.errorMessage = error.localizedDescription
            }
            viewModel.canGoBack = webView.canGoBack
            viewModel.canGoForward = webView.canGoForward
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        Task { @MainActor [weak self] in
            guard let viewModel = self?.viewModel else { return }
            viewModel.isLoading = false
            if nsError.code != NSURLErrorCancelled {
                viewModel.errorMessage = error.localizedDescription
            }
            viewModel.canGoBack = webView.canGoBack
            viewModel.canGoForward = webView.canGoForward
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // gyogwa-books.grok.me 허용 및 내부 네비게이션 정책 준수 (Stop Rule)
        if let host = url.host?.lowercased(), host == "gyogwa-books.grok.me" || host.hasSuffix(".grok.me") {
            decisionHandler(.allow)
        } else if url.scheme == "about" || url.scheme == "data" {
            decisionHandler(.allow)
        } else {
            // 외부 서드파티 도메인 이탈 차단
            decisionHandler(.cancel)
        }
    }
}

// MARK: - Platform WKWebView Representable
#if os(iOS)
struct PlatformWebViewRepresentable: UIViewRepresentable {
    @ObservedObject var viewModel: BookshelfWebViewModel

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: viewModel.makeConfiguration())
        viewModel.attach(webView: webView)
        webView.navigationDelegate = context.coordinator
        context.coordinator.setupObservers(for: webView)
        viewModel.loadIfNeeded()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> BookshelfWebCoordinator {
        BookshelfWebCoordinator(viewModel: viewModel)
    }
}
#elseif os(macOS)
struct PlatformWebViewRepresentable: NSViewRepresentable {
    @ObservedObject var viewModel: BookshelfWebViewModel

    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: viewModel.makeConfiguration())
        viewModel.attach(webView: webView)
        webView.navigationDelegate = context.coordinator
        context.coordinator.setupObservers(for: webView)
        viewModel.loadIfNeeded()
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    func makeCoordinator() -> BookshelfWebCoordinator {
        BookshelfWebCoordinator(viewModel: viewModel)
    }
}
#endif

// MARK: - BookshelfWebView
struct BookshelfWebView: View {
    @StateObject private var viewModel = BookshelfWebViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                PlatformWebViewRepresentable(viewModel: viewModel)
                    #if os(iOS)
                    .ignoresSafeArea(.container, edges: .bottom)
                    #endif

                // 초기 로딩 인디케이터
                if viewModel.isLoading && !viewModel.hasLoadedOnce && viewModel.errorMessage == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("책장 불러오는 중...")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(24)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
                }

                // 네트워크 오류 재시도 UI
                if let errorMessage = viewModel.errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)

                        VStack(spacing: 6) {
                            Text("책장을 불러올 수 없습니다")
                                .font(.headline)

                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 24)
                        }

                        Button {
                            viewModel.retry()
                        } label: {
                            Label("다시 시도", systemImage: "arrow.clockwise")
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.25, green: 0.42, blue: 0.95))
                    }
                    .padding(32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                }
            }
            .safeAreaInset(edge: .top) {
                // 상단 선형 진행률 표시줄
                if viewModel.isLoading {
                    ProgressView(value: viewModel.estimatedProgress)
                        .progressViewStyle(.linear)
                        .tint(Color(red: 0.25, green: 0.42, blue: 0.95))
                        .frame(height: 3)
                }
            }
            .navigationTitle("책장")
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItemGroup(placement: .appTrailing) {
                    Button {
                        viewModel.goBack()
                    } label: {
                        Image(systemName: "chevron.backward")
                    }
                    .disabled(!viewModel.canGoBack)
                    .help("이전 페이지")

                    Button {
                        viewModel.goForward()
                    } label: {
                        Image(systemName: "chevron.forward")
                    }
                    .disabled(!viewModel.canGoForward)
                    .help("다음 페이지")

                    Button {
                        viewModel.reload()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(viewModel.isLoading)
                    .help("새로고침")
                }
            }
        }
    }
}
