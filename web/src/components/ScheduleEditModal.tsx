import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Clock, AlertCircle, RotateCcw, Ban } from 'lucide-react';
import {
  ScheduleItem,
  WeekdayNumber,
  WEEKDAYS,
  CATEGORIES,
  ScheduleCategoryType,
  ScheduleEditScope,
  SubTask,
} from '../types/schedule';
import { ScheduleStore, globalScheduleStore, generateEntityId } from '../domain/scheduleStore';

export interface ScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ScheduleItem | null;
  defaultWeekday?: WeekdayNumber;
  initialScope?: ScheduleEditScope;
  store?: ScheduleStore;
}

export const ScheduleEditModal: React.FC<ScheduleEditModalProps> = ({
  isOpen,
  onClose,
  initialItem = null,
  defaultWeekday = 1,
  initialScope = 'master',
  store = globalScheduleStore,
}) => {
  const isEditMode = Boolean(initialItem);

  const [scope, setScope] = useState<ScheduleEditScope>(initialScope);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<ScheduleCategoryType>('study');
  const [weekday, setWeekday] = useState<WeekdayNumber>(defaultWeekday);
  const [selectedWeekdays, setSelectedWeekdays] = useState<WeekdayNumber[]>([defaultWeekday]);

  const [startHour, setStartHour] = useState(15);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(16);
  const [endMinute, setEndMinute] = useState(0);

  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialItem) {
      setTitle(initialItem.title || '');
      setNote(initialItem.note || '');
      setCategory(initialItem.category || 'study');
      setWeekday(initialItem.weekday || defaultWeekday);
      setSelectedWeekdays([initialItem.weekday || defaultWeekday]);
      setStartHour(initialItem.startHour ?? 15);
      setStartMinute(initialItem.startMinute ?? 0);
      setEndHour(initialItem.endHour ?? 16);
      setEndMinute(initialItem.endMinute ?? 0);
      setSubTasks(initialItem.subTasks ? [...initialItem.subTasks] : []);
      setIsNotificationEnabled(initialItem.isNotificationEnabled ?? true);
      setScope(initialItem.targetWeekKey ? 'thisWeek' : initialScope);
    } else {
      setTitle('');
      setNote('');
      setCategory('study');
      setWeekday(defaultWeekday);
      setSelectedWeekdays([defaultWeekday]);
      setStartHour(15);
      setStartMinute(0);
      setEndHour(16);
      setEndMinute(0);
      setSubTasks([]);
      setIsNotificationEnabled(true);
      setScope(initialScope);
    }
    setNewSubTaskTitle('');
    setErrorMsg(null);
  }, [isOpen, initialItem, defaultWeekday, initialScope]);

  if (!isOpen) return null;

  const hasOverride = initialItem ? store.hasThisWeekOverride(initialItem.id) : false;

  const toggleWeekdaySelection = (day: WeekdayNumber) => {
    if (isEditMode) {
      setWeekday(day);
      return;
    }
    if (selectedWeekdays.includes(day)) {
      if (selectedWeekdays.length > 1) {
        setSelectedWeekdays(selectedWeekdays.filter((d) => d !== day));
      }
    } else {
      setSelectedWeekdays([...selectedWeekdays, day].sort((a, b) => a - b));
    }
  };

  const handleStartHourChange = (newStartHour: number) => {
    setStartHour(newStartHour);
    const startTotal = newStartHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (endTotal <= startTotal) {
      setEndHour(Math.min(23, newStartHour + 1));
      setEndMinute(startMinute);
    }
  };

  const handleStartMinuteChange = (newStartMin: number) => {
    setStartMinute(newStartMin);
    const startTotal = startHour * 60 + newStartMin;
    const endTotal = endHour * 60 + endMinute;
    if (endTotal <= startTotal) {
      if (startHour === 23) {
        setEndMinute(Math.min(55, newStartMin + 30));
      } else {
        setEndHour(startHour + 1);
        setEndMinute(newStartMin);
      }
    }
  };

  const handleAddSubTask = () => {
    const trimmed = newSubTaskTitle.trim();
    if (!trimmed) return;
    setSubTasks([...subTasks, { id: generateEntityId('sub'), title: trimmed }]);
    setNewSubTaskTitle('');
  };

  const handleRemoveSubTask = (id: string) => {
    setSubTasks(subTasks.filter((s) => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('일정 제목을 입력해 주세요.');
      return;
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (startTotal >= endTotal) {
      setErrorMsg('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    if (isEditMode && initialItem) {
      const updated: ScheduleItem = {
        ...initialItem,
        title: trimmedTitle,
        note: note.trim(),
        category,
        weekday,
        startHour,
        startMinute,
        endHour,
        endMinute,
        subTasks,
        isNotificationEnabled,
        notificationLeadMinutes: initialItem.notificationLeadMinutes || [15],
        updatedAt: Date.now() / 1000,
      };
      store.updateItem(updated, scope);
    } else {
      const newItem: ScheduleItem = {
        id: generateEntityId('item'),
        title: trimmedTitle,
        note: note.trim(),
        category,
        iconName: CATEGORIES[category]?.defaultIcon || 'book',
        weekday: selectedWeekdays[0] || weekday,
        startHour,
        startMinute,
        endHour,
        endMinute,
        subTasks,
        isNotificationEnabled,
        notificationLeadMinutes: [15],
        updatedAt: Date.now() / 1000,
      };
      store.addItem(newItem, selectedWeekdays, scope);
    }

    onClose();
  };

  const handleSkipThisWeek = () => {
    if (!initialItem) return;
    store.skipItemForThisWeek(initialItem);
    onClose();
  };

  const handleRevertOverride = () => {
    if (!initialItem) return;
    store.revertThisWeekOverride(initialItem.id);
    onClose();
  };

  const handleDelete = () => {
    if (!initialItem) return;
    store.deleteItem(initialItem);
    onClose();
  };

  return (
    <div
      data-testid="schedule-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">
                {isEditMode ? (scope === 'thisWeek' ? '이번 주 조정' : '기본 시간표 편집') : '새 일정 등록'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {scope === 'thisWeek' ? '이번 주에만 한시적으로 적용됩니다' : '매주 반복되는 기본 시간표에 적용됩니다'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">적용 범위</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                data-testid="scope-master-radio"
                onClick={() => setScope('master')}
                className={`py-2 px-3 rounded-xl transition-all ${
                  scope === 'master'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                매주 반복 (기본 시간표)
              </button>
              <button
                type="button"
                data-testid="scope-this-week-radio"
                onClick={() => setScope('thisWeek')}
                className={`py-2 px-3 rounded-xl transition-all ${
                  scope === 'thisWeek'
                    ? 'bg-white text-amber-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                이번 주만 (임시 조정)
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">일정 제목 *</label>
            <input
              type="text"
              data-testid="schedule-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 수학 연산 학습지, 피아노 연습"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">과목 및 활동 분류</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORIES) as ScheduleCategoryType[]).map((catKey) => {
                const cat = CATEGORIES[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    data-testid={`category-btn-${catKey}`}
                    onClick={() => setCategory(catKey)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? 'border-transparent shadow-xs ring-2'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    style={{
                      backgroundColor: isSelected ? cat.softBackgroundColor : undefined,
                      borderColor: isSelected ? cat.color : undefined,
                      color: isSelected ? cat.color : undefined,
                    }}
                  >
                    <span>{cat.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weekday Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isEditMode ? '요일 선택' : '반복 요일 (다중 선택 가능)'}
            </label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => {
                const isSelected = isEditMode
                  ? weekday === w.number
                  : selectedWeekdays.includes(w.number);

                return (
                  <button
                    key={w.number}
                    type="button"
                    data-testid={`weekday-btn-${w.shortName}`}
                    onClick={() => toggleWeekdaySelection(w.number)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : w.isWeekend
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {w.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>시작 시간</span>
              </label>
              <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <select
                  data-testid="start-hour-select"
                  value={startHour}
                  onChange={(e) => handleStartHourChange(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}시
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-bold">:</span>
                <select
                  data-testid="start-minute-select"
                  value={startMinute}
                  onChange={(e) => handleStartMinuteChange(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, '0')}분
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>종료 시간</span>
              </label>
              <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <select
                  data-testid="end-hour-select"
                  value={endHour}
                  onChange={(e) => setEndHour(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, '0')}시
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-bold">:</span>
                <select
                  data-testid="end-minute-select"
                  value={endMinute}
                  onChange={(e) => setEndMinute(parseInt(e.target.value, 10))}
                  className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {m.toString().padStart(2, '0')}분
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">메모 (선택)</label>
            <input
              type="text"
              data-testid="schedule-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 3단원 복습, 준비물 챙기기"
              className="w-full px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">세부 할 일 (체크리스트)</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                data-testid="new-subtask-input"
                value={newSubTaskTitle}
                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubTask();
                  }
                }}
                placeholder="세부 항목 입력 후 추가"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                data-testid="add-subtask-btn"
                onClick={handleAddSubTask}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>추가</span>
              </button>
            </div>

            {subTasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                {subTasks.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-xl border border-slate-200"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-slate-400 font-bold">{idx + 1}.</span>
                      <span className="font-semibold text-slate-700 truncate">{sub.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubTask(sub.id)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors ml-2"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isEditMode && (
              <>
                <button
                  type="button"
                  data-testid="delete-schedule-btn"
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>

                <button
                  type="button"
                  data-testid="skip-this-week-btn"
                  onClick={handleSkipThisWeek}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold text-xs border border-amber-200 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>이번 주만 휴강</span>
                </button>

                {hasOverride && (
                  <button
                    type="button"
                    data-testid="revert-override-btn"
                    onClick={handleRevertOverride}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold text-xs border border-indigo-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>원래 시간표로 복구</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 font-bold text-xs transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              data-testid="save-schedule-btn"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
