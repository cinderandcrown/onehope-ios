import OneHopeCore
import SwiftUI
import UIKit

/// The church's social links. https URLs open the native app when it is installed.
public struct FollowAlong: View {
    private let links: [SocialLink]

    public init(links: [SocialLink]) {
        self.links = links
    }

    public var body: some View {
        if !links.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Follow along").font(.hopeTitle).foregroundStyle(BrandColor.ink)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(links) { link in
                            Button {
                                guard let url = URL(string: link.url) else { return }
                                Haptics.tap()
                                UIApplication.shared.open(url)
                            } label: {
                                Text(link.name)
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .foregroundStyle(BrandColor.ink)
                                    .background(BrandColor.sky)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(BrandColor.ink, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Follow along on \(link.name)")
                        }
                    }
                }
            }
        }
    }
}
