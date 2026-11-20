import OneHopeCore
import SwiftUI
import UIKit

/// Loads, decodes and caches the church's photos. One copy of each lives in memory and on disk,
/// so a photo never flashes in twice and screens open with their pictures already there.
@MainActor
public enum ImagePipeline {
    private static let memory: NSCache<NSURL, UIImage> = {
        let cache = NSCache<NSURL, UIImage>()
        cache.totalCostLimit = 96 * 1024 * 1024
        return cache
    }()

    private static var inflight: [URL: Task<UIImage?, Never>] = [:]

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = URLCache(memoryCapacity: 24 * 1024 * 1024, diskCapacity: 256 * 1024 * 1024)
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.timeoutIntervalForRequest = 20
        return URLSession(configuration: configuration)
    }()

    /// A photo already decoded in memory, if there is one.
    public static func cached(_ url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    public static func image(_ url: URL) async -> UIImage? {
        if let hit = cached(url) {
            return hit
        }
        if let running = inflight[url] {
            return await running.value
        }
        let task = Task { await load(url) }
        inflight[url] = task
        let result = await task.value
        inflight[url] = nil
        return result
    }

    private static func load(_ url: URL) async -> UIImage? {
        guard
            let result = try? await session.data(from: url),
            let http = result.1 as? HTTPURLResponse,
            http.statusCode == 200,
            let raw = UIImage(data: result.0)
        else {
            return nil
        }
        let ready = await raw.byPreparingForDisplay() ?? raw
        let cost = Int(ready.size.width * ready.size.height * ready.scale * ready.scale * 4)
        memory.setObject(ready, forKey: url as NSURL, cost: cost)
        return ready
    }

    private static func warm(_ url: URL) async {
        _ = await image(url)
    }

    /// Fills the cache in the background, four photos at a time, most important first.
    public static func prefetch(_ urls: [URL]) {
        Task(priority: .utility) {
            var index = 0
            while index < urls.count {
                let batch = urls[index ..< min(index + 4, urls.count)]
                await withTaskGroup(of: Void.self) { group in
                    for url in batch {
                        group.addTask { await ImagePipeline.warm(url) }
                    }
                }
                index += 4
            }
        }
    }
}

/// A church photo that fades in over the brand texture. Falls back to a second URL, then to the texture alone.
public struct RemoteImage: View {
    private let url: URL?
    private let fallback: URL?
    @State private var loaded: UIImage?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ url: URL?, fallback: URL? = nil) {
        self.url = url
        self.fallback = fallback
    }

    public var body: some View {
        Color.clear
            .overlay {
                ZStack {
                    BrandTexture()
                    if let image = loaded ?? url.flatMap({ ImagePipeline.cached($0) }) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .transition(.opacity)
                    } else if url != nil, !reduceMotion {
                        Shimmer()
                    }
                }
            }
            .clipped()
            .task(id: url) { await fetch() }
    }

    private func fetch() async {
        for candidate in [url, fallback].compactMap({ $0 }) {
            if let image = await ImagePipeline.image(candidate) {
                withAnimation(HopeMotion.fade) { loaded = image }
                return
            }
        }
    }
}

/// A soft highlight that sweeps across a photo while it loads.
struct Shimmer: View {
    @State private var phase: CGFloat = -1

    var body: some View {
        GeometryReader { proxy in
            LinearGradient(
                colors: [.clear, .white.opacity(0.28), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(width: proxy.size.width * 0.6)
            .offset(x: phase * proxy.size.width)
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) { phase = 1.4 }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
