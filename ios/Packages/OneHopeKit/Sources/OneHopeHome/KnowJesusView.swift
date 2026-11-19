import OneHopeCore
import OneHopeDesign
import SwiftUI

/// The gospel from Scripture (KJV), next-step buttons for the staff queue, and the 7-day journey after a decision.
public struct KnowJesusView: View {
    private let snapshot: ChurchSnapshot
    private let perform: (MemberAction) async -> String
    private let embedded: Bool
    @AppStorage("onehope.journey.started") private var journeyStarted = false
    @State private var asking: FollowUpKind?
    @State private var notice = ""

    /// `embedded` is true when pushed inside another navigation stack.
    public init(snapshot: ChurchSnapshot, perform: @escaping (MemberAction) async -> String, embedded: Bool = false) {
        self.snapshot = snapshot
        self.perform = perform
        self.embedded = embedded
    }

    public var body: some View {
        if embedded {
            content
        } else {
            NavigationStack { content }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let gospel = snapshot.gospel {
                    Text(gospel.intro)
                    ForEach(Array(gospel.steps.enumerated()), id: \.element.id) { index, step in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(index + 1). \(step.title)").font(.headline)
                            Text("\u{201C}\(step.text)\u{201D}").font(.body.italic())
                            Text("\(step.reference) (KJV)").font(.footnote.weight(.semibold)).foregroundStyle(BrandColor.olive)
                        }
                        .churchCard()
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("A prayer you can pray").font(.headline)
                        Text(gospel.prayer)
                    }
                    .churchCard()
                    decisions
                    if journeyStarted {
                        journey
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Water baptism").font(.headline)
                        Text(gospel.baptism)
                    }
                    .churchCard()
                    VerseCard(text: gospel.baptismVerse.text, reference: gospel.baptismVerse.reference)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Growth Track").font(.headline)
                        Text(gospel.growthTrack)
                        Button(FollowUpKind.growthTrack.label) { asking = .growthTrack }
                    }
                    .churchCard()
                } else {
                    Text(snapshot.offlineNote.isEmpty ? "Loading…" : snapshot.offlineNote)
                }
            }
            .padding()
        }
        .background(BrandColor.paper)
        .navigationTitle(L10n.text(.knowJesus))
        .sheet(item: $asking) { kind in
            FollowUpForm(kind: kind, signedIn: snapshot.signedIn, perform: perform) {
                notice = kind.thanks
                if kind == .salvation {
                    journeyStarted = true
                }
            }
        }
    }

    private var decisions: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Take a next step").font(.headline)
            ForEach([FollowUpKind.salvation, .baptism, .new]) { kind in
                Button {
                    asking = kind
                } label: {
                    Text(kind.label).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("decision-\(kind.rawValue)")
            }
            if !notice.isEmpty {
                Text(notice).font(.callout.weight(.semibold)).foregroundStyle(BrandColor.olive)
            }
        }
    }

    private var journey: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Your first 7 days").font(.title3.bold())
            ForEach(snapshot.journey) { day in
                VStack(alignment: .leading, spacing: 6) {
                    Text("Day \(day.day) · \(day.title)").font(.headline)
                    Text("\u{201C}\(day.text)\u{201D}").font(.body.italic())
                    Text("\(day.reference) (KJV)").font(.footnote.weight(.semibold)).foregroundStyle(BrandColor.olive)
                    Text(day.prompt)
                }
                .churchCard()
            }
        }
    }
}
