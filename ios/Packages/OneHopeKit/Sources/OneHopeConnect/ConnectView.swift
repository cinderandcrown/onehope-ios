import EventKit
import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct ConnectView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    @State private var prayer = ""
    @State private var message = ""
    @State private var childName = ""
    @State private var classroom = "Preschool"
    @State private var notice = ""
    @State private var pickupCode = ""
    @State private var selectedChild = ""

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" }
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
    }

    public var body: some View {
        NavigationStack {
            List {
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
                Section("Groups") {
                    if snapshot.groups.isEmpty {
                        EmptyHint("Groups will be listed here.")
                    }
                    ForEach(snapshot.groups) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(group.name).font(.headline)
                            Text(group.summary).font(.footnote)
                            Button(group.joined ? "Joined" : "Join") {
                                Task { notice = await perform(.join(group.id)) }
                            }
                            .disabled(group.joined)
                        }
                    }
                }
                Section("Group note") {
                    if snapshot.groups.contains(where: \.joined) {
                        TextField("Message your group", text: $message)
                        if let group = snapshot.groups.first(where: \.joined) {
                            Button("Send to \(group.name)") {
                                let body = message.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !body.isEmpty else {
                                    notice = "Write a note before sending it."
                                    return
                                }
                                Task {
                                    notice = await perform(.message(group.id, body))
                                    message = ""
                                }
                            }
                        }
                    } else {
                        Text("Join a group before sending a note.")
                    }
                }
                Section("Events") {
                    ForEach(snapshot.events) { event in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(event.title).font(.headline)
                            Text(event.detail).font(.footnote)
                            Button("Register") {
                                Task { notice = await perform(.register(event.id)) }
                            }
                            Button("Add to calendar") {
                                addToCalendar(event)
                            }
                        }
                    }
                }
                Section("Prayer") {
                    TextField("Prayer request", text: $prayer, axis: .vertical)
                    Button("Share a prayer") {
                        let body = prayer.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !body.isEmpty else {
                            notice = "Write a prayer before sharing it."
                            return
                        }
                        Task {
                            notice = await perform(.prayer(body))
                            prayer = ""
                        }
                    }
                    ForEach(snapshot.prayers) { prayer in
                        VStack(alignment: .leading) {
                            Text(prayer.body)
                            if prayer.mine, !prayer.approved {
                                Text("Waiting for pastor approval").font(.footnote)
                            }
                        }
                    }
                }
                Section("Kids check-in") {
                    TextField("Child's name", text: $childName)
                    Picker("Classroom", selection: $classroom) {
                        Text("Nursery").tag("Nursery")
                        Text("Preschool").tag("Preschool")
                        Text("Elementary").tag("Elementary")
                    }
                    Button("Add child") {
                        let name = childName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !name.isEmpty else {
                            notice = "Enter your child's name."
                            return
                        }
                        Task {
                            notice = await perform(.addChild(name, classroom))
                            childName = ""
                        }
                    }
                    if !snapshot.kids.isEmpty {
                        Picker("Child", selection: $selectedChild) {
                            Text("Choose").tag("")
                            ForEach(snapshot.kids) { child in
                                Text(child.displayName).tag(child.id)
                            }
                        }
                        Button("Check in") {
                            Task { notice = await perform(.checkIn(selectedChild)) }
                        }
                        TextField("Security code", text: $pickupCode)
                            .keyboardType(.numberPad)
                        Button("Confirm pickup") {
                            Task { notice = await perform(.pickup(selectedChild, pickupCode)) }
                        }
                    }
                    Text("Pickup is confirmed for a guardian, with the security code from check-in, when two adults are at the station.")
                        .font(.footnote)
                }
            }
            .refreshable { await onRefresh() }
            .navigationTitle(L10n.text(.connect))
        }
    }

    private func addToCalendar(_ event: SampleChurch.EventItem) {
        let store = EKEventStore()
        store.requestWriteOnlyAccessToEvents { granted, _ in
            guard granted else { return }
            let item = EKEvent(eventStore: store)
            item.title = event.title
            item.location = event.detail
            item.startDate = event.start ?? Date()
            item.endDate = event.end ?? (event.start ?? Date()).addingTimeInterval(90 * 60)
            item.calendar = store.defaultCalendarForNewEvents
            try? store.save(item, span: .thisEvent)
        }
    }
}
