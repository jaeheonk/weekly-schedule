import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ParentPinModal } from './ParentPinModal';
import { ScheduleStore } from '../domain/scheduleStore';
import {
  PARENT_PASSKEY_OFFER_DISMISSED_KEY,
  PARENT_PASSKEY_STORAGE_KEY,
  bufferToBase64Url,
} from '../services/parentPasskey';

const CRED_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const CRED_ID = bufferToBase64Url(CRED_BYTES);

function authenticatorData(uv: boolean): ArrayBuffer {
  const data = new Uint8Array(37);
  data[32] = 0x01 | (uv ? 0x04 : 0); // UP (+ UV)
  return data.buffer;
}

function installWebAuthn(options: { available?: boolean } = {}) {
  const create = vi.fn();
  const get = vi.fn();
  const PKC = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi
      .fn()
      .mockResolvedValue(options.available ?? true),
  };
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: PKC,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'credentials', {
    value: { create, get },
    configurable: true,
    writable: true,
  });
  return { create, get, PKC };
}

function uninstallWebAuthn() {
  delete (window as unknown as Record<string, unknown>).PublicKeyCredential;
  delete (navigator as unknown as Record<string, unknown>).credentials;
}

function storeRegisteredPasskey() {
  localStorage.setItem(
    PARENT_PASSKEY_STORAGE_KEY,
    JSON.stringify({ credentialId: CRED_ID, rpId: 'localhost', createdAt: 1 })
  );
}

function enterPin(pin: string) {
  for (const digit of pin) {
    fireEvent.click(screen.getByTestId(`keypad-btn-${digit}`));
  }
}

function notAllowed(): Error {
  const err = new Error('The operation either timed out or was not allowed.');
  err.name = 'NotAllowedError';
  return err;
}

describe('ParentPinModal — 부모님 폰 Face ID (WebAuthn 패스키)', () => {
  let store: ScheduleStore;
  const onSuccess = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    store = new ScheduleStore();
  });

  afterEach(() => {
    uninstallWebAuthn();
  });

  const renderModal = () =>
    render(<ParentPinModal isOpen onClose={onClose} onSuccess={onSuccess} store={store} />);

  it('브라우저가 WebAuthn을 지원하지 않으면 Face ID 옵션을 숨긴다', async () => {
    uninstallWebAuthn();
    storeRegisteredPasskey();
    renderModal();

    await act(async () => {});
    expect(screen.queryByTestId('passkey-auth-btn')).not.toBeInTheDocument();

    // PIN 성공 후에도 등록 제안 없이 바로 성공
    enterPin('160125');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('passkey-offer-view')).not.toBeInTheDocument();
  });

  it('플랫폼 인증기가 없으면(isUserVerifyingPlatformAuthenticatorAvailable=false) 숨긴다', async () => {
    const { PKC } = installWebAuthn({ available: false });
    storeRegisteredPasskey();
    renderModal();

    await waitFor(() =>
      expect(PKC.isUserVerifyingPlatformAuthenticatorAvailable).toHaveBeenCalled()
    );
    await act(async () => {});
    expect(screen.queryByTestId('passkey-auth-btn')).not.toBeInTheDocument();
  });

  it('아이 폰으로 지정되면 등록된 크리덴셜을 지우고 Face ID 옵션을 숨긴다', async () => {
    installWebAuthn();
    storeRegisteredPasskey();
    store.setDeviceRole('child');

    expect(localStorage.getItem(PARENT_PASSKEY_STORAGE_KEY)).toBeNull();
    expect(store.isParentPasskeyEnabled()).toBe(false);

    renderModal();
    await act(async () => {});
    expect(screen.queryByTestId('passkey-auth-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('keypad-btn-passkey')).not.toBeInTheDocument();
  });

  it('Face ID를 등록하지 않은 기기(아이 폰 기본값)에서는 버튼이 없다', async () => {
    installWebAuthn();
    renderModal();
    await act(async () => {});
    expect(screen.queryByTestId('passkey-auth-btn')).not.toBeInTheDocument();
  });

  it('등록된 부모님 폰에서 Face ID 성공 시 PIN 성공과 동일하게 부모 모드를 연다', async () => {
    const { get } = installWebAuthn();
    storeRegisteredPasskey();
    get.mockResolvedValue({
      rawId: CRED_BYTES.buffer,
      response: { authenticatorData: authenticatorData(true) },
    });

    renderModal();
    const btn = await screen.findByTestId('passkey-auth-btn');
    expect(btn).toHaveTextContent('Face ID로 1초 만에 부모 인증하기');
    fireEvent.click(btn);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(store.isParentMode()).toBe(true);

    const options = get.mock.calls[0][0].publicKey;
    expect(options.userVerification).toBe('required');
    expect(options.rpId).toBe(window.location.hostname);
    expect(options.allowCredentials).toHaveLength(1);
    expect(bufferToBase64Url(options.allowCredentials[0].id)).toBe(CRED_ID);
  });

  it('UV 플래그가 없으면 부모 모드를 열지 않는다', async () => {
    const { get } = installWebAuthn();
    storeRegisteredPasskey();
    get.mockResolvedValue({
      rawId: CRED_BYTES.buffer,
      response: { authenticatorData: authenticatorData(false) },
    });

    renderModal();
    fireEvent.click(await screen.findByTestId('passkey-auth-btn'));

    expect(await screen.findByTestId('passkey-notice')).toHaveTextContent(
      'Face ID로 확인하지 못했어요'
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(store.isParentMode()).toBe(false);
    expect(store.getFailedPinAttempts()).toBe(0);
  });

  it('Face ID를 취소하면 PIN 입력으로 돌아가고 PIN 실패 횟수는 늘지 않는다', async () => {
    const { get } = installWebAuthn();
    storeRegisteredPasskey();
    get.mockRejectedValue(notAllowed());

    renderModal();
    fireEvent.click(await screen.findByTestId('passkey-auth-btn'));

    expect(await screen.findByTestId('passkey-notice')).toHaveTextContent(
      'Face ID 인증이 취소되었어요'
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(store.getFailedPinAttempts()).toBe(0);
    expect(store.isPinLockedOut()).toBe(false);
    expect(store.isParentMode()).toBe(false);

    // 여전히 PIN으로 인증 가능
    enterPin('160125');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('PIN 성공 후 Face ID 켜기를 제안하고, 등록하면 크리덴셜 ID를 이 기기에만 저장한다', async () => {
    const { create } = installWebAuthn();
    create.mockResolvedValue({ rawId: CRED_BYTES.buffer });

    renderModal();
    await waitFor(() => expect(screen.queryByTestId('passkey-reenable-btn')).toBeNull());
    await act(async () => {});
    enterPin('160125');

    expect(await screen.findByTestId('passkey-offer-view')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('passkey-enable-btn'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const pk = create.mock.calls[0][0].publicKey;
    expect(pk.authenticatorSelection).toEqual({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    });
    expect(pk.rp.id).toBe(window.location.hostname);

    const saved = JSON.parse(localStorage.getItem(PARENT_PASSKEY_STORAGE_KEY) || '{}');
    expect(saved.credentialId).toBe(CRED_ID);
    expect(store.isParentPasskeyEnabled()).toBe(true);

    // 클라우드 동기화 스냅샷에는 포함되지 않는다
    expect(JSON.stringify(store.makeCurrentSnapshot())).not.toContain(CRED_ID);
  });

  it('“다시 묻지 않기”를 고르면 다음 PIN 성공 때 제안하지 않는다', async () => {
    installWebAuthn();
    const { unmount } = renderModal();
    await act(async () => {});
    enterPin('160125');
    fireEvent.click(await screen.findByTestId('passkey-offer-never-btn'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PARENT_PASSKEY_OFFER_DISMISSED_KEY)).toBe('true');
    unmount();

    store.lockParentMode();
    renderModal();
    await screen.findByTestId('passkey-reenable-btn');
    enterPin('160125');
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('passkey-offer-view')).not.toBeInTheDocument();
  });

  it('“Face ID 사용 끄기”로 이 기기의 크리덴셜을 지운다', async () => {
    installWebAuthn();
    storeRegisteredPasskey();
    renderModal();

    fireEvent.click(await screen.findByTestId('passkey-disable-btn'));
    expect(localStorage.getItem(PARENT_PASSKEY_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId('passkey-auth-btn')).not.toBeInTheDocument();
  });

  it('PIN을 변경해도 등록된 Face ID는 계속 동작한다', async () => {
    const { get } = installWebAuthn();
    storeRegisteredPasskey();
    store.setParentPinCode('987654');
    get.mockResolvedValue({
      rawId: CRED_BYTES.buffer,
      response: { authenticatorData: authenticatorData(true) },
    });

    renderModal();
    fireEvent.click(await screen.findByTestId('passkey-auth-btn'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
