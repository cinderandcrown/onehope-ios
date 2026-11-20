import EventKit
import OneHopeCore
import OneHopeDesign
import SwiftUI

/// What to expect on a first Sunday, from weareonehope.com, plus an "I'm coming" heads-up for the welcome team.
public struct PlanVisitView: View {
    private let snapshot: ChurchSnapshot
    private let perform: (MemberAction) async -> String
    @State private var asking = false
    @State private var notice = ""

    public init(snapshot: ChurchSnapshot, perform: @escaping (MemberAction) async -> String) {
        self.snapshot = snapshot
        self.perform = perform
    }

    public var body: some View {
        let visit = snapshot.visit
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HeroPhoto("visit", title: "Plan a Visit", subtitle: visit.welcome)
                VStack(alignment: .leading, spacing: 8) {
                    Text(visit.serviceTime).font(.title3.bold())
                    Text(visit.arrival)
                    Text(visit.address)
                    Text(visit.directions).font(.footnote)
                    HStack {
                        if let maps = URL(string: visit.mapsUrl) {
                            Link("Open in Maps", destination: maps).buttonStyle(.bordered)
                        }
                        Button("Add to calendar") { addSundayToCalendar() }
                            .buttonStyle(.bordered)
                    }
                }
                .churchCard()
                VStack(alignment: .leading, spacing: 8) {
                    if let kids = snapshot.images.url(named: "kids") {
                        PhotoCard(url: kids, height: 160)
                    }
                    Text("One Hope Kids").font(.headline)
                    Text(visit.kids)
                }
                .churchCard()
                if let welcome = snapshot.images.url(named: "welcome") {
                    PhotoCard(url: welcome, height: 200)
                }
                if !notice.isEmpty {
                    Text(notice).font(.callout.weight(.semibold)).foregroundStyle(BrandColor.olive)
                }
                Button("I'm coming") { asking = true }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("visit-coming")
                InviteCard(invite: snapshot.invite)
                if let site = URL(string: visit.websiteUrl) {
                    Link("More on weareonehope.com", destination: site).font(.footnote)
                }
            }
            .padding()
        }
        .background(BrandColor.paper)
        .navigationTitle("Plan a Visit")
        .sheet(isPresented: $asking) {
            FollowUpForm(kind: .visit, signedIn: snapshot.signedIn, perform: perform) {
                notice = FollowUpKind.visit.thanks
            }
        }
    }

    private func addSundayToCalendar() {
        guard let window = ServiceSchedule.nextSunday(from: Date()) else { return }
        let title = "Sunday at \(snapshot.churchName)"
        let location = snapshot.visit.address
        let store = EKEventStore()
        store.requestWriteOnlyAccessToEvents { granted, _ in
            guard granted else { return }
            let item = EKEvent(eventStore: store)
            item.title = title
            item.location = location
            item.startDate = window.preService
            item.endDate = window.service.addingTimeInterval(90 * 60)
            item.calendar = store.defaultCalendarForNewEvents
            try? store.save(item, span: .thisEvent)
        }
    }
}
