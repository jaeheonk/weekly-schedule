import SwiftUI
import WebKit

// MARK: - Bookshelf Custom URL Scheme Handler (Safari / Screen Time Bypass Proxy)
/// Safari 및 iOS 스크린타임 웹 콘텐츠 필터는 WebKit의 원격 http/https 네트워크 통신에만 개입합니다.
/// BookshelfURLSchemeHandler는 커스텀 스킴(bookshelf://) 요청을 가로채서,
/// '항상 허용'된 주간 시간표 앱 자체의 네이티브 URLSession으로 데이터를 가져와 웹뷰에 스트리밍합니다.
/// 따라서 Safari가 시간 제한 또는 다운타임으로 차단되어 있어도 책장은 정상적으로 로드됩니다.
final class BookshelfURLSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "bookshelf"
    static let defaultHost = "gyogwa-books.grok.me"

    private var activeTasks = [ObjectIdentifier: URLSessionDataTask]()
    private let lock = NSLock()
    private let session: URLSession

    override init() {
        let configuration = URLSessionConfiguration.default
        configuration.requestCachePolicy = .useProtocolCachePolicy
        self.session = URLSession(configuration: configuration)
        super.init()
    }

    static func readData(from stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let bytesRead = stream.read(buffer, maxLength: bufferSize)
            if bytesRead <= 0 { break }
            data.append(buffer, count: bytesRead)
        }
        return data
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url,
              var components = URLComponents(url: requestURL, resolvingAgainstBaseURL: false) else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // bookshelf:// -> https:// 로 변환
        components.scheme = "https"
        if components.host == nil || components.host?.isEmpty == true {
            components.host = Self.defaultHost
        }

        guard let targetURL = components.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var request = URLRequest(url: targetURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        request.httpMethod = urlSchemeTask.request.httpMethod ?? "GET"

        if let headers = urlSchemeTask.request.allHTTPHeaderFields {
            for (key, val) in headers {
                let lower = key.lowercased()
                if lower == "host" { continue }
                // 커스텀 스킴(bookshelf://)으로 인해 잘못 들어간 Origin, Referer, Sec-Fetch-Site는 원본 서버 기준에 맞게 정규화
                if lower == "origin" || lower == "referer" || lower == "sec-fetch-site" { continue }
                request.setValue(val, forHTTPHeaderField: key)
            }
        }

        // gyogwa-books.grok.me 대상 요청에 대해 same-origin 헤더 설정
        // Cloudflare 및 TanStack Start가 비표준 스킴(bookshelf://)의 호출을 CSRF 차단(403 Forbidden)하는 것을 방지
        if targetURL.host == Self.defaultHost || targetURL.host?.hasSuffix(".grok.me") == true {
            request.setValue("https://\(Self.defaultHost)", forHTTPHeaderField: "Origin")
            request.setValue("https://\(Self.defaultHost)/", forHTTPHeaderField: "Referer")
            request.setValue("same-origin", forHTTPHeaderField: "Sec-Fetch-Site")
            if request.value(forHTTPHeaderField: "Sec-Fetch-Mode") == nil {
                request.setValue("cors", forHTTPHeaderField: "Sec-Fetch-Mode")
            }
            if request.value(forHTTPHeaderField: "Sec-Fetch-Dest") == nil {
                request.setValue("empty", forHTTPHeaderField: "Sec-Fetch-Dest")
            }
        }

        // HTTP Body 복원: WebKit WKURLSchemeTask가 POST body를 누락시키는 문제를 해결
        if let base64Body = urlSchemeTask.request.value(forHTTPHeaderField: "X-Proxy-Body-Base64"),
           let bodyData = Data(base64Encoded: base64Body) {
            request.httpBody = bodyData
        } else if let body = urlSchemeTask.request.httpBody {
            request.httpBody = body
        } else if let stream = urlSchemeTask.request.httpBodyStream {
            request.httpBody = Self.readData(from: stream)
        }

        let taskId = ObjectIdentifier(urlSchemeTask)
        let dataTask = session.dataTask(with: request) { [weak self, weak urlSchemeTask] data, response, error in
            guard let self = self, let task = urlSchemeTask else { return }

            self.lock.lock()
            let isActive = self.activeTasks.removeValue(forKey: taskId) != nil
            self.lock.unlock()

            guard isActive else { return }

            if let error = error {
                let nsError = error as NSError
                if nsError.code != NSURLErrorCancelled {
                    task.didFailWithError(error)
                }
                return
            }

            guard let httpResponse = response as? HTTPURLResponse, var responseData = data else {
                task.didFailWithError(URLError(.badServerResponse))
                return
            }

            var headers = httpResponse.allHeaderFields as? [String: String] ?? [:]
            // CORS 및 CSP 보안 정책 완화 (모든 하위 에셋 및 서버 함수 응답이 프록시 스킴을 통해 안전하게 렌더링되도록 함)
            headers["Access-Control-Allow-Origin"] = "*"
            headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, HEAD"
            headers["Access-Control-Allow-Headers"] = "*"
            headers["Access-Control-Expose-Headers"] = "*"
            headers.removeValue(forKey: "Content-Security-Policy")
            headers.removeValue(forKey: "content-security-policy")
            headers.removeValue(forKey: "Content-Encoding")
            headers.removeValue(forKey: "content-encoding")
            headers.removeValue(forKey: "Content-Length")
            headers.removeValue(forKey: "content-length")

            // HTML 및 CSS 내부의 https:// 링크를 bookshelf:// 로 치환하여 모든 책 표지 및 스타일 에셋이 프록시를 타도록 보장
            if let mimeType = httpResponse.mimeType?.lowercased(),
               mimeType.contains("html") || mimeType.contains("css") {
                if var text = String(data: responseData, encoding: .utf8) {
                    text = text.replacingOccurrences(of: "https://", with: "\(Self.scheme)://")
                    if let modified = text.data(using: .utf8) {
                        responseData = modified
                    }
                }
            }

            let proxiedResponse = HTTPURLResponse(
                url: requestURL,
                statusCode: httpResponse.statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: headers
            ) ?? httpResponse

            task.didReceive(proxiedResponse)
            task.didReceive(responseData)
            task.didFinish()
        }

        lock.lock()
        activeTasks[taskId] = dataTask
        lock.unlock()

        dataTask.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        let taskId = ObjectIdentifier(urlSchemeTask)
        lock.lock()
        let dataTask = activeTasks.removeValue(forKey: taskId)
        lock.unlock()
        dataTask?.cancel()
    }
}

// MARK: - Bookshelf Web ViewModel
@MainActor
final class BookshelfWebViewModel: ObservableObject {
    /// 앱 내부 프록시를 통해 로드되는 대상 URL (Safari 및 스크린타임 웹필터 우회)
    static let targetURL = URL(string: "\(BookshelfURLSchemeHandler.scheme)://\(BookshelfURLSchemeHandler.defaultHost)/")!
    /// 사용자가 브라우저나 외부에서 직접 볼 수 있는 원본 웹 주소
    static let originalWebURL = URL(string: "https://\(BookshelfURLSchemeHandler.defaultHost)")!

    @Published var isLoading: Bool = false
    @Published var estimatedProgress: Double = 0.0
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false
    @Published var errorMessage: String? = nil
    @Published var hasLoadedOnce: Bool = false
    @Published var isScreenTimeBlocked: Bool = false
    @Published var isCopiedURL: Bool = false

    weak var webView: WKWebView?
    private let schemeHandler = BookshelfURLSchemeHandler()

    func makeConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        #endif
        // 커스텀 프록시 핸들러 등록
        config.setURLSchemeHandler(schemeHandler, forURLScheme: BookshelfURLSchemeHandler.scheme)
        if config.responds(to: NSSelectorFromString("showsSystemScreenTimeBlockingView")) {
            config.setValue(true, forKey: "showsSystemScreenTimeBlockingView")
        }

        // fetch 가로채기: WebKit이 WKURLSchemeTask에서 POST Body를 누락시키는 문제를 해결하기 위해
        // 문자열 바디를 Base64로 인코딩하여 X-Proxy-Body-Base64 헤더로 첨부
        let proxyScriptSource = """
        (function() {
            if (window.__bookshelfProxyInjected) return;
            window.__bookshelfProxyInjected = true;

            const originalFetch = window.fetch;
            window.fetch = async function(input, init) {
                let requestInit = init || {};
                if (requestInit.body && typeof requestInit.body === 'string') {
                    try {
                        const utf8Bytes = new TextEncoder().encode(requestInit.body);
                        let binary = '';
                        const len = utf8Bytes.byteLength;
                        for (let i = 0; i < len; i++) {
                            binary += String.fromCharCode(utf8Bytes[i]);
                        }
                        const base64Body = btoa(binary);

                        let headers = requestInit.headers;
                        if (headers instanceof Headers) {
                            headers.set('X-Proxy-Body-Base64', base64Body);
                        } else if (Array.isArray(headers)) {
                            headers.push(['X-Proxy-Body-Base64', base64Body]);
                        } else if (headers && typeof headers === 'object') {
                            headers['X-Proxy-Body-Base64'] = base64Body;
                        } else {
                            requestInit.headers = { 'X-Proxy-Body-Base64': base64Body };
                        }
                    } catch (e) {
                        console.warn('Proxy body encode failed:', e);
                    }
                }
                return originalFetch(input, requestInit);
            };
        })();
        """

        let script = WKUserScript(
            source: proxyScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(script)

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
        isScreenTimeBlocked = false
        let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        webView?.load(request)
    }

    func reload() {
        errorMessage = nil
        isScreenTimeBlocked = false
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

    func copyTargetURL() {
        #if os(iOS)
        UIPasteboard.general.string = Self.originalWebURL.absoluteString
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(Self.originalWebURL.absoluteString, forType: .string)
        #endif
        isCopiedURL = true
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            isCopiedURL = false
        }
    }
}

// MARK: - BookshelfWebCoordinator
final class BookshelfWebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    private weak var viewModel: BookshelfWebViewModel?
    private var progressObservation: NSKeyValueObservation?
    private var canGoBackObservation: NSKeyValueObservation?
    private var canGoForwardObservation: NSKeyValueObservation?

    init(viewModel: BookshelfWebViewModel) {
        self.viewModel = viewModel
        super.init()
        setupNotificationObservers()
    }

    private func setupNotificationObservers() {
        #if os(iOS)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        #elseif os(macOS)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidBecomeActive),
            name: NSApplication.didBecomeActiveNotification,
            object: nil
        )
        #endif
    }

    @objc private func handleAppDidBecomeActive() {
        Task { @MainActor [weak self] in
            guard let self = self, let viewModel = self.viewModel else { return }
            if viewModel.isScreenTimeBlocked || viewModel.errorMessage != nil {
                viewModel.reload()
            }
        }
    }

    #if os(iOS)
    @objc func handleRefreshControl(_ sender: UIRefreshControl) {
        Task { @MainActor [weak self] in
            self?.viewModel?.reload()
            sender.endRefreshing()
        }
    }
    #endif

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
        NotificationCenter.default.removeObserver(self)
        progressObservation?.invalidate()
        canGoBackObservation?.invalidate()
        canGoForwardObservation?.invalidate()
    }

    private func isContentFilterError(_ error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 105 {
            return true
        }
        let desc = nsError.localizedDescription.lowercased()
        return desc.contains("content filter") || desc.contains("콘텐츠 필터")
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
            viewModel.isScreenTimeBlocked = false
            viewModel.hasLoadedOnce = true
            viewModel.canGoBack = webView.canGoBack
            viewModel.canGoForward = webView.canGoForward
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        Task { @MainActor [weak self] in
            guard let self = self, let viewModel = self.viewModel else { return }
            viewModel.isLoading = false
            if self.isContentFilterError(error) {
                viewModel.isScreenTimeBlocked = true
                viewModel.errorMessage = nil
            } else if nsError.code != NSURLErrorCancelled {
                viewModel.errorMessage = error.localizedDescription
                viewModel.isScreenTimeBlocked = false
            }
            viewModel.canGoBack = webView.canGoBack
            viewModel.canGoForward = webView.canGoForward
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        Task { @MainActor [weak self] in
            guard let self = self, let viewModel = self.viewModel else { return }
            viewModel.isLoading = false
            if self.isContentFilterError(error) {
                viewModel.isScreenTimeBlocked = true
                viewModel.errorMessage = nil
            } else if nsError.code != NSURLErrorCancelled {
                viewModel.errorMessage = error.localizedDescription
                viewModel.isScreenTimeBlocked = false
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

        let scheme = (url.scheme ?? "").lowercased()

        // 1. 앱 내부 프록시 스킴 허용 (Safari 및 스크린타임 웹필터 우회)
        if scheme == BookshelfURLSchemeHandler.scheme {
            decisionHandler(.allow)
            return
        }

        // 2. 시스템 스킴 및 표준 로컬 스킴 허용
        if scheme == "x-apple-content-filter" || scheme.hasPrefix("x-apple-") || scheme == "screentime" || scheme == "applewebdata" || scheme == "about" || scheme == "data" || scheme == "blob" {
            decisionHandler(.allow)
            if scheme == "x-apple-content-filter" {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                    self?.viewModel?.reload()
                }
            }
            return
        }

        // 3. gyogwa-books.grok.me 허용 및 내부 네비게이션 정책 준수 (Stop Rule)
        if let host = url.host?.lowercased(), host == "gyogwa-books.grok.me" || host.hasSuffix(".grok.me") {
            decisionHandler(.allow)
        } else {
            // 외부 서드파티 도메인 이탈 차단
            decisionHandler(.cancel)
        }
    }

    // WKUIDelegate: 새 창 또는 팝업 요청 시 현재 웹뷰에서 로드
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
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
        webView.uiDelegate = context.coordinator
        context.coordinator.setupObservers(for: webView)

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(BookshelfWebCoordinator.handleRefreshControl(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

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
        webView.uiDelegate = context.coordinator
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
    @State private var showingHelpSheet: Bool = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
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
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // 스크린타임 차단 안내 배너 (웹뷰 화면을 가리지 않고 상단에 띄움)
                if viewModel.isScreenTimeBlocked {
                    HStack(spacing: 10) {
                        Image(systemName: "hourglass.badge.plus")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color(red: 0.25, green: 0.42, blue: 0.95))

                        Text("스크린타임 제한됨")
                            .font(.caption.weight(.semibold))

                        Spacer()

                        Button {
                            showingHelpSheet = true
                        } label: {
                            Text("안내 보기")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Color(red: 0.25, green: 0.42, blue: 0.95))
                                .underline()
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 2)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // 일반 네트워크 오류 재시도 UI
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
            .animation(.easeInOut(duration: 0.25), value: viewModel.isScreenTimeBlocked)
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
                        showingHelpSheet = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                    }
                    .help("책장 안내")

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
            .sheet(isPresented: $showingHelpSheet) {
                BookshelfScreenTimeHelpSheet(viewModel: viewModel)
            }
        }
    }
}

// MARK: - Bookshelf Screen Time & Proxy Help Sheet
struct BookshelfScreenTimeHelpSheet: View {
    @ObservedObject var viewModel: BookshelfWebViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // 안내 배너
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Safari 독립 로딩 (프록시 모드)", systemImage: "shield.lefthalf.filled")
                            .font(.headline)
                            .foregroundStyle(Color(red: 0.25, green: 0.42, blue: 0.95))

                        Text("이 책장은 Safari 브라우저나 스크린타임 웹 제한의 영향을 받지 않고 주간 시간표 앱 자체 네트워크(URLSession)로 안전하게 도서를 불러옵니다.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.25, green: 0.42, blue: 0.95).opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // 주요 특징 1: Safari 허용 불필요
                    VStack(alignment: .leading, spacing: 8) {
                        Text("1. Safari를 허용하지 않아도 동작")
                            .font(.headline)

                        Text("스크린타임에서 Safari가 잠겨 있거나 전체 앱 다운타임 중이어도, '주간 시간표' 앱이 '항상 허용'되어 있다면 책장은 제약 없이 자유롭게 열립니다.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    // 주요 특징 2: 외부 이미지 및 기록 동기화 자동 우회
                    VStack(alignment: .leading, spacing: 8) {
                        Text("2. 책 표지 및 내 기록 동기화 정상 지원")
                            .font(.headline)

                        Text("알라딘, 네이버 등 외부 책 표지 이미지와 클라우드(Vercel Blob)에 보관된 읽은 기록·대출 기록도 앱 내부 프록시를 통해 빠르고 안전하게 동기화됩니다.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    // 웹사이트 원본 주소 확인
                    VStack(alignment: .leading, spacing: 10) {
                        Text("3. 웹사이트 원본 주소")
                            .font(.headline)

                        Text("해당 교과연계도서 목록의 원본 웹 주소입니다. 필요 시 복사하여 사용할 수 있습니다.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)

                        HStack {
                            Text(BookshelfWebViewModel.originalWebURL.absoluteString)
                                .font(.caption.monospaced())
                                .padding(8)
                                .background(Color.secondary.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                            Spacer()

                            Button {
                                viewModel.copyTargetURL()
                            } label: {
                                Label(viewModel.isCopiedURL ? "복사됨!" : "주소 복사", systemImage: viewModel.isCopiedURL ? "checkmark" : "doc.on.doc")
                                    .font(.caption.weight(.semibold))
                            }
                            .buttonStyle(.bordered)
                            .tint(viewModel.isCopiedURL ? .green : Color(red: 0.25, green: 0.42, blue: 0.95))
                        }
                    }

                    Spacer(minLength: 16)

                    // 새로고침 액션 버튼
                    Button {
                        dismiss()
                        viewModel.reload()
                    } label: {
                        Text("책장 새로고침")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.25, green: 0.42, blue: 0.95))
                }
                .padding()
            }
            .navigationTitle("책장 안내")
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") {
                        dismiss()
                    }
                }
            }
        }
    }
}
