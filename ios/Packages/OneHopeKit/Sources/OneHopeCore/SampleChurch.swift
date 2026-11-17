import Foundation

public enum SampleChurch {
    public static let name = "One Hope"
    public static let address = "1251 S. Sherman St., Ste. 112, Richardson, TX 75081"
    public static let pastors = ["Derek Miller", "Jen Miller"]
    public static let youtubeHandle = "@Weareonehope"
    public static let mapsURL = URL(string: "https://maps.apple.com/?address=1251%20S.%20Sherman%20St.%20Ste.%20112,%20Richardson,%20TX%2075081")

    public struct Announcement: Identifiable, Equatable, Sendable {
        public let id: String
        public let title: String
        public let body: String
        public let sample: Bool
    }

    public struct EventItem: Identifiable, Equatable, Sendable {
        public let id: String
        public let title: String
        public let detail: String
        public let sample: Bool
    }

    public static let announcements: [Announcement] = [
        Announcement(id: "service", title: "Sunday", body: "Pre-service coffee at 10:00 a.m. Gathering at 10:30 a.m.", sample: false),
        Announcement(id: "growth", title: "Growth Track", body: "Sample class dates, not a live registration.", sample: true),
    ]

    public static let events: [EventItem] = [
        EventItem(id: "sunday", title: "Sunday gathering", detail: address, sample: false),
        EventItem(id: "workshop", title: "Workshop", detail: "Sample event with a waitlist.", sample: true),
    ]

    public static let viewer = DirectoryPerson(
        id: "person-avery",
        displayName: "Avery Sample",
        email: "avery@sample.onehope",
        emailPublic: true,
        phone: "214-555-0142",
        phonePublic: false
    )

    public static let directory: [DirectoryPerson] = [
        viewer,
        DirectoryPerson(id: "person-casey", displayName: "Casey Sample", email: "casey@sample.onehope", emailPublic: false, phone: "214-555-0199", phonePublic: false),
        DirectoryPerson(id: "person-harper", displayName: "Harper Sample", email: "harper@sample.onehope", emailPublic: false, phone: "214-555-0100", phonePublic: true),
    ]
}

public enum AppLanguage: String, Sendable {
    case en
    case es

    public static var current: AppLanguage {
        if Locale.preferredLanguages.first?.hasPrefix("es") == true {
            return .es
        }
        return .en
    }
}

public enum L10n {
    public static func text(_ key: Key, language: AppLanguage = .current) -> String {
        language == .es ? spanish[key] ?? english[key] ?? key.rawValue : english[key] ?? key.rawValue
    }

    public enum Key: String, Sendable {
        case home, watch, give, connect, more
        case sample
        case signIn
    }

    private static let english: [Key: String] = [
        .home: "Home",
        .watch: "Watch",
        .give: "Give",
        .connect: "Connect",
        .more: "More",
        .sample: "Sample",
        .signIn: "Continue as sample member",
    ]

    private static let spanish: [Key: String] = [
        .home: "Inicio",
        .watch: "Ver",
        .give: "Dar",
        .connect: "Conectar",
        .more: "Más",
        .sample: "Muestra",
        .signIn: "Continuar como miembro de muestra",
    ]
}
