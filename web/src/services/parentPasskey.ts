/**
 * 부모님 폰 Face ID / Touch ID(WebAuthn 플랫폼 인증기, 패스키) 부모 인증.
 *
 * ⚠️ 신뢰 수준: 이 모듈은 브라우저 안에서만 동작하는 "클라이언트 측 잠금"이다.
 * 서버가 챌린지를 발급하거나 서명을 검증하지 않으며, 기존 6자리 마스터 PIN과
 * 같은 수준(아이가 앱 화면에서 부모 모드를 함부로 열지 못하게 막는 정도)의 보호만 제공한다.
 * 브라우저가 OS 생체인증(사용자 검증)을 통과시켰는지만 확인하고 부모 모드를 연다.
 *
 * 크리덴셜 ID는 이 기기의 localStorage에만 저장하며 클라우드 동기화 스냅샷에
 * 절대 포함하지 않는다. (기기마다 따로 등록)
 */

export const PARENT_PASSKEY_STORAGE_KEY = 'weekly_schedule_parent_passkey_v1';
export const PARENT_PASSKEY_OFFER_DISMISSED_KEY =
  'weekly_schedule_parent_passkey_offer_dismissed_v1';

export interface StoredParentPasskey {
  /** base64url 인코딩된 rawId */
  credentialId: string;
  /** 등록 당시 rpId (location.hostname) */
  rpId: string;
  /** 등록 시각 (epoch ms) */
  createdAt: number;
}

export type PasskeyVerifyResult = 'success' | 'cancelled' | 'failed';

// MARK: - base64url

export function bufferToBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const withPad = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function randomBytes(length: number): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

// MARK: - Feature detection

/**
 * 이 브라우저/기기에서 사용자 검증 가능한 플랫폼 인증기(Face ID, Touch ID 등)를 쓸 수 있는지.
 * 지원하지 않으면 UI에서 생체인증 옵션을 아예 숨긴다.
 */
/** WebAuthn API 자체가 있는지 (동기 확인) */
export function hasWebAuthnApi(): boolean {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const PKC = (window as unknown as { PublicKeyCredential?: typeof PublicKeyCredential })
      .PublicKeyCredential;
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return !!navigator.credentials && typeof navigator.credentials.get === 'function';
  } catch {
    return false;
  }
}

export async function isParentPasskeySupported(): Promise<boolean> {
  try {
    if (!hasWebAuthnApi()) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// MARK: - Local storage (기기별, 동기화 제외)

export function loadParentPasskey(): StoredParentPasskey | null {
  try {
    const raw = localStorage.getItem(PARENT_PASSKEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredParentPasskey>;
    if (!parsed || typeof parsed.credentialId !== 'string' || !parsed.credentialId) {
      return null;
    }
    return {
      credentialId: parsed.credentialId,
      rpId: typeof parsed.rpId === 'string' ? parsed.rpId : '',
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveParentPasskey(record: StoredParentPasskey): void {
  try {
    localStorage.setItem(PARENT_PASSKEY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // private mode 등에서 실패해도 PIN으로 계속 동작
  }
}

export function clearParentPasskey(): void {
  try {
    localStorage.removeItem(PARENT_PASSKEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isPasskeyOfferDismissed(): boolean {
  try {
    return localStorage.getItem(PARENT_PASSKEY_OFFER_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPasskeyOfferDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(PARENT_PASSKEY_OFFER_DISMISSED_KEY, 'true');
    } else {
      localStorage.removeItem(PARENT_PASSKEY_OFFER_DISMISSED_KEY);
    }
  } catch {
    // ignore
  }
}

// MARK: - Registration / Verification

function currentRpId(): string {
  return window.location.hostname;
}

/**
 * 이 기기의 플랫폼 인증기에 부모 인증용 패스키를 만든다.
 * 반드시 사용자 제스처(버튼 탭) 안에서 호출해야 Safari가 허용한다.
 */
export async function registerParentPasskey(): Promise<StoredParentPasskey> {
  const rpId = currentRpId();
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { id: rpId, name: '주간 스케줄' },
      user: {
        id: randomBytes(16),
        name: 'weekly-schedule-parent',
        displayName: '주간 스케줄 부모 인증',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential || !credential.rawId) {
    throw new Error('passkey_registration_failed');
  }

  const record: StoredParentPasskey = {
    credentialId: bufferToBase64Url(credential.rawId),
    rpId,
    createdAt: Date.now(),
  };
  saveParentPasskey(record);
  return record;
}

/** authenticatorData flags 바이트(32번째)의 UV(User Verified, 0x04) 비트 확인 */
export function hasUserVerifiedFlag(authenticatorData: ArrayBuffer | undefined | null): boolean {
  if (!authenticatorData || authenticatorData.byteLength < 33) return false;
  const flags = new Uint8Array(authenticatorData)[32];
  return (flags & 0x04) === 0x04;
}

function isCancellation(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

/**
 * 저장된 크리덴셜로 Face ID / Touch ID 사용자 검증을 요청한다.
 * - success: UV 플래그까지 확인됨 → PIN 성공과 동일하게 부모 모드 해제
 * - cancelled: 사용자가 취소/시간 초과 → 조용히 PIN 입력으로 돌아감
 * - failed: 그 밖의 오류 → PIN 입력으로 돌아감 (PIN 실패 횟수에는 포함하지 않음)
 */
export async function verifyParentPasskey(
  record: StoredParentPasskey
): Promise<PasskeyVerifyResult> {
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: currentRpId(),
        allowCredentials: [
          {
            type: 'public-key',
            id: base64UrlToBuffer(record.credentialId),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion || !assertion.rawId) return 'failed';
    if (bufferToBase64Url(assertion.rawId) !== record.credentialId) return 'failed';

    const response = assertion.response as AuthenticatorAssertionResponse | undefined;
    if (!response || !hasUserVerifiedFlag(response.authenticatorData)) return 'failed';

    return 'success';
  } catch (error) {
    return isCancellation(error) ? 'cancelled' : 'failed';
  }
}
