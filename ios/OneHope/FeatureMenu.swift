import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeMore
import OneHopeWatch
import SwiftUI

/// What a menu row looks like: an icon, a title, and one line saying what is inside.
struct MenuLabel {
    let title: String
    let symbol: String
    let detail: String
    var tint: Color = BrandColor.terracottaDeep
}

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
                    header
                    revivalBanner
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: Space.sm, leading: 0, bottom: Space.sm, trailing: 0))
                .listRowSeparator(.hidden)
                faith
                family
                connect
                giveAndShop
                watch
                church
                accountSection
                LegalLinks()
                if snapshot.isStaff {
                    MenuSection("Staff") {
                        soon("more-staff", MenuLabel(title: "Staff", symbol: "lock", detail: "Tools for church staff"))
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.more))
            .refreshable { await onRefresh() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(snapshot.churchName).font(.hopeDisplay).foregroundStyle(BrandColor.ink)
            Text("Sundays \(snapshot.visit.serviceTime.replacingOccurrences(of: "Sundays at ", with: "")) · \(snapshot.visit.address)")
                .font(.footnote)
                .foregroundStyle(BrandColor.ink.opacity(0.8))
        }
        .padding(.horizontal, Space.xs)
    }

    private var revivalBanner: some View {
        NavigationLink {
            CoffeeView()
        } label: {
            PhotoOverlay("revival", minHeight: 150) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Revival Coffee").font(.title2.bold()).foregroundStyle(.white)
                    Text("Menu, hours, and order ahead soon").font(.footnote).foregroundStyle(.white)
                }
            }
            .accessibilityIdentifier("more-revival")
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Revival Coffee")
    }

    private var faith: some View {
        MenuSection("Faith") {
            row("more-know-jesus", MenuLabel(title: "Know Jesus", symbol: "cross", detail: "The good news, from the Bible", tint: BrandColor.olive)) {
                KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
            }
            row("more-next-steps", MenuLabel(title: "Next Steps", symbol: "arrow.right.circle", detail: "Baptism and your path", tint: BrandColor.olive)) {
                NextStepsScreen(snapshot: snapshot, perform: perform)
            }
        }
    }

    private var family: some View {
        MenuSection("Family") {
            row("more-kids", MenuLabel(title: "Children's Church", symbol: "figure.and.child.holdinghands", detail: "Check in and pick up")) {
                KidsScreen(snapshot: snapshot, perform: perform)
            }
            soon("more-household", MenuLabel(title: "Household", symbol: "house", detail: "Your family in one place"))
        }
    }

    private var connect: some View {
        MenuSection("Connect") {
            row("more-groups", MenuLabel(title: "Groups", symbol: "person.3", detail: "Find your people", tint: BrandColor.olive)) {
                GroupsScreen(snapshot: snapshot, perform: perform)
            }
            row("more-events", MenuLabel(title: "Events", symbol: "calendar", detail: "What is coming up")) {
                EventsScreen(snapshot: snapshot)
            }
            row("more-serve", MenuLabel(title: "Serve", symbol: "hands.sparkles", detail: "Use your gifts", tint: BrandColor.olive)) {
                ServeScreen(snapshot: snapshot)
            }
        }
    }

    private var giveAndShop: some View {
        MenuSection("Give and Shop") {
            row("more-giving", MenuLabel(title: "Giving", symbol: "heart", detail: "Online, text, or by mail")) {
                GiveView(snapshot: snapshot, onRefresh: onRefresh, perform: perform, embedded: true)
            }
            row("more-revival-shop", MenuLabel(title: "Revival Coffee", symbol: "cup.and.saucer", detail: "Menu and hours")) { CoffeeView() }
        }
    }

    private var watch: some View {
        MenuSection("Watch and Media") {
            row("more-sermons", MenuLabel(title: "Sermons", symbol: "play.rectangle", detail: "Messages and shorts")) {
                WatchView(snapshot: snapshot, selected: $videoId, onRefresh: onRefresh, embedded: true)
            }
            soon("more-live", MenuLabel(title: "Live stream", symbol: "dot.radiowaves.left.and.right", detail: "Watch Sunday live"))
        }
    }

    private var church: some View {
        MenuSection("Church") {
            row("more-visit", MenuLabel(title: "Plan a Visit", symbol: "mappin.and.ellipse", detail: "What to expect on Sunday")) {
                PlanVisitView(snapshot: snapshot, perform: perform)
            }
            if !snapshot.media.team.isEmpty {
                row("more-team", MenuLabel(title: "Our Team", symbol: "person.2", detail: "Pastors and staff", tint: BrandColor.olive)) {
                    TeamView(snapshot: snapshot)
                }
            }
            row("more-about", MenuLabel(title: "About", symbol: "info.circle", detail: "Who we are", tint: BrandColor.olive)) {
                AboutScreen(snapshot: snapshot)
            }
            row("more-social", MenuLabel(title: "Social media", symbol: "bubble.left.and.bubble.right", detail: "Follow along")) {
                SocialScreen(links: snapshot.social)
            }
            row("more-credits", MenuLabel(title: "About & Credits", symbol: "heart.text.square", detail: "Photos, scripture, open source", tint: BrandColor.olive)) {
                CreditsScreen(credits: snapshot.media.credits)
            }
        }
    }

    private var accountSection: some View {
        MenuSection("Account") {
            row("more-profile", MenuLabel(title: "Profile", symbol: "person", detail: snapshot.signedIn ? snapshot.accountName : "Sign in to see yours", tint: BrandColor.olive)) {
                account.navigationTitle(snapshot.signedIn ? "Profile" : "Sign in")
            }
            row("more-settings", MenuLabel(title: "Settings", symbol: "gearshape", detail: "Privacy and reminders", tint: BrandColor.olive)) {
                SettingsScreen(snapshot: snapshot)
            }
            let signedIn = snapshot.signedIn
            row(
                "more-sign-in",
                MenuLabel(
                    title: signedIn ? "Sign out" : "Sign in",
                    symbol: signedIn ? "rectangle.portrait.and.arrow.right" : "person.badge.key",
                    detail: signedIn ? "Leave this account" : "Members get prayer, kids check-in, and more",
                    tint: BrandColor.olive
                )
            ) {
                account.navigationTitle(signedIn ? "Account" : "Sign in")
            }
        }
    }

    private func row(
        _ identifier: String,
        _ label: MenuLabel,
        @ViewBuilder destination: () -> some View
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            menuRow(label)
                .accessibilityIdentifier(identifier)
        }
        .accessibilityLabel(label.title)
        .listRowBackground(BrandColor.card)
    }

    private func menuRow(_ label: MenuLabel) -> some View {
        HStack(spacing: Space.md) {
            FeatureIcon(label.symbol, tint: label.tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(label.title).font(.body.weight(.medium))
                Text(label.detail).font(.footnote).foregroundStyle(BrandColor.ink.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
    }

    private func soon(_ identifier: String, _ label: MenuLabel) -> some View {
        HStack {
            menuRow(label)
            Text("Coming soon")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(BrandColor.sky)
                .clipShape(Capsule())
                .accessibilityIdentifier("\(identifier)-badge")
        }
        .frame(minHeight: 48)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel("\(label.title), coming soon")
        .listRowBackground(BrandColor.card)
    }
}

/// A titled group of rows with a header dark enough to read on the paper background.
private struct MenuSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        Section {
            content
        } header: {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(BrandColor.ink.opacity(0.8))
                .accessibilityAddTraits(.isHeader)
        }
    }
}
