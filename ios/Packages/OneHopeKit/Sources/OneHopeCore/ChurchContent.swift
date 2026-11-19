import Foundation

/// Plan a Visit wording from weareonehope.com, served by `/api/home`.
public struct VisitInfo: Decodable, Equatable, Sendable {
    public let welcome: String
    public let directions: String
    public let serviceTime: String
    public let arrival: String
    public let kids: String
    public let address: String
    public let mapsUrl: String
    public let calendarPath: String
    public let websiteUrl: String
}

public struct VerseLine: Decodable, Equatable, Sendable {
    public let reference: String
    public let text: String
}

/// The church's Give page: Church Center online giving, text to give, and mail.
public struct GivingInfo: Decodable, Equatable, Sendable {
    public struct Online: Decodable, Equatable, Sendable { public let url: String; public let note: String }
    public struct TextToGive: Decodable, Equatable, Sendable { public let number: String; public let note: String }
    public struct Mail: Decodable, Equatable, Sendable { public let address: String; public let note: String }
    public struct Seasonal: Decodable, Equatable, Sendable { public let title: String; public let note: String }

    public let message: String
    public let verse: VerseLine
    public let online: Online
    public let text: TextToGive
    public let mail: Mail
    /// The Christmas Giving Tree note. The server leaves it out after Christmas.
    public let seasonal: Seasonal?
}

public struct InviteInfo: Decodable, Equatable, Sendable {
    public let title: String
    public let body: String
    public let url: String
    public let mapsUrl: String

    /// The words that go into the share sheet.
    public var shareText: String { "\(title)\n\(body)" }
}

public struct GospelStep: Decodable, Equatable, Sendable, Identifiable {
    public let title: String
    public let reference: String
    public let text: String
    public var id: String { reference }
}

public struct GospelInfo: Decodable, Equatable, Sendable {
    public let intro: String
    public let steps: [GospelStep]
    public let prayer: String
    public let baptism: String
    public let baptismVerse: VerseLine
    public let growthTrack: String
}

public struct JourneyDay: Decodable, Equatable, Sendable, Identifiable {
    public let day: Int
    public let title: String
    public let reference: String
    public let text: String
    public let prompt: String
    public var id: Int { day }
}

public struct DailyWord: Decodable, Equatable, Sendable {
    /// The church calendar day, YYYY-MM-DD in Chicago.
    public let day: String
    public let reference: String
    public let text: String
    public let read: String
    public let prompt: String
}

/// Next steps a guest or member can send to the staff follow-up queue.
public enum FollowUpKind: String, Sendable, CaseIterable {
    case salvation
    case baptism
    case new
    case growthTrack = "growth_track"
    case visit

    public var label: String {
        switch self {
        case .salvation: "I decided to follow Jesus"
        case .baptism: "I want to be baptized"
        case .new: "I'm new"
        case .growthTrack: "Growth Track"
        case .visit: "I'm coming this Sunday"
        }
    }

    public var thanks: String {
        switch self {
        case .salvation: "This is the best decision you'll ever make. A pastor will reach out, and your 7-day journey starts below."
        case .baptism: "Wonderful. A pastor will reach out about baptism."
        case .new: "Welcome to One Hope! We're glad you're here."
        case .growthTrack: "Great. We'll reach out about the next Growth Track."
        case .visit: "We can't wait to meet you! Look for the welcome team at the door."
        }
    }
}

/// Guests send a name and, only with consent, an email or phone. Members send only the kind and consent.
public struct FollowUpRequest: Encodable, Equatable, Sendable {
    public let kind: String
    public let name: String?
    public let email: String?
    public let phone: String?
    public let consent: Bool

    public init(kind: FollowUpKind, name: String? = nil, email: String? = nil, phone: String? = nil, consent: Bool) {
        self.kind = kind.rawValue
        self.name = name
        self.email = email
        self.phone = phone
        self.consent = consent
    }

    /// The same checks the server runs, so a guest hears about a mistake before sending.
    public static func guest(kind: FollowUpKind, name: String, email: String, phone: String, consent: Bool) -> Result<FollowUpRequest, FollowUpProblem> {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let phone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty { return .failure(.name) }
        if !consent, !email.isEmpty || !phone.isEmpty { return .failure(.consent) }
        return .success(FollowUpRequest(kind: kind, name: name, email: email, phone: phone, consent: consent))
    }
}

public enum FollowUpProblem: Error, Equatable {
    case name
    case consent

    public var message: String {
        switch self {
        case .name: "Please tell us your name."
        case .consent: "Check the box so we can contact you, or leave email and phone empty."
        }
    }
}

/// Daily Word streaks, the same rules as the server. Guests keep theirs on the phone.
public enum StreakRules {
    /// Streak after reading on `today`. Twice in a day keeps the count; a missed day starts over.
    public static func next(lastDay: String?, count: Int, today: String) -> Int {
        guard let lastDay, let gap = gap(from: lastDay, to: today) else { return 1 }
        if gap == 0 { return count }
        if gap == 1 { return count + 1 }
        return 1
    }

    /// A streak only counts when the last read was today or yesterday.
    public static func current(lastDay: String?, count: Int, today: String) -> Int {
        guard let lastDay, let gap = gap(from: lastDay, to: today) else { return 0 }
        return gap == 0 || gap == 1 ? count : 0
    }

    private static func gap(from start: String, to end: String) -> Int? {
        guard let first = dayNumber(start), let second = dayNumber(end) else { return nil }
        return second - first
    }

    private static func dayNumber(_ day: String) -> Int? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        guard let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return nil }
        return Int(date.timeIntervalSince1970 / 86400)
    }
}

/// Offline copies of the church's public wording, used until `/api/home` answers.
public extension VisitInfo {
    static let bundled = VisitInfo(
        welcome: "We are excited to meet you!",
        directions: "Just off of US 75 & Spring Valley Rd.",
        serviceTime: "Sundays at 10:30 a.m.",
        arrival: "Come early for donuts & coffee at 10:00 a.m.",
        kids: "One Hope Kids is available during our Sunday services for ages 3 months to 5th grade.",
        address: SampleChurch.address,
        mapsUrl: SampleChurch.mapsURL?.absoluteString ?? "",
        calendarPath: "/api/events/event-sunday/ics",
        websiteUrl: "https://www.weareonehope.com/plan-your-visit"
    )
}

public extension GivingInfo {
    static let bundled = GivingInfo(
        message: "We believe generosity flows from a heart of gratitude.",
        verse: VerseLine(
            reference: "2 Corinthians 9:7",
            text: "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver."
        ),
        online: Online(url: "https://weareonehope.churchcenter.com/giving", note: "Give a single gift, or schedule a recurring gift."),
        text: TextToGive(number: "84321", note: "Text any amount to 84321 and follow the prompts."),
        mail: Mail(address: "PO Box 211926, Dallas, TX 75211", note: "Mail your check or money order."),
        seasonal: nil
    )
}

public extension InviteInfo {
    static let bundled = InviteInfo(
        title: "Come sit with me at One Hope this Sunday",
        body: "Sundays at 10:30 a.m. Come early for donuts & coffee at 10:00. \(SampleChurch.address)",
        url: "https://www.weareonehope.com/plan-your-visit",
        mapsUrl: SampleChurch.mapsURL?.absoluteString ?? ""
    )
}

extension FollowUpKind: Identifiable {
    public var id: String { rawValue }
}
