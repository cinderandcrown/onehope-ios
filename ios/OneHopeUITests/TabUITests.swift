import XCTest

@MainActor
final class TabUITests: XCTestCase {
    func testGuestTabsThenSignUp() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let tabs = ["Home", "Watch", "Know Jesus", "Give", "Connect"]
        for name in tabs {
            let tab = app.tabBars.buttons[name]
            XCTAssertTrue(tab.waitForExistence(timeout: 20), "Missing \(name) tab")
            tab.tap()
            if name == "Home" {
                XCTAssertTrue(app.buttons["home-plan-visit"].waitForExistence(timeout: 10))
            }
            if name == "Know Jesus" {
                XCTAssertTrue(app.buttons["decision-salvation"].waitForExistence(timeout: 10))
            }
            if name == "Give" {
                XCTAssertTrue(app.staticTexts["Text to give"].waitForExistence(timeout: 10))
            }
            capture(app, name: "Guest \(name)")
        }
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

    private func capture(_ app: XCUIApplication, name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
