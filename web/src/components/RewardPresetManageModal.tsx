import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  Heart,
  MinusCircle,
  PlusCircle,
} from 'lucide-react';
import { ScheduleStore } from '../domain/scheduleStore';
import { RewardPreset } from '../types/snapshot';

export interface RewardPresetManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: ScheduleStore;
}

export const EMOJI_PALETTE_16: string[] = [
  '🎮',
  '🍦',
  '🧸',
  '🎡',
  '💰',
  '🎬',
  '🛌',
  '🍳',
  '📚',
  '🍕',
  '🚴',
  '🎨',
  '🧩',
  '🧁',
  '🎳',
  '🎁',
];

export const TAG_SUGGESTIONS: string[] = [
  '놀이',
  '간식',
  '선물',
  '나들이',
  '용돈',
  '미디어',
  '쿠폰',
  '특별',
  '외식',
  '학습',
];

export const RewardPresetManageModal: React.FC<RewardPresetManageModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [store]);

  const presets = store.getRewardPresets();

  // Sub-modal state for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<RewardPreset | null>(null);

  // Form input fields
  const [formEmoji, setFormEmoji] = useState('🎁');
  const [formTitle, setFormTitle] = useState('');
  const [formHearts, setFormHearts] = useState(10);
  const [formTag, setFormTag] = useState('놀이');

  // Reset confirmation dialog state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isResetConfirmOpen) {
          setIsResetConfirmOpen(false);
        } else if (isFormOpen) {
          handleCloseForm();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isResetConfirmOpen, isFormOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenAddForm = () => {
    setEditingPreset(null);
    setFormEmoji('🎁');
    setFormTitle('');
    setFormHearts(10);
    setFormTag('놀이');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (preset: RewardPreset) => {
    setEditingPreset(preset);
    setFormEmoji(preset.emoji);
    setFormTitle(preset.title);
    setFormHearts(preset.hearts);
    setFormTag(preset.tag || '놀이');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPreset(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = formTitle.trim();
    if (!cleanTitle) return;
    const finalHearts = Math.max(1, formHearts);
    const finalTag = formTag.trim() || '기타';

    if (editingPreset) {
      store.updateRewardPreset(editingPreset.id, {
        emoji: formEmoji,
        title: cleanTitle,
        hearts: finalHearts,
        tag: finalTag,
      });
    } else {
      store.addRewardPreset({
        emoji: formEmoji,
        title: cleanTitle,
        hearts: finalHearts,
        tag: finalTag,
      });
    }

    handleCloseForm();
  };

  const handleDelete = (id: string) => {
    store.deleteRewardPreset(id);
  };

  const handleConfirmReset = () => {
    store.resetRewardPresetsToDefault();
    setIsResetConfirmOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="preset-manage-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-manage-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFormOpen && !isResetConfirmOpen) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h2
                id="preset-manage-title"
                className="text-lg font-bold text-slate-800"
              >
                추천 보상 관리
              </h2>
              <p className="text-xs text-slate-400">
                가족의 규칙에 맞게 추천 보상 목록을 자유롭게 설정하세요.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-preset-manage-modal-btn"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Header: Add & Reset */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="add-preset-btn"
            onClick={handleOpenAddForm}
            className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 active:scale-[0.99] text-white text-xs font-bold shadow-sm shadow-pink-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>새 보상 추가</span>
          </button>

          <button
            type="button"
            data-testid="reset-presets-btn"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="기본 8종 추천 보상으로 초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본값 복원</span>
          </button>
        </div>

        {/* Presets List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
          {presets.length === 0 ? (
            <div
              data-testid="preset-empty-state"
              className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2"
            >
              <p className="text-3xl">🎁</p>
              <p className="text-sm font-bold text-slate-700">
                등록된 추천 보상이 없습니다
              </p>
              <p className="text-xs text-slate-400">
                ‘새 보상 추가’를 누르거나 ‘기본값 복원’을 눌러 초기 보상을 불러오세요.
              </p>
            </div>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.id}
                data-testid={`preset-manage-item-${preset.id}`}
                className="p-3 bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-xl shrink-0">
                    {preset.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-800 truncate">
                        {preset.title}
                      </h3>
                      {preset.tag && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                          {preset.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-pink-600 mt-0.5">
                      <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                      <span>{preset.hearts}개</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid={`edit-preset-btn-${preset.id}`}
                    onClick={() => handleOpenEditForm(preset)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label={`${preset.title} 수정`}
                    title="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    data-testid={`delete-preset-btn-${preset.id}`}
                    onClick={() => handleDelete(preset.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    aria-label={`${preset.title} 삭제`}
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Sub-Modal */}
      {isFormOpen && (
        <div
          data-testid="preset-form-modal"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preset-form-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {editingPreset ? '✏️' : '✨'}
                </span>
                <h3
                  id="preset-form-title"
                  className="text-base font-extrabold text-slate-800"
                >
                  {editingPreset ? '추천 보상 수정' : '새 추천 보상 추가'}
                </h3>
              </div>
              <button
                type="button"
                data-testid="cancel-preset-form-btn"
                onClick={handleCloseForm}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Emoji Selection Section with 16-Grid Palette */}
              <div>
                <div
                  id="emoji-palette-label"
                  className="text-xs font-bold text-slate-600 mb-1.5 flex items-center justify-between"
                >
                  <span>이모지 아이콘 선택</span>
                  <span
                    data-testid="selected-emoji-preview"
                    className="text-lg bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-lg"
                  >
                    {formEmoji}
                  </span>
                </div>

                <div
                  data-testid="emoji-palette-grid"
                  aria-labelledby="emoji-palette-label"
                  role="group"
                  className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200/80"
                >
                  {EMOJI_PALETTE_16.map((emoji) => {
                    const isSelected = formEmoji === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        data-testid={`emoji-option-${emoji}`}
                        onClick={() => setFormEmoji(emoji)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                          isSelected
                            ? 'bg-pink-500 text-white shadow-sm scale-105 ring-2 ring-pink-400'
                            : 'bg-white hover:bg-pink-50 border border-slate-200/60'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label
                  htmlFor="preset-title-input"
                  className="block text-xs font-bold text-slate-600 mb-1.5"
                >
                  보상 이름
                </label>
                <input
                  id="preset-title-input"
                  data-testid="preset-title-input"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 자유 놀이 30분, 맛있는 피자"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Hearts input with Stepper */}
              <div>
                <label
                  htmlFor="preset-hearts-input"
                  className="block text-xs font-bold text-slate-600 mb-1.5"
                >
                  필요 하트 수
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="preset-hearts-minus"
                    onClick={() => setFormHearts((h) => Math.max(1, h - 1))}
                    disabled={formHearts <= 1}
                    className="p-1 rounded-full text-slate-400 hover:text-pink-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="1개 감소"
                  >
                    <MinusCircle className="w-6 h-6" />
                  </button>

                  <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 px-3 py-1.5 focus-within:ring-2 focus-within:ring-pink-400 focus-within:border-transparent transition-all">
                    <input
                      id="preset-hearts-input"
                      data-testid="preset-hearts-input"
                      type="number"
                      min={1}
                      value={formHearts}
                      onChange={(e) => setFormHearts(Number(e.target.value))}
                      className="w-16 text-center text-base font-extrabold text-slate-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-sm font-bold text-slate-600 ml-1">개</span>
                  </div>

                  <button
                    type="button"
                    data-testid="preset-hearts-plus"
                    onClick={() => setFormHearts((h) => h + 1)}
                    className="p-1 rounded-full text-slate-400 hover:text-pink-600 transition-colors"
                    aria-label="1개 증가"
                  >
                    <PlusCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Category Tag input & Suggestions */}
              <div>
                <label
                  htmlFor="preset-tag-input"
                  className="block text-xs font-bold text-slate-600 mb-1.5"
                >
                  카테고리 태그
                </label>
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  {TAG_SUGGESTIONS.map((tag) => {
                    const isSelected = formTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setFormTag(tag)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-pink-500 text-white border-pink-500'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="preset-tag-input"
                  data-testid="preset-tag-input"
                  type="text"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  placeholder="예: 놀이, 간식, 선물, 외식"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  data-testid="save-preset-btn"
                  disabled={!formTitle.trim() || formHearts < 1}
                  className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs shadow-md shadow-pink-600/20 transition-all"
                >
                  {editingPreset ? '저장하기' : '추가하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div
          data-testid="reset-presets-confirm-dialog"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-presets-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
              🔄
            </div>
            <div>
              <h3
                id="reset-presets-title"
                className="text-base font-extrabold text-slate-800"
              >
                기본값으로 복원할까요?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                현재 등록된 모든 추천 보상이 삭제되고
                <br />
                <strong>기본 추천 보상 8종</strong>으로 초기화됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                data-testid="cancel-reset-presets-btn"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                data-testid="confirm-reset-presets-btn"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-colors"
              >
                기본값으로 복원
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
