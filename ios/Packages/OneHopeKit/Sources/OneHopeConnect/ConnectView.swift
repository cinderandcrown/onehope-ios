import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct ConnectView: View {
    private let snapshot: ChurchSnapshot
    @State private var code = ""
    @State private var decision: PickupDecision?

    public init(snapshot: ChurchSnapshot) { self.snapshot = snapshot }

    public var body: some View {
        NavigationStack {
            List {
                Section("Groups") {
                    if snapshot.groups.isEmpty { EmptyHint("No groups yet.") }
                    ForEach(snapshot.groups) { group in
                        VStack(alignment: .leading) {
                            Text(group.name)
                            Text(group.summary).font(.footnote)
                            Text(group.joined ? "Joined" : "Not joined").font(.footnote)
                            if group.sample { SampleBadge() }
                        }
                    }
                }
                Section("Events") {
                    ForEach(snapshot.events) { event in
                        VStack(alignment: .leading) {
                            Text(event.title)
                            Text(event.detail).font(.footnote)
                            if event.sample { SampleBadge() }
                        }
                    }
                }
                Section("Prayer") {
                    if snapshot.prayers.isEmpty { EmptyHint("No prayers you can see.") }
                    ForEach(snapshot.prayers) { prayer in
                        VStack(alignment: .leading) {
                            Text(prayer.body)
                            if prayer.sample { SampleBadge() }
                        }
                    }
                }
                Section("Kids check-in") {
                    TextField("Security code", text: $code).keyboardType(.numberPad)
                    Button("Check pickup") {
                        decision = PickupRules.evaluate(
                            PickupInput(code: code, expectedCode: "4821", guardianAuthorized: true, custodyRestricted: false, adultsOnDuty: 2)
                        )
                        Haptics.tap()
                    }
                    if let decision { Text(decision.reason) }
                    Text("The station still requires two adults and a guardian who is not custody-restricted.")
                        .font(.footnote)
                }
            }
            .navigationTitle(L10n.text(.connect))
        }
    }
}
