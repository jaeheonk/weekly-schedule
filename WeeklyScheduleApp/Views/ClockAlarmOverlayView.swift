import SwiftUI

struct ClockAlarmOverlayView: View {
    let session: ActiveAlarmSession
    let onSnooze: (Int) -> Void
    let onStop: () -> Void

    @State private var currentTime = Date()
    @State private var isBellRinging = false
    @State private var pulseRingScale: CGFloat = 0.85

    private var timeDisplayString: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: currentTime)
    }

    private var dateDisplayString: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter.string(from: currentTime)
    }

    var body: some View {
        ZStack {
            // 1. 아이폰 시계 알람 스타일 어두운 풀스크린 배경 + 카테고리 컬러 글로우
            LinearGradient(
                colors: [
                    Color(red: 0.06, green: 0.07, blue: 0.12),
                    Color(red: 0.10, green: 0.11, blue: 0.18),
                    Color(red: 0.05, green: 0.05, blue: 0.09)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.orange.opacity(0.32),
                            session.category.color.opacity(0.18),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 280
                    )
                )
                .frame(width: 520, height: 520)
                .scaleEffect(pulseRingScale)
                .offset(y: -120)
                .allowsHitTesting(false)

            VStack(spacing: 0) {
                Spacer(minLength: 24)

                // 2. 상단 알람 진동 배지 & 대형 디지털 시계
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "alarm.waves.left.and.right.fill")
                            .font(.headline)
                            .foregroundStyle(.orange)
                            .rotationEffect(.degrees(isBellRinging ? 14 : -14))
                            .animation(
                                .easeInOut(duration: 0.14).repeatForever(autoreverses: true),
                                value: isBellRinging
                            )

                        Text(
                            session.isSnoozed
                                ? "다시 알림(Snooze) 울리는 중"
                                : (session.leadMinutes == 0 ? "정각 시작 시계 알람" : "\(session.leadMinutes)분 전 미리 준비 알람")
                        )
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(.orange)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.16))
                    .overlay(
                        Capsule()
                            .strokeBorder(Color.orange.opacity(0.45), lineWidth: 1)
                    )
                    .clipShape(Capsule())

                    Text(dateDisplayString)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.78))
                        .padding(.top, 4)

                    Text(timeDisplayString)
                        .font(.system(size: 86, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.35), radius: 12, x: 0, y: 6)
                }

                Spacer(minLength: 20)

                // 3. 중앙 스케줄 상세 카드
                VStack(spacing: 16) {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(session.category.color.opacity(0.24))
                                .frame(width: 58, height: 58)
                            Image(systemName: session.iconName)
                                .font(.system(size: 26, weight: .bold))
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(session.category.title)
                                    .font(.caption.weight(.heavy))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(session.category.color.opacity(0.85))
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())

                                Text(session.timeRangeText)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.white.opacity(0.8))
                            }

                            Text(session.title)
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                        }

                        Spacer(minLength: 0)
                    }

                    if !session.note.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "pin.fill")
                                .font(.caption)
                                .foregroundStyle(.orange)
                                .padding(.top, 2)
                            Text(session.note)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.92))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(12)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    if !session.subTasks.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("오늘 해야 할 세부 항목")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white.opacity(0.65))

                            ForEach(session.subTasks, id: \.self) { sub in
                                HStack(spacing: 8) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                    Text(sub)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.white.opacity(0.92))
                                    Spacer()
                                }
                            }
                        }
                        .padding(12)
                        .background(Color.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(Color.white.opacity(0.11))
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .strokeBorder(Color.white.opacity(0.20), lineWidth: 1)
                        )
                )
                .padding(.horizontal, 24)

                Spacer(minLength: 28)

                // 4. 아이폰 시계 알람 스타일 하단 컨트롤 버튼 ('다시 알림' & '알람 끄기')
                VStack(spacing: 14) {
                    // 메인 오렌지 '다시 알림 (Snooze)' 버튼
                    Button {
                        onSnooze(5)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "zzz")
                                .font(.title3.weight(.black))
                            Text("5분 뒤 다시 알림 (Snooze)")
                                .font(.title3.weight(.heavy))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [Color.orange, Color(red: 0.96, green: 0.43, blue: 0.12)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .shadow(color: Color.orange.opacity(0.45), radius: 14, x: 0, y: 6)
                        )
                    }
                    .buttonStyle(.plain)

                    // 9분 뒤 다시 알림 보조 버튼 (아이폰 기본 시계 알람 간격)
                    Button {
                        onSnooze(9)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "clock.arrow.circlepath")
                                .font(.caption.weight(.bold))
                            Text("9분 뒤 다시 알림 (아이폰 시계 기본)")
                                .font(.footnote.weight(.bold))
                        }
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)

                    // 하단 '알람 끄기' 버튼
                    Button {
                        onStop()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "stop.circle.fill")
                                .font(.title3.weight(.bold))
                            Text("알람 끄기 · 일정 시작하기")
                                .font(.headline.weight(.heavy))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            Capsule()
                                .fill(Color.white.opacity(0.18))
                                .overlay(
                                    Capsule()
                                        .strokeBorder(Color.white.opacity(0.32), lineWidth: 1)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 34)
            }
        }
        .onAppear {
            currentTime = Date()
            isBellRinging = true
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                pulseRingScale = 1.15
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { break }
                currentTime = Date()
            }
        }
    }
}
