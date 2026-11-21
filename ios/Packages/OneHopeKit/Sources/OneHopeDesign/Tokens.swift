import SwiftUI

/// Spacing scale. Screens use these steps and nothing in between.
public enum Space {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let lg: CGFloat = 16
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
}

public enum Radius {
    public static let card: CGFloat = 20
    public static let tile: CGFloat = 14
    public static let button: CGFloat = 14
}

/// Motion shared by every screen, so transitions feel like one app.
public enum HopeMotion {
    public static let fade = Animation.easeOut(duration: 0.25)
    public static let spring = Animation.spring(response: 0.36, dampingFraction: 0.86)
    public static let press = Animation.easeOut(duration: 0.12)
}

public extension Font {
    /// Section headline. Scales with Dynamic Type.
    static var hopeHeadline: Font {
        .system(.title3, design: .default).weight(.semibold)
    }

    /// Small all-caps label above a block.
    static var hopeEyebrow: Font {
        .system(.caption, design: .default).weight(.bold)
    }
}

public extension View {
    /// The small uppercase label that sits above a card or section.
    func eyebrow(_ color: Color = BrandColor.olive) -> some View {
        font(.hopeEyebrow)
            .textCase(.uppercase)
            .tracking(0.8)
            .foregroundStyle(color)
    }
}
