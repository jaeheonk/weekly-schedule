import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: ScheduleStore
    @StateObject private var notificationManager = NotificationManager.shared
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: Int = 0

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                TodayScheduleView()
                    .tabItem {
                        Label("오늘 스케줄", systemImage: "checklist.checked")
                    }
                    .tag(0)

                WeeklyGridView()
                    .tabItem {
                        Label("주간 시간표", systemImage: "calendar")
                    }
                    .tag(1)

                BookshelfWebView()
                    .tabItem {
                        Label("책장", systemImage: "books.vertical.fill")
                    }
                    .tag(2)

                NotificationSettingsView()
                    .tabItem {
                        Label("동기화·알림", systemImage: "alarm.waves.left.and.right.fill")
                    }
                    .tag(3)
            }
            .tint(Color(red: 0.25, green: 0.42, blue: 0.95))

            VStack(spacing: 8) {
                // 실시간 동기화 및 하트 도착 플로팅 토스트 배너
                if let toast = store.syncToastMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .foregroundStyle(.yellow)
                        Text(toast)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [Color.indigo, Color.pink],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .shadow(color: Color.black.opacity(0.22), radius: 10, x: 0, y: 4)
                    )
                    .padding(.horizontal, 20)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture {
                        withAnimation {
                            store.syncToastMessage = nil
                        }
                    }
                }

                // 다시 알림(Snooze) 대기 중인 알림 배너
                if let nextSnooze = notificationManager.snoozedAlarms.first,
                   notificationManager.activeAlarm == nil {
                    let remainingSec = max(0, Int(ceil(nextSnooze.fireDate.timeIntervalSince(store.now))))
                    let mins = remainingSec / 60
                    let secs = remainingSec % 60

                    HStack(spacing: 10) {
                        Image(systemName: "zzz")
                            .font(.caption.weight(.black))
                            .foregroundStyle(.white)
                            .padding(6)
                            .background(Color.white.opacity(0.22))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 1) {
                            Text("다시 알림 대기 중 · \(nextSnooze.title)")
                                .font(.caption.weight(.heavy))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(String(format: "%d분 %02d초 뒤 다시 울림", mins, secs))
                                .font(.caption2.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(.white.opacity(0.9))
                        }

                        Spacer(minLength: 4)

                        Button {
                            withAnimation {
                                notificationManager.cancelSnooze(nextSnooze)
                            }
                        } label: {
                            Text("해제")
                                .font(.caption2.weight(.heavy))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Color.white.opacity(0.24))
                                .foregroundStyle(.white)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(Color.orange)
                            .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
                    )
                    .padding(.horizontal, 20)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .padding(.top, 8)
            .zIndex(99)

            // 전체 화면 아이폰 시계 알람 오버레이 (아이 폰 모드에서 울리는 중일 때 최상단 표시)
            if store.deviceRole == .child, let activeSession = notificationManager.activeAlarm {
                ClockAlarmOverlayView(
                    session: activeSession,
                    onSnooze: { mins in
                        Task {
                            await notificationManager.snoozeActiveAlarm(minutes: mins)
                        }
                    },
                    onStop: {
                        notificationManager.stopActiveAlarm()
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
                .zIndex(200)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                store.refreshDateAndDayChange()
                Task {
                    await store.syncNow(forceUploadIfEmpty: false)
                    await notificationManager.refreshAuthorizationStatus()
                }
            } else if newPhase == .background {
                #if os(iOS)
                BackgroundRefreshManager.shared.scheduleAppRefresh()
                #endif
                store.lockParentMode()
                notificationManager.stopPreviewSound()
            } else {
                store.lockParentMode()
                notificationManager.stopPreviewSound()
            }
        }
    }
}
