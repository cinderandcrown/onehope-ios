import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Pastors and staff, with the photos and roles printed on the church's Our Team page.
public struct TeamView: View {
    private let snapshot: ChurchSnapshot

    public init(snapshot: ChurchSnapshot) {
        self.snapshot = snapshot
    }

    private var leads: [TeamMember] {
        Array(snapshot.media.team.prefix(1))
    }

    private var others: [TeamMember] {
        Array(snapshot.media.team.dropFirst())
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                ForEach(leads) { lead in
                    VStack(alignment: .leading, spacing: Space.md) {
                        RemoteImage(snapshot.images.url(named: "team_hero") ?? lead.photoURL)
                            .frame(height: 280)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        Text(lead.role).eyebrow()
                        Text(lead.name).font(.hopeDisplay).foregroundStyle(BrandColor.ink)
                        Text("Welcome to One Hope. We would love to meet you this Sunday.")
                            .font(.body)
                            .foregroundStyle(BrandColor.ink)
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: Space.md), GridItem(.flexible(), spacing: Space.md)], spacing: Space.lg) {
                    ForEach(others) { person in
                        VStack(alignment: .leading, spacing: Space.sm) {
                            RemoteImage(person.photoURL)
                                .aspectRatio(1, contentMode: .fit)
                                .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
                            Text(person.name).font(.headline).foregroundStyle(BrandColor.ink)
                            Text(person.role).font(.footnote).foregroundStyle(BrandColor.ink.opacity(0.8))
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .padding(Space.lg)
        }
        .tabBarClearance()
        .background(BrandColor.paper)
        .navigationTitle("Our Team")
        .navigationBarTitleDisplayMode(.inline)
    }
}
