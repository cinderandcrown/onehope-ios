import EventKit
import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Groups and events from Church Center for everyone; next steps, prayer, and kids check-in for members.
/// `account` is the sign-in screen for a guest, or account and directory settings for a member.
public struct ConnectView<Account: View>: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    private let account: Account
    @State private var notice = ""

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" },
        @ViewBuilder account: () -> Account
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
        self.account = account()
    }

    public var body: some View {
        NavigationStack {
            List {
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
                } footer: {
                    if !snapshot.signedIn {
                        Text("Sign in to join groups, send a prayer request, and check in kids.")
                    }
                }
                if snapshot.signedIn {
                    MemberSections(snapshot: snapshot, perform: perform, notice: $notice)
                }
                eventsSection
                ForEach(categories, id: \.self) { category in
                    Section(category) {
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
        Section("Events") {
            ForEach(snapshot.events) { event in
                VStack(alignment: .leading, spacing: 8) {
                    Text(event.title).font(.headline)
                    if let start = event.start {
                        Text(start.formatted(date: .complete, time: .shortened)).font(.footnote)
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

/// Next steps, serving, group note, prayer request, and kids check-in.
private struct MemberSections: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @Binding var notice: String
    @State private var serve = ""
    @State private var prayer = ""
    @State private var contact = false
    @State private var message = ""
    @State private var childName = ""
    @State private var classroom = "Preschool"
    @State private var pickupCode = ""
    @State private var selectedChild = ""

    var body: some View {
        Section("Next steps") {
            ForEach(snapshot.pathway) { step in
                VStack(alignment: .leading) {
                    Text(step.title)
                    Text(Self.label(step.status)).font(.footnote)
                }
            }
        }
        Section("Serving") {
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
        prayerRequest
        kids
    }

    private var groupNote: some View {
        Section("Group note") {
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

    /// The same fields as the church's Prayer Request form on Church Center.
    private var prayerRequest: some View {
        Section("Prayer request") {
            TextField("How can we serve you?", text: $serve)
                .accessibilityIdentifier("prayer-serve")
            Picker("Please check a box below", selection: $contact) {
                Text("Just pray for me").tag(false)
                Text("Please contact me").tag(true)
            }
            TextField("Please describe your prayer need", text: $prayer, axis: .vertical)
                .accessibilityIdentifier("prayer-need")
            Button("Send prayer request") {
                let serveText = serve.trimmingCharacters(in: .whitespacesAndNewlines)
                let body = prayer.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !serveText.isEmpty, !body.isEmpty else {
                    notice = "Tell us how we can serve you and describe your prayer need."
                    return
                }
                Task {
                    notice = await perform(.prayer(serve: serveText, contact: contact, body: body))
                    serve = ""
                    prayer = ""
                    contact = false
                }
            }
            ForEach(snapshot.prayers) { item in
                VStack(alignment: .leading) {
                    if item.mine, !item.serve.isEmpty {
                        Text(item.serve).font(.headline)
                    }
                    Text(item.body)
                    if item.mine, item.contactRequested {
                        Text("A pastor will contact you.").font(.footnote)
                    }
                    if item.mine, !item.approved {
                        Text("Waiting for pastor approval").font(.footnote)
                    }
                }
            }
        }
    }

    private var kids: some View {
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

    private static func label(_ status: String) -> String {
        switch status {
        case "done": "Done"
        case "requested": "Requested. A pastor will reach out."
        case "in-progress": "In progress"
        default: "Not started"
        }
    }
}
