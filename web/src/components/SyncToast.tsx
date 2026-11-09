import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncToastProps {
  status: SyncStatus;
  message: string | null;
  onClose: () => void;
}

export const SyncToast: React.FC<SyncToastProps> = ({ status, message, onClose }) => {
  if (status === 'idle' || !message) {
    return null;
  }

  const getStyle = () => {
    switch (status) {
      case 'syncing':
        return {
          gradient: 'from-blue-600 via-indigo-600 to-blue-700 shadow-blue-500/25',
          icon: <Loader2 className="w-4 h-4 animate-spin text-white flex-shrink-0" />,
        };
      case 'success':
        return {
          gradient: 'from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-500/25',
          icon: <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />,
        };
      case 'error':
        return {
          gradient: 'from-rose-600 via-red-600 to-amber-600 shadow-rose-500/25',
          icon: <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />,
        };
      default:
        return {
          gradient: 'from-slate-700 to-slate-800 shadow-slate-500/25',
          icon: null,
        };
    }
  };

  const { gradient, icon } = getStyle();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sync-toast"
      className={`fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r ${gradient} text-white text-xs sm:text-sm font-semibold shadow-xl border border-white/20 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
    >
      {icon}
      <span className="truncate max-w-[260px] sm:max-w-xs">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
