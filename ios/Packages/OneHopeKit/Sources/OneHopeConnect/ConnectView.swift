import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct ConnectView: View {
    @State private var code = ""
    @State private var decision: PickupDecision?

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section("Groups") {
                    Text("Weekday group")
                    Text("Sample group you can join.").font(.footnote)
                    SampleBadge()
                }
                Section("Events") {
                    ForEach(SampleChurch.events) { event in
                        VStack(alignment: .leading) {
                            Text(event.title)
                            Text(event.detail).font(.footnote)
                            if event.sample { SampleBadge() }
                        }
                    }
                }
                Section("Serving") {
                    Text("Greeter · pending")
                    Text("Accept or decline stays on your own assignment.").font(.footnote)
                    SampleBadge()
                }
                Section("Prayer") {
                    Text("Pray for our city.")
                    SampleBadge()
                }
                Section("Kids check-in") {
                    Text("Remy Sample · Preschool")
                    TextField("Security code", text: $code)
                        .keyboardType(.numberPad)
                    Button("Check pickup") {
                        decision = PickupRules.evaluate(
                            PickupInput(
                                code: code,
                                expectedCode: "4821",
                                guardianAuthorized: true,
                                custodyRestricted: false,
                                adultsOnDuty: 2
                            )
                        )
                        Haptics.tap()
                    }
                    if let decision {
                        Text(decision.reason)
                    }
                    Text("Sample code 4821. A custody flag or a single adult blocks pickup.")
                        .font(.footnote)
                }
            }
            .navigationTitle(L10n.text(.connect))
        }
    }
}
