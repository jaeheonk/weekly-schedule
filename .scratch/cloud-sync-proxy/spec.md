# Spec: Vercel Blob 프록시 동기화 아키텍처 및 웹 Load Failed 오류 해결

## Problem Statement

웹 브라우저(Safari, Chrome 등)를 통해 주간 시간표 웹앱에 접속하여 수동으로 클라우드 동기화를 실행하거나 30초 주기 백그라운드 자동 동기화가 동작할 때, 화면 상단에 `Load failed`(또는 `Failed to fetch`) 오류 토스트가 발생하며 iOS/macOS 네이티브 앱과의 시간표 데이터 동기화가 실패한다.

이는 브라우저 환경에서 Vercel Blob REST API 및 Private 저장소에 직접 HTTP 요청을 보낼 때, 브라우저의 교차 출처 리소스 공유(CORS) 보안 정책 및 사전요청(OPTIONS preflight) 거부로 인해 네트워크 통신이 원천 차단되기 때문이다. 또한 클라이언트 번들에 Vercel Blob 마스터 읽기/쓰기 토큰이 하드코딩되어 보안 위험이 크며, 현재 Vercel 플랫폼 사용량 초과로 11월 17일까지 Vercel 통합 호스팅을 사용할 수 없는 제약이 있다.

## Solution

브라우저가 Vercel Blob과 직접 통신하는 기존 방식을 폐기하고, 경량 백엔드 API 프록시 서버를 구축하여 스냅샷 조회, 다운로드, 업로드, 삭제를 서버 사이드에서 안전하게 대행한다.

11월 17일 Vercel 쿼터 리셋 전까지는 웹앱 프론트엔드를 **GitHub Pages**에 유지하고 백엔드 프록시를 **Render Web Service(무료 티어)** 및 로컬 개발 환경(Vite Proxy)에 배포하여 빠른 화면 서빙과 원활한 양방향 동기화를 보장한다. 이후 11월 17일 리셋 시점에는 모듈화된 프록시 핸들러를 Vercel Serverless Functions로 이관하여 단일 Vercel 호스팅 체제로 전환한다.

## User Stories

1. As a child using the web app on an iPad or mobile browser, I want my checked schedule items to sync to the cloud without seeing a "Load failed" error toast, so that my parents can see what I accomplished today on their iPhones.
2. As a child checking off homework, I want incoming verification stamps and cheer hearts sent by my parents to appear reliably via background sync, so that I feel encouraged and rewarded.
3. As a parent accessing the web app from a desktop browser, I want to review my child's progress and stamp completed tasks with my master PIN, so that the status is instantly saved to the cloud and visible on all family devices.
4. As a parent editing the Master Schedule or Weekly Override on the web app, I want my schedule adjustments to upload cleanly to the cloud snapshot, so that our family always operates on a single source of truth.
5. As a parent managing stars and rewards on the web app, I want star redemption approvals and ledger transactions to merge deterministically without data loss, so that our child's star balance remains exact across all platforms.
6. As a web user on Safari (iOS / macOS), I want cloud sync to work flawlessly over standard HTTPS without being blocked by WebKit CORS preflight rules, so that I have the same seamless experience as the native Mac and iOS apps.
7. As a web user on a slow network or when the proxy server wakes up from sleep, I want to see a clear "동기화 중..." loading toast that transitions to success or an informative error message, so that I understand the sync status without confusion.
8. As a web user, I want the web application to load instantaneously on GitHub Pages without waiting for backend container spin-up, so that I can immediately view and interact with my schedule even if background sync takes a few seconds to connect.
9. As a developer, I want to run the web application locally with `npm run dev` and test cloud sync directly against the local proxy in Safari, so that I can reproduce and verify sync behavior without deploying to remote servers.
10. As a system administrator, I want the Vercel Blob read-write credentials to be strictly confined to server-side environment variables, so that malicious users inspecting browser dev tools cannot obtain storage tokens to wipe or corrupt family data.
11. As a developer maintaining the codebase, I want the server proxy handlers to be isolated pure functions with clean request/response interfaces, so that migrating from Render Express to Vercel Serverless Functions on November 17 requires zero refactoring of core business logic.
12. As a native iOS and macOS user, I want the web app's cloud sync payload to strictly conform to the existing `CloudSyncSnapshot (v5)` schema, so that my existing native app continues to sync bidirectionally without requiring an App Store update.

## Implementation Decisions

### 1. Proxy Server Module Architecture
- A lightweight Node.js/Express proxy server is created in a dedicated backend directory.
- The server exposes three primary REST endpoints under the `/api/sync` path:
  - `GET /api/sync/latest?familyCode=<familyCode>`: Queries the latest blob metadata from Vercel Blob, downloads the private snapshot JSON server-side using the master token, and returns `{ latest: VercelBlobItem | null, snapshot: CloudSyncSnapshot | null, allBlobs: VercelBlobItem[] }`.
  - `POST /api/sync/upload`: Accepts `{ familyCode, shortDeviceId, snapshot, previousBlobsToDelete }`, uploads the new snapshot JSON to Vercel Blob, triggers asynchronous background deletion of obsolete blobs, and returns the upload result.
  - `GET /health`: Healthcheck endpoint for container monitoring and uptime pings.
- The server enables CORS for the GitHub Pages origin (`https://jaeheonk.github.io`) and local development origins (`http://localhost:5173`, `http://localhost:4173`).

### 2. Vercel Blob Token Isolation
- `BLOB_READ_WRITE_TOKEN` is read exclusively from `process.env.BLOB_READ_WRITE_TOKEN`.
- The hardcoded token is completely stripped from all client-side source files in the web project.
- The web client only passes the `familyCode` and device identifier to the proxy API.

### 3. Web Client Service Refactoring
- The client-side sync service module is refactored to target the proxy API rather than direct Vercel Blob URLs.
- The API base URL is resolved dynamically via `import.meta.env.VITE_SYNC_API_URL || ''`:
  - In local development, an empty base URL delegates to the Vite proxy (`/api`).
  - In production builds deployed to GitHub Pages, it points to the remote proxy service URL.
- The deterministic timestamp snapshot merge algorithm in the domain layer remains 100% unchanged, preserving existing test coverage and business invariants.

### 4. Local Development Seam & Vite Proxy
- The Vite development server configuration is enhanced with a proxy rule forwarding `/api` requests to the local Express server on port 3001.
- A unified development script (`npm run dev:all`) is added to run both the frontend Vite server and backend proxy concurrently with a single command.

### 5. Render Deployment Configuration
- A `render.yaml` blueprint (or standard Node web service configuration) is added specifying build command (`npm install`), start command (`node server/index.js`), and environment variable definitions.
- Documentation for deploying the proxy to Render free tier is provided.

### 6. Phase 2 Vercel Migration Readiness
- Route handler logic is implemented as decoupled functions accepting standard request/response objects, enabling straightforward adaptation to Vercel Serverless Function signatures (`@vercel/node`) after November 17.

## Testing Decisions

### What Makes a Good Test
- Tests must verify external observable behavior (HTTP status codes, JSON payload integrity, error handling, CORS headers) rather than internal implementation minutiae.
- Domain merge logic and state invariants must remain verified by pure deterministic unit tests without network coupling.
- Client sync service tests must verify that HTTP calls correctly target the proxy endpoints and properly handle successful syncs, empty storage states, and network error responses.

### Modules Tested
1. **Server Proxy Endpoints**: Integration tests verifying `GET /api/sync/latest` and `POST /api/sync/upload` with mocked Vercel Blob SDK responses.
2. **Web Sync Client Service**: Unit tests verifying that the web client correctly formats proxy requests, serializes `CloudSyncSnapshot (v5)` payloads, and handles proxy responses.
3. **End-to-End Local Sync Flow**: Manual and automated verification in Safari and Chrome confirming that initiating sync produces a success toast and writes real snapshots without `Load failed` exceptions.

### Prior Art
- Existing client tests in `web/src/services/vercelBlobSync.test.ts` and `web/src/hooks/useCloudSync.test.ts`.
- Domain snapshot merge unit tests in `web/src/domain/snapshotMerge.test.ts`.

## Out of Scope

- Migrating the native iOS or macOS Swift codebase (native apps continue to communicate directly with Vercel Blob via URLSession as designed).
- Adding user authentication databases or account logins (authentication continues to rely on the 6-digit family Master PIN and family code).
- Implementing WebSocket or Server-Sent Events real-time pushes (sync remains driven by 30s background polling, visibilitychange, and manual refresh).
- Final migration to Vercel Serverless Functions prior to November 17 (scheduled for Phase 2).

## Further Notes

- The canonical terminology defined in `GLOSSARY.md` (클라우드 동기화 스냅샷, 기본 시간표, 이번 주 조정, 아이 모드, 부모 모드, 스타 원장) must be strictly maintained across all error messages, comments, and documentation.
- Architecture decisions are formally tracked under `docs/adr/0002-proxy-sync-architecture.md`.
