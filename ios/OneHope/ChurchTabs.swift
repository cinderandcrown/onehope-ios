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
        TabView(selection: $tab) {
            HomeView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform) { id in
                videoId = id
                tab = "watch"
            }
            .tabItem { Label(L10n.text(.home), systemImage: "house") }
            .tag("home")
            WatchView(snapshot: chrome.snapshot, selected: $videoId, onRefresh: chrome.onRefresh)
                .tabItem { Label(L10n.text(.watch), systemImage: "play.rectangle") }
                .tag("watch")
            PrayerView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform)
                .tabItem { Label(L10n.text(.prayer), systemImage: "hands.sparkles") }
                .tag("prayer")
            GiveView(snapshot: chrome.snapshot, onRefresh: chrome.onRefresh, perform: chrome.perform)
                .tabItem { Label(L10n.text(.give), systemImage: "heart") }
                .tag("give")
            ConnectView(
                snapshot: chrome.snapshot,
                onRefresh: chrome.onRefresh,
                perform: chrome.perform,
                knowJesus: { knowJesus },
                account: { account }
            )
            .id(chrome.snapshot.signedIn)
            .tabItem { Label(L10n.text(.connect), systemImage: "person.2") }
            .tag("connect")
            FeatureMenu(
                snapshot: chrome.snapshot,
                onRefresh: chrome.onRefresh,
                perform: chrome.perform,
                account: account
            )
            .tabItem { Label(L10n.text(.more), systemImage: "line.3.horizontal") }
            .tag("more")
        }
        .background(BrandColor.paper)
    }
}
