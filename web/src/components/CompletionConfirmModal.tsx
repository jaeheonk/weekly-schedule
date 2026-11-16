import React, { useEffect } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { ScheduleItem, SubTask } from '../types/schedule';
import { formatTimeRange } from '../domain/calendarUtils';

export type CompletionConfirmTarget =
  | { kind: 'item'; item: ScheduleItem }
  | { kind: 'subTask'; subTask: SubTask; parentItem: ScheduleItem };

export interface CompletionConfirmContext {
  target: CompletionConfirmTarget;
  isCurrentlyCompleted: boolean;
}

export interface CompletionConfirmCopy {
  titleText: string;
  messageText: string;
  confirmButtonTitle: string;
}

export function getCompletionConfirmCopy(
  context: CompletionConfirmContext
): CompletionConfirmCopy {
  const { target, isCurrentlyCompleted } = context;

  if (target.kind === 'item') {
    const { item } = target;
    const timeRange = formatTimeRange(
      item.startHour,
      item.startMinute,
      item.endHour,
      item.endMinute
    );
    const subTaskCount = item.subTasks?.length ?? 0;

    let messageText: string;
    if (isCurrentlyCompleted) {
      messageText =
        subTaskCount > 0
          ? `[${item.title}] (${timeRange}) 완료 체크를 해제할까요?\n포함된 세부 항목(${subTaskCount}개)도 함께 미완료 상태로 변경됩니다.`
          : `[${item.title}] (${timeRange}) 완료 체크를 해제할까요?`;
    } else {
      messageText =
        subTaskCount > 0
          ? `[${item.title}] (${timeRange}) 일정을 완료했나요?\n확인하면 포함된 세부 항목(${subTaskCount}개)도 함께 완료 체크됩니다.`
          : `[${item.title}] (${timeRange}) 일정을 완료했나요?\n체크하면 부모님께 완료 상태가 표시됩니다.`;
    }

    return {
      titleText: isCurrentlyCompleted ? '완료 체크 해제 확인' : '일정 완료 체크 확인',
      messageText,
      confirmButtonTitle: isCurrentlyCompleted ? '체크 해제' : '완료 체크하기',
    };
  }

  const { subTask, parentItem } = target;
  const messageText = isCurrentlyCompleted
    ? `[${parentItem.title}]의 세부 항목 '${subTask.title}' 완료 체크를 해제할까요?`
    : `[${parentItem.title}]의 세부 항목 '${subTask.title}'을(를) 완료했나요?`;

  return {
    titleText: isCurrentlyCompleted ? '세부 항목 체크 해제 확인' : '세부 항목 완료 확인',
    messageText,
    confirmButtonTitle: isCurrentlyCompleted ? '체크 해제' : '완료 체크하기',
  };
}

export interface CompletionConfirmModalProps {
  context: CompletionConfirmContext | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CompletionConfirmModal: React.FC<CompletionConfirmModalProps> = ({
  context,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!context) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context, onCancel]);

  if (!context) return null;

  const { titleText, messageText, confirmButtonTitle } = getCompletionConfirmCopy(context);
  const isUncheck = context.isCurrentlyCompleted;

  return (
    <div
      data-testid="completion-confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-confirm-title"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isUncheck
                ? 'bg-rose-100 text-rose-600'
                : 'bg-blue-100 text-blue-600'
            }`}
          >
            {isUncheck ? (
              <RotateCcw className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1.5 min-w-0">
            <h4
              id="completion-confirm-title"
              className="text-base sm:text-lg font-extrabold text-slate-900"
            >
              {titleText}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {messageText}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            data-testid="cancel-completion-btn"
            onClick={onCancel}
            className="w-full sm:w-auto py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            data-testid="confirm-completion-btn"
            onClick={onConfirm}
            className={`w-full sm:w-auto py-2.5 px-4 rounded-2xl text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all cursor-pointer ${
              isUncheck
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmButtonTitle}
          </button>
        </div>
      </div>
    </div>
  );
};
