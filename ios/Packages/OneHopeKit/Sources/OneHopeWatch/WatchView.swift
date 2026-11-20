import OneHopeCore
import OneHopeDesign
import OneHopeHome
import SwiftUI
import UIKit
import WebKit

/// Sunday messages and shorts from the church YouTube channel, each with a share sheet.
public struct WatchView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    @Binding private var selected: String?
    @State private var failedVideo: String?
    private let embedded: Bool

    public init(
        snapshot: ChurchSnapshot,
        selected: Binding<String?>,
        onRefresh: @escaping () async -> Void = {},
        embedded: Bool = false
    ) {
        self.snapshot = snapshot
        _selected = selected
        self.onRefresh = onRefresh
        self.embedded = embedded
    }

    private var messages: [SermonLine] {
        snapshot.sermons.filter { !$0.isShort }
    }

    private var shorts: [SermonLine] {
        snapshot.sermons.filter(\.isShort)
    }

    public var body: some View {
        if embedded {
            watchPage
        } else {
            NavigationStack { watchPage }
        }
    }

    private var watchPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                player
                if !messages.isEmpty {
                    Text("Messages").font(.title2.bold())
                    ForEach(messages) { sermon in
                        row(sermon)
                    }
                }
                if !shorts.isEmpty {
                    Text("Shorts").font(.title2.bold())
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(shorts) { short in
                                Button {
                                    selected = short.id
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        VideoThumbnail(sermon: short, height: 120)
                                        Text(short.title).font(.footnote).foregroundStyle(BrandColor.ink)
                                    }
                                    .frame(width: 160, alignment: .leading)
                                }
                                .buttonStyle(.plain)
                                .accessibilityHint("Plays this short")
                            }
                        }
                    }
                }
                if snapshot.sermons.isEmpty {
                    PhotoCard("video")
                    Text(snapshot.sermonNote)
                }
            }
            .padding()
        }
        .refreshable { await onRefresh() }
        .background(BrandColor.paper)
        .navigationTitle(L10n.text(.watch))
    }

    @ViewBuilder private var player: some View {
        if let sermon = snapshot.sermons.first(where: { $0.id == selected }) ?? messages.first {
            VStack(alignment: .leading, spacing: 8) {
                if selected == sermon.id {
                    ZStack {
                        SermonPlayer(videoID: sermon.id) { event in
                            if case .failed = event {
                                failedVideo = sermon.id
                            }
                        }
                        if failedVideo == sermon.id || !YouTubeEmbed.isVideoID(sermon.id) {
                            playerFallback(sermon)
                        }
                    }
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .accessibilityLabel("Video player for \(sermon.title)")
                    Text("Captions turn on when YouTube has them. For a transcript, open this message on YouTube.")
                        .font(.caption)
                        .foregroundStyle(BrandColor.ink.opacity(0.8))
                } else {
                    Button { selected = sermon.id } label: { VideoThumbnail(sermon: sermon, height: 220) }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Play \(sermon.title)")
                        .accessibilityHint("Plays the message here")
                }
                Text(sermon.title).font(.title3.bold())
                HStack {
                    if let published = sermon.published {
                        Text(published.formatted(date: .abbreviated, time: .omitted)).font(.footnote)
                    }
                    Spacer()
                    playOnYouTube(sermon, prominent: false)
                    share(sermon)
                }
            }
        }
    }

    /// Covers the player when YouTube refuses to play inside the app.
    private func playerFallback(_ sermon: SermonLine) -> some View {
        VStack(spacing: 12) {
            Text("This video can't play here.").font(.headline).foregroundStyle(.white)
            playOnYouTube(sermon, prominent: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
    }

    @ViewBuilder private func playOnYouTube(_ sermon: SermonLine, prominent: Bool) -> some View {
        if let url = YouTubeEmbed.watchURL(videoID: sermon.id) ?? sermon.link {
            let button = Button {
                openOnYouTube(url)
            } label: {
                Label("Play on YouTube", systemImage: "play.rectangle.fill").frame(minHeight: 44)
            }
            if prominent {
                button.buttonStyle(PrimaryButtonStyle())
            } else {
                button.font(.footnote.weight(.semibold))
            }
        }
    }

    /// Opens the YouTube app when it is installed, otherwise Safari.
    private func openOnYouTube(_ url: URL) {
        Task { @MainActor in
            let openedApp = await UIApplication.shared.open(url, options: [.universalLinksOnly: true])
            if !openedApp {
                _ = await UIApplication.shared.open(url)
            }
        }
    }

    private func row(_ sermon: SermonLine) -> some View {
        HStack(spacing: 12) {
            Button { selected = sermon.id } label: {
                HStack(spacing: 12) {
                    VideoThumbnail(sermon: sermon, height: 64).frame(width: 112)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(sermon.title).font(.subheadline.weight(.semibold)).foregroundStyle(BrandColor.ink)
                            .multilineTextAlignment(.leading)
                        if let published = sermon.published {
                            Text(published.formatted(date: .abbreviated, time: .omitted)).font(.caption)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Plays this message")
            share(sermon)
        }
        .churchCard()
    }

    @ViewBuilder private func share(_ sermon: SermonLine) -> some View {
        if let link = sermon.link {
            ShareLink(item: link, subject: Text(sermon.title), message: Text("Watch \"\(sermon.title)\" from One Hope.")) {
                Image(systemName: "square.and.arrow.up").frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Share \(sermon.title)")
        }
    }
}

/// The YouTube player, loaded under the app's identity so YouTube accepts the embed (see `YouTubeEmbed`).
private struct SermonPlayer: UIViewRepresentable {
    let videoID: String
    let onEvent: (YouTubeEmbed.PlayerEvent) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onEvent: onEvent)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.add(context.coordinator, name: YouTubeEmbed.messageHandler)
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.scrollView.isScrollEnabled = false
        web.isOpaque = false
        web.backgroundColor = .black
        load(web, coordinator: context.coordinator)
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        context.coordinator.onEvent = onEvent
        if context.coordinator.videoID != videoID {
            load(web, coordinator: context.coordinator)
        }
    }

    private func load(_ web: WKWebView, coordinator: Coordinator) {
        coordinator.videoID = videoID
        let identity = YouTubeEmbed.clientIdentity(bundleID: Bundle.main.bundleIdentifier)
        if let html = YouTubeEmbed.playerHTML(videoID: videoID, identity: identity) {
            web.loadHTMLString(html, baseURL: identity)
        }
    }

    @MainActor final class Coordinator: NSObject, WKScriptMessageHandler {
        var onEvent: (YouTubeEmbed.PlayerEvent) -> Void
        var videoID: String?

        init(onEvent: @escaping (YouTubeEmbed.PlayerEvent) -> Void) {
            self.onEvent = onEvent
        }

        func userContentController(_: WKUserContentController, didReceive message: WKScriptMessage) {
            if let body = message.body as? String, let event = YouTubeEmbed.PlayerEvent(message: body) {
                onEvent(event)
            }
        }
    }
}
