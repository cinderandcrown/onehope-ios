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

    init(selection: ChurchSelection, chrome: ChurchChrome, knowJesus: KnowJesus, account: Account) {
        _tab = selection.tab
        _videoId = selection.videoId
        self.chrome = chrome
        self.knowJesus = knowJesus
        self.account = account
    }

    var body: some View {
        screen
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
            HomeView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform) { id in
                videoId = id
                tab = "watch"
            }
        }
    }
}

private struct ChurchTabBar: View {
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 0) {
            item("home", title: L10n.text(.home), symbol: "house")
            item("watch", title: L10n.text(.watch), symbol: "play.rectangle")
            item("prayer", title: L10n.text(.prayer), symbol: "hands.sparkles")
            item("give", title: L10n.text(.give), symbol: "heart")
            item("connect", title: L10n.text(.connect), symbol: "person.2")
            item("more", title: L10n.text(.more), symbol: "line.3.horizontal")
        }
        .padding(.top, 6)
        .padding(.bottom, 4)
        .background(BrandColor.paper)
        .overlay(alignment: .top) { Rectangle().fill(BrandColor.ink.opacity(0.12)).frame(height: 1) }
        .accessibilityElement(children: .contain)
    }

    private func item(_ id: String, title: String, symbol: String) -> some View {
        Button {
            selection = id
        } label: {
            VStack(spacing: 2) {
                Image(systemName: symbol)
                Text(title)
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(selection == id ? BrandColor.terracotta : BrandColor.ink)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tab-\(id)")
        .accessibilityLabel(title)
        .accessibilityAddTraits(selection == id ? .isSelected : [])
    }
}
