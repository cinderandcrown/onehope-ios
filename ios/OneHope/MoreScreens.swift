import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeHome
import SwiftUI

struct NextStepsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String

    var body: some View {
        HopeList {
            TitledSection("Salvation and baptism") {
                Text("The next step starts with Scripture, then a pastor follows up.")
                NavigationLink("Open Know Jesus") {
                    KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
                }
            }
            TitledSection("Your path") {
                if snapshot.pathway.isEmpty {
                    Text(snapshot.signedIn ? "No steps are on your path yet." : "Sign in to see the steps saved to your account.")
                }
                ForEach(snapshot.pathway) { step in
                    VStack(alignment: .leading) {
                        Text(step.title)
                        Text(step.status).font(.footnote)
                    }
                }
            }
        }
        .navigationTitle("Next Steps")
        .accessibilityIdentifier("more-next-steps-screen")
    }
}

struct KidsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @State private var notice = ""

    var body: some View {
        HopeList {
            if !snapshot.signedIn {
                Text("Sign in before check-in so the code is saved to your household.")
            }
            if !notice.isEmpty {
                Text(notice)
            }
            KidsSection(kids: snapshot.kids, perform: perform, notice: $notice)
        }
        .navigationTitle("Children's Church")
        .accessibilityIdentifier("more-kids-screen")
    }
}

struct GroupsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @State private var notice = ""

    var body: some View {
        HopeList {
            if !notice.isEmpty {
                Text(notice)
            }
            if snapshot.groups.isEmpty {
                EmptyState(symbol: "person.3", title: "No groups yet", message: "Groups from the church will show here.")
            }
            ForEach(snapshot.groups) { group in
                VStack(alignment: .leading, spacing: 6) {
                    Text(group.name).font(.headline)
                    Text(group.summary).font(.footnote)
                    if snapshot.signedIn, group.joinsInApp {
                        Button(group.joined ? "Joined" : "Join") {
                            Task { notice = await perform(.join(group.id)) }
                        }
                        .disabled(group.joined)
                    }
                }
                .frame(minHeight: 44, alignment: .leading)
            }
        }
        .navigationTitle("Groups")
        .accessibilityIdentifier("more-groups-screen")
    }
}

struct EventsScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        HopeList {
            if snapshot.events.isEmpty {
                EmptyState(symbol: "calendar", title: "No events yet", message: "Events from the church will show here.")
            }
            ForEach(snapshot.events) { event in
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text(event.title).font(.headline)
                    if let start = event.start {
                        Text(ChurchTime.eventLine(start)).font(.subheadline.weight(.semibold)).foregroundStyle(BrandColor.terracottaDeep)
                    }
                    Text(event.detail).font(.footnote)
                    if let url = event.url {
                        Link("Details and registration", destination: url).font(.footnote.weight(.semibold))
                    }
                }
                .padding(.vertical, Space.xs)
                .frame(minHeight: 44, alignment: .leading)
            }
        }
        .navigationTitle("Events")
        .accessibilityIdentifier("more-events-screen")
    }
}

struct ServeScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        HopeList {
            if snapshot.serving.isEmpty {
                Text(snapshot.signedIn ? "No serving assignment yet." : "Sign in to see where you serve.")
            }
            ForEach(snapshot.serving) { item in
                VStack(alignment: .leading) {
                    Text(item.position).font(.headline)
                    Text(item.status).font(.footnote)
                }
            }
        }
        .navigationTitle("Serve")
        .accessibilityIdentifier("more-serve-screen")
    }
}

struct SocialScreen: View {
    let links: [SocialLink]

    var body: some View {
        HopeList {
            if links.isEmpty {
                EmptyState(symbol: "bubble.left.and.bubble.right", title: "No links yet", message: "Social links will show here when the church publishes them.")
            }
            ForEach(links) { link in
                if let url = URL(string: link.url) {
                    Link(destination: url) {
                        Text(link.name).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                    .accessibilityLabel("Open \(link.name)")
                }
            }
        }
        .navigationTitle("Social media")
        .accessibilityIdentifier("more-social-screen")
    }
}

struct SettingsScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        HopeList {
            if snapshot.signedIn {
                Text("Directory choices are saved from Profile.")
                Text(snapshot.emailPublic ? "Email is visible." : "Email is hidden.")
                Text(snapshot.phonePublic ? "Phone is visible." : "Phone is hidden.")
                Text(snapshot.listedInDirectory ? "You are listed." : "You are not listed.")
            } else {
                Text("Sign in to change what the directory shows.")
            }
        }
        .navigationTitle("Settings")
        .accessibilityIdentifier("more-settings-screen")
    }
}
