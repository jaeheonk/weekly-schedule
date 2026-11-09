# 0001. GitHub Pages 배포 및 Vercel Blob 직접 연동 웹앱(PWA) 추가

## Status
Accepted

## Context
iOS 무료 개인 Apple 개발자 계정은 7일마다 Xcode를 통해 앱을 재서명해야 하며 최대 3개의 앱 슬롯 제한이 있어 지속적인 사용에 번거로움이 있었다. 또한 별도의 유료 서버 호스팅 비용 없이 웹 브라우저를 통해 아이폰, 아이패드, PC 등 어디서나 동일한 기능으로 시간표에 접속할 수 있는 환경이 필요했다.

## Decision
프로젝트 루트 하위 `/web` 디렉토리에 **React 18 + TypeScript + Vite + Tailwind CSS** 기반의 웹앱을 구축하고, **GitHub Pages + GitHub Actions**를 통해 정적 호스팅 배포한다. 모바일 사파리에서 '홈 화면에 추가'하여 앱처럼 사용할 수 있도록 **PWA(Progressive Web App)**로 패키징하며, 별도의 백엔드 중계 서버 없이 기존 iOS/macOS 앱과 동일한 **`CloudSyncSnapshot (v5)` 규격으로 Vercel Blob 스토리지와 브라우저에서 직접 CORS 통신**하여 네이티브 앱과 실시간 양방향 동기화를 유지한다.

## Consequences
- iOS 7일 재서명 만료 걱정 없이 PWA를 통해 네이티브 앱과 거의 동일한 사용 경험을 영구적으로 유지할 수 있다.
- GitHub Pages의 무료 정적 호스팅과 Vercel Blob 무료 티어만으로 서버 유지 비용 0원으로 운영된다.
- 네이티브 전용 기능인 iOS 홈 화면 위젯은 웹에서 지원할 수 없으나, A4 1페이지 인쇄(CSS Print), 부모 PIN 보안, 스타 원장 및 보상 상점 등 핵심 도메인 기능은 100% 동일하게 제공된다.
