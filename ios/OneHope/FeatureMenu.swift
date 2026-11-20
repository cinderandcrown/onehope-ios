import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeMore
import OneHopeWatch
import SwiftUI

/// The last tab. Every feature that is not already a tab is a row here.
struct FeatureMenu<Account: View>: View {
    let snapshot: ChurchSnapshot
    let onRefresh: () async -> Void
    let perform: (MemberAction) async -> String
    let account: Account
    @State private var videoId: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row("more-revival", title: "Revival Coffee", symbol: "cup.and.saucer") { CoffeeView() }
                }
                Section("Faith") {
                    row("more-know-jesus", title: "Know Jesus", symbol: "cross") {
                        KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
                    }
                    row("more-next-steps", title: "Next Steps", symbol: "arrow.right.circle") {
                        NextStepsScreen(snapshot: snapshot, perform: perform)
                    }
                }
                Section("Family") {
                    row("more-kids", title: "Children's Church", symbol: "figure.and.child.holdinghands") {
                        KidsScreen(snapshot: snapshot, perform: perform)
                    }
                    soon("more-household", title: "Household", symbol: "house")
                }
                Section("Connect") {
                    row("more-groups", title: "Groups", symbol: "person.3") {
                        GroupsScreen(snapshot: snapshot, perform: perform)
                    }
                    row("more-events", title: "Events", symbol: "calendar") {
                        EventsScreen(snapshot: snapshot)
                    }
                    row("more-serve", title: "Serve", symbol: "hands.sparkles") {
                        ServeScreen(snapshot: snapshot)
                    }
                }
                Section("Give and Shop") {
                    row("more-giving", title: "Giving", symbol: "heart") {
                        GiveView(snapshot: snapshot, onRefresh: onRefresh, perform: perform, embedded: true)
                    }
                    row("more-revival-shop", title: "Revival Coffee", symbol: "cup.and.saucer") { CoffeeView() }
                }
                Section("Watch and Media") {
                    row("more-sermons", title: "Sermons", symbol: "play.rectangle") {
                        WatchView(snapshot: snapshot, selected: $videoId, onRefresh: onRefresh, embedded: true)
                    }
                    soon("more-live", title: "Live stream", symbol: "dot.radiowaves.left.and.right")
                }
                Section("Church") {
                    row("more-visit", title: "Plan a Visit", symbol: "mappin.and.ellipse") {
                        PlanVisitView(snapshot: snapshot, perform: perform)
                    }
                    row("more-about", title: "About", symbol: "info.circle") {
                        AboutScreen(snapshot: snapshot)
                    }
                    row("more-social", title: "Social media", symbol: "bubble.left.and.bubble.right") {
                        SocialScreen(links: snapshot.social)
                    }
                }
                Section("Account") {
                    row("more-profile", title: "Profile", symbol: "person") {
                        account.navigationTitle(snapshot.signedIn ? "Profile" : "Sign in")
                    }
                    row("more-settings", title: "Settings", symbol: "gearshape") {
                        SettingsScreen(snapshot: snapshot)
                    }
                    row(
                        "more-sign-in",
                        title: snapshot.signedIn ? "Sign out" : "Sign in",
                        symbol: snapshot.signedIn ? "rectangle.portrait.and.arrow.right" : "person.badge.key"
                    ) {
                        account.navigationTitle(snapshot.signedIn ? "Account" : "Sign in")
                    }
                }
                if snapshot.isStaff {
                    Section("Staff") {
                        soon("more-staff", title: "Staff", symbol: "lock")
                    }
                }
            }
            .navigationTitle(L10n.text(.more))
            .refreshable { await onRefresh() }
        }
    }

    private func row<Destination: View>(
        _ identifier: String,
        title: String,
        symbol: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            Label(title, systemImage: symbol)
                .font(.body)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        }
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(title)
    }

    private func soon(_ identifier: String, title: String, symbol: String) -> some View {
        HStack {
            Label(title, systemImage: symbol).font(.body)
            Spacer()
            Text("Coming soon")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(BrandColor.sky)
                .clipShape(Capsule())
                .accessibilityIdentifier("\(identifier)-badge")
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(title), coming soon")
    }
}

private struct NextStepsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String

    var body: some View {
        List {
            Section("Salvation and baptism") {
                Text("The next step starts with Scripture, then a pastor follows up.")
                NavigationLink("Open Know Jesus") {
                    KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
                }
            }
            Section("Your path") {
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

private struct KidsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @State private var notice = ""

    var body: some View {
        List {
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

private struct GroupsScreen: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @State private var notice = ""

    var body: some View {
        List {
            if !notice.isEmpty {
                Text(notice)
            }
            if snapshot.groups.isEmpty {
                Text("Groups from the church will show here.")
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

private struct EventsScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        List {
            if snapshot.events.isEmpty {
                Text("Events from the church will show here.")
            }
            ForEach(snapshot.events) { event in
                VStack(alignment: .leading) {
                    Text(event.title).font(.headline)
                    Text(event.detail).font(.footnote)
                }
                .frame(minHeight: 44, alignment: .leading)
            }
        }
        .navigationTitle("Events")
        .accessibilityIdentifier("more-events-screen")
    }
}

private struct ServeScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        List {
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

private struct AboutScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        List {
            Text(snapshot.churchName).font(.title2)
            Text(snapshot.address)
            Text("Sundays at \(snapshot.visit.serviceTime)")
            Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).")
            if let maps = URL(string: snapshot.visit.mapsUrl) {
                Link("Open in Maps", destination: maps)
            }
        }
        .navigationTitle("About")
        .accessibilityIdentifier("more-about-screen")
    }
}

private struct SocialScreen: View {
    let links: [SocialLink]

    var body: some View {
        List {
            if links.isEmpty {
                Text("Social links will show here when the church publishes them.")
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

private struct SettingsScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        List {
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
