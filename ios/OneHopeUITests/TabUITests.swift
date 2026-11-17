import XCTest

@MainActor
final class TabUITests: XCTestCase {
    func testMemberTabs() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-apiBaseURL", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let tabs = ["Home", "Watch", "Give", "Connect", "More"]
        for name in tabs {
            let tab = app.tabBars.buttons[name]
            XCTAssertTrue(tab.waitForExistence(timeout: 15), "Missing \(name) tab")
            tab.tap()
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = name
            shot.lifetime = .keepAlways
            add(shot)
        }
        XCTAssertTrue(app.staticTexts["One Hope"].exists)
    }
}
