import OneHopeCore
import OneHopeDesign
import SwiftUI

/// The church's real ways to give: Church Center online, text 84321, and mail.
/// The native card form stays hidden until giving is switched on with Stripe keys.
public struct GiveView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    private let perform: (MemberAction) async -> String
    private let embedded: Bool
    @State private var amount = ""
    @State private var fundId = ""
    @State private var frequency = GivingFrequency.once
    @State private var password = ""
    @State private var notice = ""

    public init(
        snapshot: ChurchSnapshot,
        onRefresh: @escaping () async -> Void = {},
        perform: @escaping (MemberAction) async -> String = { _ in "" },
        embedded: Bool = false
    ) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
        self.perform = perform
        self.embedded = embedded
    }

    public var body: some View {
        if embedded {
            givingPage
        } else {
            NavigationStack { givingPage }
        }
    }

    @ViewBuilder private var givingPage: some View {
        let giving = snapshot.giving
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(giving.message)
                VerseCard(text: giving.verse.text, reference: giving.verse.reference)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Online giving").font(.headline)
                    Text(giving.online.note)
                    if let url = URL(string: giving.online.url) {
                        Link(destination: url) {
                            Text("Give online").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .accessibilityIdentifier("give-online")
                    }
                }
                .churchCard()
                VStack(alignment: .leading, spacing: 8) {
                    Text("Text to give").font(.headline)
                    Text(giving.text.note)
                    if let sms = URL(string: "sms:\(giving.text.number)") {
                        Link("Text \(giving.text.number)", destination: sms).buttonStyle(.bordered).controlSize(.large)
                    }
                }
                .churchCard()
                if let seasonal = giving.seasonal {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(seasonal.title).font(.headline)
                        Text(seasonal.note)
                        if let url = URL(string: giving.online.url) {
                            Link("Give to the Giving Tree", destination: url).buttonStyle(.bordered).controlSize(.large)
                        }
                    }
                    .churchCard()
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("By mail").font(.headline)
                    Text(giving.mail.note)
                    Text(giving.mail.address).textSelection(.enabled)
                }
                .churchCard()
                if snapshot.givingOpen {
                    nativeGift
                }
                if !snapshot.gifts.isEmpty {
                    history
                }
            }
            .padding()
        }
        .refreshable { await onRefresh() }
        .background(BrandColor.paper)
        .navigationTitle(L10n.text(.give))
    }

    /// Native giving with the Church Center frequencies. Shown only when giving is switched on.
    private var nativeGift: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Give in the app").font(.headline)
            if snapshot.signedIn {
                LabeledField("Amount", hint: "In US dollars") {
                    TextField("Amount", text: $amount)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("gift-amount")
                }
                Picker("Fund", selection: $fundId) {
                    ForEach(snapshot.funds) { fund in
                        Text(fund.name).tag(fund.id)
                    }
                }
                Picker("Frequency", selection: $frequency) {
                    ForEach(GivingFrequency.allCases) { item in
                        Text(item.label).tag(item)
                    }
                }
                LabeledField("Password", hint: "Confirms it is you before a gift is made") {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                }
                Button("Give") {
                    give()
                }
                .buttonStyle(PrimaryButtonStyle())
                if !notice.isEmpty {
                    Text(notice).font(.footnote)
                }
            } else {
                Text("Sign in under Connect to give here, or use online giving above.")
            }
        }
        .churchCard()
        .announce(notice)
        .onAppear {
            if fundId.isEmpty {
                fundId = snapshot.funds.first?.id ?? ""
            }
        }
    }

    private func give() {
        guard let cents = GiftRequest.cents(from: amount) else {
            notice = "Enter an amount like 25 or 25.50."
            return
        }
        guard !password.isEmpty else {
            notice = "Confirm your password to give."
            return
        }
        let request = GiftRequest(amountCents: cents, fundId: fundId, recurring: frequency)
        let typed = password
        password = ""
        Task {
            notice = await perform(.gift(request, password: typed))
            if notice.hasPrefix("Thank you") {
                amount = ""
            }
        }
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("History").font(.headline)
            ForEach(snapshot.gifts) { gift in
                VStack(alignment: .leading) {
                    Text(gift.fundName)
                    Text(Self.dollars(gift.amountCents))
                    Text(gift.charged ? "Received" : "Not received yet").font(.footnote)
                }
            }
        }
        .churchCard()
    }

    private static func dollars(_ cents: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "$0.00"
    }
}
