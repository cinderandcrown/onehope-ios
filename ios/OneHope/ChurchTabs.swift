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
        VStack(spacing: 0) {
            screen
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
            tab("home", title: L10n.text(.home), symbol: "house")
            tab("watch", title: L10n.text(.watch), symbol: "play.rectangle")
            tab("prayer", title: L10n.text(.prayer), symbol: "hands.sparkles")
            tab("give", title: L10n.text(.give), symbol: "heart")
            tab("connect", title: L10n.text(.connect), symbol: "person.2")
            tab("more", title: L10n.text(.more), symbol: "line.3.horizontal")
        }
        .padding(.top, 4)
        .padding(.bottom, 4)
        .background(BrandColor.paper)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isTabBar)
    }

    private func tab(_ id: String, title: String, symbol: String) -> some View {
        Button {
            selection = id
        } label: {
            VStack(spacing: 2) {
                Image(systemName: symbol)
                Text(title).font(.caption2).minimumScaleFactor(0.7).lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(selection == id ? BrandColor.terracotta : BrandColor.ink)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selection == id ? .isSelected : [])
    }
}
