import OneHopeCore
import OneHopeDesign
import SwiftUI

public struct ConnectView: View {
    private let snapshot: ChurchSnapshot
    @State private var code = ""
    @State private var decision: PickupDecision?

    public init(snapshot: ChurchSnapshot) {
        self.snapshot = snapshot
    }

    public var body: some View {
        NavigationStack {
            List {
                Section("Groups") {
                    if snapshot.groups.isEmpty {
                        EmptyHint("No groups yet.")
                    }
                    ForEach(snapshot.groups) { group in
                        VStack(alignment: .leading) {
                            Text(group.name)
                            Text(group.summary).font(.footnote)
                            Text(group.joined ? "Joined" : "Not joined").font(.footnote)
                            if group.sample {
                                SampleBadge()
                            }
                        }
                    }
                }
                Section("Events") {
                    ForEach(snapshot.events) { event in
                        VStack(alignment: .leading) {
                            Text(event.title)
                            Text(event.detail).font(.footnote)
                            if event.sample {
                                SampleBadge()
                            }
                        }
                    }
                }
                Section("Prayer") {
                    if snapshot.prayers.isEmpty {
                        EmptyHint("No prayers you can see.")
                    }
                    ForEach(snapshot.prayers) { prayer in
                        VStack(alignment: .leading) {
                            Text(prayer.body)
                            if prayer.sample {
                                SampleBadge()
                            }
                        }
                    }
                }
                Section("Next steps") {
                    if snapshot.pathway.isEmpty {
                        EmptyHint("No next steps on this account.")
                    }
                    ForEach(snapshot.pathway) { step in
                        VStack(alignment: .leading) {
                            Text(step.title)
                            Text(step.status).font(.footnote)
                            SampleBadge()
                        }
                    }
                }
                Section("Your kids") {
                    if snapshot.kids.isEmpty {
                        EmptyHint("No children on this household.")
                    }
                    ForEach(snapshot.kids) { child in
                        VStack(alignment: .leading) {
                            Text(child.displayName)
                            Text(child.classroom).font(.footnote)
                            if child.sample {
                                SampleBadge()
                            }
                        }
                    }
                    Text("Allergies and security codes stay on the staff station.")
                        .font(.footnote)
                }
                Section("Serving") {
                    if snapshot.serving.isEmpty {
                        EmptyHint("No assignment on this account.")
                    }
                    ForEach(snapshot.serving) { item in
                        VStack(alignment: .leading) {
                            Text(item.position)
                            Text(item.status).font(.footnote)
                            if item.sample {
                                SampleBadge()
                            }
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
                    if let decision {
                        Text(decision.reason)
                    }
                    Text("This is a practice check on the phone. The staff station is the real pickup.")
                        .font(.footnote)
                }
            }
            .navigationTitle(L10n.text(.connect))
        }
    }
}
