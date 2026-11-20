import OneHopeCore
import OneHopeDesign
import OneHopeHome
import SwiftUI

/// Who we are, with the church's own pictures and the details a new family needs.
struct AboutScreen: View {
    let snapshot: ChurchSnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                HeroPhoto("about", title: snapshot.churchName, subtitle: "A life in God's grace")
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("Sundays").eyebrow()
                    Text(snapshot.visit.serviceTime).font(.hopeHeadline)
                    Text(snapshot.address)
                    Text(snapshot.visit.directions).font(.footnote)
                    if let maps = URL(string: snapshot.visit.mapsUrl) {
                        Link(destination: maps) { Text("Open in Maps") }
                            .buttonStyle(SecondaryButtonStyle())
                            .padding(.top, Space.xs)
                    }
                }
                .churchCard()
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("Lead pastors").eyebrow()
                    Text(snapshot.pastors.joined(separator: " and ")).font(.hopeHeadline)
                    if !snapshot.media.team.isEmpty {
                        NavigationLink("Meet the team") { TeamView(snapshot: snapshot) }
                            .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .churchCard()
                if let site = URL(string: snapshot.visit.websiteUrl) {
                    Link("More on weareonehope.com", destination: site).font(.footnote)
                }
            }
            .padding(Space.lg)
        }
        .background(BrandColor.paper)
        .navigationTitle("About")
        .accessibilityIdentifier("more-about-screen")
    }
}
