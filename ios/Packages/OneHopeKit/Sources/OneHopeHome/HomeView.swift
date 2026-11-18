import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct HomeView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void

    public init(snapshot: ChurchSnapshot, onRefresh: @escaping () async -> Void = {}) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Wordmark()
                    PhotoCard("hero")
                    Text(snapshot.churchName).font(.largeTitle).foregroundStyle(BrandColor.ink)
                    Text(snapshot.address).font(.body)
                    if !snapshot.offlineNote.isEmpty {
                        Text(snapshot.offlineNote).font(.footnote)
                    }
                    if let date = Self.serviceDate(snapshot.serviceISO) {
                        Text(date, style: .relative)
                            .font(.title2)
                            .accessibilityLabel("Time until the Sunday gathering")
                    }
                    Text("Come early for donuts and coffee. Gathering at 10:30.")
                    Text("Lead pastors \(snapshot.pastors.joined(separator: " and ")).")
                    if !snapshot.events.isEmpty {
                        Text("Upcoming").font(.headline)
                    }
                    ForEach(snapshot.events) { event in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(event.title).font(.headline)
                            Text(event.detail)
                            if let start = event.start {
                                Text(start.formatted(date: .abbreviated, time: .shortened))
                                    .font(.footnote)
                            }
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(BrandColor.card)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                    ForEach(snapshot.announcements) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.title).font(.headline)
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
            .refreshable { await onRefresh() }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.home))
        }
    }

    private static func serviceDate(_ iso: String) -> Date? {
        guard !iso.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }
}
