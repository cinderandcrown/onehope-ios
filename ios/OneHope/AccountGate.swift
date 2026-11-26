import OneHopeCore
import OneHopeDesign
import SwiftUI
import UIKit

struct AccountGate: View {
    let error: String
    let submit: (String, String, String?) async -> String
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var creating = false
    @State private var busy = false
    @State private var message = ""
    @State private var legal: LegalPage?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                intro
                credentials
                if !message.isEmpty {
                    Text(message).font(.footnote).foregroundStyle(BrandColor.terracottaDeep)
                }
                actions
            }
            .padding()
        }
        .tabBarClearance()
        .background(BrandColor.paper)
        .announce(message)
        .sheet(item: $legal) { LegalSheet(page: $0) }
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
            .buttonStyle(PrimaryButtonStyle())
            .disabled(busy)
            .accessibilityIdentifier("submit-account")
            agreement
            Button(action: toggleMode, label: {
                Text(creating ? "I already have an account" : "Create an account")
            })
            .disabled(busy)
            .accessibilityIdentifier("toggle-account")
        }
    }

    @ViewBuilder private var agreement: some View {
        if creating {
            VStack(alignment: .leading, spacing: Space.xs) {
                Text("By creating an account you agree to the Terms of Use and acknowledge the Privacy Policy.")
                    .font(.footnote)
                HStack(spacing: Space.lg) {
                    Button("Terms of Use") { legal = .terms }
                        .accessibilityIdentifier("signup-terms")
                    Button("Privacy Policy") { legal = .privacy }
                        .accessibilityIdentifier("signup-privacy")
                }
                .frame(minHeight: 44)
            }
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
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(BrandColor.ink.opacity(0.55), lineWidth: 1))
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
