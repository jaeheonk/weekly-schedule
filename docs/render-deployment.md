# Render 프록시 배포와 GitHub Pages 연동

웹앱은 GitHub Pages에 두고, 클라우드 동기화 스냅샷 프록시는 Render 무료 웹 서비스에 둔다. 화면은 Pages에서 바로 열리고, 동기화 요청만 Render로 간다.

토큰 값은 이 문서나 Git에 적지 않는다. `BLOB_READ_WRITE_TOKEN`은 Render 대시보드에만 둔다.

## Render Blueprint

저장소 루트의 `render.yaml`이 서비스를 정의한다.

| 항목 | 값 |
| --- | --- |
| 이름 | `weekly-schedule-sync` |
| 런타임 | Node |
| 플랜 | `free` |
| 루트 | `server/` |
| 빌드 | `npm install && npm run build` |
| 시작 | `npm start` |
| 헬스체크 | `GET /health` |
| `PORT` | `10000` (서버는 `process.env.PORT`를 읽고 `0.0.0.0`에 바인드) |
| `BLOB_READ_WRITE_TOKEN` | Blueprint가 값을 묻는다. `sync: false`라 파일에는 값이 없다 |
| Node | `20` |

배포 순서:

1. [Render Dashboard](https://dashboard.render.com/)에서 **New → Blueprint**를 고르고 이 저장소를 연결한다.
2. Blueprint가 `BLOB_READ_WRITE_TOKEN`을 물으면 Vercel Blob 읽기/쓰기 토큰을 입력한다.
3. 첫 배포가 끝나면 `https://weekly-schedule-sync.onrender.com/health`가 `{ "status": "ok" }`를 반환하는지 확인한다. 서비스 이름이 이미 쓰이면 Render가 붙인 실제 호스트를 사용한다.

`npm start`는 `server/package.json`의 `prestart`로 TypeScript를 다시 컴파일한 뒤 `node dist/index.js`를 실행한다. 빌드 단계에서도 `npm run build`로 같은 산출물을 만든다.

## 15분 슬립

무료 웹 서비스는 요청이 15분 동안 없으면 프로세스가 잠든다. 다음 동기화 요청이 프로세스를 깨우며, 그 사이 수십 초가 걸릴 수 있다.

웹앱은 그 요청을 취소하지 않는다. 백그라운드 동기화가 3초 넘게 걸리면 `클라우드 동기화 중...` 토스트를 띄우고, 프록시가 응답하면 `클라우드 동기화 완료`로 바뀐다. 수동 동기화는 기다림 없이 같은 토스트를 바로 보여 준다. 프록시가 오류를 반환하면 그 메시지가 토스트에 남는다. Pages의 시간표 화면은 프록시가 깨어나는 동안에도 열린다.

## GitHub Actions 시크릿

`.github/workflows/deploy-web.yml`의 빌드 단계는 저장소 시크릿 `VITE_SYNC_API_URL`을 Vite 환경 변수로 넘긴다. 시크릿이 없으면 값은 빈 문자열이고, 웹 클라이언트는 상대 경로 `/api`를 호출한다. 그 경로는 로컬 Vite 프록시에서만 동작한다. Pages 배포본이 Render를 쓰려면 시크릿이 필요하다.

1. GitHub 저장소 **Settings → Secrets and variables → Actions**에서 **New repository secret**을 만든다.
2. 이름은 `VITE_SYNC_API_URL`이다.
3. 값은 Render 서비스 오리진이다. 경로는 붙이지 않는다. 끝의 슬래시는 있어도 된다. 예: `https://weekly-schedule-sync.onrender.com`
4. `main`에 푸시하거나 Actions에서 **Deploy Web App to GitHub Pages**를 다시 실행한다. Vite는 빌드 시점에 이 값을 번들에 넣는다.

이 시크릿에 Blob 토큰을 넣지 않는다. 토큰은 Render의 `BLOB_READ_WRITE_TOKEN`만 사용한다.
