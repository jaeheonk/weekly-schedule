import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Delete, X, ScanFace } from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import {
  hasWebAuthnApi,
  isParentPasskeySupported,
  isPasskeyOfferDismissed,
  registerParentPasskey,
  setPasskeyOfferDismissed,
  verifyParentPasskey,
} from '../services/parentPasskey';

type PinModalStep = 'pin' | 'offerPasskey';

export interface ParentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  store?: ScheduleStore;
  reason?: string;
}

export const ParentPinModal: React.FC<ParentPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  store = globalScheduleStore,
  reason,
}) => {
  const [digits, setDigits] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [remainingLockout, setRemainingLockout] = useState<number>(0);

  // 부모님 폰 Face ID / Touch ID (WebAuthn 패스키) — 클라이언트 측 잠금, 서버 검증 없음
  const [step, setStep] = useState<PinModalStep>('pin');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState<boolean>(() =>
    store.isParentPasskeyEnabled()
  );
  const [offerDismissed, setOfferDismissed] = useState<boolean>(() =>
    isPasskeyOfferDismissed()
  );
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('pin');
      setPasskeyNotice(null);
      setPasskeyBusy(false);
      return;
    }
    setPasskeyEnabled(store.isParentPasskeyEnabled());
    setOfferDismissed(isPasskeyOfferDismissed());

    if (!hasWebAuthnApi()) {
      setPasskeySupported(false);
      return;
    }
    let cancelled = false;
    isParentPasskeySupported().then((supported) => {
      if (!cancelled) setPasskeySupported(supported);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, store]);

  const finishWithSuccess = useCallback(() => {
    setDigits('');
    setErrorMessage(null);
    setPasskeyNotice(null);
    setStep('pin');
    onSuccess();
    onClose();
  }, [onSuccess, onClose]);

  // Poll lockout timer every second while modal is open
  useEffect(() => {
    if (!isOpen) {
      setDigits('');
      setErrorMessage(null);
      return;
    }

    const checkLockout = () => {
      const remaining = store.getRemainingLockoutSeconds();
      setRemainingLockout(remaining);
      if (remaining === 0 && store.isPinLockedOut()) {
        store.resetPinLockout();
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [isOpen, store]);

  const handleCompleteDigits = useCallback(
    (inputPin: string) => {
      if (store.verifyParentPin(inputPin)) {
        setDigits('');
        setErrorMessage(null);
        // PIN 성공 직후에만 이 기기를 부모님 폰으로 지정하고 Face ID를 켤 수 있도록 제안한다.
        if (passkeySupported && !store.isParentPasskeyEnabled() && !isPasskeyOfferDismissed()) {
          setPasskeyNotice(null);
          setStep('offerPasskey');
          return;
        }
        finishWithSuccess();
      } else {
        const isLocked = store.isPinLockedOut();
        const attempts = store.getFailedPinAttempts();
        const remaining = Math.max(0, 5 - (attempts % 5));

        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);

        if (isLocked) {
          setRemainingLockout(store.getRemainingLockoutSeconds());
          setErrorMessage('비밀번호 5회 오류로 입력이 잠겼습니다.');
        } else {
          setErrorMessage(`6자리 마스터 PIN이 맞지 않아요. (남은 기회 ${remaining}회)`);
        }
        setDigits('');
      }
    },
    [store, passkeySupported, finishWithSuccess]
  );

  const handlePasskeyAuth = useCallback(async () => {
    const record = store.getParentPasskey();
    if (!record || passkeyBusy || store.isPinLockedOut()) return;
    setPasskeyBusy(true);
    setPasskeyNotice(null);
    const result = await verifyParentPasskey(record);
    setPasskeyBusy(false);

    if (result === 'success' && store.unlockParentModeWithPasskey()) {
      finishWithSuccess();
      return;
    }
    // 취소/실패는 PIN 실패 횟수에 포함하지 않고 조용히 PIN 입력으로 돌아간다.
    setPasskeyNotice(
      result === 'cancelled'
        ? 'Face ID 인증이 취소되었어요. 6자리 마스터 PIN을 입력해 주세요.'
        : 'Face ID로 확인하지 못했어요. 6자리 마스터 PIN을 입력해 주세요.'
    );
  }, [store, passkeyBusy, finishWithSuccess]);

  const handleEnablePasskey = useCallback(async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    setPasskeyNotice(null);
    try {
      await registerParentPasskey();
      setPasskeyOfferDismissed(false);
      setPasskeyEnabled(true);
      store.notifyParentPasskeyChanged();
      setPasskeyBusy(false);
      finishWithSuccess();
    } catch (error) {
      setPasskeyBusy(false);
      const name = (error as { name?: string } | null)?.name;
      setPasskeyNotice(
        name === 'NotAllowedError' || name === 'AbortError'
          ? 'Face ID 등록이 취소되었어요.'
          : 'Face ID를 등록하지 못했어요. 다음에 다시 시도해 주세요.'
      );
    }
  }, [store, passkeyBusy, finishWithSuccess]);

  const handleDeclinePasskeyOffer = useCallback(
    (dontAskAgain: boolean) => {
      if (dontAskAgain) {
        setPasskeyOfferDismissed(true);
        setOfferDismissed(true);
      }
      finishWithSuccess();
    },
    [finishWithSuccess]
  );

  const handleDisablePasskey = useCallback(() => {
    store.disableParentPasskey();
    setPasskeyOfferDismissed(false);
    setOfferDismissed(false);
    setPasskeyEnabled(false);
    setPasskeyNotice('이 기기의 Face ID 사용을 껐어요. 6자리 PIN을 입력하면 다시 켤 수 있어요.');
  }, [store]);

  const handleReenablePasskeyOffer = useCallback(() => {
    setPasskeyOfferDismissed(false);
    setOfferDismissed(false);
    setPasskeyNotice('6자리 마스터 PIN을 입력하면 이 기기에서 Face ID를 켤 수 있어요.');
  }, []);

  const handleAppendDigit = useCallback(
    (digit: string) => {
      if (step !== 'pin' || store.isPinLockedOut() || digits.length >= 6) return;
      setErrorMessage(null);
      const nextDigits = digits + digit;
      setDigits(nextDigits);

      if (nextDigits.length === 6) {
        handleCompleteDigits(nextDigits);
      }
    },
    [step, digits, store, handleCompleteDigits]
  );

  const handleDeleteDigit = useCallback(() => {
    if (digits.length === 0) return;
    setErrorMessage(null);
    setDigits((prev) => prev.slice(0, -1));
  }, [digits]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'offerPasskey') {
          handleDeclinePasskeyOffer(false);
        } else {
          onClose();
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDeleteDigit();
      } else if (/^[0-9]$/.test(e.key)) {
        handleAppendDigit(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose, handleDeleteDigit, handleAppendDigit, handleDeclinePasskeyOffer]);

  if (!isOpen) return null;

  const isLockedOut = remainingLockout > 0 || store.isPinLockedOut();
  // 아이 폰(등록 안 된 기기)이나 미지원 브라우저에서는 생체인증 옵션을 절대 노출하지 않는다.
  const canUsePasskey = passkeySupported && passkeyEnabled;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="parent-pin-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={step === 'offerPasskey' ? () => handleDeclinePasskeyOffer(false) : onClose}
          aria-label="닫기"
          data-testid="pin-modal-close-btn"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'offerPasskey' ? (
          <div data-testid="passkey-offer-view" className="w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-200 text-white">
              <ScanFace className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">
              이 기기에서 Face ID 사용
            </h2>
            <p className="text-xs text-slate-500 text-center mt-1.5 px-3 leading-relaxed">
              이 기기가 <span className="font-bold text-slate-700">부모님 폰</span>이라면 다음부터
              Face ID(또는 기기 생체인증)로 1초 만에 부모 인증할 수 있어요.
            </p>
            <p className="mt-3 w-full px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 text-center leading-relaxed">
              아이 폰에서는 켜지 마세요. 아이 본인의 얼굴로 부모 모드가 열릴 수 있어요.
            </p>

            {passkeyNotice && (
              <p
                data-testid="passkey-notice"
                className="mt-3 text-xs font-bold text-rose-600 text-center"
              >
                {passkeyNotice}
              </p>
            )}

            <div className="w-full mt-5 flex flex-col gap-2">
              <button
                type="button"
                data-testid="passkey-enable-btn"
                disabled={passkeyBusy}
                onClick={handleEnablePasskey}
                className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ScanFace className="w-5 h-5" />
                이 기기(부모님 폰)에서 Face ID 켜기
              </button>
              <button
                type="button"
                data-testid="passkey-offer-later-btn"
                disabled={passkeyBusy}
                onClick={() => handleDeclinePasskeyOffer(false)}
                className="h-11 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-sm transition-colors"
              >
                다음에 할게요
              </button>
              <button
                type="button"
                data-testid="passkey-offer-never-btn"
                disabled={passkeyBusy}
                onClick={() => handleDeclinePasskeyOffer(true)}
                className="h-9 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                이 기기는 아이 폰이에요 · 다시 묻지 않기
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Header Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
            isLockedOut
              ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-200 text-white'
              : 'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-200 text-white'
          }`}
        >
          {isLockedOut ? (
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          ) : (
            <ShieldCheck className="w-8 h-8" />
          )}
        </div>

        {/* Title & Description */}
        {reason && (
          <div
            data-testid="pin-reason-badge"
            className="mb-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-xs animate-in fade-in"
          >
            {reason}
          </div>
        )}
        <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">
          {isLockedOut ? '비밀번호 입력 일시 잠금' : '부모님 6자리 마스터 PIN 입력'}
        </h2>
        <p className="text-xs text-slate-500 text-center mt-1.5 px-3">
          {isLockedOut
            ? '보안을 위해 PIN 입력이 일시 중단되었습니다.'
            : (reason
                ? `${reason}을 위해 부모님 6자리 마스터 PIN을 입력해 주세요.`
                : '부모 모드로 전환하여 숙제 확인 도장을 찍고 응원 하트를 보냅니다.')}
        </p>

        {/* Lockout View or PIN Keypad View */}
        {isLockedOut ? (
          <div
            data-testid="lockout-view"
            className="w-full my-6 p-6 rounded-2xl bg-rose-50/70 border border-rose-200 text-center space-y-3"
          >
            <div
              data-testid="lockout-countdown"
              className="text-4xl font-extrabold text-rose-600 font-mono tracking-tight"
            >
              {remainingLockout}초
            </div>
            <p className="text-xs font-semibold text-rose-800 leading-relaxed">
              비밀번호를 5회 연속 잘못 입력하여
              <br />
              보안을 위해 입력이 일시 잠겼습니다.
            </p>
            <p className="text-[11px] text-rose-500">
              잠금 시간이 끝난 뒤 부모님께서 정확한 6자리 PIN을 입력해 주세요.
            </p>
          </div>
        ) : (
          <div className="w-full mt-5 flex flex-col items-center">
            {/* 6-Dot PIN Indicator */}
            <div
              data-testid="pin-dots-container"
              className={`flex items-center justify-center gap-3.5 my-3 ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const isFilled = idx < digits.length;
                return (
                  <div
                    key={idx}
                    data-testid="pin-dot"
                    data-filled={isFilled}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-indigo-600 scale-110 shadow-sm shadow-indigo-300'
                        : 'bg-slate-200 border border-slate-300/80'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message or Helper Text */}
            <div className="h-6 flex items-center justify-center text-center px-2">
              {errorMessage ? (
                <span
                  data-testid="pin-error-message"
                  className="text-xs font-bold text-rose-600 animate-in fade-in duration-200"
                >
                  {errorMessage}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {canUsePasskey
                    ? '부모님 폰에서는 Face ID 또는 6자리 마스터 PIN으로 승인할 수 있어요.'
                    : '키보드 또는 아래 숫자 패드로 6자리 숫자를 입력하세요.'}
                </span>
              )}
            </div>

            {/* 부모님 폰(Face ID 등록 기기)에서만 생체인증 빠른 인증 버튼 표시 */}
            {canUsePasskey && (
              <button
                type="button"
                data-testid="passkey-auth-btn"
                title="Face ID / Touch ID 등 이 기기의 생체인증"
                disabled={passkeyBusy}
                onClick={handlePasskeyAuth}
                className="mt-2 px-4 py-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 font-bold text-sm flex items-center gap-2 transition-colors"
              >
                <ScanFace className="w-5 h-5" />
                Face ID로 1초 만에 부모 인증하기
              </button>
            )}

            {passkeyNotice && (
              <p
                data-testid="passkey-notice"
                className="mt-2 text-[11px] font-semibold text-slate-500 text-center px-2"
              >
                {passkeyNotice}
              </p>
            )}

            {/* 12-Key Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full mt-4 max-w-[260px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  data-testid={`keypad-btn-${num}`}
                  onClick={() => handleAppendDigit(num.toString())}
                  className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200/80 active:bg-indigo-50 active:text-indigo-600 font-bold text-xl text-slate-800 transition-colors shadow-sm flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              {canUsePasskey ? (
                <button
                  type="button"
                  data-testid="keypad-btn-passkey"
                  aria-label="Face ID로 부모 인증"
                  disabled={passkeyBusy}
                  onClick={handlePasskeyAuth}
                  className="h-14 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors shadow-sm flex items-center justify-center"
                >
                  <ScanFace className="w-6 h-6" />
                </button>
              ) : (
                <div className="h-14" />
              )}

              <button
                type="button"
                data-testid="keypad-btn-0"
                onClick={() => handleAppendDigit('0')}
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200/80 active:bg-indigo-50 active:text-indigo-600 font-bold text-xl text-slate-800 transition-colors shadow-sm flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                data-testid="keypad-btn-delete"
                onClick={handleDeleteDigit}
                aria-label="지우기"
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200/80 active:bg-slate-300 font-bold text-slate-700 transition-colors shadow-sm flex items-center justify-center"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {canUsePasskey && (
              <button
                type="button"
                data-testid="passkey-disable-btn"
                onClick={handleDisablePasskey}
                className="mt-4 text-[11px] font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2"
              >
                이 기기에서 Face ID 사용 끄기
              </button>
            )}
            {passkeySupported && !passkeyEnabled && offerDismissed && (
              <button
                type="button"
                data-testid="passkey-reenable-btn"
                onClick={handleReenablePasskeyOffer}
                className="mt-4 text-[11px] font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2"
              >
                이 기기(부모님 폰)에서 Face ID 사용하기
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};
