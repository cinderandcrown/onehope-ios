import Foundation

struct MemberParts {
    let home: HomeReply
    let directory: PeopleReply
    let groups: GroupsReply
    let prayers: PrayersReply
    let sermons: SermonsReply
    let me: MeReply
    let kids: KidsReply
    let serving: ServingReply
    let pathway: PathwayReply
    let funds: FundsReply
    let gifts: [GiftLine]
    let needsStepUp: Bool
}

func memberSnapshot(_ parts: MemberParts) -> ChurchSnapshot {
    let video = parts.sermons.videos.first
    return ChurchSnapshot(
        fromAPI: true,
        offlineNote: "",
        churchName: parts.home.church.name,
        address: parts.home.church.address,
        pastors: parts.home.church.leadPastors,
        serviceISO: parts.home.countdown.service,
        announcements: parts.home.announcements.map { SampleChurch.Announcement(id: $0.id, title: $0.title, body: $0.body, sample: $0.sample) },
        events: parts.home.events.map {
            SampleChurch.EventItem(
                id: $0.id,
                title: $0.title,
                detail: $0.location,
                sample: $0.sample,
                start: $0.start.map { Date(timeIntervalSince1970: $0 / 1000) },
                end: $0.end.map { Date(timeIntervalSince1970: $0 / 1000) }
            )
        },
        sermonTitle: video?.title ?? "",
        sermonSample: video == nil,
        sermonNote: video == nil ? "Sunday messages will appear here." : "From the church YouTube channel.",
        groups: parts.groups.groups.map { GroupLine(id: $0.id, name: $0.name, summary: $0.summary, sample: $0.sample, joined: $0.joined) },
        prayers: parts.prayers.prayers.filter { !$0.body.isEmpty || $0.mine }.map {
            PrayerLine(id: $0.id, body: $0.body, sample: $0.sample, approved: $0.approved, mine: $0.mine)
        },
        directory: parts.directory.people.map {
            DirectoryPerson(id: $0.id, displayName: $0.displayName, email: $0.email, emailPublic: $0.emailPublic, phone: $0.phone, phonePublic: $0.phonePublic)
        },
        accountName: parts.me.person.displayName,
        accountEmail: parts.me.person.email,
        gifts: parts.gifts,
        needsStepUp: parts.needsStepUp,
        kids: parts.kids.kids.map { KidLine(id: $0.id, displayName: $0.displayName, classroom: $0.classroom, sample: $0.sample) },
        serving: parts.serving.assignments.map { ServingLine(id: $0.id, position: $0.position, status: $0.status, sample: $0.sample) },
        pathway: parts.pathway.steps.map { PathwayStep(id: $0.id, title: $0.title, status: $0.status) },
        sermons: parts.sermons.videos.map { SermonLine(id: $0.id, title: $0.title, thumbnail: $0.thumbnail) },
        funds: parts.funds.funds.map { FundLine(id: $0.id, name: $0.name) },
        givingOpen: parts.funds.open,
        emailPublic: parts.me.person.emailPublic ?? false,
        phonePublic: parts.me.person.phonePublic ?? false,
        listedInDirectory: parts.me.person.listedInDirectory ?? false
    )
}
