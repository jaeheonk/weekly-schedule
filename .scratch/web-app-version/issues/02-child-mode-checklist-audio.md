# 02: 아이 모드 일일 체크리스트, 진행률 게이지 및 Web Audio 효과음

**What to build:**
아이 모드(Child Mode)에서 아이가 오늘 해야 할 일정과 세부 항목(서브태스크)을 확인하고, '다 했어요' 체크박스를 클릭해 완료 상태를 토글하며, 경쾌한 칭찬 차임벨 소리와 함께 일일 달성률 프로그레스 바가 즉시 차오르는 즉각적인 성취 피드백을 제공합니다. 부모 확인 도장이 찍힌 항목은 아이가 임의로 체크를 해제할 수 없도록 보호됩니다.

**Blocked by:** 01: 웹앱 스캐폴딩, PWA 환경 구성 및 GitHub Pages 자동 배포 파이프라인

**Status:** resolved

- [x] 아이 모드에서 오늘의 일정 카드 및 하위 서브태스크 체크박스를 클릭하여 완료 상태를 토글할 수 있다.
- [x] 항목 또는 서브태스크 완료 체크 시 Web Audio API로 합성된 밝고 경쾌한 칭찬 차임벨 사운드가 지연 없이 재생된다.
- [x] 완료된 항목 수와 전체 항목 비율에 따라 상단 진행률 프로그레스 바와 달성 퍼센트(%)가 실시간으로 애니메이션과 함께 갱신된다.
- [x] 부모 확인 도장이 완료된 항목이나 서브태스크는 아이 모드에서 클릭하더라도 완료 체크가 해제되지 않도록 보호된다.
- [x] 일일 완료 상태 및 서브태스크 체크 상태가 브라우저 로컬 저장소에 주차(WeekKey) 및 일정 ID 기준으로 영속화되어 새로고침 후에도 유지된다.
- [x] 체크리스트 완료 토글, 진행률 계산, 부모 확인 항목 보호 로직을 검증하는 단위 테스트가 통과한다.

## Comments

- **아이 모드 체크리스트 & 서브태스크 동기화**: `ScheduleStore`에 `toggleCompletion`, `toggleSubTaskCompletion` 및 `toggleCompletionWithResult` 구현. 카테고리(`routine`, `free`) 체크 제외 및 전체 서브태스크 완료 시 부모 일정 자동 완료 연동.
- **Web Audio API 칭찬 차임벨**: `services/soundEffects.ts`에 4음 아르페지오(G5 → C6 → E6 → G6) 지연 없는 즉각 신디사이저 구현 (외부 음원 다운로드 0초, 사용자 터치 제스처 시 AudioContext 자동 활성화, SSR/테스트 환경 graceful fallback).
- **상단 일일 진행률 게이지 카드**: `TodayScheduleView`에 당일 완료율(%), 다 했어요 개수, 부모확인 개수, 남은 할 일 실시간 집계 및 부드러운 애니메이션 프로그레스 바(`data-testid="progress-gauge-card"`) 구현.
- **부모 확인 완료 항목 보호**: 부모 도장(`isParentVerified`)이 찍힌 항목 및 서브태스크는 아이 모드(`child`)에서 클릭 시 체크 해제가 거부되며, 피드백 알림 배너("부모님이 확인 완료한 숙제는 변경할 수 없어요 🔒") 표시.
- **주차별 로컬 영속화**: `weekly_schedule_completed_items_v1`, `weekly_schedule_completed_subtasks_v1`, `weekly_schedule_parent_verified_items_v1` 키로 `localStorage`에 `YYYY-Www_UUID` 규격 저장 및 복원.
- **TDD & 검증**: 도메인 스토어 단위 테스트 12개, 사운드 합성 테스트 2개, 체크리스트 UI/통합 테스트 5개, App 내비게이션 테스트 5개 (총 24개 테스트) 100% 통과 및 TypeScript 빌드 성공.
- **Two-Axis Code Review**: Standards(Fowler smells 제거, 중복 스토리지/키 직렬화 헬퍼 추출, UI-Store 권한 결합 완화) 및 Spec(서브태스크 접근성 `aria-label`/`title` 추가, 렌더링 items 기준 진행률 집계) 피드백 100% 반영 완료.
