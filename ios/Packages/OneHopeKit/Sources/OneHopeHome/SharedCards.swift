import OneHopeCore
import OneHopeDesign
import SwiftUI

/// "Come sit with me" card that opens the share sheet with the Sunday details.
public struct InviteCard: View {
    private let invite: InviteInfo

    public init(invite: InviteInfo) {
        self.invite = invite
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Invite someone").font(.caption.weight(.semibold)).foregroundStyle(BrandColor.olive)
            Text(invite.title).font(.title3.bold())
            Text(invite.body)
            HStack {
                if let url = URL(string: invite.url) {
                    ShareLink(item: url, subject: Text(invite.title), message: Text(invite.shareText)) {
                        Label("Send an invite", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("share-invite")
                }
                if let maps = URL(string: invite.mapsUrl) {
                    Link("Maps", destination: maps).buttonStyle(.bordered).controlSize(.large)
                }
            }
        }
        .churchCard()
    }
}

/// Today's verse. Guests keep their streak on this phone; members sync theirs.
public struct DailyWordCard: View {
    private let snapshot: ChurchSnapshot
    private let perform: (MemberAction) async -> String
    @AppStorage("onehope.daily.lastDay") private var lastDay = ""
    @AppStorage("onehope.daily.count") private var count = 0
    @State private var notice = ""

    public init(snapshot: ChurchSnapshot, perform: @escaping (MemberAction) async -> String) {
        self.snapshot = snapshot
        self.perform = perform
    }

    public var body: some View {
        if let daily = snapshot.daily {
            VStack(alignment: .leading, spacing: 10) {
                Text("Today's encouragement · \(daily.reference)").eyebrow()
                Text("\u{201C}\(daily.text)\u{201D}")
                    .font(.system(.title3, design: .serif).italic())
                    .foregroundStyle(BrandColor.ink)
                Text("Read \(daily.read) (KJV)").font(.footnote)
                Text(daily.prompt).font(.callout)
                let days = streakCount(today: daily.day)
                Button(readToday(daily.day) ? "Read today" : "I read today's Word") {
                    Task { await markRead(today: daily.day) }
                }
                .buttonStyle(.bordered).controlSize(.large)
                .disabled(readToday(daily.day))
                .accessibilityIdentifier("daily-word-read")
                if days > 0 {
                    Text(days == 1 ? "1 day in a row" : "\(days) days in a row").font(.footnote.weight(.semibold))
                }
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
            }
            .churchCard()
            .announce(notice)
        }
    }

    private func streakCount(today: String) -> Int {
        if snapshot.signedIn {
            return snapshot.dailyStreak ?? 0
        }
        return StreakRules.current(lastDay: lastDay.isEmpty ? nil : lastDay, count: count, today: today)
    }

    private func readToday(_ today: String) -> Bool {
        !snapshot.signedIn && lastDay == today
    }

    private func markRead(today: String) async {
        if snapshot.signedIn {
            notice = await perform(.readDailyWord)
            return
        }
        count = StreakRules.next(lastDay: lastDay.isEmpty ? nil : lastDay, count: count, today: today)
        lastDay = today
    }
}

/// Sends one next step to the staff follow-up queue. Guests give a name and, with consent, contact details.
public struct FollowUpForm: View {
    private let kind: FollowUpKind
    private let signedIn: Bool
    private let perform: (MemberAction) async -> String
    private let onSent: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var consent: Bool
    @State private var busy = false
    @State private var notice = ""

    public init(kind: FollowUpKind, signedIn: Bool, perform: @escaping (MemberAction) async -> String, onSent: @escaping () -> Void = {}) {
        self.kind = kind
        self.signedIn = signedIn
        self.perform = perform
        self.onSent = onSent
        _consent = State(initialValue: signedIn)
    }

    public var body: some View {
        NavigationStack {
            Form {
                if !signedIn {
                    Section("About you") {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                            .accessibilityIdentifier("follow-up-name")
                        TextField("Email (optional)", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                        TextField("Phone (optional)", text: $phone)
                            .textContentType(.telephoneNumber)
                            .keyboardType(.phonePad)
                    }
                }
                Section {
                    Toggle(signedIn ? "One Hope may contact me about this using my account email." : "One Hope may contact me about this.", isOn: $consent)
                } footer: {
                    Text("Nothing is shared outside the church staff.")
                }
                if !notice.isEmpty {
                    Text(notice).font(.footnote).foregroundStyle(BrandColor.terracottaDeep)
                }
                Button(busy ? "Sending…" : "Send") {
                    Task { await send() }
                }
                .disabled(busy)
                .accessibilityIdentifier("follow-up-send")
            }
            .navigationTitle(kind.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func send() async {
        let request: FollowUpRequest
        if signedIn {
            request = FollowUpRequest(kind: kind, consent: consent)
        } else {
            switch FollowUpRequest.guest(kind: kind, name: name, email: email, phone: phone, consent: consent) {
            case let .success(value):
                request = value
            case let .failure(problem):
                notice = problem.message
                return
            }
        }
        busy = true
        let reply = await perform(.followUp(request))
        busy = false
        if reply == kind.thanks {
            onSent()
            dismiss()
        } else {
            notice = reply
        }
    }
}
