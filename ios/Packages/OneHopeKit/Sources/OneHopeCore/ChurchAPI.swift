import Foundation

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
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ChurchAPIError.transport("The response was not HTTP.")
        }
        return (http.statusCode, data)
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

    public static func bundled(offline: Bool = false) -> ChurchSnapshot {
        ChurchSnapshot(
            fromAPI: false,
            offlineNote: offline ? "Saved sample. The church API did not answer." : "Sample on this device.",
            churchName: SampleChurch.name,
            address: SampleChurch.address,
            pastors: SampleChurch.pastors,
            serviceISO: "",
            announcements: SampleChurch.announcements,
            events: SampleChurch.events,
            sermonTitle: "A new season of growth",
            sermonSample: true,
            sermonNote: "Public sermons load from the YouTube channel when the API can reach it.",
            groups: [GroupLine(id: "group-weekday", name: "Weekday group", summary: "Sample group you can join.", sample: true, joined: false)],
            prayers: [PrayerLine(id: "prayer-public", body: "Pray for our city.", sample: true)],
            directory: DirectoryProjection.project(viewerId: SampleChurch.viewer.id, people: SampleChurch.directory),
            accountName: SampleChurch.viewer.displayName,
            accountEmail: SampleChurch.viewer.email,
            gifts: [GiftLine(id: "gift-local", fundName: "General", amountCents: 2500, charged: false, sample: true)],
            needsStepUp: false,
            kids: [KidLine(id: "child-local", displayName: "Sample child", classroom: "Preschool", sample: true)],
            serving: [],
            pathway: [PathwayStep(id: "baptism", title: "Baptism", status: "In progress")]
        )
    }
}

public struct GroupLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let summary: String
    public let sample: Bool
    public let joined: Bool
}

public struct PrayerLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let body: String
    public let sample: Bool
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

    public func loadMember(token: String) async throws -> ChurchSnapshot {
        let home: HomeReply = try await send("/api/home", method: "GET", token: nil, json: nil)
        let directory: PeopleReply = try await send("/api/directory", method: "GET", token: token, json: nil)
        let groups: GroupsReply = try await send("/api/groups", method: "GET", token: token, json: nil)
        let prayers: PrayersReply = try await send("/api/prayers", method: "GET", token: token, json: nil)
        let sermons: SermonsReply = try await send("/api/sermons", method: "GET", token: nil, json: nil)
        let me: MeReply = try await send("/api/me", method: "GET", token: token, json: nil)
        let kids: KidsReply = try await send("/api/kids/mine", method: "GET", token: token, json: nil)
        let serving: ServingReply = try await send("/api/serving/mine", method: "GET", token: token, json: nil)
        let pathway: PathwayReply = try await send("/api/pathways/mine", method: "GET", token: token, json: nil)
        var gifts: [GiftLine] = []
        var needsStepUp = false
        do {
            let mine: GiftsReply = try await send("/api/giving/mine", method: "GET", token: token, json: nil)
            gifts = mine.gifts.map { GiftLine(id: $0.id, fundName: $0.fundName, amountCents: $0.amountCents, charged: $0.charged, sample: $0.sample) }
        } catch let error as ChurchAPIError where error.code == "step_up_required" {
            needsStepUp = true
        } catch {
            needsStepUp = true
        }
        let video = sermons.videos.first
        return ChurchSnapshot(
            fromAPI: true,
            offlineNote: "",
            churchName: home.church.name,
            address: home.church.address,
            pastors: home.church.leadPastors,
            serviceISO: home.countdown.service,
            announcements: home.announcements.map { SampleChurch.Announcement(id: $0.id, title: $0.title, body: $0.body, sample: $0.sample) },
            events: home.events.map { SampleChurch.EventItem(id: $0.id, title: $0.title, detail: $0.location, sample: $0.sample) },
            sermonTitle: video?.title ?? home.sampleSermon.title,
            sermonSample: video == nil,
            sermonNote: video == nil ? "The YouTube feed did not return a video. The title above is a sample." : "From the public YouTube channel.",
            groups: groups.groups.map { GroupLine(id: $0.id, name: $0.name, summary: $0.summary, sample: $0.sample, joined: $0.joined) },
            prayers: prayers.prayers.filter { !$0.body.isEmpty }.map { PrayerLine(id: $0.id, body: $0.body, sample: $0.sample) },
            directory: directory.people.map {
                DirectoryPerson(id: $0.id, displayName: $0.displayName, email: $0.email, emailPublic: $0.emailPublic, phone: $0.phone, phonePublic: $0.phonePublic)
            },
            accountName: me.person.displayName,
            accountEmail: me.person.email,
            gifts: gifts,
            needsStepUp: needsStepUp,
            kids: kids.kids.map { KidLine(id: $0.id, displayName: $0.displayName, classroom: $0.classroom, sample: $0.sample) },
            serving: serving.assignments.map { ServingLine(id: $0.id, position: $0.position, status: $0.status, sample: $0.sample) },
            pathway: pathway.steps.map { PathwayStep(id: $0.id, title: $0.title, status: $0.status) }
        )
    }

    private func send<Response: Decodable>(
        _ path: String,
        method: String,
        token: String?,
        json: Data?
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw ChurchAPIError.transport("The API address is not valid.")
        }
        let (status, data) = try await transport.send(url: url, method: method, body: json, bearer: token)
        if status >= 400 {
            let failure = try? JSONDecoder().decode(FailureBody.self, from: data)
            throw ChurchAPIError(status: status, code: failure?.code ?? "error", message: failure?.error ?? "Request failed.")
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw ChurchAPIError.transport("The church API returned a shape this app does not understand.")
        }
    }
}

private struct FailureBody: Decodable {
    let error: String
    let code: String
}

private struct HomeReply: Decodable {
    struct Church: Decodable { let name: String; let address: String; let leadPastors: [String] }
    struct Countdown: Decodable { let service: String }
    struct Item: Decodable { let id: String; let title: String; let body: String; let sample: Bool }
    struct Event: Decodable { let id: String; let title: String; let location: String; let sample: Bool }
    struct Sermon: Decodable { let title: String }
    let church: Church
    let countdown: Countdown
    let announcements: [Item]
    let events: [Event]
    let sampleSermon: Sermon
}

private struct PeopleReply: Decodable {
    struct Person: Decodable {
        let id: String
        let displayName: String
        let email: String
        let phone: String
        let emailPublic: Bool
        let phonePublic: Bool
    }

    let people: [Person]
}

private struct GroupsReply: Decodable {
    struct Group: Decodable { let id: String; let name: String; let summary: String; let sample: Bool; let joined: Bool }
    let groups: [Group]
}

private struct PrayersReply: Decodable {
    struct Prayer: Decodable { let id: String; let body: String; let sample: Bool }
    let prayers: [Prayer]
}

private struct SermonsReply: Decodable {
    struct Video: Decodable { let title: String }
    let videos: [Video]
}

private struct MeReply: Decodable {
    struct Person: Decodable { let displayName: String; let email: String }
    let person: Person
}

private struct KidsReply: Decodable {
    struct Kid: Decodable { let id: String; let displayName: String; let classroom: String; let sample: Bool }

    let kids: [Kid]
}

private struct ServingReply: Decodable {
    struct Item: Decodable { let id: String; let position: String; let status: String; let sample: Bool }

    let assignments: [Item]
}

private struct PathwayReply: Decodable {
    struct Step: Decodable { let id: String; let title: String; let status: String }

    let steps: [Step]
}

private struct GiftsReply: Decodable {
    struct Gift: Decodable { let id: String; let fundName: String; let amountCents: Int; let charged: Bool; let sample: Bool }
    let gifts: [Gift]
}
