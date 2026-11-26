import XCTest

@MainActor
final class TabUITests: XCTestCase {
    func testGuestTabsThenSignUp() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let tabs = ["Home", "Watch", "Prayer", "Give", "Connect"]
        for name in tabs {
            openTab(name, app: app)
            if name == "Home" {
                XCTAssertTrue(app.buttons["home-plan-visit"].waitForExistence(timeout: 10))
                XCTAssertTrue(app.descendants(matching: .any)["church-photo-revival"].waitForExistence(timeout: 10))
                settle()
                capture(app, name: "Guest Home top")
                for part in 2 ... 4 {
                    app.swipeUp()
                    settle()
                    capture(app, name: "Guest Home \(part)")
                }
                for _ in 0 ..< 4 {
                    app.swipeDown()
                }
                app.buttons["home-coffee"].tap()
                XCTAssertTrue(app.staticTexts["Order at the counter."].waitForExistence(timeout: 10))
                app.navigationBars.buttons.element(boundBy: 0).tap()
                app.buttons["home-know-jesus"].tap()
                XCTAssertTrue(app.buttons["decision-salvation"].waitForExistence(timeout: 10))
                app.navigationBars.buttons.element(boundBy: 0).tap()
            }
            if name == "Prayer" {
                XCTAssertTrue(app.staticTexts["prayer-board"].waitForExistence(timeout: 10))
            }
            if name == "Give" {
                XCTAssertTrue(app.staticTexts["Text to give"].waitForExistence(timeout: 10))
            }
            settle()
            capture(app, name: "Guest \(name)")
        }
        XCTAssertFalse(app.tabBars.buttons["Know Jesus"].exists)
        signUp(app)
        capture(app, name: "Member Connect")
    }

    private func signUp(_ app: XCUIApplication) {
        let account = app.buttons["connect-account"]
        XCTAssertTrue(account.waitForExistence(timeout: 10))
        account.tap()
        let toggle = app.buttons["toggle-account"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        toggle.tap()
        let stamp = Int(Date().timeIntervalSince1970)
        let name = app.textFields["name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("UI Test")
        let email = app.textFields["email"]
        email.tap()
        email.typeText("uitest\(stamp)@onehope.test")
        let password = app.secureTextFields["password"]
        password.tap()
        password.typeText("gathering1")
        app.buttons["submit-account"].tap()
        let member = app.buttons["Account and directory"]
        if !member.waitForExistence(timeout: 20) {
            let back = app.navigationBars["Account"].buttons["BackButton"]
            if back.waitForExistence(timeout: 2) {
                back.tap()
            }
        }
        XCTAssertTrue(member.waitForExistence(timeout: 10))
    }

    func testMoreReachesEveryRow() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        openTab("More", app: app)
        XCTAssertFalse(app.buttons["more-staff"].exists)
        settle()
        capture(app, name: "More menu")
        let routes: [(String, String)] = [
            ("more-revival", "Revival Coffee"),
            ("more-know-jesus", "Know Jesus"),
            ("more-next-steps", "Next Steps"),
            ("more-kids", "Children's Church"),
            ("more-groups", "Groups"),
            ("more-events", "Events"),
            ("more-serve", "Serve"),
            ("more-giving", "Give"),
            ("more-revival-shop", "Revival Coffee"),
            ("more-sermons", "Watch"),
            ("more-visit", "Plan a Visit"),
            ("more-about", "About"),
            ("more-credits", "About & Credits"),
            ("more-privacy", "Privacy Policy"),
            ("more-terms", "Terms of Use"),
            ("more-social", "Social media"),
            ("more-profile", "Sign in"),
            ("more-settings", "Settings"),
            ("more-sign-in", "Sign in"),
        ]
        for route in routes {
            XCTAssertTrue(scrollTo(route.0, app: app), "Could not scroll to \(route.0)")
            tapMarked(route.0, app: app)
            let bar = app.navigationBars[route.1]
            XCTAssertTrue(bar.waitForExistence(timeout: 10), route.0)
            settle()
            capture(app, name: "More \(route.0)")
            bar.buttons["BackButton"].tap()
            XCTAssertTrue(app.navigationBars["More"].waitForExistence(timeout: 10), "back to More from \(route.0)")
            settle()
        }
        for hidden in ["more-household", "more-live", "more-staff"] {
            XCTAssertFalse(marked(hidden, app: app).exists, "\(hidden) is unfinished and must stay hidden")
        }
    }

    private func marked(_ identifier: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    /// Scrolls the More list until the row can be tapped, and says whether it got there.
    /// Slow swipes (no fling, so a swipe cannot land as a tap on another row), checked after every swipe,
    /// and a nudge when the row is hidden behind the tab bar.
    @discardableResult
    private func scrollTo(_ identifier: String, app: XCUIApplication) -> Bool {
        let row = marked(identifier, app: app)
        let tabTop = app.buttons["tab-home"].frame.minY
        func ready() -> Bool {
            guard row.exists, row.isHittable else { return false }
            if row.frame.maxY > tabTop - 4 {
                app.swipeUp(velocity: .slow)
            }
            return row.exists && row.isHittable
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
        for _ in 0 ..< 16 {
            app.swipeDown(velocity: .slow)
            if ready() {
                return true
            }
        }
        return false
    }

    private func tapMarked(_ identifier: String, app: XCUIApplication) {
        let matches = app.descendants(matching: .any).matching(identifier: identifier)
        XCTAssertTrue(matches.firstMatch.waitForExistence(timeout: 10), "Missing \(identifier)")
        let button = app.buttons.matching(identifier: identifier).firstMatch
        if button.exists {
            button.tap()
        } else {
            matches.firstMatch.tap()
        }
    }

    private func openTab(_ name: String, app: XCUIApplication) {
        let button = app.buttons["tab-\(name.lowercased())"]
        XCTAssertTrue(button.waitForExistence(timeout: 8), "Missing \(name) tab")
        button.tap()
    }

    /// Gives photos a moment to arrive and fade in before a screenshot.
    private func settle() {
        Thread.sleep(forTimeInterval: 1.5)
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
