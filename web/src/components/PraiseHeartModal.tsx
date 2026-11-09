import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Plus,
  Minus,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { ScheduleItem } from '../types/schedule';
import { ReactionSticker, STICKER_OPTIONS } from '../types/snapshot';

export interface PraiseHeartModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem?: ScheduleItem | null;
  store?: ScheduleStore;
}

export const QUICK_PRESETS: string[] = [
  '스스로 다 해내다니 정말 기특해! ❤️',
  '오늘도 약속 지킨 우리 아이 최고! ⭐',
  '어려운 숙제였는데 끝까지 해냈네! 👍',
  '집중해서 열심히 한 모습 멋져요! 👏',
  '남은 일정도 화이팅! 엄마 아빠가 응원해 🔥',
  '오늘의 숙제 챔피언! 정말 사랑해 👑',
];

export const PraiseHeartModal: React.FC<PraiseHeartModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  store = globalScheduleStore,
}) => {
  const [selectedSticker, setSelectedSticker] = useState<ReactionSticker>('heart');
  const [selectedHeartCount, setSelectedHeartCount] = useState<number>(1);
  const [commentText, setCommentText] = useState<string>('');
  const [alsoVerify, setAlsoVerify] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (targetItem) {
        const existing = store.getItemReaction(targetItem);
        if (existing) {
          setSelectedSticker(existing.sticker || 'heart');
        } else {
          setSelectedSticker('heart');
        }
      } else {
        setSelectedSticker('heart');
      }
      setSelectedHeartCount(1);
      setCommentText('');
      setAlsoVerify(false);
    }
  }, [isOpen, targetItem, store]);

  if (!isOpen) return null;

  const currentStickerObj =
    STICKER_OPTIONS.find((s) => s.key === selectedSticker) || STICKER_OPTIONS[0];

  const existingReaction = targetItem ? store.getItemReaction(targetItem) : undefined;
  const isTargetAlreadyVerified = targetItem ? store.isParentVerified(targetItem) : false;

  const isZeroHearts = selectedHeartCount === 0;
  const isCommentEmpty = commentText.trim().length === 0;
  const canSend = !isZeroHearts || !isCommentEmpty;

  const handleSend = () => {
    if (!canSend) return;

    if (targetItem) {
      store.sendItemReaction({
        item: targetItem,
        addHearts: selectedHeartCount,
        sticker: selectedSticker,
        comment: commentText,
        alsoVerify: alsoVerify && !isTargetAlreadyVerified,
      });
    } else {
      store.sendFamilyPraise({
        hearts: selectedHeartCount,
        sticker: selectedSticker,
        message: commentText,
      });
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="praise-heart-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          data-testid="praise-modal-close-btn"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {targetItem ? '숙제 칭찬 & 메시지 남기기' : '아이에게 응원 메시지 보내기'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {targetItem
              ? '아이가 숙제 카드에서 부모님의 응원과 하트를 바로 확인할 수 있습니다.'
              : '아이 화면 상단 배너에 부모님의 응원 메시지가 즉시 동기화됩니다.'}
          </p>
        </div>

        {/* Preview Card */}
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 border border-pink-200/60 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0">
            {currentStickerObj.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-pink-600">
                {currentStickerObj.label}
              </span>
              {selectedHeartCount > 0 && (
                <span className="text-xs font-black text-rose-500 flex items-center gap-0.5">
                  <Heart className="w-3.5 h-3.5 fill-rose-500" />+{selectedHeartCount}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {targetItem ? targetItem.title : '오늘도 열심히 하는 아이에게 보내는 응원'}
            </h3>
          </div>
        </div>

        <div className="space-y-5">
          {/* 1. Sticker Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              1. 응원 아이콘 선택
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STICKER_OPTIONS.map((st) => {
                const isSelected = selectedSticker === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    data-testid={`sticker-btn-${st.key}`}
                    onClick={() => setSelectedSticker(st.key)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-pink-500 bg-pink-50/80 shadow-sm text-pink-700 scale-105'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-2xl mb-1">{st.emoji}</span>
                    <span className="text-[11px] font-semibold truncate w-full text-center">
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Heart Count Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                2. 보낼 하트 개수
              </label>
              <div className="text-xs font-bold text-rose-500 flex items-center gap-1">
                {selectedHeartCount > 0 ? (
                  <>
                    <Heart className="w-3.5 h-3.5 fill-rose-500" />
                    <span>+{selectedHeartCount}개 지급</span>
                  </>
                ) : (
                  <span className="text-slate-500">0개 (메시지만 전송)</span>
                )}
              </div>
            </div>

            {/* Stepper & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  disabled={selectedHeartCount <= 0}
                  onClick={() => setSelectedHeartCount((c) => Math.max(0, c - 1))}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="하트 1개 줄이기"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5 font-black text-lg text-slate-900">
                  <Heart
                    className={`w-5 h-5 ${
                      selectedHeartCount > 0 ? 'text-rose-500 fill-rose-500' : 'text-slate-300'
                    }`}
                  />
                  <span>+{selectedHeartCount}</span>
                </div>

                <button
                  type="button"
                  disabled={selectedHeartCount >= 30}
                  onClick={() => setSelectedHeartCount((c) => Math.min(30, c + 1))}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="하트 1개 늘리기"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets: 0, 1, 2, 3, 5, 10 */}
              <div className="grid grid-cols-6 gap-1.5">
                {[0, 1, 2, 3, 5, 10].map((count) => {
                  const isSelected = selectedHeartCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      data-testid={`heart-preset-${count}`}
                      onClick={() => setSelectedHeartCount(count)}
                      className={`py-2 px-1 rounded-xl font-bold text-xs border transition-all ${
                        isSelected
                          ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {count === 0 ? '0개' : `+${count}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Comment Input & Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              3. 아이에게 보낼 칭찬 한마디 {isZeroHearts && <span className="text-rose-500 font-semibold">(필수)</span>}
            </label>

            <input
              type="text"
              data-testid="praise-comment-input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="예: 오늘 스스로 숙제 챙긴 모습 최고야! ❤️"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
            />

            {/* Quick Presets Horizontal Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCommentText(preset)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/60 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Previous Comments List */}
            {existingReaction?.comments && existingReaction.comments.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>이전에 남긴 메시지 ({existingReaction.comments.length}개)</span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {existingReaction.comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60 flex items-start gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="flex-1">{cmt.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Also Verify Checkbox (Only if item target is unverified) */}
          {targetItem && !isTargetAlreadyVerified && (
            <label
              data-testid="also-verify-toggle"
              className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              <input
                type="checkbox"
                checked={alsoVerify}
                onChange={(e) => setAlsoVerify(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
              />
              <div className="flex-1 text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>응원 전송 시 '부모 확인 완료' 도장도 함께 찍기</span>
                </div>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  [{targetItem.title}] 숙제를 확인 완료 상태로 변경합니다
                </p>
              </div>
            </label>
          )}

          {/* Send Button */}
          <button
            type="button"
            data-testid="send-praise-btn"
            disabled={!canSend}
            onClick={handleSend}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
              canSend
                ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 shadow-rose-200 active:scale-[0.99]'
                : 'bg-slate-300 shadow-none cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isZeroHearts
                ? `${currentStickerObj.emoji} 응원 메시지만 보내기`
                : `${currentStickerObj.emoji} 하트 +${selectedHeartCount}개와 응원 전송`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
