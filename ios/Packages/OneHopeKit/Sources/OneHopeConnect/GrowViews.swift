import OneHopeCore
import SwiftUI

/// Links to the church's Toolkit, Recovery page, and Support/Assistance form.
struct GrowSection: View {
    let growth: GrowthInfo
    let signedIn: Bool
    let perform: (MemberAction) async -> String

    var body: some View {
        Section("Grow and care") {
            NavigationLink(growth.toolkit.title) {
                ToolkitView(toolkit: growth.toolkit)
            }
            .accessibilityIdentifier("grow-toolkit")
            NavigationLink("\(growth.recovery.title): \(growth.recovery.subtitle)") {
                RecoveryView(recovery: growth.recovery)
            }
            .accessibilityIdentifier("grow-recovery")
            NavigationLink(growth.support.title) {
                SupportFormView(support: growth.support, signedIn: signedIn, perform: perform)
            }
            .accessibilityIdentifier("grow-support")
        }
    }
}

struct ToolkitView: View {
    let toolkit: ToolkitInfo

    var body: some View {
        List {
            Section {
                link(toolkit.readingPlan)
                link(toolkit.proclamations)
                link(toolkit.playlist)
            }
            Section("Scriptures to speak") {
                ForEach(toolkit.scriptures, id: \.reference) { verse in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(verse.text)
                        Text("\(verse.reference) (KJV)").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            Section("Staff reads") {
                ForEach(toolkit.staffReads) { book in
                    VStack(alignment: .leading) {
                        Text(book.title)
                        Text(book.author).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            Section("Podcast picks") {
                ForEach(toolkit.podcasts, id: \.self) { podcast in
                    Text(podcast)
                }
            }
        }
        .navigationTitle(toolkit.title)
    }

    @ViewBuilder
    private func link(_ item: ChurchLink) -> some View {
        if let url = URL(string: item.url) {
            Link(item.title, destination: url)
        }
    }
}

/// The Life Evaluation Worksheet. Ratings stay on this phone and are never sent.
struct RecoveryView: View {
    let recovery: RecoveryInfo
    @AppStorage("onehope.recovery.scores") private var stored = ""

    var body: some View {
        List {
            if let group = recovery.group {
                Section(group.name) {
                    Text(group.schedule)
                    if !group.area.isEmpty {
                        Text(group.area).font(.footnote)
                    }
                    if !group.leaders.isEmpty {
                        Text("Led by \(group.leaders.joined(separator: " and "))").font(.footnote)
                    }
                    if let raw = group.url, let url = URL(string: raw) {
                        Link("Ask to join on Church Center", destination: url)
                    }
                }
            }
            Section {
                ForEach(recovery.worksheet.areas, id: \.self) { area in
                    Stepper(value: score(for: area), in: 1 ... 10) {
                        HStack {
                            Text(area)
                            Spacer()
                            Text(scores[area].map { "\($0)" } ?? "–").monospacedDigit()
                        }
                    }
                }
                if let url = URL(string: recovery.worksheet.pdfUrl) {
                    Link("Printable worksheet", destination: url)
                }
                Button("Clear my answers", role: .destructive) {
                    stored = ""
                }
            } header: {
                Text(recovery.worksheet.title)
            } footer: {
                Text("\(recovery.worksheet.prompt) Your answers stay on this phone. They are not sent to the church.")
            }
        }
        .navigationTitle(recovery.title)
    }

    private var scores: [String: Int] {
        (try? JSONDecoder().decode([String: Int].self, from: Data(stored.utf8))) ?? [:]
    }

    private func score(for area: String) -> Binding<Int> {
        Binding(
            get: { scores[area] ?? 5 },
            set: { value in
                var next = scores
                next[area] = min(max(value, 1), 10)
                if let data = try? JSONEncoder().encode(next), let text = String(data: data, encoding: .utf8) {
                    stored = text
                }
            }
        )
    }
}

/// The church's Support/Assistance Request with its six boxes.
struct SupportFormView: View {
    let support: SupportInfo
    let signedIn: Bool
    let perform: (MemberAction) async -> String
    @State private var needs: Set<String> = []
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var consent = false
    @State private var notice = ""

    var body: some View {
        Form {
            Section {
                ForEach(support.needs) { need in
                    Toggle(need.label, isOn: binding(for: need.id))
                }
            } header: {
                Text(support.prompt)
            } footer: {
                Text(support.intro)
            }
            if !signedIn {
                Section("How can we reach you?") {
                    TextField("Your name", text: $name).textContentType(.name)
                    TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress)
                    TextField("Phone", text: $phone).textContentType(.telephoneNumber).keyboardType(.phonePad)
                }
            }
            Section {
                Toggle(signedIn ? "One Hope may contact me using my account email" : "One Hope may contact me about this", isOn: $consent)
                Button("Send support request") {
                    send()
                }
                .accessibilityIdentifier("support-send")
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
            }
        }
        .navigationTitle(support.title)
    }

    private func binding(for id: String) -> Binding<Bool> {
        Binding(
            get: { needs.contains(id) },
            set: { isOn in
                if isOn {
                    needs.insert(id)
                } else {
                    needs.remove(id)
                }
            }
        )
    }

    private func send() {
        let ordered = support.needs.map(\.id).filter { needs.contains($0) }
        let request = signedIn
            ? SupportRequest.member(needs: ordered, consent: consent)
            : SupportRequest.guest(needs: ordered, name: name, email: email, phone: phone, consent: consent)
        switch request {
        case let .failure(problem):
            notice = problem.message
        case let .success(body):
            Task {
                notice = await perform(.support(body))
                if notice.hasPrefix("Thank you") {
                    needs = []
                }
            }
        }
    }
}
