import SwiftUI

@main
struct WeeklyScheduleApp: App {
    @StateObject private var store: ScheduleStore

    init() {
        // iOS 로컬 알림 델리게이트는 앱 초기화 시점에 즉시 등록되어야 함
        _ = NotificationManager.shared
        let newStore = ScheduleStore()
        _store = StateObject(wrappedValue: newStore)
        BackgroundRefreshManager.shared.register()
        BackgroundRefreshManager.shared.store = newStore
    }

    var body: some Scene {
        WindowGroup {
            #if os(macOS)
            MacContentView()
                .environmentObject(store)
                .frame(minWidth: 980, minHeight: 650)
            #else
            ContentView()
                .environmentObject(store)
                .dynamicTypeSize(.large)
            #endif
        }
        #if os(macOS)
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
        .commands {
            ScheduleCommands(store: store)
        }
        #endif
    }
}
