import Foundation

struct PublicParts {
    let home: HomeReply
    let sermons: SermonsReply
    let groups: GroupsReply
    let knowJesus: KnowJesusReply
    let daily: DailyWordReply
    let growth: GrowthInfo?
}

struct MemberParts {
    let church: PublicParts
    let directory: PeopleReply
    let prayers: PrayersReply
    let me: MeReply
    let kids: KidsReply
    let serving: ServingReply
    let pathway: PathwayReply
    let funds: FundsReply
    let gifts: [GiftLine]
    let needsStepUp: Bool
    let registeredEventIds: [String]
}

func guestSnapshot(_ parts: PublicParts) -> ChurchSnapshot {
    let home = parts.home
    let messages = parts.sermons.videos.filter { $0.kind != "short" }
    var snapshot = ChurchSnapshot.bundled()
    snapshot.fromAPI = true
    snapshot.offlineNote = ""
    snapshot.visit = home.visit
    snapshot.giving = home.giving
    snapshot.invite = home.invite
    snapshot.gospel = parts.knowJesus.gospel
    snapshot.journey = parts.knowJesus.journey
    snapshot.daily = parts.daily.reading
    snapshot.dailyStreak = parts.daily.streak
    snapshot.growth = parts.growth
    snapshot.churchName = home.church.name
    snapshot.address = home.church.address
    snapshot.pastors = home.church.leadPastors
    snapshot.serviceISO = home.countdown.service
    snapshot.announcements = home.announcements.map { SampleChurch.Announcement(id: $0.id, title: $0.title, body: $0.body, sample: $0.sample) }
    snapshot.events = home.events.map { eventItem($0, registered: false) }
    snapshot.sermonTitle = messages.first?.title ?? ""
    snapshot.sermonSample = messages.isEmpty
    snapshot.sermonNote = messages.isEmpty ? "Sunday messages will appear here." : "From the church YouTube channel."
    snapshot.sermons = parts.sermons.videos.map(sermonLine)
    snapshot.groups = parts.groups.groups.map(groupLine)
    return snapshot
}

func memberSnapshot(_ parts: MemberParts) -> ChurchSnapshot {
    var snapshot = guestSnapshot(parts.church)
    snapshot.signedIn = true
    snapshot.events = parts.church.home.events.map { eventItem($0, registered: parts.registeredEventIds.contains($0.id)) }
    snapshot.prayers = parts.prayers.prayers.filter { !$0.body.isEmpty || $0.mine }.map {
        PrayerLine(
            id: $0.id,
            serve: $0.serve ?? "",
            body: $0.body,
            contactRequested: $0.contactRequested ?? false,
            sample: $0.sample,
            approved: $0.approved,
            mine: $0.mine
        )
    }
    snapshot.directory = parts.directory.people.map {
        DirectoryPerson(id: $0.id, displayName: $0.displayName, email: $0.email, emailPublic: $0.emailPublic, phone: $0.phone, phonePublic: $0.phonePublic)
    }
    snapshot.accountName = parts.me.person.displayName
    snapshot.accountEmail = parts.me.person.email
    snapshot.gifts = parts.gifts
    snapshot.needsStepUp = parts.needsStepUp
    snapshot.kids = parts.kids.kids.map { KidLine(id: $0.id, displayName: $0.displayName, classroom: $0.classroom, sample: $0.sample, checkedIn: $0.checkedIn ?? false) }
    snapshot.serving = parts.serving.assignments.map { ServingLine(id: $0.id, position: $0.position, status: $0.status, sample: $0.sample) }
    snapshot.pathway = parts.pathway.steps.map { PathwayStep(id: $0.id, title: $0.title, status: $0.status) }
    snapshot.funds = parts.funds.funds.map { FundLine(id: $0.id, name: $0.name) }
    snapshot.givingOpen = parts.funds.open
    snapshot.emailPublic = parts.me.person.emailPublic ?? false
    snapshot.phonePublic = parts.me.person.phonePublic ?? false
    snapshot.listedInDirectory = parts.me.person.listedInDirectory ?? false
    return snapshot
}

private func eventItem(_ event: HomeReply.Event, registered: Bool) -> SampleChurch.EventItem {
    SampleChurch.EventItem(
        id: event.id,
        title: event.title,
        detail: event.location,
        sample: event.sample,
        start: event.start.map { Date(timeIntervalSince1970: $0 / 1000) },
        end: event.end.map { Date(timeIntervalSince1970: $0 / 1000) },
        registered: registered,
        url: event.url.flatMap(URL.init(string:))
    )
}

private func sermonLine(_ video: SermonsReply.Video) -> SermonLine {
    SermonLine(
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        published: video.published.flatMap(parseISODate),
        kind: video.kind ?? "message",
        link: video.link.flatMap(URL.init(string:))
    )
}

private func groupLine(_ group: GroupsReply.Group) -> GroupLine {
    GroupLine(
        id: group.id,
        name: group.name,
        summary: group.summary,
        sample: group.sample,
        joined: group.joined,
        category: group.category ?? "Groups",
        schedule: group.schedule ?? "",
        area: group.area ?? "",
        leaders: group.leaders ?? [],
        joinType: group.joinType ?? "open",
        url: group.url.flatMap(URL.init(string:))
    )
}

/// Parses the ISO dates the server and YouTube send, with or without fractional seconds.
public func parseISODate(_ iso: String) -> Date? {
    guard !iso.isEmpty else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
        return date
    }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)
}
