import Foundation

struct VercelBlobItem: Codable, Equatable {
    let url: String
    let pathname: String
    let size: Int?
    let uploadedAt: String?
}

struct VercelBlobListResponse: Codable {
    let hasMore: Bool?
    let blobs: [VercelBlobItem]
}

struct VercelBlobPutResponse: Codable {
    let url: String
    let pathname: String
}

enum VercelBlobSyncError: LocalizedError {
    case missingToken
    case invalidURL
    case httpError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Vercel Blob 토큰이 비어 있습니다."
        case .invalidURL:
            return "잘못된 동기화 URL입니다."
        case .httpError(let code, let message):
            return "동기화 서버 응답 오류 (\(code)): \(message)"
        }
    }
}

final class VercelBlobSyncService {
    static let shared = VercelBlobSyncService()

    /// 사용자 제공 기본 Vercel Blob Read/Write 토큰
    static let defaultToken = "vercel_blob_rw_z8SmedqOGmynl5Hm_y3N5ZOKGow5ZsDIviQp1VGLRlxJSCT"
    static let defaultFamilyCode = "family-main"

    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.ephemeral
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.urlCache = nil
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 25
        self.session = URLSession(configuration: config)
    }

    /// 현재 가족 채널의 가장 최신 스냅샷 메타데이터와 정리할 이전 스냅샷 URL 목록을 조회합니다.
    func fetchLatestBlobMetadata(
        token: String,
        familyCode: String
    ) async throws -> (latest: VercelBlobItem?, allBlobs: [VercelBlobItem]) {
        let cleanToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanToken.isEmpty else { throw VercelBlobSyncError.missingToken }

        let safeFamily = sanitizeFamilyCode(familyCode)
        let prefix = "families/\(safeFamily)/state-"
        guard var components = URLComponents(string: "https://blob.vercel-storage.com") else {
            throw VercelBlobSyncError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "prefix", value: prefix),
            URLQueryItem(name: "limit", value: "100")
        ]
        guard let url = components.url else { throw VercelBlobSyncError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(cleanToken)", forHTTPHeaderField: "Authorization")
        request.setValue("7", forHTTPHeaderField: "x-api-version")

        let (data, response) = try await session.data(for: request)
        try validateHTTPResponse(response, data: data)

        let decoded = try JSONDecoder().decode(VercelBlobListResponse.self, from: data)
        // pathname 형식: families/<familyCode>/state-<timestampMs>-<deviceId>.json
        // 최신 파일이 맨 앞에 오도록 정렬
        let sorted = decoded.blobs.sorted { a, b in
            a.pathname > b.pathname
        }
        return (sorted.first, sorted)
    }

    /// 특정 Blob URL에서 스냅샷 JSON을 다운로드합니다.
    func downloadSnapshot(from blobURLString: String, token: String) async throws -> CloudSyncSnapshot {
        let cleanToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanToken.isEmpty else { throw VercelBlobSyncError.missingToken }
        guard let url = URL(string: blobURLString) else { throw VercelBlobSyncError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(cleanToken)", forHTTPHeaderField: "Authorization")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        let (data, response) = try await session.data(for: request)
        try validateHTTPResponse(response, data: data)

        return try JSONDecoder().decode(CloudSyncSnapshot.self, from: data)
    }

    /// 새로운 스냅샷을 업로드하고 이전 스냅샷 파일들을 정리합니다.
    func uploadSnapshot(
        _ snapshot: CloudSyncSnapshot,
        token: String,
        familyCode: String,
        shortDeviceId: String,
        previousBlobsToDelete: [VercelBlobItem]
    ) async throws -> VercelBlobPutResponse {
        let cleanToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanToken.isEmpty else { throw VercelBlobSyncError.missingToken }

        let safeFamily = sanitizeFamilyCode(familyCode)
        let timestampMs = Int64(Date().timeIntervalSince1970 * 1000)
        let paddedTs = String(format: "%014lld", timestampMs)
        let pathname = "families/\(safeFamily)/state-\(paddedTs)-\(shortDeviceId).json"

        let bodyData = try JSONEncoder().encode(snapshot)
        let putResult = try await performPut(pathname: pathname, bodyData: bodyData, token: cleanToken, accessMode: "private")

        // 업로드 성공 후 이전 스냅샷 파일들 비동기 삭제 (최근 1개만 남겨 스토리지 절약)
        let urlsToDelete = previousBlobsToDelete
            .map { $0.url }
            .filter { $0 != putResult.url }

        if !urlsToDelete.isEmpty {
            Task {
                try? await deleteBlobs(urls: urlsToDelete, token: cleanToken)
            }
        }

        return putResult
    }

    private func performPut(
        pathname: String,
        bodyData: Data,
        token: String,
        accessMode: String
    ) async throws -> VercelBlobPutResponse {
        guard let url = URL(string: "https://blob.vercel-storage.com/\(pathname)") else {
            throw VercelBlobSyncError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("7", forHTTPHeaderField: "x-api-version")
        request.setValue("application/json", forHTTPHeaderField: "x-content-type")
        request.setValue(accessMode, forHTTPHeaderField: "x-vercel-blob-access")
        request.setValue("0", forHTTPHeaderField: "x-add-random-suffix")
        request.setValue("1", forHTTPHeaderField: "x-allow-overwrite")
        request.setValue("0", forHTTPHeaderField: "x-cache-control-max-age")
        request.httpBody = bodyData

        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 400, accessMode == "private" {
            let text = String(data: data, encoding: .utf8) ?? ""
            if text.localizedCaseInsensitiveContains("public") {
                return try await performPut(pathname: pathname, bodyData: bodyData, token: token, accessMode: "public")
            }
        }
        try validateHTTPResponse(response, data: data)
        return try JSONDecoder().decode(VercelBlobPutResponse.self, from: data)
    }

    func deleteBlobs(urls: [String], token: String) async throws {
        guard !urls.isEmpty else { return }
        guard let url = URL(string: "https://blob.vercel-storage.com/delete") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("7", forHTTPHeaderField: "x-api-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = ["urls": urls]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        _ = try? await session.data(for: request)
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
            let bodyText = String(data: data, encoding: .utf8) ?? "알 수 없는 오류"
            throw VercelBlobSyncError.httpError(statusCode: http.statusCode, message: bodyText)
        }
    }
}
