import OneHopeCore
import SwiftUI
import UIKit

public enum BrandColor {
    /// weareonehope.com --green
    public static let olive = Color(uiColor: dynamic(light: 0x3F4903, dark: 0xC6CC8E))
    /// weareonehope.com --orange
    public static let terracotta = Color(uiColor: dynamic(light: 0xDF8052, dark: 0xE79A74))
    /// The orange, darkened so text and icons on paper or cards reach 4.5:1. Use this for anything readable.
    public static let terracottaDeep = Color(uiColor: dynamic(light: 0x9A3F14, dark: 0xE79A74))
    /// Text and icons that sit on `terracottaDeep` (6.8:1 in light, 8.1:1 in dark).
    public static let onAccent = Color(uiColor: dynamic(light: 0xFFFFFF, dark: 0x14140F))
    /// weareonehope.com --dove
    public static let paper = Color(uiColor: dynamic(light: 0xE5E4D0, dark: 0x14140F))
    /// weareonehope.com --black-2
    public static let ink = Color(uiColor: dynamic(light: 0x1C1B1B, dark: 0xE5E4D0))
    public static let card = Color(uiColor: dynamic(light: 0xF7F4EA, dark: 0x222218))
    /// weareonehope.com --blue
    public static let sky = Color(uiColor: dynamic(light: 0xCADDF6, dark: 0x33465F))

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
    private let direct: URL?
    @Environment(\.churchImages) private var images

    public init(_ resource: String, height: CGFloat = 180) {
        self.resource = resource
        self.height = height
        direct = nil
    }

    /// A photo at a known URL, such as a ministry or team picture.
    public init(url: URL?, height: CGFloat = 180) {
        resource = "url"
        self.height = height
        direct = url
    }

    public var body: some View {
        RemoteImage(direct ?? images.url(named: resource))
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Self.altText[resource] ?? "")
            .accessibilityAddTraits(.isImage)
            .accessibilityHidden(direct != nil || Self.altText[resource] == nil)
            .accessibilityIdentifier("church-photo-\(resource)")
    }

    /// What a screen reader says for each named photo. Photos shown by URL sit beside their own text and stay silent.
    private static let altText: [String: String] = [
        "hero": "Photo of the church family",
        "revival": "Inside Revival Coffee",
        "kids": "Children at church",
        "about": "The church family",
        "video": "Message artwork",
        "visit": "Welcome to the church",
        "groups": "People in a small group",
        "growth": "Growing in faith together",
    ]
}

/// Neutral stand-in when a church photo URL is unset or the phone is offline.
public struct BrandTexture: View {
    public init() {}

    public var body: some View {
        LinearGradient(
            colors: [BrandColor.olive, BrandColor.terracotta, BrandColor.paper],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(
            Circle()
                .fill(BrandColor.sky.opacity(0.55))
                .frame(width: 180, height: 180)
                .offset(x: 80, y: -40)
        )
        .accessibilityHidden(true)
    }
}

private struct ChurchImagesKey: EnvironmentKey {
    static let defaultValue = ChurchImages.empty
}

private struct ChurchMediaKey: EnvironmentKey {
    static let defaultValue = ChurchMedia.empty
}

public extension EnvironmentValues {
    var churchImages: ChurchImages {
        get { self[ChurchImagesKey.self] }
        set { self[ChurchImagesKey.self] = newValue }
    }

    var churchMedia: ChurchMedia {
        get { self[ChurchMediaKey.self] }
        set { self[ChurchMediaKey.self] = newValue }
    }
}

public struct Wordmark: View {
    @Environment(\.colorScheme) private var scheme
    public init() {}
    public var body: some View {
        let name = scheme == .dark ? "wordmark-dove" : "wordmark-ink"
        if let image = BundledPhoto.image(named: name, ext: "png") {
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
    /// A warm card on the dove background: soft edge, gentle lift.
    func churchCard() -> some View {
        padding(Space.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BrandColor.card)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).stroke(BrandColor.ink.opacity(0.12), lineWidth: 1))
            .shadow(color: BrandColor.ink.opacity(0.08), radius: 14, x: 0, y: 6)
    }
}

public extension Font {
    /// Large headlines in the site's scale. Articulat CF is not licensed for the app, so this is SF.
    static var hopeDisplay: Font {
        .system(.largeTitle, design: .default).weight(.bold)
    }

    static var hopeTitle: Font {
        .system(.title2, design: .default).weight(.semibold)
    }
}

enum BundledPhoto {
    private static let cache = NSCache<NSString, UIImage>()

    static func image(named resource: String, ext: String = "jpg") -> UIImage? {
        let key = "\(resource).\(ext)" as NSString
        if let cached = cache.object(forKey: key) {
            return cached
        }
        guard let url = Bundle.module.url(forResource: resource, withExtension: ext),
              let data = try? Data(contentsOf: url),
              let image = UIImage(data: data) else {
            return nil
        }
        cache.setObject(image, forKey: key)
        return image
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
            LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: UnitPoint(x: 0.5, y: 0.25), endPoint: .bottom)
                .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.largeTitle.bold()).foregroundStyle(.white)
                if !subtitle.isEmpty {
                    Text(subtitle).font(.headline).foregroundStyle(.white)
                }
            }
            .padding()
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
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
