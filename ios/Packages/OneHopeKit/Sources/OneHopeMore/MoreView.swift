import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct MoreView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let onSignOut: () -> Void
    private let onPrivacy: (Bool, Bool) async -> Void
    @State private var emailPublic = false
    @State private var phonePublic = false

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        onSignOut: @escaping () -> Void = {},
        onPrivacy: @escaping (Bool, Bool) async -> Void = { _, _ in }
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.onSignOut = onSignOut
        self.onPrivacy = onPrivacy
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    Text(snapshot.accountName)
                    Text(snapshot.accountEmail).font(.footnote)
                    Button("Sign out", role: .destructive, action: onSignOut)
                        .accessibilityIdentifier("sign-out")
                }
                Section("Directory") {
                    Toggle("Show my email", isOn: $emailPublic)
                    Toggle("Show my phone", isOn: $phonePublic)
                    Button("Save privacy") {
                        Task { await onPrivacy(emailPublic, phonePublic) }
                    }
                    if snapshot.directory.isEmpty {
                        Text("People appear here when they choose to be listed.")
                    }
                    ForEach(snapshot.directory) { person in
                        VStack(alignment: .leading) {
                            Text(person.displayName)
                            Text(person.email.isEmpty ? "Email hidden" : person.email).font(.footnote)
                            Text(person.phone.isEmpty ? "Phone hidden" : person.phone).font(.footnote)
                        }
                    }
                }
                Section("About") {
                    Text(snapshot.churchName)
                    Text(snapshot.address)
                    Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).")
                    if let url = SampleChurch.mapsURL {
                        Link("Open in Maps", destination: url)
                    }
                }
            }
            .refreshable { await onRefresh() }
            .navigationTitle(L10n.text(.more))
        }
    }
}
