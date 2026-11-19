import OneHopeCore
import SwiftUI
import UIKit

public enum BrandColor {
    public static let olive = Color(uiColor: dynamic(light: 0x3F4903, dark: 0xC6CC8E))
    public static let terracotta = Color(uiColor: dynamic(light: 0xDF8052, dark: 0xE79A74))
    public static let paper = Color(uiColor: dynamic(light: 0xF4F1E6, dark: 0x14140F))
    public static let ink = Color(uiColor: dynamic(light: 0x1C1B1B, dark: 0xE5E4D0))
    public static let card = Color(uiColor: dynamic(light: 0xFBF8F1, dark: 0x222218))

    private static func dynamic(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { traits in
            color(traits.userInterfaceStyle == .dark ? dark : light)
        }
    }

    private static func color(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

public struct SampleBadge: View {
    public init() {}
    public var body: some View {
        Text(L10n.text(.sample))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(BrandColor.card)
            .clipShape(Capsule())
            .accessibilityLabel(L10n.text(.sample))
    }
}

public struct PhotoCard: View {
    private let resource: String
    private let height: CGFloat
    public init(_ resource: String, height: CGFloat = 180) {
        self.resource = resource
        self.height = height
    }

    public var body: some View {
        photo
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .accessibilityHidden(true)
    }

    @ViewBuilder private var photo: some View {
        if let url = Bundle.module.url(forResource: resource, withExtension: "jpg"),
           let data = try? Data(contentsOf: url),
           let image = UIImage(data: data) {
            Image(uiImage: image).resizable().scaledToFill()
        } else {
            BrandColor.olive
        }
    }
}

public struct Wordmark: View {
    @Environment(\.colorScheme) private var scheme
    public init() {}
    public var body: some View {
        let name = scheme == .dark ? "wordmark-dove" : "wordmark-ink"
        if let url = Bundle.module.url(forResource: name, withExtension: "png"),
           let data = try? Data(contentsOf: url),
           let image = UIImage(data: data) {
            Image(uiImage: image).resizable().scaledToFit().frame(height: 36).accessibilityLabel("One Hope")
        }
    }
}

public struct EmptyHint: View {
    private let title: String
    public init(_ title: String) {
        self.title = title
    }

    public var body: some View {
        Text(title).font(.body).foregroundStyle(BrandColor.ink).frame(maxWidth: .infinity, alignment: .leading)
    }
}

public struct LoadingRow: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public init() {}
    public var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(BrandColor.card)
            .frame(height: 18)
            .opacity(reduceMotion ? 1 : 0.7)
            .accessibilityLabel("Loading")
    }
}

@MainActor
public enum Haptics {
    public static func tap() {
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    }
}

public extension View {
    /// The rounded paper card used across the app.
    func churchCard() -> some View {
        padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BrandColor.card)
            .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

/// A full-width bundled photo with a title over a soft shade, for the top of a screen.
public struct HeroPhoto: View {
    private let resource: String
    private let title: String
    private let subtitle: String

    public init(_ resource: String, title: String, subtitle: String = "") {
        self.resource = resource
        self.title = title
        self.subtitle = subtitle
    }

    public var body: some View {
        ZStack(alignment: .bottomLeading) {
            PhotoCard(resource, height: 260)
            LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .center, endPoint: .bottom)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.largeTitle.bold()).foregroundStyle(.white)
                if !subtitle.isEmpty {
                    Text(subtitle).font(.headline).foregroundStyle(.white)
                }
            }
            .padding()
        }
        .accessibilityElement(children: .combine)
    }
}

/// A verse with its reference, always marked KJV.
public struct VerseCard: View {
    private let text: String
    private let reference: String

    public init(text: String, reference: String) {
        self.text = text
        self.reference = reference
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\u{201C}\(text)\u{201D}").font(.body.italic()).foregroundStyle(BrandColor.ink)
            Text("\(reference) (KJV)").font(.footnote.weight(.semibold)).foregroundStyle(BrandColor.olive)
        }
        .churchCard()
    }
}
