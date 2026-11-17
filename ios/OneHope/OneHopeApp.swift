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
    private let client: ChurchClient? = APIEndpoint.resolve().map { ChurchClient(baseURL: $0, transport: URLSessionTransport()) }
    @State private var signedIn = ProcessInfo.processInfo.arguments.contains("-uiTesting")
    @State private var snapshot = ChurchSnapshot.bundled()
    @State private var token: String?

    var body: some View {
        Group {
            if signedIn {
                TabView {
                    HomeView(snapshot: snapshot).tabItem { Label(L10n.text(.home), systemImage: "house") }
                    WatchView(snapshot: snapshot).tabItem { Label(L10n.text(.watch), systemImage: "play.rectangle") }
                    GiveView(snapshot: snapshot) { password in
                        Task { await stepUp(password) }
                    }
                    .tabItem { Label(L10n.text(.give), systemImage: "heart") }
                    ConnectView(snapshot: snapshot).tabItem { Label(L10n.text(.connect), systemImage: "person.2") }
                    MoreView(snapshot: snapshot).tabItem { Label(L10n.text(.more), systemImage: "ellipsis") }
                }
            } else {
                SignInView {
                    signedIn = true
                }
            }
        }
        .background(BrandColor.paper)
        .task(id: signedIn) {
            if signedIn {
                await load()
            }
        }
    }

    private func load() async {
        guard let client else { return }
        do {
            let session = try await client.login(
                email: SampleChurch.sampleMemberEmail,
                password: SampleChurch.sampleMemberPassword
            )
            token = session
            snapshot = try await client.loadMember(token: session)
        } catch {
            snapshot = ChurchSnapshot.bundled(offline: true)
        }
    }

    private func stepUp(_ password: String) async {
        guard let client, let token else { return }
        do {
            try await client.stepUp(token: token, password: password)
            snapshot = try await client.loadMember(token: token)
        } catch {
            snapshot = ChurchSnapshot.bundled(offline: true)
        }
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
            Text("Sample member. The app asks the church API when a server address is set.").font(.footnote)
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(BrandColor.paper)
    }
}
