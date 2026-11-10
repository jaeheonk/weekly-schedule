import { describe, it, expect, beforeEach } from 'vitest';
import {
  PARENT_PASSKEY_STORAGE_KEY,
  base64UrlToBuffer,
  bufferToBase64Url,
  hasUserVerifiedFlag,
  loadParentPasskey,
} from './parentPasskey';
import { ScheduleStore } from '../domain/scheduleStore';

describe('parentPasskey helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('base64url 왕복 변환이 원본 바이트를 보존한다', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 250, 1, 2]);
    const encoded = bufferToBase64Url(bytes.buffer);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(new Uint8Array(base64UrlToBuffer(encoded)))).toEqual(Array.from(bytes));
  });

  it('authenticatorData의 UV 비트를 확인한다', () => {
    const data = new Uint8Array(37);
    data[32] = 0x01;
    expect(hasUserVerifiedFlag(data.buffer)).toBe(false);
    data[32] = 0x05;
    expect(hasUserVerifiedFlag(data.buffer)).toBe(true);
    expect(hasUserVerifiedFlag(new Uint8Array(10).buffer)).toBe(false);
    expect(hasUserVerifiedFlag(undefined)).toBe(false);
  });

  it('손상된 저장값은 등록 안 된 것으로 취급한다', () => {
    localStorage.setItem(PARENT_PASSKEY_STORAGE_KEY, '{oops');
    expect(loadParentPasskey()).toBeNull();
    localStorage.setItem(PARENT_PASSKEY_STORAGE_KEY, JSON.stringify({ credentialId: '' }));
    expect(loadParentPasskey()).toBeNull();
  });

  it('Face ID 해제는 PIN 실패 횟수를 바꾸지 않고, PIN 잠금 중에는 거절한다', () => {
    localStorage.setItem(
      PARENT_PASSKEY_STORAGE_KEY,
      JSON.stringify({ credentialId: 'AQID', rpId: 'localhost', createdAt: 1 })
    );
    const store = new ScheduleStore();
    store.verifyParentPin('000000');
    expect(store.getFailedPinAttempts()).toBe(1);
    store.lockParentMode();

    expect(store.unlockParentModeWithPasskey()).toBe(true);
    expect(store.isParentMode()).toBe(true);
    expect(store.getFailedPinAttempts()).toBe(1);

    store.lockParentMode();
    for (let i = 0; i < 4; i++) store.verifyParentPin('000000');
    expect(store.isPinLockedOut()).toBe(true);
    expect(store.unlockParentModeWithPasskey()).toBe(false);
    expect(store.isParentMode()).toBe(false);
  });

  it('등록되지 않은 기기에서는 Face ID 해제를 거절한다', () => {
    const store = new ScheduleStore();
    expect(store.unlockParentModeWithPasskey()).toBe(false);
  });
});
