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
                    MoreView(snapshot: snapshot, onRefresh: load, onSignOut: signOut) { emailPublic, phonePublic, listed in
                        await updatePrivacy(emailPublic: emailPublic, phonePublic: phonePublic, listed: listed)
                    } onDelete: { password in
                        await deleteAccount(password)
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
        guard let client else { return "We couldn't reach the church just now." }
        do {
            let session = if let name, !name.isEmpty {
                try await client.signup(email: email, password: password, displayName: name)
            } else {
                try await client.login(email: email, password: password)
            }
            SessionKeychain.save(session)
            UserDefaults.standard.removeObject(forKey: "onehope.accountDeleted")
            token = session
            authError = ""
            return ""
        } catch {
            return friendly(error)
        }
    }

    private func load() async {
        guard let client, let token else { return }
        do {
            snapshot = try await client.loadMember(token: token)
        } catch let error as ChurchAPIError where error.status == 401 {
            signOut(message: "Please sign in again.")
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
                await load()
                return "You're in that group."
            case let .message(id, body):
                try await client.postMessage(token: token, groupId: id, body: body)
                await load()
                return "Your note was sent."
            case let .register(id):
                try await client.register(token: token, eventId: id)
                await load()
                return "You're registered."
            case let .prayer(body):
                try await client.submitPrayer(token: token, body: body)
                await load()
                return "Your prayer was sent to the pastors."
            case let .addChild(name, classroom):
                _ = try await client.addChild(token: token, displayName: name, classroom: classroom)
                await load()
                return "\(name) was added."
            case let .checkIn(id):
                let code = try await client.checkIn(token: token, childId: id)
                await load()
                return "Security code \(code)"
            case let .pickup(id, code):
                let reason = try await client.householdPickup(token: token, childId: id, code: code)
                await load()
                return reason
            }
        } catch {
            return friendly(error)
        }
    }

    private func updatePrivacy(emailPublic: Bool, phonePublic: Bool, listed: Bool) async {
        guard let client, let token else { return }
        try? await client.updateProfile(token: token, emailPublic: emailPublic, phonePublic: phonePublic, listed: listed)
        await load()
    }

    private func deleteAccount(_ password: String) async -> String {
        guard let client, let token else { return "Sign in again." }
        do {
            try await client.stepUp(token: token, password: password)
            try await client.deleteAccount(token: token)
            UserDefaults.standard.set(true, forKey: "onehope.accountDeleted")
            signOut(message: "Your account was deleted.")
            return "Your account was deleted."
        } catch {
            return friendly(error)
        }
    }

    private func friendly(_ error: Error) -> String {
        guard let error = error as? ChurchAPIError else { return "We couldn't reach the church just now." }
        let blocked = ["contract", "shape", "configured", "not valid"]
        if blocked.contains(where: { error.message.localizedCaseInsensitiveContains($0) }) {
            return "Please check what you entered and try again."
        }
        if error.code == "session_expired" || error.message.localizedCaseInsensitiveContains("sign in again") {
            return "Please sign in again."
        }
        if error.code == "unauthenticated" {
            return "That email and password don't match."
        }
        return error.message
    }

    private func signOut(message: String = "") {
        let current = token
        token = nil
        if !message.isEmpty {
            authError = message
        }
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
        .onAppear {
            if UserDefaults.standard.bool(forKey: "onehope.accountDeleted") {
                message = "Your account was deleted."
            } else if !error.isEmpty {
                message = error
            }
        }
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
