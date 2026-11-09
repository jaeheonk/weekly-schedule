import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Delete, X } from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';

export interface ParentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  store?: ScheduleStore;
}

export const ParentPinModal: React.FC<ParentPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  store = globalScheduleStore,
}) => {
  const [digits, setDigits] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [remainingLockout, setRemainingLockout] = useState<number>(0);

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
        onSuccess();
        onClose();
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
    [store, onSuccess, onClose]
  );

  const handleAppendDigit = useCallback(
    (digit: string) => {
      if (store.isPinLockedOut() || digits.length >= 6) return;
      setErrorMessage(null);
      const nextDigits = digits + digit;
      setDigits(nextDigits);

      if (nextDigits.length === 6) {
        handleCompleteDigits(nextDigits);
      }
    },
    [digits, store, handleCompleteDigits]
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
        onClose();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDeleteDigit();
      } else if (/^[0-9]$/.test(e.key)) {
        handleAppendDigit(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleDeleteDigit, handleAppendDigit]);

  if (!isOpen) return null;

  const isLockedOut = remainingLockout > 0 || store.isPinLockedOut();

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
          onClick={onClose}
          aria-label="닫기"
          data-testid="pin-modal-close-btn"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

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
        <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">
          {isLockedOut ? '비밀번호 입력 일시 잠금' : '부모님 6자리 마스터 PIN 입력'}
        </h2>
        <p className="text-xs text-slate-500 text-center mt-1.5 px-3">
          {isLockedOut
            ? '보안을 위해 PIN 입력이 일시 중단되었습니다.'
            : '부모 모드로 전환하여 숙제 확인 도장을 찍고 응원 하트를 보냅니다.'}
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
                  키보드 또는 아래 숫자 패드로 6자리 숫자를 입력하세요.
                </span>
              )}
            </div>

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

              <div className="h-14" />

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
          </div>
        )}
      </div>
    </div>
  );
};
