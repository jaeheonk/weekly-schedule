import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { StarRewardShopView } from './StarRewardShopView';

export interface StarRewardShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRewardExchange?: () => void;
  store?: ScheduleStore;
}

/**
 * ⭐ 스타 보상 상점 모달.
 * iOS 앱의 StarRewardShopSheet처럼 상단 탭이 아니라 시트(모달)로 띄운다.
 * 겉모습과 닫기 동작은 하트 보상 교환 모달(RewardExchangeModal)과 같은 패턴을 따른다.
 */
export const StarRewardShopModal: React.FC<StarRewardShopModalProps> = ({
  isOpen,
  onClose,
  onOpenRewardExchange,
  store = globalScheduleStore,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape는 이 모달이 가장 위에 떠 있을 때만 닫는다 (PIN·보상 추가·하트 교환 모달이 위에 있으면 무시)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs.length > 0 && dialogs[dialogs.length - 1] === dialogRef.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      data-testid="star-shop-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="star-shop-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h2 id="star-shop-modal-title" className="text-lg font-bold text-slate-800">
              스타 보상 상점
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-star-shop-modal-btn"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain">
          <StarRewardShopView
            store={store}
            variant="modal"
            onOpenRewardExchange={onOpenRewardExchange}
          />
        </div>
      </div>
    </div>
  );
};
