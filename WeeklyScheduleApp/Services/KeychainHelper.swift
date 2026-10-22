import Foundation
import Security
import LocalAuthentication

enum KeychainHelper {
    private static let service = "com.jae.weeklyschedule.security"

    static func saveString(_ value: String, forKey key: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)

        var newEntry = query
        newEntry[kSecValueData as String] = data
        newEntry[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(newEntry as CFDictionary, nil)
    }

    static func readString(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }
}

enum BiometricAuthHelper {
    /// 현재 기기에서 Face ID 또는 Touch ID 사용 가능 여부와 아이콘/이름 반환
    static func biometricInfo() -> (available: Bool, name: String, icon: String) {
        let context = LAContext()
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        guard canEvaluate else {
            return (false, "생체 인증", "faceid")
        }
        switch context.biometryType {
        case .faceID:
            return (true, "Face ID", "faceid")
        case .touchID:
            return (true, "Touch ID", "touchid")
        case .opticID:
            return (true, "Optic ID", "opticid")
        default:
            return (true, "생체 인증", "faceid")
        }
    }

    /// 부모님 폰에서 Face ID / Touch ID 인증 실행
    static func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "6자리 PIN 입력"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            return false
        }
    }
}
