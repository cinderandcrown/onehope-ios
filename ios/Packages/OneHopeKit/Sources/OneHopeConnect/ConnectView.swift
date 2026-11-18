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
                    TextField("Message your group", text: $message)
                    if let group = snapshot.groups.first(where: \.joined) ?? snapshot.groups.first {
                        Button("Send to \(group.name)") {
                            Task {
                                notice = await perform(.message(group.id, message))
                                message = ""
                            }
                        }
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
                        Task {
                            notice = await perform(.prayer(prayer))
                            prayer = ""
                        }
                    }
                    ForEach(snapshot.prayers) { prayer in
                        Text(prayer.body)
                    }
                }
                Section("Kids check-in") {
                    TextField("Child's name", text: $childName)
                    Button("Add child") {
                        Task { notice = await perform(.addChild(childName, "Sunday")) }
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
            item.startDate = Date()
            item.endDate = Date().addingTimeInterval(90 * 60)
            item.calendar = store.defaultCalendarForNewEvents
            try? store.save(item, span: .thisEvent)
        }
    }
}
