import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeMore
import OneHopeWatch
import Security
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
    @State private var token: String? = SessionKeychain.load()
    @State private var snapshot = ChurchSnapshot.bundled()
    @State private var authError = ""

    var body: some View {
        Group {
            if token != nil {
                TabView {
                    HomeView(snapshot: snapshot, onRefresh: load)
                        .tabItem { Label(L10n.text(.home), systemImage: "house") }
                    WatchView(snapshot: snapshot, onRefresh: load)
                        .tabItem { Label(L10n.text(.watch), systemImage: "play.rectangle") }
                    GiveView(snapshot: snapshot, onRefresh: load)
                        .tabItem { Label(L10n.text(.give), systemImage: "heart") }
                    ConnectView(snapshot: snapshot, onRefresh: load) { action in
                        await perform(action)
                    }
                    .tabItem { Label(L10n.text(.connect), systemImage: "person.2") }
                    MoreView(snapshot: snapshot, onRefresh: load, onSignOut: signOut) { emailPublic, phonePublic in
                        await updatePrivacy(emailPublic: emailPublic, phonePublic: phonePublic)
                    }
                    .tabItem { Label(L10n.text(.more), systemImage: "ellipsis") }
                }
            } else {
                AccountGate(error: authError) { email, password, name in
                    await authenticate(email: email, password: password, name: name)
                }
            }
        }
        .background(BrandColor.paper)
        .task(id: token) {
            if token != nil {
                await load()
            }
        }
    }

    private func authenticate(email: String, password: String, name: String?) async -> String {
        guard let client else { return "The church server is not configured on this build." }
        do {
            let session: String
            if let name, !name.isEmpty {
                session = try await client.signup(email: email, password: password, displayName: name)
            } else {
                session = try await client.login(email: email, password: password)
            }
            SessionKeychain.save(session)
            token = session
            authError = ""
            return ""
        } catch let error as ChurchAPIError {
            return error.message
        } catch {
            return "We couldn't sign you in."
        }
    }

    private func load() async {
        guard let client, let token else { return }
        do {
            snapshot = try await client.loadMember(token: token)
        } catch let error as ChurchAPIError where error.status == 401 {
            signOut()
        } catch {
            if snapshot.accountEmail.isEmpty {
                snapshot = ChurchSnapshot.bundled(offline: true)
            }
        }
    }

    private func perform(_ action: MemberAction) async -> String {
        guard let client, let token else { return "Sign in again." }
        do {
            switch action {
            case let .join(id):
                try await client.join(token: token, groupId: id)
            case let .message(id, body):
                try await client.postMessage(token: token, groupId: id, body: body)
            case let .register(id):
                try await client.register(token: token, eventId: id)
            case let .prayer(body):
                try await client.submitPrayer(token: token, body: body)
            case let .addChild(name, classroom):
                _ = try await client.addChild(token: token, displayName: name, classroom: classroom)
            case let .checkIn(id):
                let code = try await client.checkIn(token: token, childId: id)
                await load()
                return "Security code \(code)"
            case let .pickup(id, code):
                let reason = try await client.householdPickup(token: token, childId: id, code: code)
                await load()
                return reason
            }
            await load()
            return ""
        } catch let error as ChurchAPIError {
            return error.message
        } catch {
            return "That didn't go through."
        }
    }

    private func updatePrivacy(emailPublic: Bool, phonePublic: Bool) async {
        guard let client, let token else { return }
        try? await client.updateProfile(token: token, emailPublic: emailPublic, phonePublic: phonePublic)
        await load()
    }

    private func signOut() {
        let current = token
        token = nil
        SessionKeychain.clear()
        snapshot = ChurchSnapshot.bundled()
        if let client, let current {
            Task { await client.logout(token: current) }
        }
    }
}

struct AccountGate: View {
    let error: String
    let submit: (String, String, String?) async -> String
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var creating = false
    @State private var message = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Wordmark()
                Text("One Hope").font(.largeTitle)
                Text(SampleChurch.address)
                Text("Sundays at 10:30 a.m. Come early for donuts and coffee.")
                TextField("Name", text: $name)
                    .textContentType(.name)
                    .accessibilityIdentifier("name")
                    .opacity(creating ? 1 : 0)
                    .frame(height: creating ? nil : 0)
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("email")
                SecureField("Password", text: $password)
                    .textContentType(creating ? .newPassword : .password)
                    .accessibilityIdentifier("password")
                if !message.isEmpty {
                    Text(message).font(.footnote)
                }
                Button(creating ? "Create account" : "Sign in") {
                    Task {
                        message = await submit(email, password, creating ? name : nil)
                    }
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("submit-account")
                Button(creating ? "I already have an account" : "Create an account") {
                    creating.toggle()
                    message = ""
                }
                .accessibilityIdentifier("toggle-account")
            }
            .padding()
        }
        .background(BrandColor.paper)
        .onAppear { if !error.isEmpty { message = error } }
    }
}

enum SessionKeychain {
    private static let service = "com.cinderandcrown.onehope"
    private static let account = "session"

    static func save(_ token: String) {
        clear()
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
