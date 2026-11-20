import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Prayer requests and the public prayer list. Guests can read. Sending requires an account.
public struct PrayerView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    @State private var serve = ""
    @State private var prayer = ""
    @State private var contact = false
    @State private var notice = ""
    @State private var reporting: String?

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
                Section {
                    Text("Prayer requests")
                        .font(.headline)
                        .accessibilityIdentifier("prayer-board")
                    if snapshot.prayers.isEmpty {
                        Text("No prayer requests yet.")
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
                            if !item.mine, item.approved, snapshot.signedIn {
                                Button("Report this request", role: .destructive) { reporting = item.id }
                                    .font(.footnote)
                                    .frame(minHeight: 44)
                                    .accessibilityHint("Takes it off the wall until a pastor reviews it")
                                    .accessibilityIdentifier("prayer-report-\(item.id)")
                            }
                        }
                    }
                }
                if snapshot.signedIn {
                    requestForm
                } else {
                    Section {
                        Text("Sign in from the Connect tab to send a prayer request.")
                    }
                }
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
            }
            .refreshable { await onRefresh() }
            .announce(notice)
            .confirmationDialog("Report this prayer request?", isPresented: Binding(get: { reporting != nil }, set: {
                if !$0 {
                    reporting = nil
                }
            }), titleVisibility: .visible) {
                Button("Report and take it down", role: .destructive) {
                    guard let id = reporting else { return }
                    reporting = nil
                    Task { notice = await perform(.reportPrayer(id)) }
                }
                Button("Cancel", role: .cancel) { reporting = nil }
            } message: {
                Text("It is removed from the wall right away. A pastor will review it.")
            }
            .navigationTitle(L10n.text(.prayer))
        }
    }

    /// The same fields as the church's Prayer Request form on Church Center.
    private var requestForm: some View {
        Section("Prayer request") {
            LabeledField("How can we serve you?") {
                TextField("How can we serve you?", text: $serve)
                    .accessibilityIdentifier("prayer-serve")
            }
            Picker("Please check a box below", selection: $contact) {
                Text("Just pray for me").tag(false)
                Text("Please contact me").tag(true)
            }
            LabeledField("Please describe your prayer need", hint: "Pastors and the care team will read this.") {
                TextField("Please describe your prayer need", text: $prayer, axis: .vertical)
                    .accessibilityIdentifier("prayer-need")
            }
            Button("Send prayer request") {
                let serveText = serve.trimmingCharacters(in: .whitespacesAndNewlines)
                let body = prayer.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !serveText.isEmpty, !body.isEmpty else {
                    notice = "Tell us how we can serve you and describe your prayer need."
                    return
                }
                Task {
                    let reply = await perform(.prayer(serve: serveText, contact: contact, body: body))
                    notice = reply
                    if reply == "Your prayer request was sent to the pastors." {
                        serve = ""
                        prayer = ""
                        contact = false
                    }
                }
            }
        }
    }
}
