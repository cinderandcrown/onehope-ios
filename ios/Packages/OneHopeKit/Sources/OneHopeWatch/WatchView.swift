import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct WatchView: View {
    private let snapshot: ChurchSnapshot
    public init(snapshot: ChurchSnapshot) { self.snapshot = snapshot }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    PhotoCard("video")
                    HStack {
                        Text(snapshot.sermonTitle).font(.title2)
                        if snapshot.sermonSample { SampleBadge() }
                    }
                    Text(snapshot.sermonNote).font(.body)
                    Text("John 3:16, KJV").font(.headline)
                    Text("For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.")
                        .font(.body)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Facebook Live").font(.headline)
                        Text("This slot stays empty until a Page token is set on the server. The token never ships in the app.")
                            .font(.body)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BrandColor.card)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                }
                .padding()
            }
            .background(BrandColor.paper)
            .navigationTitle(L10n.text(.watch))
        }
    }
}
