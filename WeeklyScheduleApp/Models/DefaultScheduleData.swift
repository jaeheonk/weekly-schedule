import Foundation
import CryptoKit

enum DefaultScheduleData {
    /// 기본 시간표의 초기 기준 타임스탬프 (어느 기기에서 수정/삭제하더라도 최신 타임스탬프가 우선되도록 고정값 사용)
    static let baselineTimestamp: TimeInterval = 1_700_000_000

    /// 시드 문자열로부터 모든 기기에서 항상 동일한 결정론적(Deterministic) UUID 생성
    static func deterministicUUID(seed: String) -> UUID {
        let digest = SHA256.hash(data: Data(seed.utf8))
        var bytes = Array(digest.prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x40 // Version 4
        bytes[8] = (bytes[8] & 0x3F) | 0x80 // Variant 1
        let tuple: uuid_t = (
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
            bytes[12], bytes[13], bytes[14], bytes[15]
        )
        return UUID(uuid: tuple)
    }

    /// 일정의 요일·시간·제목 기반 고유 시그니처 (중복 방지 및 레거시 기본 일정 매칭용)
    static func signature(for item: ScheduleItem) -> String {
        let cleanTitle = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let scopeTag = item.targetWeekKey ?? "master"
        return "\(scopeTag)|\(item.weekday.rawValue)|\(item.startHour):\(item.startMinute)|\(item.endHour):\(item.endMinute)|\(cleanTitle)"
    }

    static func makeDefaultItems() -> [ScheduleItem] {
        var items: [ScheduleItem] = []

        // MARK: - 월요일 (Monday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .monday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 13, startMinute: 30,
                endHour: 14, endMinute: 30,
                title: "학교",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "바이올린",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 15, startMinute: 0,
                endHour: 16, endMinute: 0,
                title: "Vocabulary for Reading + 100 Words",
                subTasks: [
                    SubTask(title: "Vocabulary for Reading"),
                    SubTask(title: "100 Words")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 16, startMinute: 0,
                endHour: 17, endMinute: 0,
                title: "바이올린",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 17, startMinute: 0,
                endHour: 18, endMinute: 0,
                title: "한국책 읽기 30분",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "수영",
                note: "수영 가방 챙기기",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 20, startMinute: 0,
                endHour: 21, endMinute: 30,
                title: "국어똑",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 21, startMinute: 30,
                endHour: 22, endMinute: 30,
                title: "Faye 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .monday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 화요일 (Tuesday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .tuesday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "하교",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 15, startMinute: 0,
                endHour: 16, endMinute: 0,
                title: "축구 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 16, startMinute: 0,
                endHour: 17, endMinute: 0,
                title: "씻고 간식 · 바이올린",
                subTasks: [
                    SubTask(title: "씻고 간식 먹기"),
                    SubTask(title: "바이올린 연습")
                ],
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 17, startMinute: 0,
                endHour: 18, endMinute: 0,
                title: "영어수학",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "한국책 30분 읽고 그래픽 오거나이저 쓰기",
                subTasks: [
                    SubTask(title: "한국책 30분 읽기"),
                    SubTask(title: "그래픽 오거나이저 쓰기")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 20, startMinute: 0,
                endHour: 21, endMinute: 30,
                title: "100 Words + 수학 과외",
                subTasks: [
                    SubTask(title: "100 Words"),
                    SubTask(title: "수학 과외")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 21, startMinute: 30,
                endHour: 22, endMinute: 30,
                title: "Faye 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .tuesday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 수요일 (Wednesday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .wednesday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "영어수학 + 100 Words",
                subTasks: [
                    SubTask(title: "영어수학"),
                    SubTask(title: "100 Words")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 15, startMinute: 0,
                endHour: 17, endMinute: 0,
                title: "학교 축구",
                note: "3:00 PM ~ 5:00 PM",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 17, startMinute: 0,
                endHour: 18, endMinute: 0,
                title: "수학숙제",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "바이올린",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 20, startMinute: 0,
                endHour: 21, endMinute: 30,
                title: "한국책 읽기 30분 + 영어책 읽기 30분",
                subTasks: [
                    SubTask(title: "한국책 읽기 30분"),
                    SubTask(title: "영어책 읽기 30분")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 21, startMinute: 30,
                endHour: 22, endMinute: 30,
                title: "Faye 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .wednesday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 목요일 (Thursday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .thursday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "바이올린",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 15, startMinute: 0,
                endHour: 16, endMinute: 0,
                title: "수학숙제",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 16, startMinute: 0,
                endHour: 17, endMinute: 0,
                title: "100 Words",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 17, startMinute: 0,
                endHour: 18, endMinute: 0,
                title: "농구",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "한국책 읽기 30분 + 영어책 읽기 30분",
                subTasks: [
                    SubTask(title: "한국책 읽기 30분"),
                    SubTask(title: "영어책 읽기 30분")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 20, startMinute: 0,
                endHour: 21, endMinute: 30,
                title: "수학과외",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 21, startMinute: 30,
                endHour: 22, endMinute: 30,
                title: "Faye 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .thursday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 금요일 (Friday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .friday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "100 Words",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 15, startMinute: 0,
                endHour: 16, endMinute: 0,
                title: "한국책 30분 읽고 그래픽 오거나이저 쓰기",
                subTasks: [
                    SubTask(title: "한국책 30분 읽기"),
                    SubTask(title: "그래픽 오거나이저 쓰기")
                ],
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 16, startMinute: 0,
                endHour: 17, endMinute: 0,
                title: "Vocabulary for Reading + 100 Words (Unit 6-10)",
                note: "Unit 6-10",
                subTasks: [
                    SubTask(title: "Vocabulary for Reading"),
                    SubTask(title: "100 Words (Unit 6-10)")
                ],
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 17, startMinute: 0,
                endHour: 18, endMinute: 0,
                title: "수영",
                note: "수영 가방 챙기기",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "수학숙제",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 20, startMinute: 0,
                endHour: 21, endMinute: 30,
                title: "인물사전",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 21, startMinute: 30,
                endHour: 22, endMinute: 30,
                title: "Faye 수업",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .friday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 토요일 (Saturday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .saturday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .saturday,
                startHour: 10, startMinute: 30,
                endHour: 11, endMinute: 20,
                title: "바이올린",
                note: "10:30 - 11:20",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .saturday,
                startHour: 12, startMinute: 0,
                endHour: 22, endMinute: 30,
                title: "토요일 주간 미션 & 도서관",
                note: "1. 밀린 숙제하기 / 2. 도서관 가기 / 3. 영어수학 / 4. 수학숙제",
                category: .study,
                iconName: "checklist",
                subTasks: [
                    SubTask(title: "1. 밀린 숙제하기"),
                    SubTask(title: "2. 도서관 가기 - 도서 반납"),
                    SubTask(title: "2. 도서관 가기 - 리스트에 있는 책 빌리기"),
                    SubTask(title: "3. 영어수학"),
                    SubTask(title: "4. 수학숙제")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .saturday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // MARK: - 일요일 (Sunday)
        items.append(contentsOf: [
            ScheduleItem(
                weekday: .sunday,
                startHour: 7, startMinute: 0,
                endHour: 7, endMinute: 30,
                title: "코딱지",
                note: "아침 기상 및 루틴",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 9, startMinute: 30,
                endHour: 10, endMinute: 10,
                title: "코딩",
                note: "9:30 - 10:10",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 13, startMinute: 30,
                endHour: 14, endMinute: 30,
                title: "교회 끝",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 14, startMinute: 30,
                endHour: 15, endMinute: 0,
                title: "집 도착",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 15, startMinute: 0,
                endHour: 16, endMinute: 0,
                title: "한국책 30분 읽고 그래픽 오거나이저 쓰기",
                subTasks: [
                    SubTask(title: "한국책 30분 읽기"),
                    SubTask(title: "그래픽 오거나이저 쓰기")
                ],
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 16, startMinute: 0,
                endHour: 17, endMinute: 30,
                title: "오케스트라 연습",
                note: "16:00 - 17:30",
                isNotificationEnabled: true,
                notificationLeadMinutes: [15, 0]
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 18, startMinute: 0,
                endHour: 19, endMinute: 0,
                title: "저녁",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 19, startMinute: 0,
                endHour: 20, endMinute: 0,
                title: "인명사전",
                isNotificationEnabled: false
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 20, startMinute: 0,
                endHour: 22, endMinute: 0,
                title: "자유시간",
                note: "20:00 - 22:00 신나는 자유시간!",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            ),
            ScheduleItem(
                weekday: .sunday,
                startHour: 22, startMinute: 30,
                endHour: 23, endMinute: 0,
                title: "취침",
                isNotificationEnabled: true,
                notificationLeadMinutes: [0]
            )
        ])

        // 모든 기기에서 동일한 기본 시간표 ID 및 기준 시각(baselineTimestamp)을 갖도록 정규화
        for idx in items.indices {
            let item = items[idx]
            let startSig = "\(item.weekday.rawValue)|\(item.startHour):\(item.startMinute)|\(item.title.trimmingCharacters(in: .whitespacesAndNewlines))"
            items[idx].id = deterministicUUID(seed: "weekly-schedule-default-v2-\(startSig)")
            items[idx].updatedAt = baselineTimestamp
            for sIdx in items[idx].subTasks.indices {
                let subTitle = items[idx].subTasks[sIdx].title
                items[idx].subTasks[sIdx].id = deterministicUUID(seed: "weekly-schedule-sub-v2-\(startSig)-\(sIdx)-\(subTitle)")
            }
        }

        return items
    }
}
