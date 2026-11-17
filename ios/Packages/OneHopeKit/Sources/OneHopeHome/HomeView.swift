import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct HomeView: View {
    public init() {}

    public var body: some View {
        let window = ServiceSchedule.nextSunday(from: Date())
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Wordmark()
                    PhotoCard("hero")
                    Text(SampleChurch.name).font(.largeTitle).foregroundStyle(BrandColor.ink)
                    Text(SampleChurch.address).font(.body)
                    if let window {
                        Text(window.service, style: .relative)
                            .font(.title2)
                            .accessibilityLabel("Time until the Sunday gathering")
                        Text("Pre-service coffee at 10:00 a.m. Gathering at 10:30.")
                    } else {
                        EmptyHint("The next gathering time is unavailable.")
                    }
                    Text("Lead pastors \(SampleChurch.pastors.joined(separator: " and ")).")
                    ForEach(SampleChurch.announcements) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.title).font(.headline)
                                if item.sample { SampleBadge() }
                            }
                            Text(item.body)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(BrandColor.card)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                }
                .padding()
            }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.home))
        }
    }
}
