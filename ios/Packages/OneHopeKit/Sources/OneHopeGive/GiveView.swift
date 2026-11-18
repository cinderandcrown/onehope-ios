import OneHopeCore
import OneHopeDesign
import SwiftUI

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
        NavigationStack {
            Form {
                Section("Give") {
                    if snapshot.givingOpen {
                        TextField("Amount", text: $amount)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("gift-amount")
                        Picker("Fund", selection: $fundId) {
                            ForEach(snapshot.funds) { fund in
                                Text(fund.name).tag(fund.id)
                            }
                        }
                    } else {
                        Text("Giving opens soon.")
                            .accessibilityIdentifier("giving-soon")
                    }
                }
                if !snapshot.gifts.isEmpty {
                    Section("History") {
                        ForEach(snapshot.gifts) { gift in
                            VStack(alignment: .leading) {
                                Text(gift.fundName)
                                Text(Self.dollars(gift.amountCents))
                                Text(gift.charged ? "Received" : "Not received yet").font(.footnote)
                            }
                        }
                    }
                }
            }
            .refreshable { await onRefresh() }
            .navigationTitle(L10n.text(.give))
        }
    }

    private static func dollars(_ cents: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "$0.00"
    }
}
