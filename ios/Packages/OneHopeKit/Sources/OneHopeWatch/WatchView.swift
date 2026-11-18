import OneHopeCore
import OneHopeDesign
import SwiftUI
import WebKit

public struct WatchView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    @State private var selected: String?

    public init(snapshot: ChurchSnapshot, onRefresh: @escaping () async -> Void = {}) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let selected, let sermon = snapshot.sermons.first(where: { $0.id == selected }) ?? snapshot.sermons.first {
                        SermonPlayer(videoID: sermon.id)
                            .frame(height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                        Text(sermon.title).font(.title2)
                    } else {
                        PhotoCard("video")
                        Text(snapshot.sermonTitle).font(.title2)
                        Text(snapshot.sermonNote).font(.body)
                    }
                    ForEach(snapshot.sermons) { sermon in
                        Button {
                            selected = sermon.id
                        } label: {
                            HStack {
                                Text(sermon.title)
                                    .foregroundStyle(BrandColor.ink)
                                    .multilineTextAlignment(.leading)
                                Spacer()
                            }
                            .padding()
                            .background(BrandColor.card)
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                        }
                        .buttonStyle(.plain)
                    }
                    Text("John 3:16, KJV").font(.headline)
                    Text("For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.")
                        .font(.body)
                }
                .padding()
            }
            .refreshable { await onRefresh() }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.watch))
        }
    }
}

private struct SermonPlayer: UIViewRepresentable {
    let videoID: String

    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView()
        web.scrollView.isScrollEnabled = false
        if let url = URL(string: "https://www.youtube.com/embed/\(videoID)") {
            web.load(URLRequest(url: url))
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context _: Context) {}
}
