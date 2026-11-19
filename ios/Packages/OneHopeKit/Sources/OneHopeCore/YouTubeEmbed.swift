import Foundation

/// The in-app YouTube player page and the client identity YouTube requires.
///
/// YouTube refuses embeds that arrive without an HTTP Referer (Error 153). A WKWebView sends none when it loads
/// the embed URL directly, so the player page is loaded with `loadHTMLString(_:baseURL:)` and a base URL of
/// `https://<bundle id>`, which Google's Required Minimum Functionality rules name as an app's identity.
public enum YouTubeEmbed {
    /// The App Store bundle id, used when the running bundle has none (unit tests and previews).
    public static let appID = "com.cinderandcrown.onehope"
    /// The name of the script message handler the player page posts to.
    public static let messageHandler = "player"

    /// What the player page reports back to the app.
    public enum PlayerEvent: Equatable, Sendable {
        case ready
        /// A YouTube player error code (such as 150 or 153), or `offline` / `timeout`.
        case failed(String)

        public init?(message: String) {
            if message == "ready" {
                self = .ready
            } else if message.hasPrefix("error:") {
                self = .failed(String(message.dropFirst("error:".count)))
            } else {
                return nil
            }
        }
    }

    /// `https://<bundle id>` in lowercase, the Referer YouTube expects from an iOS app.
    public static func clientIdentity(bundleID: String?) -> URL {
        let id = (bundleID?.isEmpty == false ? bundleID : nil) ?? appID
        return URL(string: "https://\(id.lowercased())") ?? URL(fileURLWithPath: "/")
    }

    /// YouTube video ids are letters, digits, `-` and `_`; anything else never reaches the page.
    public static func isVideoID(_ id: String) -> Bool {
        !id.isEmpty && id.count <= 64 && id.allSatisfy { ($0.isASCII && ($0.isLetter || $0.isNumber)) || $0 == "-" || $0 == "_" }
    }

    /// The player page for one video, or nil for an invalid id.
    public static func playerHTML(videoID: String, identity: URL) -> String? {
        guard isVideoID(videoID),
              let template = Bundle.module.url(forResource: "youtube-player", withExtension: "html"),
              let page = try? String(contentsOf: template, encoding: .utf8)
        else {
            return nil
        }
        let origin = identity.absoluteString
        return page.replacingOccurrences(of: "__VIDEO_ID__", with: videoID).replacingOccurrences(of: "__ORIGIN__", with: origin)
    }

    /// The YouTube watch page, which opens in the YouTube app when it is installed.
    public static func watchURL(videoID: String) -> URL? {
        guard isVideoID(videoID) else {
            return nil
        }
        return URL(string: "https://www.youtube.com/watch?v=\(videoID)")
    }
}
