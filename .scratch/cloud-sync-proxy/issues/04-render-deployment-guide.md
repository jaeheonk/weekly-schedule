# 04: Render 배포 구성(render.yaml) 및 GitHub Pages 연동 가이드

Status: ready-for-agent

**What to build:**
Render 무료 웹 서비스 배포를 위한 설정 파일(`render.yaml`)을 추가하고, GitHub Pages 배포 워크플로우에 `VITE_SYNC_API_URL` 빌드 환경 변수를 연결할 수 있도록 가이드를 작성합니다.

**Blocked by:** 01, 02

**Acceptance Criteria:**
- [ ] Render Blueprint 사양을 만족하는 `render.yaml` 파일이 프로젝트 루트에 추가된다.
- [ ] 환경 변수(`BLOB_READ_WRITE_TOKEN`, `PORT`) 및 서비스 시작 명령어(`npm start`)가 올바르게 정의된다.
- [ ] GitHub Actions 워크플로우(`.github/workflows/deploy-web.yml`)에 `VITE_SYNC_API_URL` 시크릿 연동 옵션이 문서화된다.
- [ ] Render 15분 슬립(콜드 스타트) 시에도 프론트엔드가 gracefully하게 "동기화 중..." 상태를 표시하고 타임아웃 없이 복구되는지 검증된다.

## Comments
