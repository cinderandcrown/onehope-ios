import Foundation

public enum ChurchClock {
    public static let chicago: TimeZone = TimeZone(identifier: "America/Chicago") ?? .gmt
}

public struct ServiceWindow: Equatable, Sendable {
    public let preService: Date
    public let service: Date
}

public enum ServiceSchedule {
    public static func nextSunday(from now: Date, timeZone: TimeZone = ChurchClock.chicago) -> ServiceWindow? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let weekday = calendar.component(.weekday, from: now)
        var daysUntil = (8 - weekday) % 7
        guard let todayService = calendar.date(bySettingHour: 10, minute: 30, second: 0, of: now) else {
            return nil
        }
        if daysUntil == 0, now > todayService {
            daysUntil = 7
        }
        guard
            let day = calendar.date(byAdding: .day, value: daysUntil, to: calendar.startOfDay(for: now)),
            let service = calendar.date(bySettingHour: 10, minute: 30, second: 0, of: day),
            let preService = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: day)
        else {
            return nil
        }
        return ServiceWindow(preService: preService, service: service)
    }
}

public struct PickupInput: Equatable, Sendable {
    public var code: String
    public var expectedCode: String
    public var guardianAuthorized: Bool
    public var custodyRestricted: Bool
    public var adultsOnDuty: Int

    public init(code: String, expectedCode: String, guardianAuthorized: Bool, custodyRestricted: Bool, adultsOnDuty: Int) {
        self.code = code
        self.expectedCode = expectedCode
        self.guardianAuthorized = guardianAuthorized
        self.custodyRestricted = custodyRestricted
        self.adultsOnDuty = adultsOnDuty
    }
}

public struct PickupDecision: Equatable, Sendable {
    public let allowed: Bool
    public let reason: String
}

public enum PickupRules {
    public static func evaluate(_ input: PickupInput) -> PickupDecision {
        if input.adultsOnDuty < 2 {
            return PickupDecision(allowed: false, reason: "Two adults must be on duty at the station.")
        }
        if !input.guardianAuthorized {
            return PickupDecision(allowed: false, reason: "This adult is not an authorized guardian.")
        }
        if input.custodyRestricted {
            return PickupDecision(allowed: false, reason: "A custody restriction blocks this pickup.")
        }
        if !codesMatch(input.code, input.expectedCode) {
            return PickupDecision(allowed: false, reason: "Security code does not match.")
        }
        return PickupDecision(allowed: true, reason: "Guardian verified and the security code matches.")
    }

    private static func codesMatch(_ left: String, _ right: String) -> Bool {
        let first = Array(left.trimmingCharacters(in: .whitespaces).utf8)
        let second = Array(right.trimmingCharacters(in: .whitespaces).utf8)
        let length = max(first.count, second.count)
        var mismatch = first.count == second.count ? 0 : 1
        for index in 0..<length {
            let leftByte = index < first.count ? Int(first[index]) : 0
            let rightByte = index < second.count ? Int(second[index]) : 0
            mismatch |= leftByte ^ rightByte
        }
        return mismatch == 0
    }
}

public struct DirectoryPerson: Equatable, Sendable, Identifiable {
    public let id: String
    public let displayName: String
    public let email: String
    public let emailPublic: Bool
    public let phone: String
    public let phonePublic: Bool

    public init(id: String, displayName: String, email: String, emailPublic: Bool, phone: String, phonePublic: Bool) {
        self.id = id
        self.displayName = displayName
        self.email = email
        self.emailPublic = emailPublic
        self.phone = phone
        self.phonePublic = phonePublic
    }
}

public enum DirectoryProjection {
    public static func project(viewerId: String, people: [DirectoryPerson]) -> [DirectoryPerson] {
        people.map { person in
            let own = person.id == viewerId
            return DirectoryPerson(
                id: person.id,
                displayName: person.displayName,
                email: own || person.emailPublic ? person.email : "",
                emailPublic: person.emailPublic,
                phone: own || person.phonePublic ? person.phone : "",
                phonePublic: person.phonePublic
            )
        }
    }
}

public struct GiftResult: Equatable, Sendable {
    public let charged: Bool
    public let processor: String
    public let sample: Bool
}

public enum GivingRules {
    /// Live charging also requires the server flags. The phone never marks a gift charged.
    public static func prepare(live: Bool) -> GiftResult {
        GiftResult(charged: false, processor: live ? "stripe" : "demo", sample: !live)
    }
}
