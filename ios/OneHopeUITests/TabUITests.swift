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
                app.buttons["home-coffee"].tap()
                XCTAssertTrue(app.staticTexts["Order ahead coming soon."].waitForExistence(timeout: 10))
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
            capture(app, name: "Guest \(name)")
        }
        XCTAssertFalse(app.tabBars.buttons["Know Jesus"].exists)
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
        XCTAssertTrue(app.buttons["Account and directory"].waitForExistence(timeout: 20))
        capture(app, name: "Member Connect")
    }

    func testMoreReachesEveryRow() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        openTab("More", app: app)
        if !marked("more-revival", app: app).waitForExistence(timeout: 3) {
            let nested = app.cells["More"]
            if nested.waitForExistence(timeout: 3) {
                nested.tap()
            }
        }
        XCTAssertFalse(app.buttons["more-staff"].exists)
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
            ("more-social", "Social media"),
            ("more-profile", "Sign in"),
            ("more-settings", "Settings"),
            ("more-sign-in", "Sign in"),
        ]
        for route in routes {
            let row = marked(route.0, app: app)
            XCTAssertTrue(row.waitForExistence(timeout: 10), "Missing \(route.0)")
            row.tap()
            XCTAssertTrue(app.navigationBars[route.1].waitForExistence(timeout: 10), route.0)
            app.navigationBars.buttons["More"].tap()
        }
        for soon in ["more-household", "more-live"] {
            let row = marked(soon, app: app)
            XCTAssertTrue(row.waitForExistence(timeout: 5), soon)
            XCTAssertTrue(app.staticTexts["Coming soon"].exists)
            row.tap()
            XCTAssertTrue(app.navigationBars["More"].exists)
        }
    }

    private func marked(_ identifier: String, app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func openTab(_ name: String, app: XCUIApplication) {
        let direct = app.tabBars.buttons[name]
        if direct.waitForExistence(timeout: 8) {
            direct.tap()
            return
        }
        let overflow = app.tabBars.buttons["More"]
        XCTAssertTrue(overflow.waitForExistence(timeout: 8), "Missing \(name) tab")
        overflow.tap()
        let cell = app.cells[name]
        if cell.waitForExistence(timeout: 5) {
            cell.tap()
            return
        }
        app.buttons[name].tap()
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
