# 0002. 브라우저 CORS 및 Private 스토리지 극복을 위한 프록시 동기화 아키텍처

## Status
Accepted (Supersedes the direct CORS communication decision in ADR-0001)

## Context
ADR-0001에서는 정적 웹 호스팅(GitHub Pages) 환경에서 브라우저가 직접 Vercel Blob REST API(`https://blob.vercel-storage.com`)와 CORS 통신하여 **클라우드 동기화 스냅샷(Cloud Sync Snapshot)**을 동기화하도록 결정했다.

그러나 실제 웹 브라우저(특히 Safari/WebKit 및 Chrome) 환경에서 다음과 같은 치명적인 브라우저 보안 및 CORS 제약으로 인해 `TypeError: Load failed` 오류가 발생했다:
1. Vercel Blob 관리 API의 CORS 사전문서(OPTIONS) 응답에 `GET` 메서드가 포함되어 있지 않고(`access-control-allow-methods: PUT,OPTIONS,POST,DELETE`), 실제 `GET` 응답에 `Access-Control-Allow-Origin` 헤더가 존재하지 않아 스냅샷 목록 조회가 원천 차단된다.
2. Vercel Blob 스토리지 버킷이 `private` 모드로 설정되어 있어 스냅샷 다운로드 시 `Authorization` 헤더가 요구되나, Private Blob 스토리지 엔드포인트는 인증 헤더를 포함한 CORS preflight에 대해 `403 Forbidden`을 반환한다.
3. 브라우저 번들에 마스터 읽기/쓰기 토큰(`BLOB_READ_WRITE_TOKEN`)이 노출되어 악의적인 사용자가 스토리지 전체를 임의로 조작하거나 삭제할 수 있는 보안 취약점이 존재한다.
4. 또한 현재 11월 17일까지 Vercel 플랫폼 사용 용량(Quota) 초과로 Vercel 통합 호스팅을 즉시 사용할 수 없는 환경적 제약이 존재한다.

## Decision
브라우저 직접 통신 방식을 공식 폐기하고, **경량 백엔드 API 프록시**를 도입하여 클라이언트와 Vercel Blob 간의 통신을 중계하는 2단계 아키텍처 로드맵을 채택한다:

### 1단계: 임시 운영 및 검증 (현재 ~ 11월 17일)
1. **프론트엔드 호스팅**: 화면 로딩 지연 없는 PWA 서빙을 위해 기존 **GitHub Pages** 정적 호스팅을 유지한다.
2. **백엔드 프록시 API**: Node.js/Express 기반의 독립 경량 API 서버를 구축하고, **Render Web Service(무료 티어)**에 배포하여 GitHub Pages 도메인에 대한 CORS를 허용한다.
3. **토큰 보안 격리**: Vercel Blob 읽기/쓰기 토큰을 프론트엔드 코드에서 전면 제거하고, 프록시 서버의 환경 변수(`BLOB_READ_WRITE_TOKEN`)로 격리한다.
4. **로컬 개발 즉시 검증**: Vite 프록시(`vite.config.ts`)를 구성하여 로컬 개발 환경에서 Safari 브라우저로 `Load failed` 해결 및 실제 양방향 동기화를 즉시 검증할 수 있도록 지원한다.

### 2단계: Vercel 통합 마이그레이션 (11월 17일 이후)
11월 17일 Vercel 쿼터 리셋 후, Express 라우트 핸들러를 Vercel Serverless Functions(`api/sync/...`)로 그대로 전환하여 단일 Vercel 프로젝트에서 Same-Origin 무중단 통합 호스팅 체제로 전환한다.

## Consequences
- **장점**:
  - Safari/Chrome 등 모든 브라우저에서 `Load failed` CORS 에러가 완벽히 해결된다.
  - 마스터 토큰이 서버 환경 변수로 숨겨져 스토리지 무단 삭제 및 변조 위험이 원천 차단된다.
  - 네이티브 iOS/macOS 앱의 `CloudSyncSnapshot (v5)` 데이터 스키마 및 타임스탬프 결정론적 병합 알고리즘을 100% 호환 유지한다.
  - GitHub Pages 유지로 인해 Render 무료 티어의 15분 슬립(50초 콜드 스타트) 시에도 시간표 UI 진입 자체가 차단되지 않는다.
- **트레이드오프**:
  - 프론트엔드 단독 정적 호스팅 대비 독립 프록시 서버(Render)라는 추가 인프라 구성요소가 발생한다.
  - Render 무료 티어의 슬립 시 첫 동기화 요청에서 수십 초의 지연이 발생할 수 있으므로, 웹앱 UI에서 동기화 중 토스트 상태를 명확히 안내해야 한다.
