import UIKit

enum CoffeeShortcut {
    static let kind = "com.cinderandcrown.onehope.orderCoffee"
    static var pending = false

    static func install() {
        UIApplication.shared.shortcutItems = [
            UIApplicationShortcutItem(
                type: kind,
                localizedTitle: "Order Revival Coffee",
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(systemImageName: "cup.and.saucer"),
                userInfo: nil
            ),
        ]
    }

    static func consume() -> Bool {
        let open = pending
        pending = false
        return open
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        CoffeeShortcut.install()
        if let item = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem, item.type == CoffeeShortcut.kind {
            CoffeeShortcut.pending = true
        }
        return true
    }
}
