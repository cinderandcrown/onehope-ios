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

    var body: some View {
        screen
            .id(tab)
            .transition(.opacity)
            .animation(reduceMotion ? nil : HopeMotion.fade, value: tab)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(BrandColor.paper)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                ChurchTabBar(selection: $tab)
            }
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
        .background(BrandColor.paper)
        .overlay(alignment: .top) { Rectangle().fill(BrandColor.ink.opacity(0.12)).frame(height: 1) }
        .accessibilityElement(children: .contain)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
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
                Text(title)
                    .font(.caption2.weight(selection == id ? .semibold : .regular))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(selection == id ? BrandColor.terracottaDeep : BrandColor.ink.opacity(0.75))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tab-\(id)")
        .accessibilityLabel(title)
        .accessibilityAddTraits(selection == id ? .isSelected : [])
    }
}
