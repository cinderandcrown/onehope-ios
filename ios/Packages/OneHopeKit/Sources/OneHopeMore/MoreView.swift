import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct MoreView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let onSignOut: () -> Void
    private let onPrivacy: (Bool, Bool, Bool) async -> Void
    private let onDelete: (String) async -> String
    @State private var emailPublic: Bool
    @State private var phonePublic: Bool
    @State private var listed: Bool
    @State private var password = ""
    @State private var notice = ""
    @State private var confirmDelete = false

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        onSignOut: @escaping () -> Void = {},
        onPrivacy: @escaping (Bool, Bool, Bool) async -> Void = { _, _, _ in },
        onDelete: @escaping (String) async -> String = { _ in "" }
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.onSignOut = onSignOut
        self.onPrivacy = onPrivacy
        self.onDelete = onDelete
        _emailPublic = State(initialValue: snapshot.emailPublic)
        _phonePublic = State(initialValue: snapshot.phonePublic)
        _listed = State(initialValue: snapshot.listedInDirectory)
    }

    /// Pushed from Connect, so it has no navigation stack of its own.
    public var body: some View {
        List {
            if !notice.isEmpty {
                Text(notice)
            }
            Section("Account") {
                Text(snapshot.accountName)
                Text(snapshot.accountEmail).font(.footnote)
                Button("Sign out", role: .destructive, action: onSignOut)
                    .accessibilityIdentifier("sign-out")
                SecureField("Password to delete", text: $password)
                Button("Delete my account", role: .destructive) {
                    confirmDelete = true
                }
            }
            Section("Directory") {
                Toggle("Show my email", isOn: $emailPublic)
                Toggle("Show my phone", isOn: $phonePublic)
                Toggle("List me in the directory", isOn: $listed)
                Button("Save privacy") {
                    Task { await onPrivacy(emailPublic, phonePublic, listed) }
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
        .navigationTitle("Account")
        .alert("Delete your account?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) {
                Task { notice = await onDelete(password) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes your prayers, registrations, and children.")
        }
        .onChange(of: snapshot.emailPublic) { _, value in emailPublic = value }
        .onChange(of: snapshot.phonePublic) { _, value in phonePublic = value }
        .onChange(of: snapshot.listedInDirectory) { _, value in listed = value }
    }
}
