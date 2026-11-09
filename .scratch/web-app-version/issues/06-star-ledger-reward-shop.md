# 06: 스타 원장(Star Ledger) 기록 및 스타 보상 상점 교환 신청·승인 워크플로우

**What to build:**
평일 일과 완수 및 5일 올클리어 보너스로 획득하는 스타를 변경 불가능한 원장(Star Ledger)에 기록하고, 아이가 스타 보상 상점에서 보상(로벅스, 칭찬 하트 등)을 교환 신청할 수 있도록 합니다. 부모 모드에서는 신청 내역을 검토하여 승인(스타 차감 및 지급)하거나 반려할 수 있는 상호작용 워크플로우를 제공합니다.

**Blocked by:** 04: 6자리 부모 PIN 보안 인증, 잠금 제한 및 부모 확인 도장·응원 하트

**Status:** resolved

- [x] 평일(월~금) 일과를 모두 완수했을 때 일일 스타(+1) 및 5일 연속 올클리어 시 보너스 스타(+2)가 스타 원장에 트랜잭션으로 적립된다.
- [x] 스타 원장은 누적 획득, 사용 차감, 현재 잔여 스타 잔액을 정확히 계산하여 표시한다.
- [x] 아이 모드에서 스타 보상 상점 뷰(#stars)를 열고 등록된 프리셋(로벅스, 하트 교환 등)을 선택해 교환 신청을 제출할 수 있다.
- [x] 부모 모드에서 대기 중인 스타 보상 신청 목록을 확인하고, 6자리 PIN 확인 후 승인(스타 차감 확정)하거나 반려할 수 있다.
- [x] 스타 획득 또는 보상 승인 시 축하 애니메이션과 함께 보유 스타 현황이 갱신되며, 클라우드 스냅샷을 통해 동기화된다.
- [x] 스타 원장 트랜잭션 계산, 보상 신청 및 부모 승인/반려 상태 전이 로직을 검증하는 단위 테스트가 통과한다.

## Answer

스타 원장(Star Ledger) 기록 및 스타 보상 상점 교환 신청·승인 워크플로우를 구현 완료했습니다:
1. **스타 원장(Star Ledger) 및 퀘스트 엔진 (`ScheduleStore.ts`)**:
   - `getWeekdayStarState`: 평일 일과 완수 및 부모 확인 도장 여부에 따른 요일별 상태(`weekendExcluded`, `ineligibleEmpty`, `inProgress`, `claimable`, `awarded`) 판정.
   - `awardDailyStar`: 결정론적 ID(`star_earn_{weekKey}_{weekday}`)를 가진 변경 불가능한(Append-Only) 일일 스타(+1⭐) 트랜잭션 기록.
   - `evaluateAndGrantWeeklyAllClearBonusIfNeeded`: 월~금 5일 올클리어 달성 시 자동 주간 보너스(+2⭐, `star_bonus_weekly_{weekKey}`) 트랜잭션 자동 발행.
   - 스타 잔액 계산 프로퍼티: `totalEarnedStars`, `totalSpentStars`, `availableStars`, `reservedPendingStars`, `requestableStars`, `thisWeekEarnedStars`.
2. **스타 보상 상점 뷰 (`StarRewardShopView.tsx` - #stars)**:
   - 상단 히어로 카드: 보유 스타 잔액, 보유 하트 수, 로블록스 로벅스 500개(10⭐) 프로그레스 게이지.
   - 부모 승인 대기 큐: 대기 중 신청 목록 확인, 6자리 PIN 인증 후 승인(`approveStarRedemption`) 또는 반려(`rejectStarRedemption`).
   - 보상 카탈로그 & 프리셋: 하트 5개 보너스 상자(1⭐, 원자적 +5❤️ 즉시 충전), 로벅스 500개(10⭐) 등 교환 신청 및 즉시 승인.
   - 변경 불가능한 스타 원장 내역: 전체 적립/차감 트랜잭션 타임라인.
3. **주간 스타 스탬프 보드 (`WeeklyStarStampBoardCard.tsx`)**:
   - 오늘의 할 일 상단 및 스타 상점 내부에 통합되어 월~금 5일 스탬프 현황과 주간 보너스 슬롯 시각화.
   - 모든 할 일 완료 시 '스타 수여하기' 배너가 자동 노출(Progressive Disclosure)되어 부모 PIN 인증 후 즉시 수여.
4. **스타 축하 모달 (`StarCelebrationModal.tsx`)**:
   - 일일 스타(+1⭐), 주간 올클리어(+2⭐), 보상 교환 승인 시 축하 애니메이션 모달 제공.
5. **검증**:
   - Seam 1, 2, 3 단위/통합 테스트 총 109개 테스트 통과 및 프로덕션 빌드 타입체크 완료.
