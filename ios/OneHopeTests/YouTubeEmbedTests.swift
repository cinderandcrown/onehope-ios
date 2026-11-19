import OneHopeCore
import WebKit
import XCTest

/// YouTube answers an embed with no Referer with Error 153, so the player must load under the app's identity.
final class YouTubeEmbedTests: XCTestCase {
    func testClientIdentityIsTheLowercasedBundleID() {
        XCTAssertEqual(YouTubeEmbed.clientIdentity(bundleID: "com.CinderAndCrown.OneHope").absoluteString, "https://com.cinderandcrown.onehope")
        XCTAssertEqual(YouTubeEmbed.clientIdentity(bundleID: nil).absoluteString, "https://com.cinderandcrown.onehope")
        XCTAssertEqual(YouTubeEmbed.clientIdentity(bundleID: "").absoluteString, "https://com.cinderandcrown.onehope")
    }

    func testPlayerPageCarriesTheIdentityAndInlinePlayback() throws {
        let identity = YouTubeEmbed.clientIdentity(bundleID: YouTubeEmbed.appID)
        let html = try XCTUnwrap(YouTubeEmbed.playerHTML(videoID: "IQOB8zlcXDE", identity: identity))
        XCTAssertTrue(html.contains(#"videoId: "IQOB8zlcXDE""#))
        XCTAssertTrue(html.contains(#"origin: "https://com.cinderandcrown.onehope""#))
        XCTAssertTrue(html.contains(#"widget_referrer: "https://com.cinderandcrown.onehope""#))
        XCTAssertTrue(html.contains("playsinline: 1"))
        XCTAssertTrue(html.contains(#"<meta name="referrer" content="strict-origin-when-cross-origin">"#))
        XCTAssertTrue(html.contains("https://www.youtube.com/iframe_api"))
        XCTAssertFalse(html.contains("__"))
    }

    func testOnlyRealVideoIDsReachThePage() {
        let identity = YouTubeEmbed.clientIdentity(bundleID: nil)
        XCTAssertNil(YouTubeEmbed.playerHTML(videoID: #"x"});alert(1);//"#, identity: identity))
        XCTAssertNil(YouTubeEmbed.playerHTML(videoID: "", identity: identity))
        XCTAssertNil(YouTubeEmbed.watchURL(videoID: "a b"))
        XCTAssertEqual(YouTubeEmbed.watchURL(videoID: "9gwIQoe0tL0")?.absoluteString, "https://www.youtube.com/watch?v=9gwIQoe0tL0")
    }

    func testPlayerEventsDriveTheFallback() {
        XCTAssertEqual(YouTubeEmbed.PlayerEvent(message: "ready"), .ready)
        XCTAssertEqual(YouTubeEmbed.PlayerEvent(message: "error:153"), .failed("153"))
        XCTAssertEqual(YouTubeEmbed.PlayerEvent(message: "error:timeout"), .failed("timeout"))
        XCTAssertNil(YouTubeEmbed.PlayerEvent(message: "playing"))
    }

    /// The page a WKWebView builds from loadHTMLString(_:baseURL:) has the app's https origin, which WebKit sends as the
    /// Referer on the iframe_api and embed requests.
    @MainActor
    func testWebViewRunsThePlayerUnderTheAppOrigin() async throws {
        let identity = YouTubeEmbed.clientIdentity(bundleID: Bundle.main.bundleIdentifier)
        XCTAssertEqual(identity.absoluteString, "https://com.cinderandcrown.onehope")
        let html = try XCTUnwrap(YouTubeEmbed.playerHTML(videoID: "IQOB8zlcXDE", identity: identity))
        let web = WKWebView()
        web.loadHTMLString(html, baseURL: identity)
        var origin = ""
        for _ in 0 ..< 100 where origin != identity.absoluteString {
            try await Task.sleep(nanoseconds: 100_000_000)
            origin = (try? await web.evaluateJavaScript("window.location.origin") as? String) ?? ""
        }
        XCTAssertEqual(origin, "https://com.cinderandcrown.onehope")
        let policy = try await web.evaluateJavaScript(#"document.querySelector('meta[name="referrer"]').content"#) as? String
        XCTAssertEqual(policy, "strict-origin-when-cross-origin")
    }
}
