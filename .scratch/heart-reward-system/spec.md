# Spec: 웹앱 하트 보상 교환 및 추천 보상 프리셋 시스템 (Heart Reward System)

Status: ready-for-agent

## Problem Statement

현재 주간 시간표 웹앱(PWA)은 부모가 아이에게 응원 하트와 칭찬 스티커를 전송하는 기능(`PraiseHeartModal`) 및 상단 잔여 하트 배지 표시까지는 구현되어 있으나, 아이가 열심히 모은 하트를 실제 일상 보상(자유 놀이 시간, 간식, 선물, 용돈 등)으로 교환(차감)하거나 부모가 이를 관리할 수 있는 수단이 부재하다.
반면 기존 iOS/macOS 네이티브 앱은 하트 잔액 히어로 카드, 8종 추천 보상 프리셋, 스텝퍼/슬라이더/퀵 칩 기반 수량 선택기, 6자리 부모 PIN 인증 연동, 최근 교환 내역 조회 및 부모 전용 취소(하트 환급), 추천 보상 목록 커스텀 편집 모달을 완벽히 갖추고 있다.
이로 인해 웹앱을 주로 사용하는 환경(안드로이드 폰, 태블릿, PC 등)에서는 아이가 모은 하트를 사용할 수 없어 동기부여가 반쪽짜리에 그치며, 기기 간 기능 불일치로 인해 가족 간 보상 교환 규칙 운영에 혼란이 발생한다.

## Solution

기존 iOS/macOS 네이티브 앱의 `RewardExchangeSheet` 및 `RewardPresetsManageSheet`와 100% 동일한 사용자 경험과 도메인 규칙을 웹앱에 구현한다.
어느 화면에서나 가볍게 열고 닫을 수 있는 모달 다이얼로그 형태로 하트 보상 교환 모달을 제공하며, 상단 헤더의 하트 배지, 투데이 뷰의 히어로 배너, 스타 상점 안내 배너 등 모든 주요 진입로를 유기적으로 연결한다.
아이 모드에서는 무분별한 남용을 방지하기 위해 6자리 부모 PIN 보안 인증 후 교환이 승인되도록 보호하고, 부모 모드에서는 즉각적인 교환 및 과거 교환 취소(하트 환급)를 지원한다.
또한 가족마다 고유한 보상 기준을 설정할 수 있도록 16종 이모지 팔레트를 활용한 추천 보상 프리셋 추가·수정·삭제 및 기본값 초기화 모달을 제공하며, Vercel Blob 클라우드 스토리지와 실시간 양방향으로 동기화하여 모든 기기에서 동일한 하트 잔액과 교환 내역을 유지한다.

## User Stories

1. As a child, I want to click on my heart balance badge in the navigation header, so that I can open the Heart Reward Exchange modal from anywhere in the app.
2. As a child, I want to see a heart reward exchange button on today's schedule hero card, so that I am reminded to redeem rewards after finishing my daily tasks.
3. As a child, I want to view my available heart balance, cumulative earned hearts, and total spent hearts in a colorful hero card, so that I feel proud of all the hard work I have done.
4. As a child, I want to see a grid of frequently used reward presets (e.g. 30 min gaming, ice cream, toy gift, family outing, pocket money), so that I can quickly pick what I want with one tap.
5. As a child, I want selecting a reward preset to automatically fill in the reward title and required heart count, so that I do not need to type manually.
6. As a child, I want to type a custom reward title if my desired reward is not in the presets, so that I can exchange hearts for any unique promise made with my parents.
7. As a child, I want to adjust the heart count using minus/plus stepper buttons, so that I can fine-tune the amount of hearts to spend.
8. As a child, I want to use a continuous slider to set the heart count between 1 and my available balance, so that I have fluid control over larger heart amounts.
9. As a child, I want to tap quick chips (+5, +10, +15, +20), so that I can jump to common heart values instantly.
10. As a child, I want an "All-in" chip that sets the hearts to my exact total available balance, so that I can spend all my hearts at once without mental math.
11. As a child, I want to see a live preview of my remaining hearts after exchange, so that I know exactly how many hearts I will have left.
12. As a child, I want the system to disable the exchange button and show a clear warning message when I try to spend more hearts than I currently have, so that I never overdraft my balance.
13. As a child in Child Mode, I want the app to prompt for my parents' 6-digit Master PIN when I submit an exchange, so that my parents can verify and approve the reward in person.
14. As a child, I want to hear a cheerful chime sound when my reward exchange succeeds, so that I feel celebrated and excited.
15. As a child, I want to see a floating celebration toast confirming the reward name and deducted heart count upon redemption, so that I have clear visual feedback of the completed exchange.
16. As a child or parent, I want to see a chronologically sorted history of recent reward redemptions with dates and deducted heart amounts, so that our family has a clear record of past rewards.
17. As a parent in Parent Mode, I want the exchange button to allow immediate one-click redemption with a simple confirmation prompt, so that I do not have to re-enter my PIN while already authenticated.
18. As a parent in Parent Mode, I want each past redemption history row to display a refund/cancellation button, so that I can easily cancel an accidental exchange and restore my child's spent hearts.
19. As a parent in Parent Mode, I want to click the "Edit Presets" button to open the Preset Management modal, so that I can customize our family's reward catalog.
20. As a child in Child Mode, I want clicking the "Edit Presets" button to require 6-digit Master PIN verification, so that children cannot alter reward heart costs on their own.
21. As a parent, I want to see the complete list of reward presets displaying their emoji, title, category tag, and heart cost, so that I have a clean overview of available templates.
22. As a parent, I want to delete unwanted reward presets, so that outdated or unsuitable rewards do not clutter the exchange screen.
23. As a parent, I want to edit an existing preset's emoji, title, heart cost, or category tag, so that I can adjust reward criteria as my child grows.
24. As a parent, I want to add a new reward preset with a custom title, category tag, heart count, and an emoji selected from a 16-emoji palette, so that we can celebrate new hobbies and goals.
25. As a parent, I want a "Reset to Defaults" button with a confirmation dialog, so that I can restore the original 8 curated presets at any time.
26. As a family member using the Star Reward Shop, I want to see a shortcut linking directly to the Heart Reward Exchange modal, so that hearts converted from stars can be redeemed without friction.
27. As a family member, I want any reward redemption, preset addition, edit, deletion, or refund to automatically sync across iOS, macOS, and Web via Vercel Blob cloud storage, so that all devices remain perfectly consistent.

## Implementation Decisions

### Domain State & Storage Decisions
- **Deterministic Preset Initialization**: Maintain a predefined set of 8 default reward presets matching the native iOS app's UUIDs and content. On initial load or when presets are empty, populate these defaults so new users immediately have a functional reward catalog.
- **Ring-Buffered Redemption Ledger**: Cap the history of heart reward redemptions at 50 items. Newer redemptions are prepended; entries beyond 50 are trimmed to keep snapshot payload sizes optimal.
- **Heart Balance Accounting**: Available hearts are computed as:
  $$\text{Available Hearts} = \max(0, \text{Total Earned Hearts} - \text{Total Spent Hearts})$$
  Where Total Earned Hearts is the sum of schedule item reaction hearts, praise note hearts, and archived earned hearts. Total Spent Hearts is the sum of all active reward redemptions.
- **Reversible Redemptions (Refunds)**: Canceling a redemption removes its record from the active redemptions list, naturally restoring the spent hearts to the available balance.
- **Tombstone-Based Preset Synchronization**: Preset deletions are tracked with deletion timestamps to ensure deterministic three-way snapshot merging across devices without resurrecting deleted presets.
- **Auto-Sync Triggers**: Any mutation on reward redemptions or presets (redeem, cancel, add, edit, delete, reset) triggers an immediate state subscriber notification and dispatches a debounced cloud sync push.

### UI & Component Architecture Decisions
- **Modal Overlay Presentation**: Implement the exchange screen as an accessible, responsive overlay dialog matching the iOS sheet structure:
  - Top Hero Card showing available balance, cumulative metrics, and current mode badge.
  - Preset Grid for 1-click selection.
  - Form Editor with interactive stepper, range slider, quick chips (5, 10, 15, 20), and all-in chip.
  - Dynamic Action Button adapting label and style according to authentication mode (Parent vs Child).
  - Recent Redemptions List with formatted timestamps and parent refund actions.
- **Dedicated Sub-Modals**:
  - A Preset Management Modal listing all presets with delete/edit actions and a reset-to-defaults trigger.
  - An Add/Edit Preset Modal with an emoji picker grid, title input, heart cost selector, and tag selector.
- **Seamless PIN Auth Integration**: When operating in Child Mode, clicking the redemption button or preset edit button passes the required authorization reason to the existing 6-digit Master PIN authentication modal. Successful PIN entry immediately resumes and completes the action without requiring the user to press the button again.
- **Audio & Toast Feedback**: On successful redemption, play the existing synthesized 4-note ascending chime via Web Audio API and display a floating gradient toast banner. On refund, display a dedicated recovery toast.
- **Unified Entry Points**: Ensure the navigation bar heart counter is a clickable interactive button, the Today view hero banner features a heart exchange button, and the Star Reward Shop provides a direct trigger.

## Testing Decisions

### What Makes a Good Test
Tests should verify observable user behavior and state outcomes from the user's perspective, never private internal implementation details. A good test simulates real user interactions (clicking preset buttons, sliding heart values, entering PINs, requesting refunds) and asserts visible DOM changes, accessible labels, emitted events, and updated store balances.

### Modules to be Tested
1. **Domain Store Tests**:
   - Initial state contains default reward presets.
   - Redemption deductions: valid redemption decreases available hearts, records redemption history, and enforces the 50-item limit.
   - Invalid redemption handling: overdraft attempts (hearts > available) or zero/negative hearts are rejected.
   - Refund/Cancellation: canceling a redemption removes the item from history and restores available hearts.
   - Preset CRUD: adding, updating, deleting (with deletion tombstones), and resetting presets to defaults.
2. **Component & Integration Tests**:
   - Modal rendering: balance hero card accurately reflects store data.
   - Form controls: clicking presets populates input; stepper, slider, and quick chips update heart count; remaining heart calculations update accurately.
   - Child Mode flow: attempting redemption opens PIN modal; entering valid PIN executes redemption, plays audio chime, and closes modal.
   - Parent Mode flow: attempting redemption executes immediately; refund button on history row prompts confirmation and restores balance.
   - Preset Management flow: editing, creating with emoji picker, deleting, and resetting presets.
   - Access Points: clicking navigation header heart badge and Today hero card opens the modal.

### Prior Art
- `web/src/components/StarRewardShopView.test.tsx`: testing reward requests, approval flows, PIN auth gates, and preset management.
- `web/src/components/PraiseHeartModal.test.tsx`: testing sticker selectors, numeric counters, and reaction submissions.
- `web/src/domain/scheduleStore.test.ts`: testing domain state transitions, star transactions, and cloud sync snapshot serialization.

## Out of Scope
- Converting hearts back into stars (stars convert to hearts unidirectionally, matching native app).
- Cash or real-world payment gateway integrations (rewards are family-internal agreements).
- Push notification delivery for heart redemptions to external third-party messaging apps (KakaoTalk, Slack, etc.).

## Further Notes
- All domain terminology conforms strictly to `GLOSSARY.md`.
- No architectural ADR violations exist; data synchronization cleanly adheres to ADR-0001 (PWA Client Architecture) and ADR-0002 (Cloud Sync Proxy Architecture).
