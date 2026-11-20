import OneHopeConnect
import OneHopeCore
import OneHopeDesign
import OneHopeGive
import OneHopeHome
import OneHopeMore
import OneHopeWatch
import os
import Security
import SwiftUI

private let authLog = Logger(subsystem: "com.cinderandcrown.onehope", category: "account")

@main
struct OneHopeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(BrandColor.terracotta)
        }
    }
}

struct RootView: View {
    private let client: ChurchClient? = {
        guard let url = APIEndpoint.resolve() else { return nil }
        let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("onehope-reads", isDirectory: true)
        return ChurchClient(baseURL: url, transport: URLSessionTransport(), cache: folder.map { ResponseCache(directory: $0) })
    }()

    @State private var token: String? = SessionKeychain.load()
    @State private var snapshot = ChurchSnapshot.bundled()
    @State private var authError = ""
    @State private var tab = "home"
    @State private var videoId: String?
    @State private var orderCoffee = false

    /// Home, Watch, Prayer, Give, and Connect stay. More is the last tab.
    var body: some View {
        ChurchShell(
            selection: ChurchSelection(tab: $tab, videoId: $videoId),
            chrome: ChurchChrome(snapshot: snapshot, onRefresh: load, perform: perform),
            knowJesus: KnowJesusView(snapshot: snapshot, perform: perform, embedded: true),
            account: account
        )
        .environment(\.churchImages, snapshot.images)
        .sheet(isPresented: $orderCoffee) {
            NavigationStack {
                CoffeeView()
            }
        }
        .task(id: token) { await load() }
        .onAppear {
            if CoffeeShortcut.consume() {
                orderCoffee = true
            }
        }
    }

    @ViewBuilder private var account: some View {
        if token != nil {
            MoreView(
                snapshot: snapshot,
                onRefresh: load,
                onSignOut: { signOut() },
                onPrivacy: { emailPublic, phonePublic, listed in
                    await updatePrivacy(emailPublic: emailPublic, phonePublic: phonePublic, listed: listed)
                },
                onDelete: { password in
                    await deleteAccount(password)
                }
            )
        } else {
            AccountGate(error: authError) { email, password, name in
                await authenticate(email: email, password: password, name: name)
            }
        }
    }

    private func authenticate(email: String, password: String, name: String?) async -> String {
        guard let client else {
            authLog.error("API client is missing. Info.plist API_BASE_URL is empty.")
            return "App is misconfigured"
        }
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
        guard let client else {
            authLog.error("API client is missing. Info.plist API_BASE_URL is empty.")
            snapshot = ChurchSnapshot.bundled(offline: true)
            return
        }
        do {
            if let token {
                snapshot = try await client.loadMember(token: token)
            } else {
                snapshot = try await client.loadGuest()
            }
            let note = await client.cacheAge.consume()
            if !note.isEmpty {
                snapshot.offlineNote = note
            }
        } catch let error as ChurchAPIError where error.status == 401 && token != nil {
            signOut(message: "Please sign in again.")
        } catch {
            if !snapshot.fromAPI {
                snapshot = ChurchSnapshot.bundled(offline: true)
            }
        }
    }

    private func perform(_ action: MemberAction) async -> String {
        guard let client else {
            authLog.error("API client is missing. Info.plist API_BASE_URL is empty.")
            return "App is misconfigured"
        }
        do {
            let reply = try await client.run(action, token: token)
            await load()
            return reply
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
        guard let client else {
            authLog.error("API client is missing. Info.plist API_BASE_URL is empty.")
            return "App is misconfigured"
        }
        guard let token else { return "Please sign in again." }
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
    @State private var busy = false
    @State private var message = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                intro
                credentials
                if !message.isEmpty {
                    Text(message).font(.footnote).foregroundStyle(BrandColor.terracotta)
                }
                actions
            }
            .padding()
        }
        .background(BrandColor.paper)
        .onAppear { showStoredMessage() }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 16) {
            Wordmark()
            Text("One Hope").font(.largeTitle)
            Text(SampleChurch.address)
            Text("Sundays at 10:30 a.m. Come early for donuts and coffee.")
        }
    }

    private var credentials: some View {
        VStack(alignment: .leading, spacing: 16) {
            if creating {
                AccountField(title: "Name", text: $name, identifier: "name", content: .name)
            }
            AccountField(
                title: "Email",
                text: $email,
                identifier: "email",
                content: .username,
                keyboard: .emailAddress,
                capitalize: false
            )
            AccountField(
                title: "Password",
                text: $password,
                identifier: "password",
                content: creating ? .newPassword : .password,
                secure: true
            )
            if creating {
                Text("Use at least 8 characters.").font(.footnote)
            }
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 16) {
            Button(action: { Task { await send() } }, label: {
                if busy {
                    ProgressView()
                } else {
                    Text(creating ? "Create account" : "Sign in")
                }
            })
            .buttonStyle(.borderedProminent)
            .disabled(busy)
            .accessibilityIdentifier("submit-account")
            Button(action: toggleMode, label: {
                Text(creating ? "I already have an account" : "Create an account")
            })
            .disabled(busy)
            .accessibilityIdentifier("toggle-account")
        }
    }

    private func toggleMode() {
        creating.toggle()
        message = ""
    }

    private func send() async {
        if creating, password.count < 8 {
            message = "Use at least 8 characters."
            return
        }
        busy = true
        message = await submit(email, password, creating ? name : nil)
        busy = false
    }

    private func showStoredMessage() {
        if UserDefaults.standard.bool(forKey: "onehope.accountDeleted") {
            message = "Your account was deleted."
        } else if !error.isEmpty {
            message = error
        }
    }
}

private struct AccountField: View {
    let title: String
    @Binding var text: String
    let identifier: String
    let content: UITextContentType
    var keyboard: UIKeyboardType = .default
    var secure = false
    var capitalize = true

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.footnote)
            entry
                .textContentType(content)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalize ? .words : .never)
                .accessibilityIdentifier(identifier)
                .padding(12)
                .background(BrandColor.card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(BrandColor.ink.opacity(0.28), lineWidth: 1))
        }
    }

    @ViewBuilder private var entry: some View {
        if secure {
            SecureField(title, text: $text)
        } else {
            TextField(title, text: $text)
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
