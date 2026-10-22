import SwiftUI

#if os(macOS)
struct ScheduleCommands: Commands {
    @ObservedObject var store: ScheduleStore

    var body: some Commands {
        CommandGroup(after: .newItem) {
            Button("지금 클라우드 동기화") {
                Task {
                    await store.syncNow(forceUploadIfEmpty: false)
                }
            }
            .keyboardShortcut("r", modifiers: .command)

            Divider()

            Button("부모 모드 전환 / 잠금") {
                if store.isParentModeUnlocked {
                    store.lockParentMode()
                }
            }
            .keyboardShortcut("l", modifiers: .command)
        }

        CommandGroup(replacing: .help) {
            Link("주간 시간표 도움말 & GitHub", destination: URL(string: "https://github.com")!)
        }
    }
}
#endif
