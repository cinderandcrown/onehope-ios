import OneHopeCore
import XCTest

final class GrowthTests: XCTestCase {
    func testSupportRequestMatchesTheServerRules() {
        XCTAssertEqual(SupportRequest.guest(needs: [], name: "Sam", email: "", phone: "214-555-0100", consent: true), .failure(.needs))
        XCTAssertEqual(SupportRequest.guest(needs: ["clothing"], name: " ", email: "", phone: "214-555-0100", consent: true), .failure(.name))
        XCTAssertEqual(SupportRequest.guest(needs: ["clothing"], name: "Sam", email: "", phone: " ", consent: true), .failure(.contact))
        XCTAssertEqual(SupportRequest.guest(needs: ["clothing"], name: "Sam", email: "", phone: "214-555-0100", consent: false), .failure(.consent))
        let sent = SupportRequest.guest(needs: ["hospital", "clothing"], name: " Sam ", email: "", phone: "214-555-0100", consent: true)
        XCTAssertEqual(try sent.get().name, "Sam")
        XCTAssertEqual(try sent.get().needs, ["hospital", "clothing"])
        XCTAssertEqual(SupportRequest.member(needs: ["counseling"], consent: false), .failure(.consent))
        XCTAssertNil(try SupportRequest.member(needs: ["counseling"], consent: true).get().email)
    }

    func testGivingFrequenciesMatchChurchCenter() {
        XCTAssertEqual(GivingFrequency.allCases.map(\.label), ["Once", "Weekly", "Every other week", "Twice monthly", "Monthly"])
        XCTAssertEqual(GivingFrequency.allCases.map(\.rawValue), ["once", "weekly", "every_other_week", "twice_monthly", "monthly"])
    }

    func testGiftAmountParsing() {
        XCTAssertEqual(GiftRequest.cents(from: "25"), 2500)
        XCTAssertEqual(GiftRequest.cents(from: "25.5"), 2550)
        XCTAssertEqual(GiftRequest.cents(from: "$1,250.00"), 125_000)
        XCTAssertNil(GiftRequest.cents(from: "0"))
        XCTAssertNil(GiftRequest.cents(from: "12.345"))
        XCTAssertNil(GiftRequest.cents(from: "abc"))
        XCTAssertNil(GiftRequest.cents(from: "100001"))
    }
}
