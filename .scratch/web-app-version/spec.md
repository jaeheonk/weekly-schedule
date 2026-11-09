# Spec: 주간 시간표 웹앱(PWA) 버전 추가 및 GitHub Pages 배포

Status: ready-for-agent

## Problem Statement

현재 주간 시간표(WeeklyScheduleApp)는 iOS 및 macOS 네이티브 앱으로만 배포되어 있다. iOS의 경우 개인 무료 Apple 개발자 계정의 한계로 인해 7일마다 Xcode를 통해 기기를 연결하고 앱을 재서명(Re-signing)해야 하며, 최대 3개의 무료 앱 설치 슬롯 제한이 있어 다른 필수 앱들과 슬롯 경합이 발생한다. 이로 인해 7일이 지나 인증서가 만료되면 아이가 시간표를 볼 수 없거나 부모가 재서명 작업을 반복해야 하는 극심한 사용상 불편함이 존재한다. 또한 맥이 없는 환경이나 다른 모바일 기기(아이패드, 안드로이드, 윈도우 PC 등)에서 웹 브라우저를 통해 주간 시간표에 즉시 접근하고 동기화할 수 있는 수단이 부재하다.

## Solution

별도의 유료 서버 호스팅 비용이나 인증서 만료 걱정 없이 영구적으로 동작하는 웹앱 버전을 구축하고 GitHub Pages로 자동 배포한다. 브라우저에서 기존 Vercel Blob 클라우드 스토리지와 직접 통신(CORS 지원)하여 기존 iOS/macOS 네이티브 앱과 실시간 양방향으로 데이터를 동기화한다. 모바일 사파리 등에서 '홈 화면에 추가' 시 네이티브 앱과 다름없는 전체화면으로 실행되는 PWA(Progressive Web App)를 적용하고, 오늘의 스케줄 체크, 주간 시간표 와이드 그리드, 이번 주 조정(Override), 6자리 부모 PIN 보안, 하트 및 스타 보상 상점, A4 1페이지 인쇄 등 기존 네이티브 앱의 핵심 도메인 기능을 100% 동일하게 제공한다.

## User Stories

1. As a child using a web browser, I want to open the web app from my home screen without address bars, so that I feel like I am using a real app.
2. As a child, I want to see today's schedule items automatically selected, so that I immediately know what tasks and classes I have to do right now.
3. As a child, I want to check off completed items and subtasks by clicking the '다 했어요' checkbox, so that I can track my daily study progress.
4. As a child, I want to hear a cheerful chime sound when I complete an item, so that I feel immediate accomplishment and motivation.
5. As a child, I want to see the progress bar and completion percentage update instantly when I check off tasks, so that I know how much of today's work is finished.
6. As a child, I want to see parent praise hearts and cheer stickers attached to my schedule items and banner, so that I feel encouraged by my parents.
7. As a child, I want to view the weekly schedule grid with color-coded subjects and spanned time slots, so that I can understand my entire week's rhythm at a glance.
8. As a child, I want to browse the Star Reward Shop and submit a reward redemption request (e.g., Robux or hearts), so that I can enjoy rewards earned from my weekday diligence.
9. As a child in Child Mode, I want the app to prevent me from unchecking or deleting items already verified by parents, so that verified achievements remain safe and disciplined.
10. As a parent, I want to switch to Parent Mode by entering my 6-digit Master PIN, so that I can securely access parental controls and stamp verifications.
11. As a parent, I want the system to lock out PIN entry for 60 seconds after 5 consecutive failed attempts, so that children cannot brute-force the PIN.
12. As a parent in Parent Mode, I want to stamp a verification seal on completed tasks and subtasks, so that my child knows their work has been officially approved.
13. As a parent, I want to send praise hearts (+1, +3, +5, +10) with custom cheer stickers and comments, so that I can warmly acknowledge my child's effort.
14. As a parent, I want to review, approve, or reject star reward redemption requests, so that reward exchanges are properly supervised.
15. As a parent, I want to add, edit, or delete items in the Master Schedule, so that recurring weekly plans stay up to date.
16. As a parent or child, I want to make temporary adjustments (Weekly Overrides) for the current week only (e.g. reschedule academy class or skip hospital visit), so that unexpected weekly events do not mess up the recurring master schedule.
17. As a parent or child, I want temporary weekly adjustments to automatically revert to the master schedule once the week ends, so that no manual cleanup is needed next Monday.
18. As a parent, I want to print the weekly schedule perfectly onto a single landscape A4 sheet with 3 different selectable themes (Classic Mint, Subject Color, B&W Ink Saver), so that we can hang an aesthetically pleasing schedule on the wall or refrigerator.
19. As a parent, I want to toggle whether completed stamps and praise hearts appear on the printed schedule, so that I can choose between a clean blank weekly schedule or a completed praise celebration report.
20. As a family member using the web app, I want data edited on the web app to sync seamlessly to the iPhone and Mac native apps, so that all family devices stay in sync in real time.
21. As a family member using the web app, I want updates made on an iPhone to appear automatically on the web app within 30 seconds or upon returning to the tab, so that I never work with stale information.
22. As a family member, I want to manually trigger cloud synchronization via a refresh button or keyboard shortcut (Cmd+R), so that I can force immediate updates whenever I want.
23. As a family member, I want to see a floating gradient toast banner when new praise hearts arrive or when synchronization completes, so that I have clear visual feedback of cloud activity.
24. As a user opening the web app for the first time without an internet connection or remote data, I want the app to load sensible default weekly schedule items, so that the app is immediately usable out of the box.
25. As a developer, I want the web app to be deployed automatically to GitHub Pages on every push to the repository's main branch, so that maintenance and deployments are completely frictionless.

## Implementation Decisions

### Architectural Seams & Directory Placement
- The web application is placed under a dedicated top-level directory (`/web`) in the existing repository.
- The project is configured as a modern, lightweight single-page application using TypeScript, React 18, Vite, and Tailwind CSS.
- The existing Xcode project and native Swift code remain untouched and fully intact.

### Deployment & CI/CD Pipeline
- Automated deployment to GitHub Pages using GitHub Actions (`.github/workflows/deploy-web.yml`).
- Base URL is configured for repository sub-path compatibility (`/weekly-schedule/`).
- Client-side navigation uses URL Hash routing (`#today`, `#weekly`, `#stars`, `#print`, `#settings`), ensuring zero HTTP 404 routing errors on static GitHub Pages hosting upon page refreshes.

### Progressive Web App (PWA) Capabilities
- Web App Manifest (`manifest.webmanifest`) configured with `display: "standalone"`, theme colors, and icons.
- Apple Touch Icon and mobile viewport meta tags configured for optimal iOS Safari full-screen presentation.
- Lightweight Service Worker caching static application assets for fast cold starts and offline capability.

### Data Contract & Cloud Sync Compatibility (SSOT)
- Adopts the exact same schema contract as the Swift native app: `CloudSyncSnapshot` (schemaVersion: 5).
- Directly communicates with Vercel Blob REST API (`https://blob.vercel-storage.com`) from browser via CORS-enabled HTTP calls (`GET` snapshot metadata/download, `PUT` snapshot upload, `POST` old blob cleanup).
- Uses the same default family channel code (`family-main`) and read/write Bearer token as the native app, with local persistence in browser `localStorage`.
- Snapshot merging engine mirrors the deterministic timestamp-based merge logic of `ScheduleStore.swift`:
  - Items merged using deletedItemTimestamps.
  - Overrides keyed by `"YYYY-Www_UUID"`.
  - Completion flags and parent verification flags keyed by `"YYYY-Www_UUID"`.
  - Star Ledger maintained as an append-only transaction log.

### Synchronization Triggers
- Automatic sync on document visibility recovery (`document.visibilitychange`).
- Periodic background polling every 30 seconds.
- Debounced automatic upload upon any local state mutation.
- Explicit manual synchronization button and `⌘R` keyboard shortcut.

### Security & Mode Management
- Default operational mode is Child Mode (`아이 모드`).
- Parent Mode (`부모 모드`) guarded by a 6-digit Master PIN (`160125` default).
- Step-wise rate limiting / lockout on 5 consecutive incorrect PIN attempts (60-second / 300-second lockout).
- Session-based unlock persistence (remains unlocked until the browser tab is closed or the user explicitly taps '잠금').

### Print Engine
- Dedicated Print Preview Modal supporting theme selection:
  1. Classic Mint (세이지 그린 헤더, 원본 스타일)
  2. Subject Color (과목별 파스텔 컬러)
  3. B&W Ink Saver (흑백 인쇄 절약 모드)
- Toggle option for printing stamps/hearts vs clean blank template.
- CSS `@media print` with `@page { size: landscape; margin: 8mm; }` ensuring strict 1-page A4 landscape fit.

### Audio & Visual Feedback
- Synthesized audio chimes using the Web Audio API (zero external sound file download latency).
- Floating gradient toast notifications matching the native SwiftUI capsule banner design.

## Testing Decisions

### Good Test Principles
- Tests must strictly verify external domain behavior (observable user actions and state transitions), never internal UI framework implementation details.
- Avoid mocking internal store methods; test through high-level public state APIs and user action dispatches.

### Testing Seam
- **Primary Seam**: The centralized reactive Store / State Engine (`ScheduleStore`) and its Cloud Sync Adapter.
- Testing this single high-level seam covers:
  1. Default data initialization and WeekKey calculations.
  2. Completion check and uncheck actions under Child Mode vs Parent Mode.
  3. Parent verification protection (ensuring children cannot revert stamped items).
  4. Weekly override calculations (ensuring this week's adjustments do not overwrite the master schedule).
  5. Star ledger transactions and reward redemption request flows.
  6. Bi-directional CloudSyncSnapshot serialization and deterministic timestamp merging.
- **Prior Art**: The existing Swift codebase's `ScheduleStore.swift` and `VercelBlobSyncService.swift` logic serves as the behavioral reference specification.

## Out of Scope
- iOS Home Screen Widgets (AppWidget / WidgetKit) - native OS only.
- Apple Siri Shortcuts & App Intents (`CompleteScheduleItemIntent`) - native OS only.
- Native AirDrop file transfer - replaced by web download/print.
- Native Keychain storage - replaced by browser Web Storage (`localStorage`) with identical lockout security logic.

## Further Notes
- The default family code (`family-main`) and token ensure that the web app works immediately upon first load without any complex onboarding for family members.
- If the user ever changes the family code or sync token in settings, both are preserved in `localStorage`.
