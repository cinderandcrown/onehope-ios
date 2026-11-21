import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Revival Coffee as published on myrevivalcoffee.com on Nov 19, 2026.
/// Revival Coffee: menu, hours and directions. Orders are taken at the counter.
public struct CoffeeView: View {
    @Environment(\.churchImages) private var images
    @Environment(\.churchMedia) private var media

    public init() {}

    private static let mapsLink = "https://maps.apple.com/?address=1251%20S.%20Sherman%20St.%20Ste.%20112%2C%20Richardson%2C%20TX%2075081"

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                hero
                actions
                hours
                gallery
                menuBoard
                menu("Coffee & Drinks", items: CoffeeMenuData.drinks)
                menu("Food & Pastries", items: CoffeeMenuData.food)
            }
            .padding(Space.lg)
        }
        .tabBarClearance()
        .background(BrandColor.paper)
        .navigationTitle("Revival Coffee")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            PhotoCard("revival", height: 240)
            Text("Coffee. Community. Welcome.").font(.hopeDisplay).foregroundStyle(BrandColor.ink)
            Text("Revival Coffee shares the building with One Hope. Menu and hours are from their site.")
                .font(.body)
                .foregroundStyle(BrandColor.ink)
            Text("Order at the counter.").font(.headline).foregroundStyle(BrandColor.terracottaDeep)
        }
    }

    private var actions: some View {
        HStack(spacing: Space.md) {
            if let maps = URL(string: Self.mapsLink) {
                Link(destination: maps) { Text("Directions") }.buttonStyle(PrimaryButtonStyle())
            }
            if let mail = URL(string: "mailto:info@myrevivalcoffee.com") {
                Link(destination: mail) { Text("Email the shop") }.buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    private var hours: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("Hours").font(.hopeTitle)
            Text("Monday–Friday 7:00 AM – 3:00 PM")
            Text("Weekends: email the shop for hours.")
        }
        .churchCard()
    }

    @ViewBuilder private var gallery: some View {
        if !media.revivalGallery.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionHeader("Inside Revival", eyebrow: "Gallery")
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: Space.md) {
                        ForEach(media.revivalGallery) { photo in
                            PhotoTile(url: photo.photoURL, title: photo.caption, width: 220, height: 280)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollClipDisabled()
            }
        }
    }

    @ViewBuilder private var menuBoard: some View {
        if let board = images.url(named: "revival_menu") {
            PhotoCard(url: board, height: 160)
        }
    }

    private func menu(_ title: String, items: [MenuLine]) -> some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(title).font(.hopeTitle)
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(item.name).font(.headline)
                        Spacer(minLength: Space.sm)
                        Text(item.price).font(.subheadline.weight(.semibold)).foregroundStyle(BrandColor.terracottaDeep)
                    }
                    Text(item.detail).font(.footnote)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .churchCard()
    }
}
