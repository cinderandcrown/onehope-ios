import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Who made the pictures and words, and the open-source software behind the app.
struct CreditsScreen: View {
    let credits: [CreditLine]

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? ""
        let build = info?["CFBundleVersion"] as? String ?? ""
        return build.isEmpty ? short : "\(short) (\(build))"
    }

    var body: some View {
        List {
            Section("This app") {
                Text("One Hope, version \(version)")
                Text("Built for One Hope Church. The app's own source code is open source under the MIT License.")
            }
            Section("Photos and church content") {
                Text("Pictures of the church, its team, its ministries, and Revival Coffee are shown from the church's own websites and belong to their owners.")
                ForEach(credits) { credit in
                    creditRow(credit)
                }
            }
            Section("Scripture, video, and maps") {
                Text("Scripture is the King James Version, which is in the public domain in the United States.")
                Text("Sermon videos and thumbnails come from the church's YouTube channel and play in YouTube's player under YouTube's terms.")
                Text("Maps open in Apple Maps. Symbols are Apple's SF Symbols, used under Apple's license.")
            }
            Section("Music") {
                Text("This app does not play music.")
            }
            Section("Open-source software") {
                ForEach(Self.licenses) { item in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name).font(.body.weight(.semibold))
                        Text(item.license).font(.footnote).foregroundStyle(BrandColor.ink.opacity(0.8))
                    }
                    .accessibilityElement(children: .combine)
                }
                if let repo = URL(string: "https://github.com/cinderandcrown/onehope-ios") {
                    Link("View the source and full license texts", destination: repo)
                        .frame(minHeight: 44, alignment: .leading)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(BrandColor.paper)
        .navigationTitle("About & Credits")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("credits-screen")
    }

    @ViewBuilder private func creditRow(_ credit: CreditLine) -> some View {
        let content = VStack(alignment: .leading, spacing: 2) {
            Text(credit.title).font(.body.weight(.semibold))
            if !credit.detail.isEmpty {
                Text(credit.detail).font(.footnote).foregroundStyle(BrandColor.ink.opacity(0.8))
            }
        }
        if let link = credit.link {
            Link(destination: link) { content }
                .accessibilityHint("Opens in your browser")
        } else {
            content.accessibilityElement(children: .combine)
        }
    }

    private struct License: Identifiable {
        let name: String
        let license: String
        var id: String {
            name
        }
    }

    private static let licenses = [
        License(name: "One Hope app (this project)", license: "MIT License"),
        License(name: "Next.js and React (church website and staff desk)", license: "MIT License"),
        License(name: "Zod (server checks)", license: "MIT License"),
        License(name: "Neon serverless driver (database connection)", license: "MIT License"),
        License(name: "PGlite (testing database)", license: "Apache License 2.0"),
    ]
}
