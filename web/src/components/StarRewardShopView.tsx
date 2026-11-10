import React, { useState, useEffect } from 'react';
import {
  Star,
  Heart,
  Gift,
  Crown,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { ScheduleStore, globalScheduleStore } from '../domain/scheduleStore';
import { WeeklyStarStampBoardCard } from './WeeklyStarStampBoardCard';
import { ParentPinModal } from './ParentPinModal';
import { StarRewardPreset, StarRedemptionRequest } from '../types/snapshot';
import { WeekdayNumber } from '../types/schedule';
import { formatKoreanDateTime } from '../domain/calendarUtils';

export interface StarRewardShopViewProps {
  store?: ScheduleStore;
  onOpenParentPin?: () => void;
}

export const StarRewardShopView: React.FC<StarRewardShopViewProps> = ({
  store = globalScheduleStore,
  onOpenParentPin,
}) => {
  const [, setRenderVersion] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'rewards' | 'ledger'>('rewards');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionCallback, setPinActionCallback] = useState<(() => void) | null>(null);

  // Add preset modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmoji, setNewEmoji] = useState('🎁');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newCost, setNewCost] = useState(1);
  const [newActionType, setNewActionType] = useState<'convertToHearts' | 'customVoucher'>('customVoucher');
  const [newGrantedHearts, setNewGrantedHearts] = useState(5);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setRenderVersion((v) => v + 1);
    });
    return unsubscribe;
  }, [store]);

  const isParentMode = store.isParentMode();
  const availableStars = store.getAvailableStars();
  const availableHearts = store.getAvailableHearts();
  const reservedPendingStars = store.getReservedPendingStars();
  const requestableStars = store.getRequestableStars();
  const thisWeekEarnedStars = store.getThisWeekEarnedStars();
  const totalEarnedStars = store.getTotalEarnedStars();
  const totalSpentStars = store.getTotalSpentStars();

  const presets = store.getStarRewardPresets();
  const pendingRequests = store
    .getStarRedemptionRequests()
    .filter((r) => r.status === 'pending');
  const resolvedRequests = store
    .getStarRedemptionRequests()
    .filter((r) => r.status !== 'pending')
    .slice(0, 15);
  const transactions = store.getStarTransactions();

  const robuxTarget = 10;
  const robuxProgress = Math.min(100, Math.round((availableStars / robuxTarget) * 100));

  const runWithParentAuth = (action: () => void) => {
    if (store.isParentMode()) {
      action();
    } else if (onOpenParentPin) {
      onOpenParentPin();
    } else {
      setPinActionCallback(() => action);
      setIsPinModalOpen(true);
    }
  };

  const handleAwardDailyStar = (weekday: WeekdayNumber) => {
    runWithParentAuth(() => {
      store.awardDailyStar(weekday);
    });
  };

  const handleApprove = (req: StarRedemptionRequest) => {
    runWithParentAuth(() => {
      store.approveStarRedemption(req);
    });
  };

  const handleImmediateRedeem = (preset: StarRewardPreset) => {
    runWithParentAuth(() => {
      store.redeemStarRewardImmediately(preset);
    });
  };

  const handleAddPresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    store.addStarRewardPreset({
      emoji: newEmoji || '🎁',
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || '스타 보상 교환',
      starCost: Math.max(1, newCost),
      actionType: newActionType,
      grantedHearts: newActionType === 'convertToHearts' ? newGrantedHearts : 0,
      badgeTag: newActionType === 'convertToHearts' ? '즉시 충전' : '스페셜 목표',
    });
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewSubtitle('');
    setNewCost(1);
  };

  const formatTimestamp = formatKoreanDateTime;

  return (
    <div data-testid="star-reward-shop-view" className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* 1. Hero Balance & Goal Progress Card */}
      <div
        data-testid="star-balance-hero-card"
        className="rounded-3xl p-5 sm:p-6 text-white shadow-xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider block mb-1">
              보유 중인 스타
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight flex items-center gap-1.5">
                <span>⭐</span>
                <span>{availableStars}</span>
              </span>
              <span className="text-base font-bold text-white/90">개</span>
            </div>

            {reservedPendingStars > 0 && (
              <p className="text-xs font-bold text-yellow-200 mt-1.5 flex items-center gap-1">
                <span>승인 대기 중 {reservedPendingStars}⭐</span>
                <span>·</span>
                <span>추가 신청 가능 {requestableStars}⭐</span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-extrabold border border-white/20 shadow-xs">
              <Heart className="w-3.5 h-3.5 fill-pink-300 text-pink-300" />
              <span>보유 하트 {availableHearts}개</span>
            </div>
            <span className="text-xs font-semibold text-white/85">
              이번 주 획득: +{thisWeekEarnedStars}⭐ (최대 7⭐)
            </span>
          </div>
        </div>

        {/* Roblox Robux 500 Special Goal Gauge */}
        <div className="p-3.5 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="flex items-center gap-1.5 text-white">
              <span>🎮</span>
              <span>스페셜 목표: 로블록스 로벅스 500개</span>
            </span>
            <span className="text-amber-200 font-extrabold">
              {Math.min(availableStars, robuxTarget)} / {robuxTarget} ⭐ ({robuxProgress}%)
            </span>
          </div>

          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-amber-300 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${robuxProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Weekly Star Stamp Board Card (Embedded) */}
      <WeeklyStarStampBoardCard
        store={store}
        initiallyExpanded={true}
        showsShopButton={false}
        onRequestAwardStar={handleAwardDailyStar}
      />

      {/* 3. Pending Approvals Queue (Shown if pending requests exist) */}
      {pendingRequests.length > 0 && (
        <section
          data-testid="pending-approvals-section"
          className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300/80 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-amber-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>부모님 승인 대기 중인 교환 신청 ({pendingRequests.length}건)</span>
            </h3>
          </div>

          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">
                    {req.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800">{req.rewardTitle}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
                        -{req.starCost}⭐
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatTimestamp(req.requestedAt)} · {req.requestedByRole}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => runWithParentAuth(() => store.rejectStarRedemption(req))}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors"
                  >
                    취소 / 반려
                  </button>

                  <button
                    type="button"
                    data-testid="approve-redemption-button"
                    onClick={() => handleApprove(req)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>부모 승인</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Segmented Tabs (보상 교환소 vs 스타 원장 내역) */}
      <div className="flex border-b border-slate-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'rewards'}
          onClick={() => setSelectedTab('rewards')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-extrabold border-b-2 transition-all ${
            selectedTab === 'rewards'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>보상 교환소</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'ledger'}
          onClick={() => setSelectedTab('ledger')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-extrabold border-b-2 transition-all ${
            selectedTab === 'ledger'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>스타 원장 내역</span>
        </button>
      </div>

      {/* 5. Tab Content */}
      {selectedTab === 'rewards' ? (
        <div className="space-y-6">
          {/* Presets List Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">교환 가능한 스타 보상</h3>
              <p className="text-xs text-slate-500">
                {isParentMode
                  ? '부모 모드에서 즉시 승인 및 보상 추가 관리가 가능해요'
                  : '아이가 신청하면 부모님이 승인해요'}
              </p>
            </div>

            {isParentMode && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>새 보상 추가</span>
                </button>
                <button
                  type="button"
                  onClick={() => store.resetStarRewardPresetsToDefault()}
                  title="기본 보상으로 초기화"
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Reward Preset Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {presets.map((preset) => {
              const canRequest = requestableStars >= preset.starCost;
              const canApprove = availableStars >= preset.starCost;

              return (
                <div
                  key={preset.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-3 hover:border-amber-200 transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl shrink-0 border border-amber-100">
                      {preset.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {preset.badgeTag}
                        </span>
                        {preset.actionType === 'convertToHearts' && (
                          <span className="text-[10px] font-black text-pink-600">
                            +❤️{preset.grantedHearts}개
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">
                        {preset.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{preset.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm font-black text-amber-600">⭐ {preset.starCost}개</span>

                    <div className="flex items-center gap-1.5">
                      {isParentMode ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={`approve-immediate-${preset.id}`}
                            onClick={() => handleImmediateRedeem(preset)}
                            disabled={!canApprove}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs shadow-xs transition-all ${
                              canApprove
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{canApprove ? '즉시 교환 승인' : '스타 부족'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => store.deleteStarRewardPreset(preset.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            title="보상 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`request-redemption-${preset.id}`}
                            onClick={() => store.requestStarRedemption(preset)}
                            disabled={!canRequest}
                            className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-xs transition-all ${
                              canRequest
                                ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {canRequest ? '교환 신청하기' : '스타 부족'}
                          </button>

                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => handleImmediateRedeem(preset)}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            >
                              <Lock className="w-3 h-3" />
                              <span>부모 바로승인</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resolved Redemptions History */}
          {resolvedRequests.length > 0 && (
            <div className="pt-4 border-t border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                최근 교환 처리 내역
              </h4>

              <div className="space-y-2">
                {resolvedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-white rounded-xl border border-slate-200/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{req.emoji}</span>
                      <div>
                        <span className="font-bold text-slate-800">{req.rewardTitle}</span>
                        <p className="text-[11px] text-slate-400">
                          {formatTimestamp(req.resolvedAt || req.requestedAt)}
                        </p>
                      </div>
                    </div>

                    <div>
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>승인 완료 (-{req.starCost}⭐)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px]">
                          <XCircle className="w-3 h-3" />
                          <span>취소됨</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Star Ledger History Tab */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                변경 불가능한 스타 원장 (총 {transactions.length}건)
              </h3>
              <p className="text-xs text-slate-500">
                다중 기기 동기화 시에도 중복 없이 보존되는 Append-Only 트랜잭션 기록
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              <span>누적 획득 +{totalEarnedStars}⭐</span>
              <span className="mx-1.5 text-slate-300">|</span>
              <span>누적 사용 -{totalSpentStars}⭐</span>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Star className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">아직 기록된 스타 원장 내역이 없어요.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                평일(월~금) 할 일을 모두 마치고 부모님 확인을 받아 첫 스타를 모아보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isEarn = tx.delta > 0;
                const isBonus = tx.kind === 'weeklyAllClearBonus';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          isBonus
                            ? 'bg-purple-100 text-purple-700'
                            : isEarn
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {isBonus ? '👑' : isEarn ? '⭐' : '🎁'}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{tx.title}</h4>
                        <p className="text-xs text-slate-500">{tx.note}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatTimestamp(tx.createdAt)} · {tx.createdByRole}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-black ${
                          isEarn ? 'text-amber-600' : 'text-pink-600'
                        }`}
                      >
                        {isEarn ? `+${tx.delta}⭐` : `${tx.delta}⭐`}
                      </span>

                      {isParentMode && (
                        <button
                          type="button"
                          data-testid={`revoke-tx-${tx.id}`}
                          onClick={() => store.revokeStarTransaction(tx.id)}
                          title="이 내역 회수/삭제"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Parent PIN Authentication Modal for protected actions */}
      <ParentPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinActionCallback(null);
        }}
        onSuccess={() => {
          setIsPinModalOpen(false);
          if (pinActionCallback) {
            pinActionCallback();
            setPinActionCallback(null);
          }
        }}
        store={store}
      />

      {/* Add Custom Preset Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">새 스타 보상 추가</h3>

            <form onSubmit={handleAddPresetSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">이모지</label>
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">보상 이름</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 닌텐도 게임 30분"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">필요 스타 개수</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newCost}
                  onChange={(e) => setNewCost(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">설명</label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="스타로 교환하는 보상"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">보상 유형</label>
                <select
                  value={newActionType}
                  onChange={(e) =>
                    setNewActionType(e.target.value as 'convertToHearts' | 'customVoucher')
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="customVoucher">교환권 / 실물 보상</option>
                  <option value="convertToHearts">하트 즉시 충전</option>
                </select>
              </div>

              {newActionType === 'convertToHearts' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">충전할 하트 개수</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newGrantedHearts}
                    onChange={(e) => setNewGrantedHearts(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs"
                >
                  보상 추가하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
