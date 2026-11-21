import OneHopeCore
import OneHopeDesign
import SwiftUI

/// The first thing on Home: a real photo of the church family, this Sunday's time, and two ways in.
struct HomeHero: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            PhotoOverlay("hero", minHeight: 300) {
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text("This Sunday").eyebrow(.white)
                    Text("Welcome home").font(.largeTitle.bold()).foregroundStyle(.white)
                    sundayLine
                }
            }
            // Side by side at normal sizes; stacked once the text is large, so the labels grow instead of squeezing.
            Group {
                if typeSize >= .xxLarge {
                    VStack(spacing: Space.md) { heroButtons }
                } else {
                    HStack(spacing: Space.md) { heroButtons }
                }
            }
            .padding(.top, Space.md)
        }
    }

    @ViewBuilder private var heroButtons: some View {
        NavigationLink {
            PlanVisitView(snapshot: snapshot, perform: perform)
        } label: {
            Text("Plan a Visit")
        }
        .buttonStyle(PrimaryButtonStyle())
        .accessibilityIdentifier("home-plan-visit")
        if let maps = URL(string: snapshot.visit.mapsUrl) {
            Link(destination: maps) { Text("Directions") }
                .buttonStyle(SecondaryButtonStyle())
        }
    }

    @ViewBuilder private var sundayLine: some View {
        if let date = parseISODate(snapshot.serviceISO) {
            Text(ChurchTime.serviceLine(date))
                .font(.headline)
                .foregroundStyle(.white)
                + Text(" · ").font(.headline).foregroundStyle(.white)
                + Text(date, style: .relative).font(.headline).foregroundStyle(.white)
        } else {
            Text(snapshot.visit.serviceTime).font(.headline).foregroundStyle(.white)
        }
        Text(snapshot.visit.arrival).font(.footnote).foregroundStyle(.white)
    }
}

/// Four round-the-corner shortcuts: the things people open the app for.
struct HomeShortcuts: View {
    let snapshot: ChurchSnapshot
    let perform: (MemberAction) async -> String
    let onOpenTab: (String) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Space.sm), count: typeSize >= .xxLarge ? 2 : 4), spacing: Space.sm) {
            shortcut("Give", symbol: "heart.fill", tint: BrandColor.terracottaDeep) { onOpenTab("give") }
            shortcut("Pray", symbol: "hands.sparkles.fill", tint: BrandColor.olive) { onOpenTab("prayer") }
            NavigationLink {
                CoffeeView()
            } label: {
                tile("Revival", symbol: "cup.and.saucer.fill", tint: BrandColor.terracottaDeep)
            }
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("home-shortcut-revival")
            NavigationLink {
                KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
            } label: {
                tile("Know Jesus", symbol: "cross.fill", tint: BrandColor.olive)
            }
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("home-know-jesus")
        }
    }

    private func shortcut(_ title: String, symbol: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) { tile(title, symbol: symbol, tint: tint) }
            .buttonStyle(PressableStyle())
            .accessibilityLabel(title)
    }

    private func tile(_ title: String, symbol: String, tint: Color) -> some View {
        VStack(spacing: Space.sm) {
            FeatureIcon(symbol, tint: tint, size: 44)
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(BrandColor.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .padding(.vertical, Space.md)
        .background(BrandColor.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous).stroke(BrandColor.ink.opacity(0.1), lineWidth: 1))
    }
}

/// Revival Coffee, front and center. Order-ahead is honest: the menu and hours today, ordering when the shop turns it on.
struct RevivalFeature: View {
    var body: some View {
        NavigationLink {
            CoffeeView()
        } label: {
            VStack(alignment: .leading, spacing: Space.md) {
                PhotoCard("revival", height: 200)
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text("Next door").eyebrow()
                    Text("Revival Coffee").font(.hopeTitle).foregroundStyle(BrandColor.ink)
                    Text("Coffee, community, and a welcome in our building.")
                        .font(.body)
                        .foregroundStyle(BrandColor.ink)
                }
                HStack(spacing: Space.md) {
                    Text("Menu and hours").frame(maxWidth: .infinity)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(BrandColor.onAccent)
                        .frame(minHeight: 44)
                        .background(BrandColor.terracottaDeep)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.button, style: .continuous))
                }
            }
            .churchCard()
        }
        .buttonStyle(PressableStyle())
        .accessibilityIdentifier("home-coffee")
        .accessibilityLabel("Revival Coffee. Menu, hours and directions.")
    }
}

/// The newest message large, then the next few as a row.
struct LatestMessages: View {
    let sermons: [SermonLine]
    let onWatch: (String) -> Void

    private var messages: [SermonLine] {
        sermons.filter { !$0.isShort }
    }

    var body: some View {
        if let latest = messages.first {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionHeader("Latest message", eyebrow: "Watch")
                Button {
                    onWatch(latest.id)
                } label: {
                    VStack(alignment: .leading, spacing: Space.sm) {
                        VideoThumbnail(sermon: latest, height: 200, highRes: true)
                        Text(latest.title).font(.headline).foregroundStyle(BrandColor.ink).multilineTextAlignment(.leading)
                        if !latest.speaker.isEmpty || !latest.passage.isEmpty {
                            Text([latest.speaker, latest.passage].filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.subheadline)
                                .foregroundStyle(BrandColor.ink)
                        }
                        if let published = latest.published {
                            Text(ChurchTime.dayLine(published)).font(.footnote).foregroundStyle(BrandColor.ink)
                        }
                    }
                    .churchCard()
                }
                .buttonStyle(PressableStyle())
                .accessibilityIdentifier("home-latest-message")
                more
            }
        }
    }

    @ViewBuilder private var more: some View {
        let rest = Array(messages.dropFirst().prefix(6))
        if !rest.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: Space.md) {
                    ForEach(rest) { sermon in
                        Button { onWatch(sermon.id) } label: {
                            VStack(alignment: .leading, spacing: Space.xs) {
                                VideoThumbnail(sermon: sermon, height: 100).frame(width: 180)
                                Text(sermon.title).font(.footnote.weight(.semibold)).foregroundStyle(BrandColor.ink)
                                    .multilineTextAlignment(.leading).frame(width: 180, alignment: .leading)
                            }
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
            .scrollClipDisabled()
        }
    }
}

/// Kids, Small Groups, Growth Track and more, each with the picture from the church's own site.
struct MinistriesRow: View {
    let ministries: [MinistryCard]

    var body: some View {
        if !ministries.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionHeader("Find your place", eyebrow: "Ministries")
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: Space.md) {
                        ForEach(ministries) { ministry in
                            card(ministry)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollClipDisabled()
            }
        }
    }

    @ViewBuilder private func card(_ ministry: MinistryCard) -> some View {
        let tile = PhotoTile(url: ministry.photoURL, title: ministry.title, detail: ministry.blurb, width: 260, height: 200)
        if let link = ministry.link {
            Link(destination: link) { tile }.buttonStyle(PressableStyle())
        } else {
            tile
        }
    }
}

/// A doorway to the Our Team screen, led by the pastors' photo.
struct TeamTeaser: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        if !snapshot.media.team.isEmpty {
            NavigationLink {
                TeamView(snapshot: snapshot)
            } label: {
                HStack(spacing: Space.md) {
                    RemoteImage(snapshot.images.url(named: "pastors") ?? snapshot.media.team.first?.photoURL)
                        .frame(width: 84, height: 84)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
                    VStack(alignment: .leading, spacing: Space.xs) {
                        Text("Our team").eyebrow()
                        Text("Meet our pastors").font(.hopeHeadline).foregroundStyle(BrandColor.ink)
                        Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).")
                            .font(.footnote)
                            .foregroundStyle(BrandColor.ink)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").foregroundStyle(BrandColor.ink.opacity(0.5)).accessibilityHidden(true)
                }
                .churchCard()
            }
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("home-team")
        }
    }
}
