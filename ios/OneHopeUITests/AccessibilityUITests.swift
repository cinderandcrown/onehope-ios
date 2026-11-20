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
            reveal(row, app: app)
            let item = app.descendants(matching: .any).matching(identifier: row).firstMatch
            XCTAssertTrue(item.waitForExistence(timeout: 10), row)
            item.tap()
            try audit(app, screen: name, types: .all)
            app.navigationBars.buttons.element(boundBy: 0).tap()
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

    private func reveal(_ identifier: String, app: XCUIApplication) {
        let row = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        for _ in 0 ..< 8 where !row.exists {
            app.swipeUp()
        }
    }

    private func report(named name: String) {
        let text = findings.isEmpty ? "No issues found." : findings.joined(separator: "\n")
        let attachment = XCTAttachment(string: text)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
