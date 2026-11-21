import XCTest

/// Runs Apple's accessibility audit (contrast, tap target size, clipped text, labels, Dynamic Type) on the main screens.
/// Findings are saved as an attachment so each build shows what is left. Set ONEHOPE_A11Y_STRICT=1 to fail on them.
@MainActor
final class AccessibilityUITests: XCTestCase {
    private var findings: [String] = []

    func testMainScreensPassTheAccessibilityAudit() throws {
        let app = launch(extra: [])
        for tab in ["home", "watch", "prayer", "give", "connect", "more"] {
            let button = app.buttons["tab-\(tab)"]
            XCTAssertTrue(button.waitForExistence(timeout: 10), tab)
            button.tap()
            Thread.sleep(forTimeInterval: 1.5)
            try audit(app, screen: tab, types: .all)
        }
        for (row, name) in [("more-privacy", "privacy"), ("more-terms", "terms"), ("more-credits", "credits")] {
            app.buttons["tab-more"].tap()
            let item = marked(row, app: app)
            XCTAssertTrue(scrollUntilHittable(item, app: app), row)
            item.tap()
            try audit(app, screen: name, types: .all)
            let back = app.navigationBars.buttons["BackButton"]
            XCTAssertTrue(back.waitForExistence(timeout: 10), row)
            back.tap()
        }
        report(named: "Accessibility audit, default text size")
    }

    func testLargestTextStillFitsAndPassesTheAudit() throws {
        let app = launch(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        for tab in ["home", "more", "give"] {
            let button = app.buttons["tab-\(tab)"]
            XCTAssertTrue(button.waitForExistence(timeout: 10), tab)
            button.tap()
            Thread.sleep(forTimeInterval: 1.5)
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "Largest text \(tab)"
            shot.lifetime = .keepAlways
            add(shot)
            try audit(app, screen: "xxxl-\(tab)", types: [.textClipped, .dynamicType, .hitRegion])
        }
        report(named: "Accessibility audit, largest text size")
    }

    private func launch(extra: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"] + extra
        app.launch()
        return app
    }

    private func audit(_ app: XCUIApplication, screen: String, types: XCUIAccessibilityAuditType) throws {
        try app.performAccessibilityAudit(for: types) { [self] issue in
            let element = issue.element.map { "\($0.elementType.rawValue) \"\($0.label)\" id=\($0.identifier)" } ?? "no element"
            findings.append("[\(screen)] \(issue.compactDescription) | \(element)")
            return ProcessInfo.processInfo.environment["ONEHOPE_A11Y_STRICT"] == nil
        }
    }

    private func marked(_ identifier: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    /// The last More rows sit under the tab bar. A fast swipe can also land as a tap, so this nudges slowly
    /// until the row is actually hittable.
    private func scrollUntilHittable(_ row: XCUIElement, app: XCUIApplication) -> Bool {
        let tabTop = app.buttons["tab-home"].frame.minY
        func ready() -> Bool {
            guard row.exists, row.isHittable else { return false }
            if row.frame.maxY > tabTop - 4 {
                app.swipeUp(velocity: .slow)
            }
            return row.exists && row.isHittable && row.frame.maxY <= tabTop - 4
        }
        if ready() {
            return true
        }
        for _ in 0 ..< 12 {
            app.swipeUp(velocity: .slow)
            if ready() {
                return true
            }
        }
        for _ in 0 ..< 8 {
            app.swipeDown(velocity: .slow)
            if ready() {
                return true
            }
        }
        return row.exists && row.isHittable
    }

    private func report(named name: String) {
        let text = findings.isEmpty ? "No issues found." : findings.joined(separator: "\n")
        let attachment = XCTAttachment(string: text)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
