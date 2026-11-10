# 0005. 웹앱 부모 인증에 부모님 폰 Face ID(WebAuthn 패스키)를 클라이언트 측 잠금으로 추가

## Status
Accepted

## Context
iOS 앱은 부모님 폰(`deviceRole == .parent`)에서 PIN 시트에 "Face ID로 1초 만에 부모 인증하기" 버튼을 보여주고, 아이 폰에서는 아이 본인의 얼굴로 뚫릴 수 있으므로 생체인증을 절대 허용하지 않는다.
웹앱(GitHub Pages PWA)의 부모 인증은 6자리 마스터 PIN뿐이었다. 또한 웹은 iOS처럼 "부모님 폰/아이 폰" 기기 역할을 영구 설정하는 화면이 없고, `deviceRole`이 부모 모드 세션과 함께 움직인다(부모 모드를 잠그면 `child`로 저장됨). 그래서 PIN 시트가 열리는 시점의 `deviceRole`은 항상 `child`이며, 이것만으로는 부모님 폰을 구분할 수 없다.

## Decision
1. WebAuthn 플랫폼 인증기(`authenticatorAttachment: 'platform'`, `userVerification: 'required'`, `residentKey: 'preferred'`, `rpId = location.hostname`)로 Face ID / Touch ID 부모 인증을 추가한다.
2. **등록 = 이 기기를 부모님 폰으로 지정**하는 행위로 본다. 등록은 6자리 마스터 PIN을 맞힌 직후에만 제안하며, 제안 화면에 "아이 폰에서는 켜지 마세요" 경고와 "이 기기는 아이 폰이에요 · 다시 묻지 않기" 선택지를 둔다.
3. 크리덴셜 ID는 기기별 `localStorage`(`weekly_schedule_parent_passkey_v1`)에만 저장하고 클라우드 동기화 스냅샷에 넣지 않는다. 기기마다 따로 등록한다.
4. 등록된 기기에서만 PIN 시트에 Face ID 버튼을 보여주고, `navigator.credentials.get`(allowCredentials = 저장된 ID, UV 필수)이 성공하고 authenticatorData의 UV 비트가 켜져 있으면 PIN 성공과 같은 방식으로 부모 모드를 연다.
5. 취소·실패는 PIN 실패 횟수에 포함하지 않고 PIN 입력으로 돌아간다. PIN 입력 잠금 중에는 Face ID도 쓰지 않는다(iOS와 동일).
6. 기기 역할이 명시적으로 아이 폰(`setDeviceRole('child')`)이 되면 크리덴셜을 지운다. PIN 시트의 "이 기기에서 Face ID 사용 끄기"로 언제든 끌 수 있다. 일상적인 "부모 모드 잠금"은 크리덴셜을 지우지 않는다.
7. **서버 검증은 하지 않는다.** 챌린지는 브라우저에서 무작위로 만들고 서명을 검증하지 않으므로, 이 기능은 기존 PIN과 같은 수준의 클라이언트 측 잠금이다.

## Consequences
- 부모님 아이폰 Safari / 홈 화면 PWA에서 PIN 대신 Face ID로 바로 부모 모드를 열 수 있다.
- 패스키는 `jaeheonk.github.io` 도메인에 묶인다. 같은 도메인의 다른 GitHub Pages 프로젝트와 RP ID를 공유하며, 도메인을 바꾸면 다시 등록해야 한다.
- Safari 일반 탭은 오래 방문하지 않으면 사이트 저장소가 지워질 수 있어(ITP) 다시 등록해야 할 수 있다. 홈 화면 PWA는 영향이 적다.
- 개발자 도구로 localStorage/JS를 조작할 수 있는 사람은 PIN과 마찬가지로 우회할 수 있다. 실제 보안 경계가 필요해지면 서버 챌린지·서명 검증으로 확장해야 한다.
