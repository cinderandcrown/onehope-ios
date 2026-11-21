import Foundation

/// One YouTube item, or the message staff featured for this Sunday.
public struct SermonLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let thumbnail: String?
    /// 1280x720 poster. YouTube has none for some older videos, so views fall back to `thumbnail`.
    public let thumbnailHD: String?
    public let published: Date?
    /// "message" for full Sunday messages, "short" for clips.
    public let kind: String
    public let link: URL?
    public let speaker: String
    public let passage: String

    public init(
        id: String,
        title: String,
        thumbnail: String?,
        thumbnailHD: String?,
        published: Date?,
        kind: String,
        link: URL?,
        speaker: String = "",
        passage: String = ""
    ) {
        self.id = id
        self.title = title
        self.thumbnail = thumbnail
        self.thumbnailHD = thumbnailHD
        self.published = published
        self.kind = kind
        self.link = link
        self.speaker = speaker
        self.passage = passage
    }

    public var isShort: Bool {
        kind == "short"
    }
}

/// Puts the message staff featured on Home and Watch first.
/// An empty feature leaves the YouTube list alone, newest message first.
public enum SermonOrder {
    public static func featuring(_ sermons: [SermonLine], featured: SermonLine?) -> [SermonLine] {
        guard let featured, !featured.id.isEmpty, !featured.title.isEmpty else { return sermons }
        if let match = sermons.first(where: { $0.id == featured.id }) {
            let lead = SermonLine(
                id: match.id,
                title: featured.title,
                thumbnail: featured.thumbnail ?? match.thumbnail,
                thumbnailHD: match.thumbnailHD,
                published: match.published,
                kind: "message",
                link: featured.link ?? match.link,
                speaker: featured.speaker,
                passage: featured.passage
            )
            return [lead] + sermons.filter { $0.id != featured.id }
        }
        return [featured] + sermons
    }
}
