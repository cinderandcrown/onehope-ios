import XCTest

/// Scrolls every tab to the very bottom and checks the last text or button ends above the app's tab bar.
/// CI runs this on an iPhone SE (3rd generation) simulator, the smallest screen the app supports, and on the
/// default large iPhone. A screenshot of each tab's bottom is kept so a person can look too.
@MainActor
final class SmallScreenUITests: XCTestCase {
    private let contentTypes: Set<XCUIElement.ElementType> = [.staticText, .button, .link, .textField, .secureTextField, .switch]
    private let containerTypes: Set<XCUIElement.ElementType> = [.scrollView, .collectionView, .table]

    func testLastRowOfEveryTabClearsTheTabBar() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let device = "\(Int(app.windows.firstMatch.frame.width))x\(Int(app.windows.firstMatch.frame.height))"
        for tab in ["home", "watch", "prayer", "give", "connect", "more"] {
            let button = app.buttons["tab-\(tab)"]
            XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing \(tab) tab")
            button.tap()
            Thread.sleep(forTimeInterval: 1.5)
            let tabTop = button.frame.minY
            let bottom = try scrollToBottom(app)
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "Bottom of \(tab) on \(device)"
            shot.lifetime = .keepAlways
            add(shot)
            XCTAssertLessThanOrEqual(
                bottom.container, tabTop + 1,
                "\(tab): the scroll area runs under the tab bar (ends at \(bottom.container), bar starts at \(tabTop)) on \(device)"
            )
            XCTAssertLessThanOrEqual(
                bottom.content, tabTop + 1,
                "\(tab): the last row ends at \(bottom.content) but the tab bar starts at \(tabTop) on \(device), so it is hidden"
            )
        }
    }

    /// Swipes up until the last content stops moving, then reports where the main scroll area and its last row end.
    private func scrollToBottom(_ app: XCUIApplication) throws -> (container: CGFloat, content: CGFloat) {
        var last = try measure(app)
        for _ in 0 ..< 25 {
            app.swipeUp()
            Thread.sleep(forTimeInterval: 0.6)
            let now = try measure(app)
            if abs(now.content - last.content) < 1, abs(now.container - last.container) < 1 {
                // One more slow swipe, in case a fling stopped short.
                app.swipeUp(velocity: .slow)
                Thread.sleep(forTimeInterval: 0.8)
                let settled = try measure(app)
                if abs(settled.content - now.content) < 1 {
                    return settled
                }
                last = settled
                continue
            }
            last = now
        }
        return last
    }

    /// The tallest vertical scroll container on screen is the tab's page. Returns its bottom edge and the lowest
    /// text, button, or field inside it.
    private func measure(_ app: XCUIApplication) throws -> (container: CGFloat, content: CGFloat) {
        let root = try app.windows.firstMatch.snapshot()
        var best: XCUIElementSnapshot?
        visit(root) { node in
            guard containerTypes.contains(node.elementType), node.frame.height > 100 else { return }
            if node.frame.height > (best?.frame.height ?? 0) {
                best = node
            }
        }
        guard let page = best else {
            XCTFail("No scroll area found")
            return (0, 0)
        }
        var lowest: CGFloat = 0
        visit(page) { node in
            guard contentTypes.contains(node.elementType), node.frame.height > 0, node.frame.width > 0 else { return }
            // Horizontal carousels can hold cards off to the side; only what sits across the page counts.
            guard node.frame.maxX > page.frame.minX, node.frame.minX < page.frame.maxX else { return }
            lowest = max(lowest, node.frame.maxY)
        }
        return (page.frame.maxY, lowest)
    }

    private func visit(_ node: XCUIElementSnapshot, _ body: (XCUIElementSnapshot) -> Void) {
        body(node)
        for child in node.children {
            visit(child, body)
        }
    }
}
