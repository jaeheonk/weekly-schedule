import SwiftUI

@main
struct WeeklyScheduleApp: App {
    @StateObject private var store: ScheduleStore

    init() {
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
