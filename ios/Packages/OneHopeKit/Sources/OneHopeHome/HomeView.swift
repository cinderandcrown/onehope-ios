import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct HomeView: View {
    private let snapshot: ChurchSnapshot
    public init(snapshot: ChurchSnapshot) {
        self.snapshot = snapshot
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Wordmark()
                    PhotoCard("hero")
                    Text(snapshot.churchName).font(.largeTitle).foregroundStyle(BrandColor.ink)
                    Text(snapshot.address).font(.body)
                    if snapshot.fromAPI {
                        Text("Loaded from the church API.").font(.footnote)
                    } else {
                        Text(snapshot.offlineNote).font(.footnote)
                        SampleBadge()
                    }
                    if let date = Self.serviceDate(snapshot.serviceISO) {
                        Text(date, style: .relative)
                            .font(.title2)
                            .accessibilityLabel("Time until the Sunday gathering")
                    }
                    Text("Pre-service coffee at 10:00 a.m. Gathering at 10:30.")
                    Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).")
                    ForEach(snapshot.announcements) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.title).font(.headline)
                                if item.sample {
                                    SampleBadge()
                                }
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

    private static func serviceDate(_ iso: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }
}
