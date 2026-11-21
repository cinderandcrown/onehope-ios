import UserNotifications

/// Opt-in local reminder. This does not register for remote push.
enum DailyReminder {
    private static let id = "onehope.daily-word"

    static func setEnabled(_ enabled: Bool) async -> Bool {
        let center = UNUserNotificationCenter.current()
        if !enabled {
            center.removePendingNotificationRequests(withIdentifiers: [id])
            return false
        }
        let granted = await (try? center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else { return false }
        let content = UNMutableNotificationContent()
        content.title = "One Hope"
        content.body = "Today's verse and a moment to pray are here."
        var when = DateComponents()
        when.hour = 7
        when.minute = 30
        let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        try? await center.add(request)
        return true
    }
}
