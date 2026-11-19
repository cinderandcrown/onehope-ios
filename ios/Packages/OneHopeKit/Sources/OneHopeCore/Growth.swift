import Foundation

/// A link the church publishes, with the title it uses.
public struct ChurchLink: Decodable, Equatable, Sendable {
    public let title: String
    public let url: String
}

/// The church's Toolkit for Spiritual Growth page.
public struct ToolkitInfo: Decodable, Equatable, Sendable {
    public struct Book: Decodable, Equatable, Sendable, Identifiable {
        public let title: String
        public let author: String

        public var id: String {
            title
        }
    }

    public let title: String
    public let readingPlan: ChurchLink
    public let staffReads: [Book]
    public let podcasts: [String]
    public let playlist: ChurchLink
    public let scriptures: [VerseLine]
    public let proclamations: ChurchLink
}

/// Hope City Recovery: the Unlocking Freedom group and the Life Evaluation Worksheet.
public struct RecoveryInfo: Decodable, Equatable, Sendable {
    public struct Worksheet: Decodable, Equatable, Sendable {
        public let title: String
        public let prompt: String
        public let areas: [String]
        public let pdfUrl: String
    }

    public struct Group: Decodable, Equatable, Sendable {
        public let name: String
        public let schedule: String
        public let area: String
        public let leaders: [String]
        public let url: String?
    }

    public let title: String
    public let subtitle: String
    public let worksheet: Worksheet
    public let group: Group?
}

/// One box on the church's Support/Assistance Request.
public struct SupportNeed: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let label: String
}

public struct SupportInfo: Decodable, Equatable, Sendable {
    public let title: String
    public let intro: String
    public let prompt: String
    public let needs: [SupportNeed]
}

/// Everything from `GET /api/growth`.
public struct GrowthInfo: Decodable, Equatable, Sendable {
    public let toolkit: ToolkitInfo
    public let recovery: RecoveryInfo
    public let support: SupportInfo
}

/// A Support/Assistance Request. The form promises a call back, so consent is always sent.
public struct SupportRequest: Encodable, Equatable, Sendable {
    public let needs: [String]
    public let name: String?
    public let email: String?
    public let phone: String?
    public let consent: Bool

    /// A member's request; the server uses their account name and email.
    public static func member(needs: [String], consent: Bool) -> Result<SupportRequest, SupportProblem> {
        guard !needs.isEmpty else {
            return .failure(.needs)
        }
        guard consent else {
            return .failure(.consent)
        }
        return .success(SupportRequest(needs: needs, name: nil, email: nil, phone: nil, consent: true))
    }

    /// The same checks the server runs for a guest.
    public static func guest(needs: [String], name: String, email: String, phone: String, consent: Bool) -> Result<SupportRequest, SupportProblem> {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let email = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let phone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needs.isEmpty else {
            return .failure(.needs)
        }
        guard !name.isEmpty else {
            return .failure(.name)
        }
        guard !email.isEmpty || !phone.isEmpty else {
            return .failure(.contact)
        }
        guard consent else {
            return .failure(.consent)
        }
        return .success(SupportRequest(needs: needs, name: name, email: email, phone: phone, consent: true))
    }
}

public enum SupportProblem: Error, Equatable {
    case needs
    case name
    case contact
    case consent

    public var message: String {
        switch self {
        case .needs: "Please check at least one box."
        case .name: "Please tell us your name."
        case .contact: "Please leave an email or phone so we can reach you."
        case .consent: "Check the box so we can contact you."
        }
    }
}

/// The Church Center giving frequencies.
public enum GivingFrequency: String, CaseIterable, Identifiable, Sendable, Encodable {
    case once
    case weekly
    case everyOtherWeek = "every_other_week"
    case twiceMonthly = "twice_monthly"
    case monthly

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .once: "Once"
        case .weekly: "Weekly"
        case .everyOtherWeek: "Every other week"
        case .twiceMonthly: "Twice monthly"
        case .monthly: "Monthly"
        }
    }
}

/// A native gift. Only sent when giving is switched on with Stripe keys.
public struct GiftRequest: Encodable, Equatable, Sendable {
    public let amountCents: Int
    public let fundId: String
    public let recurring: GivingFrequency

    public init(amountCents: Int, fundId: String, recurring: GivingFrequency) {
        self.amountCents = amountCents
        self.fundId = fundId
        self.recurring = recurring
    }

    /// Reads "25", "25.50", or "$1,250.00". Returns nil for anything else, zero, or over $100,000.
    public static func cents(from text: String) -> Int? {
        let cleaned = text.filter { !"$, ".contains($0) }
        let parts = cleaned.split(separator: ".", omittingEmptySubsequences: false)
        guard (1 ... 2).contains(parts.count), let whole = Int(parts[0]), whole >= 0 else {
            return nil
        }
        var fraction = 0
        if parts.count == 2 {
            let digits = parts[1]
            guard (1 ... 2).contains(digits.count), digits.allSatisfy(\.isNumber), let value = Int(digits) else {
                return nil
            }
            fraction = digits.count == 1 ? value * 10 : value
        }
        let cents = whole * 100 + fraction
        return (1 ... 10_000_000).contains(cents) ? cents : nil
    }
}
