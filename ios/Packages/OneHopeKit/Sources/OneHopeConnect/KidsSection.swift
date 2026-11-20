import OneHopeCore
import OneHopeDesign
import SwiftUI

/// Household check-in. Each child shows whether they are checked in; pickup needs
/// the code from check-in, a verified guardian, and two adults at the station.
public struct KidsSection: View {
    let kids: [KidLine]
    let perform: (MemberAction) async -> String
    @Binding var notice: String
    @State private var childName = ""
    @State private var classroom = "Preschool"
    @State private var codes: [String: String] = [:]

    public init(kids: [KidLine], perform: @escaping (MemberAction) async -> String, notice: Binding<String>) {
        self.kids = kids
        self.perform = perform
        self._notice = notice
    }

    public var body: some View {
        Section {
            ForEach(kids) { child in
                row(child)
            }
            LabeledField("Child's name") {
                TextField("Child's name", text: $childName)
            }
            Picker("Classroom", selection: $classroom) {
                Text("Nursery").tag("Nursery")
                Text("Preschool").tag("Preschool")
                Text("Elementary").tag("Elementary")
            }
            Button("Add child") {
                let name = childName.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !name.isEmpty else {
                    notice = "Enter your child's name."
                    return
                }
                Task {
                    notice = await perform(.addChild(name, classroom))
                    childName = ""
                }
            }
        } header: {
            Text("Kids check-in")
        } footer: {
            Text("Keep the security code from check-in. Pickup works once, for a guardian with that code, when two adults are at the station.")
        }
        .announce(notice)
    }

    private func row(_ child: KidLine) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(child.displayName).font(.headline)
                Spacer()
                Text(child.checkedIn ? "Checked in" : "Not checked in")
                    .font(.footnote)
                    .foregroundStyle(child.checkedIn ? BrandColor.olive : BrandColor.ink.opacity(0.8))
            }
            Text(child.classroom).font(.footnote)
            if child.checkedIn {
                LabeledField("Security code", hint: "The 4 digits you got at check-in") {
                    TextField("Security code", text: binding(for: child.id))
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("pickup-code-\(child.id)")
                }
                Button("Pick up \(child.displayName)") {
                    let code = (codes[child.id] ?? "").trimmingCharacters(in: .whitespaces)
                    guard code.count == 4, code.allSatisfy(\.isNumber) else {
                        notice = "Enter the 4-digit security code from check-in."
                        return
                    }
                    Task {
                        notice = await perform(.pickup(child.id, code))
                        codes[child.id] = nil
                    }
                }
            } else {
                Button("Check in \(child.displayName)") {
                    Task { notice = await perform(.checkIn(child.id)) }
                }
                .accessibilityIdentifier("check-in-\(child.id)")
            }
        }
        .buttonStyle(.borderless)
    }

    private func binding(for id: String) -> Binding<String> {
        Binding(get: { codes[id] ?? "" }, set: { codes[id] = String($0.prefix(4)) })
    }
}
