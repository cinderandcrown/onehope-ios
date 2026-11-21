import Foundation

public extension ChurchSnapshot {
    /// Photo URLs to load ahead of time, the ones on the first screen first.
    var warmURLs: [URL] {
        let first = ["hero", "revival", "kids", "groups", "growth", "about", "visit"]
        var urls = first.compactMap { images.url(named: $0) }
        let latest = sermons.first { !$0.isShort }
        urls += [latest?.thumbnailHD, latest?.thumbnail].compactMap { $0.flatMap(ChurchImages.httpsURL) }
        urls += images.allURLs
        urls += sermons.prefix(8).compactMap { $0.thumbnail.flatMap(ChurchImages.httpsURL) }
        urls += media.allURLs
        var seen = Set<URL>()
        return urls.filter { seen.insert($0).inserted }
    }
}
