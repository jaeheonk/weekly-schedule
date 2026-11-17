import Foundation

struct VercelBlobItem: Codable, Equatable {
    let url: String
    let pathname: String
    let size: Int?
    let uploadedAt: String?
}

struct SyncLatestResponse: Codable {
    let latest: VercelBlobItem?
    let snapshot: CloudSyncSnapshot?
    let allBlobs: [VercelBlobItem]
}

struct VercelBlobPutResponse: Codable {
    let url: String
    let pathname: String
}

enum VercelBlobSyncError: LocalizedError {
    case missingServerURL
    case invalidURL
    case invalidSnapshotPayload
    case httpError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .missingServerURL:
            return "동기화 서버 URL이 설정되지 않았습니다."
        case .invalidURL:
            return "잘못된 동기화 서버 URL입니다."
        case .invalidSnapshotPayload:
            return "서버 응답에 유효한 스냅샷 데이터가 없습니다."
        case .httpError(let code, let message):
            return "동기화 서버 응답 오류 (\(code)): \(message)"
        }
    }
}

protocol CloudSyncTransport {
    var requiresServerURL: Bool { get }

    func fetchLatestSnapshot(
        serverURL: String,
        familyCode: String
    ) async throws -> SyncLatestResponse

    func uploadSnapshot(
        _ snapshot: CloudSyncSnapshot,
        serverURL: String,
        familyCode: String,
        shortDeviceId: String,
        previousBlobsToDelete: [VercelBlobItem]
    ) async throws -> VercelBlobPutResponse
}

final class VercelBlobSyncService: CloudSyncTransport {
    static let shared = VercelBlobSyncService()

    /// 기본 Upstash 동기화 프록시 서버 URL
    static let defaultServerURL = "https://weekly-schedule-six-seven.vercel.app"
    static let defaultFamilyCode = "family-main"

    var requiresServerURL: Bool { true }

    private let session: URLSession

    init(session: URLSession? = nil) {
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.ephemeral
            config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            config.urlCache = nil
            config.timeoutIntervalForRequest = 20
            config.timeoutIntervalForResource = 45
            self.session = URLSession(configuration: config)
        }
    }

    static func normalizeServerURL(_ raw: String) -> String {
        var trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.hasSuffix("/") {
            trimmed.removeLast()
        }
        if trimmed.lowercased().hasSuffix("/api/sync") {
            trimmed.removeLast("/api/sync".count)
            while trimmed.hasSuffix("/") {
                trimmed.removeLast()
            }
        }
        return trimmed
    }

    /// 현재 가족 채널의 최신 스냅샷과 메타데이터를 Vercel 동기화 프록시(`/api/sync/latest` -> Upstash)에서 조회합니다.
    func fetchLatestSnapshot(
        serverURL: String,
        familyCode: String
    ) async throws -> SyncLatestResponse {
        let safeFamily = sanitizeFamilyCode(familyCode)
        let cacheBuster = String(Int64(Date().timeIntervalSince1970 * 1000))
        let url = try makeEndpointURL(
            serverURL: serverURL,
            path: "/api/sync/latest",
            queryItems: [
                URLQueryItem(name: "familyCode", value: safeFamily),
                URLQueryItem(name: "_t", value: cacheBuster)
            ]
        )

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        let (data, response) = try await session.data(for: request)
        try validateHTTPResponse(response, data: data)

        return try JSONDecoder().decode(SyncLatestResponse.self, from: data)
    }

    /// 새로운 스냅샷을 Vercel 동기화 프록시(`/api/sync/upload` -> Upstash)로 업로드합니다.
    func uploadSnapshot(
        _ snapshot: CloudSyncSnapshot,
        serverURL: String,
        familyCode: String,
        shortDeviceId: String,
        previousBlobsToDelete: [VercelBlobItem]
    ) async throws -> VercelBlobPutResponse {
        let safeFamily = sanitizeFamilyCode(familyCode)
        let url = try makeEndpointURL(serverURL: serverURL, path: "/api/sync/upload")

        let payload = SyncUploadRequest(
            familyCode: safeFamily,
            shortDeviceId: shortDeviceId,
            snapshot: snapshot,
            previousBlobsToDelete: previousBlobsToDelete
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await session.data(for: request)
        try validateHTTPResponse(response, data: data)

        return try JSONDecoder().decode(VercelBlobPutResponse.self, from: data)
    }

    private struct SyncUploadRequest: Encodable {
        let familyCode: String
        let shortDeviceId: String
        let snapshot: CloudSyncSnapshot
        let previousBlobsToDelete: [VercelBlobItem]
    }

    private func makeEndpointURL(
        serverURL: String,
        path: String,
        queryItems: [URLQueryItem] = []
    ) throws -> URL {
        let cleanBase = Self.normalizeServerURL(serverURL)
        guard !cleanBase.isEmpty else {
            throw VercelBlobSyncError.missingServerURL
        }
        guard var components = URLComponents(string: cleanBase),
              let scheme = components.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = components.host,
              !host.isEmpty else {
            throw VercelBlobSyncError.invalidURL
        }

        var basePath = components.path
        while basePath.hasSuffix("/") {
            basePath.removeLast()
        }
        components.path = basePath + path
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components.url else {
            throw VercelBlobSyncError.invalidURL
        }
        return url
    }

    private func sanitizeFamilyCode(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let filtered = String(trimmed.unicodeScalars.filter { allowed.contains($0) })
        return filtered.isEmpty ? Self.defaultFamilyCode : filtered
    }

    private func validateHTTPResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rawText = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let serverMessage = (json?["error"] as? String)
                ?? (json?["message"] as? String)
                ?? (rawText?.isEmpty == false ? rawText : nil)
                ?? "알 수 없는 오류"
            throw VercelBlobSyncError.httpError(statusCode: http.statusCode, message: serverMessage)
        }
    }
}
