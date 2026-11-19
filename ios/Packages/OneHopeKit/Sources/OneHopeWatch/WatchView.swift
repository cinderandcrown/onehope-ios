import OneHopeCore
import OneHopeDesign
import OneHopeHome
import SwiftUI
import WebKit

/// Sunday messages and shorts from the church YouTube channel, each with a share sheet.
public struct WatchView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    @Binding private var selected: String?

    public init(snapshot: ChurchSnapshot, selected: Binding<String?>, onRefresh: @escaping () async -> Void = {}) {
        self.snapshot = snapshot
        _selected = selected
        self.onRefresh = onRefresh
    }

    private var messages: [SermonLine] {
        snapshot.sermons.filter { !$0.isShort }
    }

    private var shorts: [SermonLine] {
        snapshot.sermons.filter(\.isShort)
    }

    public var body: some View {
        NavigationStack {
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
                                            Text(short.title).font(.footnote).lineLimit(2).foregroundStyle(BrandColor.ink)
                                        }
                                        .frame(width: 160)
                                    }
                                    .buttonStyle(.plain)
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
    }

    @ViewBuilder private var player: some View {
        if let sermon = snapshot.sermons.first(where: { $0.id == selected }) ?? messages.first {
            VStack(alignment: .leading, spacing: 8) {
                if selected == sermon.id {
                    SermonPlayer(videoID: sermon.id)
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                } else {
                    Button { selected = sermon.id } label: { VideoThumbnail(sermon: sermon, height: 220) }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Play \(sermon.title)")
                }
                Text(sermon.title).font(.title3.bold())
                HStack {
                    if let published = sermon.published {
                        Text(published.formatted(date: .abbreviated, time: .omitted)).font(.footnote)
                    }
                    Spacer()
                    share(sermon)
                }
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
                            .multilineTextAlignment(.leading).lineLimit(3)
                        if let published = sermon.published {
                            Text(published.formatted(date: .abbreviated, time: .omitted)).font(.caption)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(.plain)
            share(sermon)
        }
        .churchCard()
    }

    @ViewBuilder private func share(_ sermon: SermonLine) -> some View {
        if let link = sermon.link {
            ShareLink(item: link, subject: Text(sermon.title), message: Text("Watch \"\(sermon.title)\" from One Hope.")) {
                Image(systemName: "square.and.arrow.up")
            }
            .accessibilityLabel("Share \(sermon.title)")
        }
    }
}

private struct SermonPlayer: UIViewRepresentable {
    let videoID: String

    func makeUIView(context _: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.scrollView.isScrollEnabled = false
        load(web)
        return web
    }

    func updateUIView(_ web: WKWebView, context _: Context) {
        if web.url?.lastPathComponent != videoID {
            load(web)
        }
    }

    private func load(_ web: WKWebView) {
        if let url = URL(string: "https://www.youtube.com/embed/\(videoID)?playsinline=1") {
            web.load(URLRequest(url: url))
        }
    }
}
