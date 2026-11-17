import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct MoreView: View {
    private let snapshot: ChurchSnapshot
    @AppStorage("onehope.notifications") private var notifications = true

    public init(snapshot: ChurchSnapshot) {
        self.snapshot = snapshot
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    Text(snapshot.accountName)
                    Text(snapshot.accountEmail).font(.footnote)
                    if !snapshot.fromAPI {
                        SampleBadge()
                    }
                }
                Section("Directory") {
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
                Section("Notifications") {
                    Toggle("Sunday reminder", isOn: $notifications)
                }
            }
            .navigationTitle(L10n.text(.more))
        }
    }
}
