import EventKit
import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Groups, events, Toolkit, Recovery, and care. Know Jesus is linked from here. Prayer and Give are their own tabs.
/// `account` is the sign-in screen for a guest, or account and directory settings for a member.
public struct ConnectView<Account: View, KnowJesus: View>: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    private let account: Account
    private let knowJesus: KnowJesus
    @State private var notice = ""

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" },
        @ViewBuilder knowJesus: () -> KnowJesus,
        @ViewBuilder account: () -> Account
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
        self.knowJesus = knowJesus()
        self.account = account()
    }

    public var body: some View {
        NavigationStack {
            HopeList {
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
                Section {
                    NavigationLink {
                        account
                    } label: {
                        Text(snapshot.signedIn ? "Account and directory" : "Sign in or create an account")
                    }
                    .accessibilityIdentifier("connect-account")
                    NavigationLink {
                        knowJesus
                    } label: {
                        Text(L10n.text(.knowJesus))
                    }
                    .accessibilityIdentifier("connect-know-jesus")
                } footer: {
                    if !snapshot.signedIn {
                        Text("Sign in to join groups and check in kids. Prayer has its own tab.")
                    }
                }
                if snapshot.signedIn {
                    MemberSections(snapshot: snapshot, perform: perform, notice: $notice)
                }
                if let growth = snapshot.growth {
                    GrowSection(growth: growth, signedIn: snapshot.signedIn, perform: perform)
                }
                eventsSection
                ForEach(categories, id: \.self) { category in
                    TitledSection(category) {
                        ForEach(snapshot.groups.filter { $0.category == category }) { group in
                            groupRow(group)
                        }
                    }
                }
            }
            .refreshable { await onRefresh() }
            .navigationTitle(L10n.text(.connect))
        }
    }

    private var categories: [String] {
        snapshot.groups.reduce(into: [String]()) { list, group in
            if !list.contains(group.category) {
                list.append(group.category)
            }
        }
    }

    private var eventsSection: some View {
        TitledSection("Events") {
            ForEach(snapshot.events) { event in
                VStack(alignment: .leading, spacing: 8) {
                    Text(event.title).font(.headline)
                    if let start = event.start {
                        Text(ChurchTime.eventLine(start)).font(.footnote)
                    }
                    Text(event.detail).font(.footnote)
                    if let url = event.url {
                        Link("Register on Church Center", destination: url)
                    } else if snapshot.signedIn {
                        Button(event.registered ? "Registered" : "Register") {
                            Task { notice = await perform(.register(event.id)) }
                        }
                        .disabled(event.registered)
                    }
                    Button("Add to calendar") {
                        addToCalendar(event)
                    }
                }
                .buttonStyle(.borderless)
            }
        }
    }

    private func groupRow(_ group: GroupLine) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(group.name).font(.headline)
            if !group.schedule.isEmpty {
                Text(group.schedule).font(.subheadline)
            }
            Text([group.area, group.summary].filter { !$0.isEmpty }.joined(separator: " · ")).font(.footnote)
            if !group.leaders.isEmpty {
                Text("Led by \(group.leaders.joined(separator: ", "))").font(.footnote)
            }
            if snapshot.signedIn, group.joinsInApp {
                Button(group.joined ? "Joined" : "Join") {
                    Task { notice = await perform(.join(group.id)) }
                }
                .disabled(group.joined)
            }
            if let url = group.url {
                Link(group.joinsInApp ? "See it on Church Center" : "Request to join on Church Center", destination: url)
            }
        }
        .buttonStyle(.borderless)
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

/// Next steps, serving, group note, and kids check-in. Prayer lives on its own tab.
private struct MemberSections: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @Binding var notice: String
    @State private var message = ""

    var body: some View {
        TitledSection("Next steps") {
            ForEach(snapshot.pathway) { step in
                VStack(alignment: .leading) {
                    Text(step.title)
                    Text(Self.label(step.status)).font(.footnote)
                }
            }
        }
        TitledSection("Serving") {
            if snapshot.serving.isEmpty {
                Text("No serving assignment yet. Ask about a team at Growth Track.")
            }
            ForEach(snapshot.serving) { item in
                VStack(alignment: .leading) {
                    Text(item.position)
                    Text(item.status).font(.footnote)
                }
            }
        }
        groupNote
        KidsSection(kids: snapshot.kids, perform: perform, notice: $notice)
    }

    private var groupNote: some View {
        TitledSection("Group note") {
            if let group = snapshot.groups.first(where: \.joined) {
                TextField("Message your group", text: $message)
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
            } else {
                Text("Join a group before sending a note.")
            }
        }
    }

    private static func label(_ status: String) -> String {
        switch status {
        case "done": "Done"
        case "requested": "Requested. A pastor will reach out."
        case "in-progress": "In progress"
        default: "Not started"
        }
    }
}
