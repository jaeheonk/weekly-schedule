import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  CheckCheck,
  Heart,
  Palette,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { ScheduleItem, WEEKDAYS, CATEGORIES } from '../types/schedule';
import {
  PrintConfig,
  getPrintableTimeSlots,
  buildPrintColumnBlocks,
  getThemeStyles,
  formatPrintDisplayLines,
} from '../domain/printLayout';

export interface SchedulePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  store?: ScheduleStore;
}

export const SchedulePrintModal: React.FC<SchedulePrintModalProps> = ({
  isOpen,
  onClose,
  store = globalScheduleStore,
}) => {
  const [config, setConfig] = useState<PrintConfig>({
    scope: 'master',
    theme: 'classicMint',
    documentTitle: 'WEEKLY SCHEDULE | 주간 시간표',
    showCompletionStamps: false,
    showNotesAndSubtasks: true,
    mergeLongBlocks: true,
  });

  const [, setRenderVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [store]);

  // Support ⌘P or ESC keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        handleExecutePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const printableItems: ScheduleItem[] =
    config.scope === 'master' ? store.getMasterItems() : store.getEffectiveItems();

  const timeSlots = getPrintableTimeSlots(printableItems);
  const themeStyles = getThemeStyles(config.theme);
  const totalHeartsThisWeek = store.getAvailableHearts();
  const currentWeekAdjustmentCount = store.getCurrentWeekAdjustmentCount();

  const handleExecutePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        {/* Modal Header (Hidden during actual print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 id="print-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                1페이지 시간표 인쇄
              </h2>
              <p className="text-xs text-slate-500">
                A4 가로 1장에 정확히 들어맞는 냉장고·벽걸이용 시간표 출력
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="execute-print-btn"
              onClick={handleExecutePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>바로 인쇄하기 (⌘P)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable container for preview & controls */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 print:p-0 print:overflow-visible">
          {/* 1. Real-time A4 Landscape Preview Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 print:hidden">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>A4 가로 1페이지 실시간 미리보기 (8mm 여백 최적화)</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  config.scope === 'master'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {config.scope === 'master' ? '전체 기본 시간표' : '이번 주 조정 반영됨'}
              </span>
            </div>

            {/* A4 Sheet Container */}
            <div className="overflow-x-auto bg-slate-100/60 p-2 sm:p-4 rounded-2xl border border-slate-200/80 flex justify-center print:bg-white print:p-0 print:border-none print:overflow-visible">
              <div
                data-testid="printable-sheet"
                className={`printable-sheet ${themeStyles.themeClass} bg-white text-slate-900 border border-slate-300 shadow-lg rounded-sm print:shadow-none print:border print:rounded-none`}
                style={{
                  width: '100%',
                  maxWidth: '1060px',
                  minWidth: '760px',
                  aspectRatio: '1.414 / 1',
                  boxSizing: 'border-box',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Header Title & Stamp Summary */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <h1
                      className="text-sm sm:text-base font-extrabold tracking-tight"
                      style={{ color: themeStyles.titleText }}
                    >
                      {config.documentTitle || 'WEEKLY SCHEDULE | 주간 시간표'}
                    </h1>
                  </div>

                  {config.showCompletionStamps && (
                    <div
                      data-testid="preview-stamps-summary"
                      className="flex items-center gap-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <span className="flex items-center gap-1 text-blue-600">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>아이 완료</span>
                      </span>
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCheck className="w-3 h-3" />
                        <span>부모 확인</span>
                      </span>
                      {totalHeartsThisWeek > 0 && (
                        <span className="flex items-center gap-1 text-pink-600">
                          <Heart className="w-3 h-3 fill-pink-500" />
                          <span>하트 {totalHeartsThisWeek}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Main Table: Time Column + 7 Weekdays */}
                <div
                  className="flex-1 mt-2 border border-slate-300 grid"
                  style={{
                    gridTemplateColumns: '50px repeat(7, 1fr)',
                    borderColor: themeStyles.gridLine,
                  }}
                >
                  {/* Table Header Row: Time + Mon..Sun */}
                  <div
                    className="p-1 text-center text-[10px] font-bold flex items-center justify-center border-r border-b"
                    style={{
                      backgroundColor: themeStyles.headerBg,
                      color: themeStyles.headerText,
                      borderColor: themeStyles.gridLine,
                    }}
                  >
                    시간
                  </div>
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w.number}
                      className="p-1 text-center text-[10px] font-bold flex items-center justify-center border-r last:border-r-0 border-b"
                      style={{
                        backgroundColor: themeStyles.headerBg,
                        color: themeStyles.headerText,
                        borderColor: themeStyles.gridLine,
                      }}
                    >
                      {w.fullName}
                    </div>
                  ))}

                  {/* Body Content Row: Column per day */}
                  {/* 1. Left Time Slots Column */}
                  <div
                    className="flex flex-col border-r"
                    style={{ borderColor: themeStyles.gridLine }}
                  >
                    {timeSlots.map((slot) => (
                      <div
                        key={slot.totalMinutes}
                        className="flex-1 min-h-[18px] text-[9px] font-semibold flex items-center justify-center border-b last:border-b-0 px-0.5 text-center"
                        style={{
                          backgroundColor: themeStyles.timeColBg,
                          color: themeStyles.timeColText,
                          borderColor: themeStyles.gridLine,
                        }}
                      >
                        {slot.label}
                      </div>
                    ))}
                  </div>

                  {/* 2. Seven Weekdays Columns */}
                  {WEEKDAYS.map((w) => {
                    const blocks = buildPrintColumnBlocks(
                      w.number,
                      printableItems,
                      timeSlots,
                      config.mergeLongBlocks
                    );

                    return (
                      <div
                        key={w.number}
                        className="flex flex-col border-r last:border-r-0"
                        style={{ borderColor: themeStyles.gridLine }}
                      >
                        {blocks.map((block) => {
                          const hasItems = block.items.length > 0;
                          const firstItem = block.items[0];

                          // Background determination
                          let cellBg = '#FFFFFF';
                          if (block.isHighlightedSpanBlock) {
                            cellBg = themeStyles.spanBlockHighlight;
                          } else if (hasItems && config.theme === 'subjectColor' && firstItem) {
                            const cat = CATEGORIES[firstItem.category];
                            cellBg = cat ? `${cat.color}18` : '#F3F4F6';
                          }

                          return (
                            <div
                              key={block.id}
                              className="border-b last:border-b-0 flex flex-col justify-center items-center text-center p-0.5 overflow-hidden"
                              style={{
                                flex: block.spanCount,
                                minHeight: `${block.spanCount * 18}px`,
                                backgroundColor: cellBg,
                                borderColor: themeStyles.gridLine,
                              }}
                            >
                              {block.items.map((item, itemIdx) => {
                                const isContinuation =
                                  item.startHour * 60 + item.startMinute < block.slot.totalMinutes;
                                const formatted = formatPrintDisplayLines(
                                  item,
                                  isContinuation,
                                  block.nextSlotMinutes
                                );

                                const isCompleted = store.isCompleted(item);
                                const isParentVerified = store.isParentVerified(item);
                                const reaction = store.getItemReaction(item);

                                return (
                                  <div
                                    key={`${item.id}_${itemIdx}`}
                                    className="w-full flex flex-col items-center justify-center leading-tight py-0.5"
                                  >
                                    <div className="flex items-center justify-center gap-0.5 text-[8.5px] font-bold text-slate-800 break-keep">
                                      {config.showCompletionStamps && (
                                        <>
                                          {isParentVerified ? (
                                            <CheckCheck className="w-2.5 h-2.5 text-green-600 shrink-0" />
                                          ) : isCompleted ? (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                          ) : null}
                                        </>
                                      )}
                                      <span className="truncate max-w-full">
                                        {formatted.titleText}
                                      </span>
                                      {config.showCompletionStamps &&
                                        !isContinuation &&
                                        reaction &&
                                        reaction.heartCount > 0 && (
                                          <span className="flex items-center text-pink-600 text-[7px] font-extrabold shrink-0">
                                            <Heart className="w-2 h-2 fill-pink-500" />
                                            {reaction.heartCount}
                                          </span>
                                        )}
                                    </div>

                                    {/* Subtitle / time range note */}
                                    {config.showNotesAndSubtasks && formatted.subtitleText && (
                                      <div className="text-[7.5px] text-slate-500 font-medium">
                                        {formatted.subtitleText}
                                      </div>
                                    )}

                                    {/* Subtasks checklist if present */}
                                    {config.showNotesAndSubtasks &&
                                      block.isHighlightedSpanBlock &&
                                      item.subTasks &&
                                      item.subTasks.length > 0 && (
                                        <div className="mt-1 space-y-0.5 text-[7px] text-slate-600 text-left w-full px-1">
                                          {item.subTasks.map((st) => (
                                            <div
                                              key={st.id}
                                              className="flex items-center gap-1 truncate"
                                            >
                                              <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                                              <span className="truncate">{st.title}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Customization Controls Section (Hidden during actual print) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-5 print:hidden">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              <span>인쇄 옵션 및 스타일 맞춤 설정</span>
            </h3>

            {/* Scope selection: Master Schedule vs This Week */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>출력할 시간표 기준</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, scope: 'master' }))}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    config.scope === 'master'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  전체 기본 시간표 (매주)
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, scope: 'thisWeek' }))}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    config.scope === 'thisWeek'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  이번 주 조정 반영 ({currentWeekAdjustmentCount}건)
                </button>
              </div>
            </div>

            {/* Theme selection: Classic Mint, Subject Color, B&W Ink Saver */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>디자인 테마 선택</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, theme: 'classicMint' }))}
                  className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    config.theme === 'classicMint'
                      ? 'bg-[#DAE9E2] text-[#233F35] border-[#A8C6B7] ring-2 ring-[#70A58F]'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#70A58F]" />
                  <span>Classic Mint (세이지)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, theme: 'subjectColor' }))}
                  className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    config.theme === 'subjectColor'
                      ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-400'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                  <span>Subject Color (파스텔)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, theme: 'bwInkSaver' }))}
                  className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                    config.theme === 'bwInkSaver'
                      ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span>B&W Ink Saver (흑백)</span>
                </button>
              </div>
            </div>

            {/* Document Title input */}
            <div className="space-y-1.5">
              <label
                htmlFor="print-doc-title"
                className="text-xs font-semibold text-slate-600 flex items-center justify-between"
              >
                <span>상단 제목 문구</span>
                {config.documentTitle !== 'WEEKLY SCHEDULE | 주간 시간표' && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        documentTitle: 'WEEKLY SCHEDULE | 주간 시간표',
                      }))
                    }
                    className="text-[11px] text-indigo-600 hover:underline font-bold"
                  >
                    기본값 복원
                  </button>
                )}
              </label>
              <input
                id="print-doc-title"
                type="text"
                value={config.documentTitle}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, documentTitle: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                placeholder="WEEKLY SCHEDULE | 주간 시간표"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200/80">
              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    완료 확인 도장 및 응원 하트 표시
                  </div>
                  <div className="text-[11px] text-slate-500">
                    벽걸이용 빈 양식은 끄고, 주간 완료 칭찬 리포트는 켜보세요
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="완료 확인 도장 및 응원 하트 표시"
                  checked={config.showCompletionStamps}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      showCompletionStamps: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    세부 할 일 목록 & 시간 메모 표시
                  </div>
                  <div className="text-[11px] text-slate-500">
                    체크리스트 서브태스크와 상세 시간 메모(예: 10:30-11:20)를 표 안에 함께 출력
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="세부 할 일 목록 & 시간 메모 표시"
                  checked={config.showNotesAndSubtasks}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      showNotesAndSubtasks: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    장기 일정 셀 하나로 병합하기
                  </div>
                  <div className="text-[11px] text-slate-500">
                    토요일 미션, 주말 자유시간 등 여러 칸에 걸친 일정을 깔끔하게 한 칸으로 병합
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label="장기 일정 셀 하나로 병합하기"
                  checked={config.mergeLongBlocks}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      mergeLongBlocks: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
