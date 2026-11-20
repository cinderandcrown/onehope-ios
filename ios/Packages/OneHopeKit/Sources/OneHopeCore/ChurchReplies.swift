import Foundation

// Shapes of the server replies the client decodes. See contracts/openapi.json.

struct HomeReply: Decodable {
    struct Church: Decodable { let name: String; let address: String; let leadPastors: [String] }
    struct Countdown: Decodable { let service: String }
    struct Item: Decodable { let id: String; let title: String; let body: String; let sample: Bool }
    struct Event: Decodable {
        let id: String
        let title: String
        let location: String
        let sample: Bool
        let start: Double?
        let end: Double?
        let url: String?
    }

    let church: Church
    let countdown: Countdown
    let announcements: [Item]
    let events: [Event]
    let visit: VisitInfo
    let giving: GivingInfo
    let invite: InviteInfo
    let social: [SocialLink]?
    let images: ChurchImagesReply?
}

struct ChurchImagesReply: Decodable {
    let hero: String?
    let about: String?
    let video: String?
    let revival: String?
    let og: String?
}

struct KnowJesusReply: Decodable {
    let gospel: GospelInfo
    let journey: [JourneyDay]
    let journeyMonth: [JourneyDay]?
}

struct DailyWordReply: Decodable {
    let reading: DailyWord
    let streak: Int?
}

struct PeopleReply: Decodable {
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

struct GroupsReply: Decodable {
    struct Group: Decodable {
        let id: String
        let name: String
        let summary: String
        let sample: Bool
        let joined: Bool
        let category: String?
        let schedule: String?
        let area: String?
        let leaders: [String]?
        let joinType: String?
        let url: String?
    }

    let groups: [Group]
}

struct PrayersReply: Decodable {
    struct Prayer: Decodable {
        let id: String
        let serve: String?
        let body: String
        let contactRequested: Bool?
        let sample: Bool
        let approved: Bool
        let mine: Bool
        let prayedCount: Int?
        let prayed: Bool?
    }

    let prayers: [Prayer]
}

struct SermonsReply: Decodable {
    struct Video: Decodable {
        let id: String
        let title: String
        let thumbnail: String?
        let published: String?
        let kind: String?
        let link: String?
    }

    let videos: [Video]
}

struct EventsMineReply: Decodable {
    struct Event: Decodable { let id: String; let registered: Bool }

    let events: [Event]
}

struct FundsReply: Decodable {
    struct Fund: Decodable { let id: String; let name: String }
    let funds: [Fund]
    let open: Bool
}

struct MeReply: Decodable {
    struct Person: Decodable {
        let displayName: String
        let email: String
        let emailPublic: Bool?
        let phonePublic: Bool?
        let listedInDirectory: Bool?
        let role: String?
    }

    let person: Person
}

struct KidsReply: Decodable {
    struct Kid: Decodable { let id: String; let displayName: String; let classroom: String; let sample: Bool; let checkedIn: Bool? }

    let kids: [Kid]
}

struct ServingReply: Decodable {
    struct Item: Decodable { let id: String; let position: String; let status: String; let sample: Bool }

    let assignments: [Item]
}

struct PathwayReply: Decodable {
    struct Step: Decodable { let id: String; let title: String; let status: String }

    let steps: [Step]
}

struct GiftsReply: Decodable {
    struct Gift: Decodable { let id: String; let fundName: String; let amountCents: Int; let charged: Bool; let sample: Bool }
    let gifts: [Gift]
}
