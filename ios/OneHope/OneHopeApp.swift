import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeMore
import OneHopeWatch
import SwiftUI

@main
struct OneHopeApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(BrandColor.terracotta)
        }
    }
}

struct RootView: View {
    @State private var signedIn = ProcessInfo.processInfo.arguments.contains("-uiTesting")

    var body: some View {
        Group {
            if signedIn {
                TabView {
                    HomeView().tabItem { Label(L10n.text(.home), systemImage: "house") }
                    WatchView().tabItem { Label(L10n.text(.watch), systemImage: "play.rectangle") }
                    GiveView().tabItem { Label(L10n.text(.give), systemImage: "heart") }
                    ConnectView().tabItem { Label(L10n.text(.connect), systemImage: "person.2") }
                    MoreView().tabItem { Label(L10n.text(.more), systemImage: "ellipsis") }
                }
            } else {
                SignInView { signedIn = true }
            }
        }
        .background(BrandColor.paper)
    }
}

struct SignInView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Wordmark()
            Text("One Hope").font(.largeTitle)
            Text(SampleChurch.address).font(.body)
            Text("Sundays at 10:30 a.m. Pre-service at 10:00.")
            Button(L10n.text(.signIn)) {
                Haptics.tap()
                onContinue()
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("sample-member")
            Text("Sample member. No real account is created.").font(.footnote)
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(BrandColor.paper)
    }
}
