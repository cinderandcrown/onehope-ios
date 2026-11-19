import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct HomeView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    private let onWatch: (String) -> Void

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" },
        onWatch: @escaping (String) -> Void = { _ in }
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
        self.onWatch = onWatch
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Wordmark()
                    Text(DayGreeting.line(name: snapshot.signedIn ? snapshot.accountName : ""))
                        .font(.hopeDisplay)
                        .foregroundStyle(BrandColor.ink)
                    HeroPhoto("hero", title: "Welcome home", subtitle: snapshot.visit.serviceTime)
                    if !snapshot.offlineNote.isEmpty {
                        Text(snapshot.offlineNote).font(.footnote)
                    }
                    callsToAction
                    latestMessage
                    thisSunday
                    InviteCard(invite: snapshot.invite)
                    DailyWordCard(snapshot: snapshot, perform: perform)
                    NavigationLink {
                        PlanVisitView(snapshot: snapshot, perform: perform)
                    } label: {
                        PictureLink(photo: "about", title: "Plan a Visit", detail: snapshot.visit.arrival)
                    }
                    .buttonStyle(.plain)
                    NavigationLink {
                        KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
                    } label: {
                        PictureLink(photo: "video", title: "Know Jesus", detail: "The good news, straight from the Bible.")
                    }
                    .buttonStyle(.plain)
                    ForEach(snapshot.announcements) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.title).font(.headline)
                            Text(item.body)
                        }
                        .churchCard()
                    }
                    Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).").font(.footnote)
                    FollowAlong(links: snapshot.social)
                    ReminderToggle()
                    NavigationLink {
                        CoffeeView()
                    } label: {
                        Text("Revival Coffee").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("home-coffee")
                }
                .padding()
            }
            .refreshable { await onRefresh() }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.home))
        }
    }

    private var callsToAction: some View {
        HStack(spacing: 12) {
            NavigationLink {
                PlanVisitView(snapshot: snapshot, perform: perform)
            } label: {
                Text("Plan a Visit").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("home-plan-visit")
            NavigationLink {
                KnowJesusView(snapshot: snapshot, perform: perform, embedded: true)
            } label: {
                Text("Know Jesus").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("home-know-jesus")
        }
    }

    @ViewBuilder private var latestMessage: some View {
        if let latest = snapshot.sermons.first(where: { !$0.isShort }) {
            Button {
                onWatch(latest.id)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Latest message").font(.caption.weight(.semibold)).foregroundStyle(BrandColor.olive)
                    VideoThumbnail(sermon: latest, height: 190)
                    Text(latest.title).font(.headline).foregroundStyle(BrandColor.ink).multilineTextAlignment(.leading)
                    if let published = latest.published {
                        Text(published.formatted(date: .abbreviated, time: .omitted)).font(.footnote)
                    }
                }
                .churchCard()
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("home-latest-message")
        }
    }

    private var thisSunday: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("This Sunday").font(.caption.weight(.semibold)).foregroundStyle(BrandColor.olive)
            if let date = parseISODate(snapshot.serviceISO) {
                Text(date.formatted(.dateTime.weekday(.wide).month().day().hour().minute())).font(.title3.bold())
                Text(date, style: .relative).font(.footnote).accessibilityLabel("Time until the Sunday gathering")
            } else {
                Text(snapshot.visit.serviceTime).font(.title3.bold())
            }
            Text(snapshot.visit.arrival)
            Text(snapshot.visit.address).font(.footnote)
            if let maps = URL(string: snapshot.visit.mapsUrl) {
                Link("Directions", destination: maps)
            }
        }
        .churchCard()
    }
}

private struct ReminderToggle: View {
    @AppStorage("onehope.reminder") private var enabled = false

    var body: some View {
        Toggle("Remind me at 7:30", isOn: $enabled)
            .onChange(of: enabled) { _, value in
                Task {
                    let on = await DailyReminder.setEnabled(value)
                    if value, !on {
                        enabled = false
                    }
                }
            }
        Text("This stays on this phone. It is not a push from the church.").font(.footnote)
    }
}

/// A photo card that opens another screen.
struct PictureLink: View {
    let photo: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            PhotoCard(photo, height: 140)
            Text(title).font(.title3.bold()).foregroundStyle(BrandColor.ink)
            Text(detail).font(.footnote).foregroundStyle(BrandColor.ink)
        }
        .churchCard()
    }
}

/// A YouTube thumbnail, or a bundled photo while it loads or when there is none.
public struct VideoThumbnail: View {
    private let sermon: SermonLine
    private let height: CGFloat

    public init(sermon: SermonLine, height: CGFloat) {
        self.sermon = sermon
        self.height = height
    }

    public var body: some View {
        AsyncImage(url: sermon.thumbnail.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            PhotoCard("video", height: height)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay {
            Image(systemName: "play.circle.fill").font(.system(size: 44)).foregroundStyle(.white.opacity(0.9))
        }
        .accessibilityHidden(true)
    }
}
