import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct GiveView: View {
    private let snapshot: ChurchSnapshot
    private let onStepUp: (String) -> Void
    @State private var password = ""

    public init(snapshot: ChurchSnapshot, onStepUp: @escaping (String) -> Void) {
        self.snapshot = snapshot
        self.onStepUp = onStepUp
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Demo mode. Apple Pay nonprofit approval is pending. This does not charge a card.")
                        .font(.footnote)
                }
                if snapshot.needsStepUp {
                    Section("Your giving") {
                        Text("Confirm it is you before the amounts open.")
                        SecureField("Password", text: $password)
                        Button("Show my giving") { onStepUp(password) }
                    }
                } else if snapshot.gifts.isEmpty {
                    Section("History") { EmptyHint("No gifts on this account.") }
                } else {
                    Section("History") {
                        ForEach(snapshot.gifts) { gift in
                            VStack(alignment: .leading) {
                                Text(gift.fundName)
                                Text(Self.dollars(gift.amountCents))
                                Text(gift.charged ? "Charged" : "Not charged").font(.footnote)
                                if gift.sample {
                                    SampleBadge()
                                }
                            }
                        }
                    }
                }
            }
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
