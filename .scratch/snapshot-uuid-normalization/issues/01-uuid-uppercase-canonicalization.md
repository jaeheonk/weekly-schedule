# 01: 웹앱 UUID 대문자 정규화 헬퍼 및 기본 시간표 생성기 수정

Status: resolved

**What to build:**
- `web/src/domain/defaultSchedule.ts`의 `deterministicUUID` 함수가 Swift Foundation `UUID.uuidString`과 100% 동일하게 16진수 대문자(Uppercase) 문자열(`[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}`)을 반환하도록 수정한다.
- `web/src/domain/scheduleStore.ts`의 `generateEntityId` 및 임의 UUID 생성 로직이 대문자 UUID를 반환하도록 수정한다.
- 복합 키 생성 헬퍼 `scopedKey(id: string, weekKey?: WeekKey)` 등에서 `id`를 `.toUpperCase()`로 정규화한다.
- `web/src/domain/scheduleStore.test.ts`의 결정론적 UUID 테스트를 대문자 기대값으로 갱신한다.
