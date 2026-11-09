# 01: 웹앱 스캐폴딩, PWA 환경 구성 및 GitHub Pages 자동 배포 파이프라인

**What to build:**
아이가 홈 화면에서 주소창 없이 실행할 수 있는 반응형 웹 애플리케이션(PWA) 기반을 구축하고, 기본 시간표(Master Schedule)를 오늘의 할 일 뷰와 주간 와이드 그리드 뷰로 조회할 수 있도록 하며, 변경사항이 메인 브랜치에 반영될 때마다 GitHub Pages로 자동 배포되는 파이프라인을 완성합니다.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] 웹 애플리케이션이 정적 빌드 및 번들링되며, 로컬 개발 서버에서 에러 없이 실행된다.
- [x] PWA 매니페스트와 홈 화면 아이콘, 모바일 전체화면 메타 태그가 설정되어 모바일 사파리 등에서 홈 화면에 추가 시 주소창 없는 전체화면으로 실행된다.
- [x] 초기 원격 데이터가 없거나 오프라인인 상태에서도 기본 시간표(Master Schedule) 데이터가 정상 로드된다.
- [x] 상단 내비게이션을 통해 오늘의 할 일 목록 뷰와 전체 주간 시간표 와이드 그리드 뷰를 해시 라우팅(#today, #weekly)으로 부드럽게 전환할 수 있다.
- [x] GitHub Actions 워크플로우를 통해 메인 브랜치 푸시 시 GitHub Pages 서브패스 환경으로 자동 빌드 및 배포된다.
- [x] 기본 렌더링 및 라우팅 동작을 검증하는 단위 테스트가 통과한다.

## Comments

- React 18, TypeScript, Vite, Tailwind CSS 기반의 반응형 단일 페이지 웹 애플리케이션(`/web`) 구축 완료.
- 모바일 사파리 전체화면 메타태그, PWA Manifest(`manifest.webmanifest`), 192/512/Apple Touch 아이콘, Service Worker(`sw.js`) 캐싱 환경 구성.
- 네이티브 Swift 앱과 100% 동일한 기본 시간표(Master Schedule) 데이터 모델 및 결정론적 UUID 생성기 구현.
- `#today`(오늘의 할 일) 및 `#weekly`(주간 7일 와이드 그리드) 해시 라우팅 뷰 및 상단 내비게이션 구현.
- 메인 브랜치 push 시 GitHub Pages(`/weekly-schedule/`)로 자동 빌드 및 배포하는 GitHub Actions 워크플로우(`.github/workflows/deploy-web.yml`) 추가.
- Vitest 기반 단위 테스트(도메인 스토어 5개, UI/라우팅 4개, 총 9개) 통과 및 Two-Axis 코드 리뷰(Standards/Spec) 완료.
