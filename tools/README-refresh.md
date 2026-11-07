# WeeklyScheduleApp 자동 재설치 (Xcode, 개인팀)

toon-viewer-native/tools/refresh-devices.sh와 같은 방식이다. 비밀번호는 저장하지 않는다.
실행할 때마다 앱과 위젯의 로컬 프로파일을 지워, 그 시점부터 7일짜리 프로파일을 새로 받게 한다.
새 프로파일에 Jaeheon의 iPhone, Bluelock, hana의 iPhone이 모두 없으면 그 프로파일로 설치하지 않고,
세 기기가 들어 있는 이전 프로파일로 다시 서명한다. Bluelock가 집에 없어도 설치 파일은 준비된다.

- 스크립트: `tools/refresh-devices.sh` — iOS 앱(WeeklyScheduleApp)만 빌드·설치. Mac 타깃은 제외.
- 대상: Jaeheon의 iPhone, Bluelock, hana의 iPhone
- 로그: `~/Library/Logs/weekly-schedule-refresh.log`
- 스케줄: `~/Library/LaunchAgents/com.jae.weeklyschedule.refresh.plist` — 매주 월·목 02:20
  (툰 뷰어 02:00와 겹치지 않게 20분 뒤로 뒀다)

최초 1회만 터미널에서 직접:

```
cd /Users/jae/Workspace/weekly-schedule
chmod +x tools/refresh-devices.sh
./tools/refresh-devices.sh
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jae.weeklyschedule.refresh.plist
```

codesign 키체인 창이 뜨면 "항상 허용". 기기가 프로비저닝 프로파일에 아직 포함돼 있지
않으면 설치가 실패할 수 있다. 그 경우 그 기기로 Xcode에서 한 번 Run한 뒤 다시 실행한다.
