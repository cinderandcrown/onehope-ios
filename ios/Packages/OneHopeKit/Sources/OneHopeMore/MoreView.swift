import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct MoreView: View {
    @AppStorage("onehope.notifications") private var notifications = true

    public init() {}

    private var directory: [DirectoryPerson] {
        DirectoryProjection.project(viewerId: SampleChurch.viewer.id, people: SampleChurch.directory)
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    Text(SampleChurch.viewer.displayName)
                    Text(SampleChurch.viewer.email).font(.footnote)
                    SampleBadge()
                }
                Section("Household") {
                    Text("Avery Sample and Blake Sample")
                    Text("You see your own household. Another household stays hidden.").font(.footnote)
                }
                Section("Directory") {
                    ForEach(directory) { person in
                        VStack(alignment: .leading) {
                            Text(person.displayName)
                            Text(person.email.isEmpty ? "Email hidden" : person.email).font(.footnote)
                            Text(person.phone.isEmpty ? "Phone hidden" : person.phone).font(.footnote)
                        }
                    }
                }
                Section("About") {
                    Text(SampleChurch.name)
                    Text(SampleChurch.address)
                    Text("Lead pastors \(SampleChurch.pastors.joined(separator: " and ")).")
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
