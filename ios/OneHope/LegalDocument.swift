import OneHopeDesign
import SwiftUI

/// One heading and the paragraphs under it. Bullet lines start with "• ".
struct LegalSection: Identifiable {
    let heading: String
    let paragraphs: [String]
    var id: String {
        heading
    }
}

/// Which legal screen to open from signup, where there is no navigation stack to push onto.
enum LegalPage: String, Identifiable {
    case privacy, terms
    var id: String {
        rawValue
    }
}

/// A plain, readable document with a banner that says it is a draft.
struct LegalDocument: View {
    let title: String
    let banner: String
    let sections: [LegalSection]
    let identifier: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                Text(banner)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(BrandColor.ink)
                    .padding(Space.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BrandColor.sky)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.tile, style: .continuous))
                    .accessibilityIdentifier("\(identifier)-draft")
                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: Space.sm) {
                        Text(section.heading)
                            .font(.hopeHeadline)
                            .foregroundStyle(BrandColor.ink)
                            .accessibilityAddTraits(.isHeader)
                        ForEach(section.paragraphs, id: \.self) { paragraph in
                            Text(paragraph).font(.body).foregroundStyle(BrandColor.ink)
                        }
                    }
                }
            }
            .padding(Space.lg)
        }
        .background(BrandColor.paper)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier(identifier)
    }
}

/// Privacy, Terms and Credits as three rows, for the More menu.
struct LegalLinks: View {
    var body: some View {
        Section("Legal") {
            NavigationLink {
                PrivacyScreen()
            } label: {
                Label("Privacy Policy", systemImage: "hand.raised")
            }
            .accessibilityIdentifier("more-privacy")
            .listRowBackground(BrandColor.card)
            NavigationLink {
                TermsScreen()
            } label: {
                Label("Terms of Use", systemImage: "doc.text")
            }
            .accessibilityIdentifier("more-terms")
            .listRowBackground(BrandColor.card)
        }
    }
}

/// The legal pages in a sheet, for signup.
struct LegalSheet: View {
    let page: LegalPage
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                switch page {
                case .privacy: PrivacyScreen()
                case .terms: TermsScreen()
                }
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("legal-done")
                }
            }
        }
    }
}
