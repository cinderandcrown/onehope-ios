import UIKit

enum CoffeeShortcut {
    static let kind = "com.cinderandcrown.onehope.orderCoffee"
    private static let pendingKey = "onehope.orderCoffee"

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

    static func request() {
        UserDefaults.standard.set(true, forKey: pendingKey)
    }

    static func consume() -> Bool {
        let open = UserDefaults.standard.bool(forKey: pendingKey)
        UserDefaults.standard.removeObject(forKey: pendingKey)
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
            CoffeeShortcut.request()
        }
        return true
    }
}
