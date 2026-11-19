import Foundation
import os

private let reachabilityLog = Logger(subsystem: "com.cinderandcrown.onehope", category: "reachability")

public enum APIEndpoint {
    public static func resolve() -> URL? {
        let args = ProcessInfo.processInfo.arguments
        if let flag = args.firstIndex(of: "-apiBaseURL"), args.indices.contains(flag + 1) {
            return URL(string: args[flag + 1])
        }
        if let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String, !raw.isEmpty {
            return URL(string: raw)
        }
        return nil
    }
}

public protocol HTTPTransport: Sendable {
    func send(url: URL, method: String, body: Data?, bearer: String?) async throws -> (status: Int, body: Data)
}

public struct URLSessionTransport: HTTPTransport {
    public init() {}

    public func send(url: URL, method: String, body: Data?, bearer: String?) async throws -> (status: Int, body: Data) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError {
            throw churchReachError(error)
        } catch {
            reachabilityLog.error("The church request failed before a response.")
            throw ChurchAPIError(status: 0, code: "server", message: "The church server didn't answer.")
        }
        guard let http = response as? HTTPURLResponse else {
            throw ChurchAPIError.transport("The response was not HTTP.")
        }
        return (http.statusCode, data)
    }
}

func churchReachError(_ error: URLError) -> ChurchAPIError {
    switch error.code {
    case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .internationalRoamingOff:
        reachabilityLog.error("Offline. URL error \(error.code.rawValue, privacy: .public).")
        return ChurchAPIError(status: 0, code: "offline", message: "You appear to be offline.")
    default:
        reachabilityLog.error("Server unreachable. URL error \(error.code.rawValue, privacy: .public).")
        return ChurchAPIError(status: 0, code: "server", message: "The church server didn't answer.")
    }
}

public struct ChurchAPIError: Error, Equatable {
    public let status: Int
    public let code: String
    public let message: String

    public static func transport(_ message: String) -> ChurchAPIError {
        ChurchAPIError(status: 0, code: "transport", message: message)
    }
}

public struct ChurchSnapshot: Equatable, Sendable {
    public var fromAPI: Bool
    /// False for a guest. Home, Watch, Know Jesus, Plan a Visit, and Give work either way.
    public var signedIn: Bool
    public var visit: VisitInfo
    public var giving: GivingInfo
    public var invite: InviteInfo
    public var gospel: GospelInfo?
    public var journey: [JourneyDay]
    public var daily: DailyWord?
    /// The member's synced Daily Word streak. Nil for guests, who keep theirs on the phone.
    public var dailyStreak: Int?
    public var offlineNote: String
    public var churchName: String
    public var address: String
    public var pastors: [String]
    public var serviceISO: String
    public var announcements: [SampleChurch.Announcement]
    public var events: [SampleChurch.EventItem]
    public var sermonTitle: String
    public var sermonSample: Bool
    public var sermonNote: String
    public var groups: [GroupLine]
    public var prayers: [PrayerLine]
    public var directory: [DirectoryPerson]
    public var accountName: String
    public var accountEmail: String
    public var gifts: [GiftLine]
    public var needsStepUp: Bool
    public var kids: [KidLine]
    public var serving: [ServingLine]
    public var pathway: [PathwayStep]
    public var sermons: [SermonLine]
    public var funds: [FundLine]
    public var givingOpen: Bool
    public var emailPublic: Bool
    public var phonePublic: Bool
    public var listedInDirectory: Bool

    public static func bundled(offline: Bool = false) -> ChurchSnapshot {
        ChurchSnapshot(
            fromAPI: false,
            signedIn: false,
            visit: .bundled,
            giving: .bundled,
            invite: .bundled,
            gospel: nil,
            journey: [],
            daily: nil,
            dailyStreak: nil,
            offlineNote: offline ? "We couldn't reach the church just now." : "Loading the church…",
            churchName: SampleChurch.name,
            address: SampleChurch.address,
            pastors: SampleChurch.pastors,
            serviceISO: "",
            announcements: [],
            events: [],
            sermonTitle: "",
            sermonSample: false,
            sermonNote: offline ? "We couldn't reach the church just now." : "Sunday messages will appear here.",
            groups: [],
            prayers: [],
            directory: [],
            accountName: "",
            accountEmail: "",
            gifts: [],
            needsStepUp: false,
            kids: [],
            serving: [],
            pathway: [],
            sermons: [],
            funds: [],
            givingOpen: false,
            emailPublic: false,
            phonePublic: false,
            listedInDirectory: false
        )
    }
}

public struct GroupLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let summary: String
    public let sample: Bool
    public let joined: Bool
    public let category: String
    public let schedule: String
    public let area: String
    public let leaders: [String]
    /// "open" joins in the app. "request" goes through the leaders on Church Center.
    public let joinType: String
    public let url: URL?

    public var joinsInApp: Bool {
        joinType != "request"
    }
}

public struct PrayerLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let serve: String
    public let body: String
    public let contactRequested: Bool
    public let sample: Bool
    public let approved: Bool
    public let mine: Bool
}

public struct KidLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let displayName: String
    public let classroom: String
    public let sample: Bool
}

public struct ServingLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let position: String
    public let status: String
    public let sample: Bool
}

public struct PathwayStep: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let status: String
}

public struct SermonLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let thumbnail: String?
    public let published: Date?
    /// "message" for full Sunday messages, "short" for clips.
    public let kind: String
    public let link: URL?

    public var isShort: Bool {
        kind == "short"
    }
}

public enum MemberAction: Sendable {
    case join(String)
    case message(String, String)
    case register(String)
    /// Church Center's Prayer Request fields: how can we serve you, please contact me, and the need.
    case prayer(serve: String, contact: Bool, body: String)
    case addChild(String, String)
    case checkIn(String)
    case pickup(String, String)
    /// Works for guests too.
    case followUp(FollowUpRequest)
    case readDailyWord
}

public struct FundLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
}

public struct GiftLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let fundName: String
    public let amountCents: Int
    public let charged: Bool
    public let sample: Bool
}

public struct ChurchClient: Sendable {
    public let baseURL: URL
    public let transport: any HTTPTransport

    public init(baseURL: URL, transport: any HTTPTransport) {
        self.baseURL = baseURL
        self.transport = transport
    }

    public func login(email: String, password: String) async throws -> String {
        struct Body: Encodable { let email: String; let password: String }
        struct Reply: Decodable { let token: String }
        let reply: Reply = try await send("/api/auth/login", method: "POST", token: nil, json: JSONEncoder().encode(Body(email: email, password: password)))
        return reply.token
    }

    public func stepUp(token: String, password: String) async throws {
        struct Body: Encodable { let password: String }
        struct Reply: Decodable { let stepUpUntil: Int }
        let _: Reply = try await send("/api/auth/step-up", method: "POST", token: token, json: JSONEncoder().encode(Body(password: password)))
    }

    /// Everything a guest can see: Home, Watch, Know Jesus, Plan a Visit, Give, groups, and events.
    public func loadGuest() async throws -> ChurchSnapshot {
        try await guestSnapshot(loadPublic(token: nil))
    }

    public func loadMember(token: String) async throws -> ChurchSnapshot {
        let church = try await loadPublic(token: token)
        let directory: PeopleReply = try await send("/api/directory", method: "GET", token: token, json: nil)
        let prayers: PrayersReply = try await send("/api/prayers", method: "GET", token: token, json: nil)
        let me: MeReply = try await send("/api/me", method: "GET", token: token, json: nil)
        let kids: KidsReply = try await send("/api/kids/mine", method: "GET", token: token, json: nil)
        let serving: ServingReply = try await send("/api/serving/mine", method: "GET", token: token, json: nil)
        let pathway: PathwayReply = try await send("/api/pathways/mine", method: "GET", token: token, json: nil)
        let funds: FundsReply = try await send("/api/giving/funds", method: "GET", token: nil, json: nil)
        let eventMine: EventsMineReply = try await send("/api/events/mine", method: "GET", token: token, json: nil)
        var gifts: [GiftLine] = []
        var needsStepUp = false
        do {
            let mine: GiftsReply = try await send("/api/giving/mine", method: "GET", token: token, json: nil)
            gifts = mine.gifts.map { GiftLine(id: $0.id, fundName: $0.fundName, amountCents: $0.amountCents, charged: $0.charged, sample: $0.sample) }
        } catch {
            needsStepUp = true
        }
        return memberSnapshot(
            MemberParts(
                church: church,
                directory: directory,
                prayers: prayers,
                me: me,
                kids: kids,
                serving: serving,
                pathway: pathway,
                funds: funds,
                gifts: gifts,
                needsStepUp: needsStepUp,
                registeredEventIds: eventMine.events.filter(\.registered).map(\.id)
            )
        )
    }

    private func loadPublic(token: String?) async throws -> PublicParts {
        let home: HomeReply = try await send("/api/home", method: "GET", token: nil, json: nil)
        let sermons: SermonsReply = try await send("/api/sermons", method: "GET", token: nil, json: nil)
        let groups: GroupsReply = try await send("/api/groups", method: "GET", token: token, json: nil)
        let knowJesus: KnowJesusReply = try await send("/api/know-jesus", method: "GET", token: nil, json: nil)
        let daily: DailyWordReply = try await send("/api/daily-word", method: "GET", token: token, json: nil)
        return PublicParts(home: home, sermons: sermons, groups: groups, knowJesus: knowJesus, daily: daily)
    }

    func send<Response: Decodable>(
        _ path: String,
        method: String,
        token: String?,
        json: Data?
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw ChurchAPIError.transport("We couldn't reach the church just now.")
        }
        let (status, data) = try await transport.send(url: url, method: method, body: json, bearer: token)
        if status >= 400 {
            let failure = try? JSONDecoder().decode(FailureBody.self, from: data)
            throw ChurchAPIError(status: status, code: failure?.code ?? "error", message: failure?.error ?? "Request failed.")
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw ChurchAPIError.transport("We couldn't read the church's reply. Please try again.")
        }
    }
}

private struct FailureBody: Decodable {
    let error: String
    let code: String
}
