import SwiftUI

struct ScheduleEditSheet: View {
    enum Mode: Identifiable {
        case add
        case edit(ScheduleItem)

        var id: String {
            switch self {
            case .add: return "add"
            case .edit(let item): return item.id.uuidString
            }
        }
    }

    @EnvironmentObject var store: ScheduleStore
    @Environment(\.dismiss) private var dismiss

    let mode: Mode
    let defaultWeekday: Weekday
    var initialStartHour: Int = 15
    var initialStartMinute: Int = 0
    var initialScope: ScheduleEditScope = .master

    @State private var scope: ScheduleEditScope = .master
    @State private var title: String = ""
    @State private var note: String = ""
    @State private var weekday: Weekday = .monday
    @State private var selectedWeekdaysForAdd: Set<Weekday> = []
    @State private var startDate: Date = Date()
    @State private var endDate: Date = Date()
    @State private var category: ScheduleCategory = .study
    @State private var iconName: String = "book.fill"
    @State private var hasManuallySelectedCategory: Bool = false

    @State private var subTasks: [SubTask] = []
    @State private var newSubTaskTitle: String = ""

    @State private var isNotificationEnabled: Bool = true
    @State private var selectedLeadMinutes: Set<Int> = [15, 0]

    @State private var showingDeleteConfirm: Bool = false

    private let availableIcons: [String] = [
        "book.fill", "character.book.closed.fill", "books.vertical.fill", "function",
        "pencil.and.list.clipboard", "checklist", "graduationcap.fill", "building.columns.fill",
        "person.wave.2.fill", "person.2.fill", "laptopcomputer", "music.quarternote.3",
        "music.mic", "figure.pool.swim", "soccerball", "basketball.fill",
        "figure.run", "fork.knife", "sun.and.horizon.fill", "house.fill",
        "moon.stars.fill", "gamecontroller.fill", "face.smiling.fill", "sparkles"
    ]

    private var isEditMode: Bool {
        if case .edit = mode { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            Form {
                // 0. 변경 적용 범위 선택 섹션 (이번 주만 조정 vs 전체 스케줄 변경)
                scopeSelectionSection

                // 1. 기본 정보 섹션
                Section("일정 이름 및 메모") {
                    TextField("예: 바이올린, 영어수학, 수영", text: $title)
                        .font(.body.weight(.semibold))
                        .onChange(of: title) { _, newValue in
                            if !isEditMode && !hasManuallySelectedCategory && !newValue.isEmpty {
                                let inferred = ScheduleCategory.inferCategoryAndIcon(from: newValue)
                                category = inferred.0
                                iconName = inferred.1
                            }
                        }

                    TextField("메모 또는 준비물 (선택사항)", text: $note)
                        .font(.subheadline)
                }

                // 2. 요일 선택 섹션
                Section(isEditMode ? "요일 선택" : "요일 선택 (여러 요일 동시 등록 가능)") {
                    if isEditMode {
                        Picker("요일", selection: $weekday) {
                            ForEach(Weekday.allCases) { day in
                                Text(day.fullName).tag(day)
                            }
                        }
                        .pickerStyle(.segmented)
                    } else {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 6) {
                                ForEach(Weekday.allCases) { day in
                                    let isSelected = selectedWeekdaysForAdd.contains(day)
                                    Button {
                                        if isSelected && selectedWeekdaysForAdd.count > 1 {
                                            selectedWeekdaysForAdd.remove(day)
                                        } else {
                                            selectedWeekdaysForAdd.insert(day)
                                        }
                                    } label: {
                                        Text(day.shortName)
                                            .font(.subheadline.weight(.bold))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 9)
                                            .background(isSelected ? Color.accentColor : Color(.tertiarySystemFill))
                                            .foregroundStyle(isSelected ? .white : .primary)
                                            .clipShape(RoundedRectangle(cornerRadius: 10))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            HStack(spacing: 8) {
                                Button("평일 (월~금)") {
                                    selectedWeekdaysForAdd = [.monday, .tuesday, .wednesday, .thursday, .friday]
                                }
                                .font(.caption.weight(.semibold))
                                .buttonStyle(.bordered)

                                Button("매일 (월~일)") {
                                    selectedWeekdaysForAdd = Set(Weekday.allCases)
                                }
                                .font(.caption.weight(.semibold))
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                // 3. 시간 설정 섹션
                Section("시간 설정") {
                    DatePicker("시작 시간", selection: $startDate, displayedComponents: .hourAndMinute)
                        .onChange(of: startDate) { _, newStart in
                            if endDate <= newStart {
                                endDate = Calendar.current.date(byAdding: .minute, value: 60, to: newStart) ?? newStart
                            }
                        }

                    DatePicker("종료 시간", selection: $endDate, displayedComponents: .hourAndMinute)

                    // 빠른 시간 간격 버튼
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Text("빠른 길이:")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            ForEach([30, 50, 60, 90, 120], id: \.self) { mins in
                                Button(mins == 60 ? "1시간" : (mins == 90 ? "1시간 30분" : (mins == 120 ? "2시간" : "\(mins)분"))) {
                                    if let updated = Calendar.current.date(byAdding: .minute, value: mins, to: startDate) {
                                        endDate = updated
                                    }
                                }
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(Capsule())
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                // 4. 시계 알람 설정 섹션
                Section {
                    Toggle(isOn: $isNotificationEnabled.animation()) {
                        Label {
                            Text("스케줄 시계 알람 켜기")
                                .fontWeight(.semibold)
                        } icon: {
                            Image(systemName: isNotificationEnabled ? "alarm.waves.left.and.right.fill" : "bell.slash")
                                .foregroundStyle(isNotificationEnabled ? .orange : .secondary)
                        }
                    }

                    if isNotificationEnabled {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("알람 울릴 시간 (중복 선택 가능)")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)

                            HStack(spacing: 6) {
                                ForEach(NotificationLeadTime.allCases) { option in
                                    let isSelected = selectedLeadMinutes.contains(option.rawValue)
                                    Button {
                                        if isSelected {
                                            if selectedLeadMinutes.count > 1 {
                                                selectedLeadMinutes.remove(option.rawValue)
                                            }
                                        } else {
                                            selectedLeadMinutes.insert(option.rawValue)
                                        }
                                    } label: {
                                        Text(option.label)
                                            .font(.caption.weight(.bold))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.85)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 8)
                                            .frame(maxWidth: .infinity)
                                            .background(isSelected ? Color.orange : Color(.tertiarySystemFill))
                                            .foregroundStyle(isSelected ? .white : .primary)
                                            .clipShape(RoundedRectangle(cornerRadius: 9))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                } header: {
                    Text("⏰ 시계 알람 설정")
                } footer: {
                    if isNotificationEnabled {
                        if store.deviceRole == .parent {
                            Text("아이의 폰에서 설정된 시간에 시계 알람이 연속으로 울립니다. (부모님 폰에서는 알림이 울리지 않습니다)")
                        } else {
                            Text("선택한 시간(예: 15분 전 및 정각)마다 시계 알람처럼 연속 벨소리가 길게 울리며, '다시 알림(Snooze)'과 '알람 끄기'를 사용할 수 있습니다.")
                        }
                    }
                }

                // 5. 과목/활동 카테고리 및 아이콘
                Section("과목·활동 분류 및 아이콘") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 95), spacing: 8)], spacing: 8) {
                        ForEach(ScheduleCategory.allCases) { cat in
                            let isSelected = category == cat
                            Button {
                                hasManuallySelectedCategory = true
                                category = cat
                                iconName = cat.defaultIcon
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: cat.defaultIcon)
                                        .font(.caption)
                                    Text(cat.title)
                                        .font(.caption.weight(.bold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(isSelected ? cat.color : cat.softBackgroundColor)
                                .foregroundStyle(isSelected ? .white : cat.color)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(availableIcons, id: \.self) { sym in
                                let isSelected = iconName == sym
                                Button {
                                    hasManuallySelectedCategory = true
                                    iconName = sym
                                } label: {
                                    Image(systemName: sym)
                                        .font(.body)
                                        .frame(width: 38, height: 38)
                                        .background(isSelected ? category.color : Color(.tertiarySystemFill))
                                        .foregroundStyle(isSelected ? .white : .primary)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                // 6. 세부 할 일 체크리스트 (Sub-tasks)
                Section {
                    ForEach(subTasks) { sub in
                        HStack {
                            Image(systemName: category.isCheckable ? "checkmark.square" : "circle.fill")
                                .font(category.isCheckable ? .body : .system(size: 6))
                                .foregroundStyle(category.color)
                            Text(sub.title)
                                .font(.subheadline)
                            Spacer()
                            Button {
                                subTasks.removeAll { $0.id == sub.id }
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundStyle(.red.opacity(0.8))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    HStack {
                        TextField(category.isCheckable ? "세부 할 일 추가 (예: 100 Words)" : "세부 내용 추가 (선택)", text: $newSubTaskTitle)
                            .font(.subheadline)
                            .onSubmit {
                                addSubTask()
                            }
                        Button {
                            addSubTask()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundStyle(newSubTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty ? .gray : Color.accentColor)
                        }
                        .disabled(newSubTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(category.isCheckable ? "세부 할 일 체크리스트 (선택)" : "세부 내용 (선택 · 체크 제외)")
                } footer: {
                    Text(
                        category.isCheckable
                            ? "한 시간대에 여러 공부를 하거나 주말 미션 목록을 만들 때 유용합니다."
                            : "생활·습관 및 자유·여가 항목은 완료 체크 기능에서 제외되며 일정 표시만 수행합니다."
                    )
                }

                // 7. 이번 주 빠른 조정 & 삭제 버튼 (수정 모드일 때만 - 이미 부모 확인된 항목은 부모 모드에서만 삭제/휴강 가능)
                if case .edit(let existingItem) = mode {
                    if !existingItem.isThisWeekOnlyAddition {
                        Section {
                            if store.hasThisWeekOverride(for: existingItem.id) {
                                Button {
                                    store.revertThisWeekOverride(for: existingItem.id)
                                    dismiss()
                                } label: {
                                    HStack {
                                        Image(systemName: "arrow.uturn.backward.circle.fill")
                                            .foregroundStyle(.blue)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("이번 주 조정 취소 (원래 시간표로 복구)")
                                                .font(.subheadline.weight(.bold))
                                                .foregroundStyle(.blue)
                                            if let master = store.masterItem(withId: existingItem.id) {
                                                Text("원래 일정: \(master.weekday.fullName) \(master.timeRangeString) · \(master.title)")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                    }
                                    .padding(.vertical, 2)
                                }
                            }

                            if !store.isSkippedThisWeek(existingItem.id) {
                                if store.isParentVerified(existingItem) && !store.isParentModeUnlocked {
                                    HStack(spacing: 8) {
                                        Image(systemName: "lock.shield.fill")
                                            .foregroundStyle(.green)
                                        Text("이번 주 부모님 확인 도장이 찍힌 숙제는 부모 확인 모드에서만 휴강·삭제할 수 있어요.")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    .padding(.vertical, 4)
                                } else {
                                    Button {
                                        _ = store.skipItemForThisWeek(existingItem)
                                        dismiss()
                                    } label: {
                                        HStack {
                                            Image(systemName: "calendar.badge.minus")
                                                .foregroundStyle(.orange)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text("이번 주만 휴강·제외하기 (다음 주 자동 복구)")
                                                    .font(.subheadline.weight(.bold))
                                                    .foregroundStyle(.orange)
                                                Text("기본 시간표는 그대로 유지하고 이번 주 목록에서만 숨깁니다.")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                        }
                                        .padding(.vertical, 2)
                                    }
                                }
                            }
                        } header: {
                            Text("🔄 이번 주 일시 조정 옵션")
                        }
                    }

                    Section {
                        if store.isParentVerified(existingItem) && !store.isParentModeUnlocked {
                            HStack(spacing: 8) {
                                Image(systemName: "lock.shield.fill")
                                    .foregroundStyle(.green)
                                Text("이번 주 부모님 확인 도장이 찍힌 숙제는 부모 확인 모드에서만 삭제할 수 있어요.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        } else {
                            Button(role: .destructive) {
                                showingDeleteConfirm = true
                            } label: {
                                HStack {
                                    Spacer()
                                    Label(
                                        existingItem.isThisWeekOnlyAddition
                                            ? "이번 주 추가 일정 삭제하기"
                                            : "전체 기본 시간표에서 영구 삭제하기",
                                        systemImage: "trash"
                                    )
                                    .fontWeight(.semibold)
                                    Spacer()
                                }
                            }
                        }
                    }
                    .confirmationDialog(
                        existingItem.isThisWeekOnlyAddition
                            ? "이번 주에 추가한 일정을 삭제할까요?"
                            : "전체 기본 시간표에서 이 일정을 영구적으로 삭제할까요?",
                        isPresented: $showingDeleteConfirm,
                        titleVisibility: .visible
                    ) {
                        if !existingItem.isThisWeekOnlyAddition && !store.isSkippedThisWeek(existingItem.id) {
                            Button("이번 주만 휴강·제외하기 (권장)") {
                                _ = store.skipItemForThisWeek(existingItem)
                                dismiss()
                            }
                        }
                        Button("영구 삭제", role: .destructive) {
                            _ = store.deleteItem(existingItem)
                            dismiss()
                        }
                        Button("취소", role: .cancel) {}
                    } message: {
                        if !existingItem.isThisWeekOnlyAddition {
                            Text("이번 주만 쉬거나 건너뛰려면 '이번 주만 휴강·제외하기'를 선택하세요. 영구 삭제하면 다음 주에도 나타나지 않습니다.")
                        }
                    }
                }
            }
            #if os(macOS)
            .formStyle(.grouped)
            #endif
            .navigationTitle(sheetTitle)
            .inlineNavigationBarTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(scope == .thisWeek ? "이번 주 적용" : "전체 저장") {
                        saveSchedule()
                    }
                    .fontWeight(.bold)
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                setupInitialState()
            }
            #if os(iOS)
            .dynamicTypeSize(.large)
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 580, idealWidth: 640, minHeight: 420, idealHeight: 700)
        #endif
    }

    private var sheetTitle: String {
        if isEditMode {
            return scope == .thisWeek ? "이번 주 스케줄 조정" : "전체 스케줄 변경"
        } else {
            return scope == .thisWeek ? "이번 주 일정 추가" : "전체 정규 일정 추가"
        }
    }

    private var scopeSelectionSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    ForEach(ScheduleEditScope.allCases) { option in
                        let isSelected = scope == option
                        let accentColor: Color = option == .thisWeek ? .orange : .indigo

                        Button {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.8)) {
                                scope = option
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 5) {
                                    Image(systemName: option.iconName)
                                        .font(.caption.weight(.bold))
                                    Text(option.shortLabel)
                                        .font(.caption.weight(.heavy))
                                    Spacer(minLength: 0)
                                    if isSelected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.caption)
                                    }
                                }
                                Text(option == .thisWeek ? "다음 주 원래대로 자동 복구" : "매주 반복 시간표 영구 반영")
                                    .font(.system(size: 10.5, weight: .medium))
                                    .opacity(isSelected ? 0.92 : 0.75)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.85)
                            }
                            .padding(.horizontal, 11)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(isSelected ? accentColor : Color(.tertiarySystemFill))
                            )
                            .foregroundStyle(isSelected ? .white : .primary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: scope == .thisWeek ? "sparkles" : "calendar")
                        .font(.caption)
                        .foregroundStyle(scope == .thisWeek ? .orange : .indigo)
                        .padding(.top, 1)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(scope.subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if case .edit(let existing) = mode,
                           let master = store.masterItem(withId: existing.id) {
                            Text("기본 시간표 기준: \(master.weekday.fullName) \(master.timeRangeString) · \(master.title)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(scope == .thisWeek ? Color.orange : Color.indigo)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        } header: {
            Text("변경 적용 범위 (이번 주 조정 vs 전체 변경)")
        }
    }

    private func addSubTask() {
        let trimmed = newSubTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        subTasks.append(SubTask(title: trimmed))
        newSubTaskTitle = ""
    }

    private func setupInitialState() {
        scope = initialScope

        switch mode {
        case .add:
            weekday = defaultWeekday
            selectedWeekdaysForAdd = [defaultWeekday]
            startDate = Self.makeTime(hour: initialStartHour, minute: initialStartMinute)
            let endHour = min(23, initialStartHour + 1)
            endDate = Self.makeTime(hour: endHour, minute: initialStartMinute)
            isNotificationEnabled = true
            selectedLeadMinutes = [15, 0]

        case .edit(let item):
            if item.isThisWeekOnlyAddition {
                scope = .thisWeek
            }
            title = item.title
            note = item.note
            weekday = item.weekday
            selectedWeekdaysForAdd = [item.weekday]
            startDate = Self.makeTime(hour: item.startHour, minute: item.startMinute)
            endDate = Self.makeTime(hour: item.endHour, minute: item.endMinute)
            category = item.category
            iconName = item.iconName
            hasManuallySelectedCategory = true
            subTasks = item.subTasks
            isNotificationEnabled = item.isNotificationEnabled
            selectedLeadMinutes = Set(NotificationLeadTime.normalize(item.notificationLeadMinutes))
        }
    }

    private func saveSchedule() {
        // 입력 중이던 세부 할 일이 있으면 자동 반영
        let pendingSub = newSubTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !pendingSub.isEmpty {
            subTasks.append(SubTask(title: pendingSub))
        }

        let cal = Calendar.current
        let sHour = cal.component(.hour, from: startDate)
        let sMin = cal.component(.minute, from: startDate)
        var eHour = cal.component(.hour, from: endDate)
        var eMin = cal.component(.minute, from: endDate)

        if (eHour * 60 + eMin) <= (sHour * 60 + sMin) {
            let adjusted = min(23 * 60 + 59, sHour * 60 + sMin + 30)
            eHour = adjusted / 60
            eMin = adjusted % 60
        }

        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let leadArray = Array(selectedLeadMinutes).sorted(by: >)

        switch mode {
        case .add:
            let newItem = ScheduleItem(
                weekday: weekday,
                startHour: sHour,
                startMinute: sMin,
                endHour: eHour,
                endMinute: eMin,
                title: cleanTitle,
                note: cleanNote,
                category: category,
                iconName: iconName,
                subTasks: subTasks,
                isNotificationEnabled: isNotificationEnabled,
                notificationLeadMinutes: leadArray
            )
            store.addItem(newItem, targetWeekdays: selectedWeekdaysForAdd, scope: scope)

        case .edit(let existing):
            var updated = existing
            updated.weekday = weekday
            updated.startHour = sHour
            updated.startMinute = sMin
            updated.endHour = eHour
            updated.endMinute = eMin
            updated.title = cleanTitle
            updated.note = cleanNote
            updated.category = category
            updated.iconName = iconName
            updated.subTasks = subTasks
            updated.isNotificationEnabled = isNotificationEnabled
            updated.notificationLeadMinutes = leadArray
            store.updateItem(updated, scope: scope)
        }

        dismiss()
    }

    private static func makeTime(hour: Int, minute: Int) -> Date {
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = hour
        comps.minute = minute
        return Calendar.current.date(from: comps) ?? Date()
    }
}
