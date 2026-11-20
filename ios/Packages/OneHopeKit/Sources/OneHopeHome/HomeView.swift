import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct HomeView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    private let onOpenTab: (String) -> Void
    private let onWatch: (String) -> Void

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" },
        onOpenTab: @escaping (String) -> Void = { _ in },
        onWatch: @escaping (String) -> Void = { _ in }
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
        self.onOpenTab = onOpenTab
        self.onWatch = onWatch
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xl) {
                    header
                    HomeHero(snapshot: snapshot, perform: perform)
                    HomeShortcuts(snapshot: snapshot, perform: perform, onOpenTab: onOpenTab)
                    if !snapshot.offlineNote.isEmpty {
                        Text(snapshot.offlineNote).font(.footnote).foregroundStyle(BrandColor.ink.opacity(0.8))
                    }
                    DailyWordCard(snapshot: snapshot, perform: perform)
                    LatestMessages(sermons: snapshot.sermons, onWatch: onWatch)
                    RevivalFeature()
                    MinistriesRow(ministries: snapshot.media.ministries)
                    TeamTeaser(snapshot: snapshot)
                    InviteCard(invite: snapshot.invite)
                    announcements
                    FollowAlong(links: snapshot.social)
                    ReminderToggle()
                }
                .padding(.horizontal, Space.lg)
                .padding(.vertical, Space.lg)
            }
            .refreshable { await onRefresh() }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.home))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Wordmark()
            Text(DayGreeting.line(name: snapshot.signedIn ? snapshot.accountName : ""))
                .font(.hopeDisplay)
                .foregroundStyle(BrandColor.ink)
        }
    }

    private var announcements: some View {
        ForEach(snapshot.announcements) { item in
            VStack(alignment: .leading, spacing: Space.sm) {
                Text("Announcement").eyebrow()
                Text(item.title).font(.headline)
                Text(item.body).font(.body)
            }
            .churchCard()
        }
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

/// A YouTube poster, or the church texture while it loads or when there is none.
public struct VideoThumbnail: View {
    private let sermon: SermonLine
    private let height: CGFloat
    private let highRes: Bool

    public init(sermon: SermonLine, height: CGFloat, highRes: Bool = false) {
        self.sermon = sermon
        self.height = height
        self.highRes = highRes
    }

    public var body: some View {
        let standard = sermon.thumbnail.flatMap(ChurchImages.httpsURL)
        let hd = sermon.thumbnailHD.flatMap(ChurchImages.httpsURL)
        RemoteImage(highRes ? hd ?? standard : standard, fallback: highRes ? standard : nil)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
            .overlay {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.3), radius: 6)
            }
            .accessibilityHidden(true)
    }
}
