import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeWatch
import SwiftUI

struct ChurchChrome {
    var snapshot: ChurchSnapshot
    var onRefresh: () async -> Void
    var perform: (MemberAction) async -> String
}

struct ChurchSelection {
    var tab: Binding<String>
    var videoId: Binding<String?>
}

/// Home, Watch, Prayer, Give, and Connect stay. More is the last tab, always on screen.
/// iPhone keeps five items in the system tab bar, so this bar is the app's own.
struct ChurchShell<Account: View, KnowJesus: View>: View {
    @Binding var tab: String
    @Binding var videoId: String?
    var chrome: ChurchChrome
    var knowJesus: KnowJesus
    var account: Account
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(selection: ChurchSelection, chrome: ChurchChrome, knowJesus: KnowJesus, account: Account) {
        _tab = selection.tab
        _videoId = selection.videoId
        self.chrome = chrome
        self.knowJesus = knowJesus
        self.account = account
    }

    /// The tab bar is stacked under the screen instead of floated over it with `safeAreaInset`.
    /// Every tab hosts its own NavigationStack (List, Form, ScrollView, pushed pages), and an inset
    /// applied outside a NavigationStack is not reliably passed down to those scroll views, so the
    /// last rows and buttons ended up behind the bar. Stacking gives each screen a frame that ends
    /// at the top of the bar on every device, so nothing can sit underneath it.
    var body: some View {
        VStack(spacing: 0) {
            screen
                .id(tab)
                .transition(.opacity)
                .animation(reduceMotion ? nil : HopeMotion.fade, value: tab)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            ChurchTabBar(selection: $tab)
        }
        .background(BrandColor.paper)
    }

    @ViewBuilder private var screen: some View {
        switch tab {
        case "watch":
            WatchView(snapshot: chrome.snapshot, selected: $videoId, onRefresh: chrome.onRefresh)
        case "prayer":
            PrayerView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform)
        case "give":
            GiveView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform)
        case "connect":
            ConnectView(
                snapshot: chrome.snapshot,
                onRefresh: chrome.onRefresh,
                perform: chrome.perform,
                knowJesus: { knowJesus },
                account: { account }
            )
            .id(chrome.snapshot.signedIn)
        case "more":
            FeatureMenu(
                snapshot: chrome.snapshot,
                onRefresh: chrome.onRefresh,
                perform: chrome.perform,
                account: account
            )
        default:
            HomeView(
                snapshot: chrome.snapshot,
                onRefresh: chrome.onRefresh,
                perform: chrome.perform,
                onOpenTab: { tab = $0 },
                onWatch: { id in
                    videoId = id
                    tab = "watch"
                }
            )
        }
    }
}

private struct ChurchTabBar: View {
    @Binding var selection: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        HStack(spacing: 0) {
            item("home", title: L10n.text(.home), symbol: "house", filled: "house.fill")
            item("watch", title: L10n.text(.watch), symbol: "play.rectangle", filled: "play.rectangle.fill")
            item("prayer", title: L10n.text(.prayer), symbol: "hands.sparkles", filled: "hands.sparkles.fill")
            item("give", title: L10n.text(.give), symbol: "heart", filled: "heart.fill")
            item("connect", title: L10n.text(.connect), symbol: "person.2", filled: "person.2.fill")
            item("more", title: L10n.text(.more), symbol: "line.3.horizontal", filled: "line.3.horizontal")
        }
        .padding(.top, 6)
        .padding(.bottom, 4)
        // The bar stays inside the safe area; only its paper color runs down behind the home indicator.
        .background(BrandColor.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(BrandColor.ink.opacity(0.12)).frame(height: 1) }
        .accessibilityElement(children: .contain)
    }

    private func item(_ id: String, title: String, symbol: String, filled: String) -> some View {
        Button {
            guard selection != id else { return }
            Haptics.tap()
            withAnimation(reduceMotion ? nil : HopeMotion.fade) { selection = id }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: selection == id ? filled : symbol)
                    .symbolEffect(.bounce, value: reduceMotion ? false : selection == id)
                // Like Apple's own tab bar: at accessibility text sizes the labels would be cut off ("lome", "Mor"),
                // so the bar shows icons and a long press shows the large label (Large Content Viewer).
                if !typeSize.isAccessibilitySize {
                    Text(title)
                        .font(.caption2.weight(selection == id ? .semibold : .regular))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
            .foregroundStyle(selection == id ? BrandColor.terracottaDeep : BrandColor.ink.opacity(0.75))
        }
        .buttonStyle(.plain)
        .accessibilityShowsLargeContentViewer {
            Label(title, systemImage: selection == id ? filled : symbol)
        }
        .accessibilityIdentifier("tab-\(id)")
        .accessibilityLabel(title)
        .accessibilityAddTraits(selection == id ? .isSelected : [])
    }
}
