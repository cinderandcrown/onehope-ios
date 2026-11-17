import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct GiveView: View {
    @State private var amount = "25"
    @State private var recurring = false
    @State private var confirmed = false

    public init() {}

    public var body: some View {
        let result = GivingRules.prepare(live: false)
        return NavigationStack {
            Form {
                Section("Gift") {
                    TextField("Amount in dollars", text: $amount)
                        .keyboardType(.decimalPad)
                    Toggle("Monthly", isOn: $recurring)
                    Text("Demo mode. Apple Pay nonprofit approval is pending. This does not charge a card.")
                        .font(.footnote)
                }
                Section {
                    Button("Review Apple Pay") {
                        confirmed = true
                        Haptics.tap()
                    }
                    .accessibilityHint("Opens a demo confirmation. No payment is sent.")
                }
                if confirmed {
                    Section("Confirmation") {
                        Text(result.charged ? "Charged" : "Not charged")
                        Text("Demo processor")
                        SampleBadge()
                    }
                }
                Section("History") {
                    LabeledContent("General", value: "$25.00")
                    Text("Sample household gift. Charged: no.").font(.footnote)
                }
            }
            .navigationTitle(L10n.text(.give))
        }
    }
}
