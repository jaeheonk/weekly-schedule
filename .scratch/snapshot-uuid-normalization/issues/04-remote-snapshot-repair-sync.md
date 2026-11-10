# 04: 오염된 원격 Vercel Blob 스냅샷 정제 및 배포 검증

Status: resolved
Blocked by: 01, 02, 03

**What to build:**
- 현재 Vercel Blob에 저장되어 있는 108개 항목의 스냅샷 데이터를 새로운 정제 병합 로직을 통과시켜 76개의 정상 항목으로 단일화하고 클라우드에 업로드한다.
- `TodayScheduleView`, `WeeklyGridView` 등 웹앱의 전체 테스트 스위트(`npm test`, `npm run build`)가 100% 통과함을 확인한다.
- 웹앱 화면에서 `Faye 수업`과 `취침`이 더 이상 2개씩 노출되지 않고 각각 1개의 카드로 올바른 시간(21:30~22:00, 22:00~22:30)에 노출되는지 검증한다.
