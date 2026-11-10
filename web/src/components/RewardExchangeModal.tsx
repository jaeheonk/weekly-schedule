import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Sparkles,
  Gift,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ScheduleStore } from '../domain/scheduleStore';
import { RewardPreset, DEFAULT_REWARD_PRESETS } from '../types/snapshot';
import { playCompletionChime } from '../services/soundEffects';

export interface RewardExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: ScheduleStore;
}

export const RewardExchangeModal: React.FC<RewardExchangeModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const presets: RewardPreset[] = store.getRewardPresets();
  const availableHearts = store.getAvailableHearts();
  const totalEarnedHearts = store.getTotalEarnedHearts();
  const totalSpentHearts = store.getTotalSpentHearts();
  const isParentMode = store.isParentMode();

  const [customTitle, setCustomTitle] = useState<string>('');
  const [heartsToSpend, setHeartsToSpend] = useState<number>(10);

  // Initialize form with the first preset when opened
  useEffect(() => {
    if (isOpen) {
      if (presets.length > 0) {
        setCustomTitle(presets[0].title);
        setHeartsToSpend(presets[0].hearts);
      } else if (DEFAULT_REWARD_PRESETS.length > 0) {
        setCustomTitle(DEFAULT_REWARD_PRESETS[0].title);
        setHeartsToSpend(DEFAULT_REWARD_PRESETS[0].hearts);
      }
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveTitle = customTitle.trim() || '보상 교환';
  const canRedeem =
    heartsToSpend > 0 &&
    availableHearts >= heartsToSpend &&
    effectiveTitle.length > 0;

  const handleSelectPreset = (preset: RewardPreset) => {
    setCustomTitle(preset.title);
    setHeartsToSpend(preset.hearts);
  };

  const handleStepMinus = () => {
    if (heartsToSpend > 1) {
      setHeartsToSpend((prev) => prev - 1);
    }
  };

  const handleStepPlus = () => {
    if (heartsToSpend < availableHearts || availableHearts === 0) {
      setHeartsToSpend((prev) => prev + 1);
    }
  };

  const handleQuickChip = (count: number) => {
    setHeartsToSpend(count);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRedeem) return;

    const success = store.redeemReward(effectiveTitle, heartsToSpend);
    if (success) {
      playCompletionChime();
      onClose();
    }
  };

  const remainingAfterExchange = Math.max(0, availableHearts - heartsToSpend);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      data-testid="reward-exchange-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-exchange-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎁</span>
            <h2
              id="reward-exchange-modal-title"
              className="text-lg font-bold text-slate-800"
            >
              하트 보상 교환
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* 1. Balance Hero Card */}
          <div
            data-testid="balance-hero-card"
            className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-white shadow-lg shadow-pink-500/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/85">
                  현재 사용 가능한 하트
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <Heart className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white drop-shadow-xs" />
                  <span
                    data-testid="available-hearts-value"
                    className="text-3xl sm:text-4xl font-black tracking-tight"
                  >
                    {availableHearts}
                  </span>
                  <span className="text-sm font-bold text-white/90">개</span>
                </div>
              </div>

              {/* Mode Badge */}
              <div className="flex flex-col items-end gap-1">
                <span
                  data-testid="user-mode-badge"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/25 shadow-xs"
                >
                  {isParentMode ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>부모 모드</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5" />
                      <span>아이 모드</span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-white/80 font-medium">
                  {isParentMode ? '즉시 교환 가능' : '부모 확인 필요'}
                </span>
              </div>
            </div>

            <div className="my-3 border-t border-white/20" />

            <div className="flex items-center justify-between text-xs text-white/90 font-medium">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                <span>
                  누적 획득:{' '}
                  <strong
                    data-testid="total-earned-hearts"
                    className="font-bold text-white"
                  >
                    {totalEarnedHearts}
                  </strong>
                  개
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-white/90" />
                <span>
                  교환 사용:{' '}
                  <strong
                    data-testid="total-spent-hearts"
                    className="font-bold text-white"
                  >
                    {totalSpentHearts}
                  </strong>
                  개
                </span>
              </div>
            </div>
          </div>

          {/* 2. Preset Recommendations Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-700">
                자주 쓰는 추천 보상
              </h3>
            </div>

            <div
              data-testid="preset-grid"
              className="grid grid-cols-2 gap-2 sm:gap-2.5"
            >
              {presets.map((preset) => {
                const isSelected =
                  customTitle === preset.title && heartsToSpend === preset.hearts;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`preset-card-${preset.id}`}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-pink-50 border-2 border-pink-500 shadow-xs'
                        : 'bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{preset.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                        {preset.title}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-pink-600 font-bold text-xs">
                        <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
                        <span>{preset.hearts}개</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Exchange Form Section */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4"
          >
            <div>
              <label
                htmlFor="reward-title-input"
                className="block text-xs font-bold text-slate-600 mb-1.5"
              >
                보상 이름
              </label>
              <input
                id="reward-title-input"
                type="text"
                data-testid="reward-title-input"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="예: 게임 30분, 원하는 간식, 포켓몬 카드"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all"
              />
            </div>

            {/* Hearts to Spend Stepper & Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600">
                  차감할 하트 수
                </span>
                <span className="text-xs sm:text-sm font-black text-pink-600 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                  <span data-testid="hearts-to-spend-value">{heartsToSpend}</span>
                  개
                </span>
              </div>

              {/* Stepper */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-testid="stepper-minus-btn"
                  onClick={handleStepMinus}
                  disabled={heartsToSpend <= 1}
                  className="p-1 rounded-full text-slate-400 hover:text-pink-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="1개 감소"
                >
                  <MinusCircle className="w-6 h-6" />
                </button>

                <div className="flex-1 text-center py-2 bg-white rounded-xl border border-slate-200 text-base font-extrabold text-slate-800">
                  {heartsToSpend}개
                </div>

                <button
                  type="button"
                  data-testid="stepper-plus-btn"
                  onClick={handleStepPlus}
                  disabled={heartsToSpend >= availableHearts && availableHearts > 0}
                  className="p-1 rounded-full text-slate-400 hover:text-pink-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="1개 증가"
                >
                  <PlusCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Quick Chips */}
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5">
                {[5, 10, 15, 20].map((count) => {
                  const isSelected = heartsToSpend === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      data-testid={`quick-chip-${count}`}
                      onClick={() => handleQuickChip(count)}
                      className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-pink-500 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      +{count}개
                    </button>
                  );
                })}
              </div>

              {/* Remaining preview & Warning */}
              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">교환 후 잔여 하트</span>
                <span
                  data-testid="remaining-hearts-preview"
                  className={`font-bold ${
                    availableHearts >= heartsToSpend
                      ? 'text-slate-700'
                      : 'text-rose-600'
                  }`}
                >
                  {remainingAfterExchange}개
                </span>
              </div>

              {availableHearts < heartsToSpend && (
                <div
                  data-testid="overdraft-warning"
                  className="mt-1 text-xs font-bold text-rose-600"
                >
                  ⚠️ 보유 하트({availableHearts}개)가 부족합니다.
                </div>
              )}
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              data-testid="redeem-submit-btn"
              disabled={!canRedeem}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                canRedeem
                  ? isParentMode
                    ? 'bg-pink-600 hover:bg-pink-700 active:scale-[0.99] shadow-pink-500/25'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-indigo-500/25'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              <Gift className="w-4 h-4" />
              <span>
                {isParentMode
                  ? `하트 ${heartsToSpend}개 차감하고 보상 교환하기`
                  : `보상 교환하기 (${heartsToSpend}개 차감)`}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
