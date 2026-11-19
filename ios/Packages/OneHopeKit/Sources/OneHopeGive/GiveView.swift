import OneHopeCore
import OneHopeDesign
import SwiftUI

/// The church's real ways to give: Church Center online, text 84321, and mail.
/// The native card form stays hidden until giving is switched on with Stripe keys.
public struct GiveView: View {
    private let snapshot: ChurchSnapshot
    private let onRefresh: () async -> Void
    @State private var amount = ""
    @State private var fundId = "general"

    public init(snapshot: ChurchSnapshot, onRefresh: @escaping () async -> Void = {}) {
        self.snapshot = snapshot
        self.onRefresh = onRefresh
    }

    public var body: some View {
        let giving = snapshot.giving
        NavigationStack {
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
                            .buttonStyle(.borderedProminent)
                            .accessibilityIdentifier("give-online")
                        }
                    }
                    .churchCard()
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Text to give").font(.headline)
                        Text(giving.text.note)
                        if let sms = URL(string: "sms:\(giving.text.number)") {
                            Link("Text \(giving.text.number)", destination: sms).buttonStyle(.bordered)
                        }
                    }
                    .churchCard()
                    if let seasonal = giving.seasonal {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(seasonal.title).font(.headline)
                            Text(seasonal.note)
                            if let url = URL(string: giving.online.url) {
                                Link("Give to the Giving Tree", destination: url).buttonStyle(.bordered)
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
    }

    private var nativeGift: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Give in the app").font(.headline)
            TextField("Amount", text: $amount)
                .keyboardType(.decimalPad)
                .accessibilityIdentifier("gift-amount")
            Picker("Fund", selection: $fundId) {
                ForEach(snapshot.funds) { fund in
                    Text(fund.name).tag(fund.id)
                }
            }
        }
        .churchCard()
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
