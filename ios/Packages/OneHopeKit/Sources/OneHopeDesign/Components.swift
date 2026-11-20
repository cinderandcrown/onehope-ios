import SwiftUI

/// The main action on a screen: terracotta, full width, easy to hit.
public struct PrimaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(BrandColor.onAccent)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.vertical, Space.sm)
            .padding(.horizontal, Space.md)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(BrandColor.terracottaDeep.opacity(configuration.isPressed ? 0.85 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Radius.button, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(HopeMotion.press, value: configuration.isPressed)
    }
}

/// A quieter action beside the main one.
public struct SecondaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(BrandColor.ink)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.vertical, Space.sm)
            .padding(.horizontal, Space.md)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(BrandColor.card)
            .clipShape(RoundedRectangle(cornerRadius: Radius.button, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.button, style: .continuous).stroke(BrandColor.ink.opacity(0.18), lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(HopeMotion.press, value: configuration.isPressed)
    }
}

/// Lets a whole card act as a button with a small press response.
public struct PressableStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(HopeMotion.press, value: configuration.isPressed)
    }
}

/// A colored rounded square holding a symbol, used for menu rows and shortcuts.
public struct FeatureIcon: View {
    private let symbol: String
    private let tint: Color
    private let size: CGFloat

    public init(_ symbol: String, tint: Color = BrandColor.terracottaDeep, size: CGFloat = 36) {
        self.symbol = symbol
        self.tint = tint
        self.size = size
    }

    public var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.46, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// A heading for a block, with an optional action on the right.
public struct SectionHeader: View {
    private let title: String
    private let eyebrowText: String?

    public init(_ title: String, eyebrow: String? = nil) {
        self.title = title
        eyebrowText = eyebrow
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            if let eyebrowText {
                Text(eyebrowText).eyebrow()
            }
            Text(title).font(.hopeHeadline).foregroundStyle(BrandColor.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityAddTraits(.isHeader)
    }
}

/// A photo with its title and a line of text laid over a soft shade. Used in carousels and grids.
public struct PhotoTile: View {
    private let url: URL?
    private let title: String
    private let detail: String
    private let width: CGFloat
    private let height: CGFloat

    public init(url: URL?, title: String, detail: String = "", width: CGFloat, height: CGFloat) {
        self.url = url
        self.title = title
        self.detail = detail
        self.width = width
        self.height = height
    }

    public var body: some View {
        PhotoOverlay(url: url, minHeight: height, width: width) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(.white)
                if !detail.isEmpty {
                    Text(detail).font(.caption).foregroundStyle(.white)
                }
            }
        }
        .shadow(color: BrandColor.ink.opacity(0.12), radius: 10, x: 0, y: 5)
    }
}

/// A small status label shown on a card.
public struct InfoPill: View {
    private let text: String

    public init(_ text: String) {
        self.text = text
    }

    public var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(BrandColor.ink)
            .padding(.horizontal, Space.md)
            .padding(.vertical, Space.xs + 2)
            .background(BrandColor.sky)
            .clipShape(Capsule())
    }
}

/// A friendly empty screen: an icon, what is missing, and what will show up here.
public struct EmptyState: View {
    private let symbol: String
    private let title: String
    private let message: String

    public init(symbol: String, title: String, message: String) {
        self.symbol = symbol
        self.title = title
        self.message = message
    }

    public var body: some View {
        VStack(spacing: Space.sm) {
            FeatureIcon(symbol, tint: BrandColor.olive, size: 48)
            Text(title).font(.headline).foregroundStyle(BrandColor.ink)
            Text(message).font(.subheadline).foregroundStyle(BrandColor.ink.opacity(0.8)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Space.xl)
        .accessibilityElement(children: .combine)
    }
}

public extension View {
    /// Reads a message aloud to VoiceOver users when it changes, such as "Your prayer request was sent."
    func announce(_ message: String) -> some View {
        onChange(of: message) { _, new in
            if !new.isEmpty {
                AccessibilityNotification.Announcement(new).post()
            }
        }
    }
}

/// A form field with a label that stays visible after typing, not just a placeholder.
public struct LabeledField<Content: View>: View {
    private let title: String
    private let hint: String
    private let content: Content

    public init(_ title: String, hint: String = "", @ViewBuilder content: () -> Content) {
        self.title = title
        self.hint = hint
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title).font(.footnote.weight(.semibold)).foregroundStyle(BrandColor.ink)
            content.frame(minHeight: 44)
            if !hint.isEmpty {
                Text(hint).font(.caption).foregroundStyle(BrandColor.ink.opacity(0.8))
            }
        }
    }
}

/// Text laid over a church photo. The photo is the background, so the box grows with the text
/// (large Dynamic Type sizes never push words off the picture) and a shade keeps the words readable.
public struct PhotoOverlay<Content: View>: View {
    private let resource: String
    private let direct: URL?
    private let minHeight: CGFloat
    private let width: CGFloat?
    private let content: Content
    @Environment(\.churchImages) private var images

    public init(_ resource: String = "", url: URL? = nil, minHeight: CGFloat, width: CGFloat? = nil, @ViewBuilder content: () -> Content) {
        self.resource = resource
        direct = url
        self.minHeight = minHeight
        self.width = width
        self.content = content()
    }

    public var body: some View {
        content
            .multilineTextAlignment(.leading)
            .padding(Space.lg)
            .frame(maxWidth: width ?? .infinity, minHeight: minHeight, alignment: .bottomLeading)
            .frame(width: width)
            .background {
                ZStack {
                    RemoteImage(direct ?? images.url(named: resource))
                    LinearGradient(colors: [.black.opacity(0.3), .black.opacity(0.82)], startPoint: .top, endPoint: .bottom)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityElement(children: .combine)
    }
}

/// A titled group of rows with a header dark enough to read on the paper background.
public struct TitledSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    public init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    public var body: some View {
        Section {
            content
        } header: {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(BrandColor.ink)
                .accessibilityAddTraits(.isHeader)
        }
    }
}

/// A List on the paper background, so every screen shares one warm color instead of system gray.
public struct HopeList<Content: View>: View {
    @ViewBuilder let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        List { content }
            .scrollContentBackground(.hidden)
            .background(BrandColor.paper)
    }
}

/// A Form on the paper background.
public struct HopeForm<Content: View>: View {
    @ViewBuilder let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        Form { content }
            .scrollContentBackground(.hidden)
            .background(BrandColor.paper)
    }
}
