import OneHopeCore
import XCTest

final class ChurchLogicTests: XCTestCase {
    func testNextSundayServiceInChicago() throws {
        let parser = ISO8601DateFormatter()
        let tuesday = try XCTUnwrap(parser.date(from: "2026-11-17T18:00:00Z"))
        let window = try XCTUnwrap(ServiceSchedule.nextSunday(from: tuesday))
        XCTAssertEqual(parser.string(from: window.service), "2026-11-22T16:30:00Z")
        XCTAssertEqual(parser.string(from: window.preService), "2026-11-22T16:00:00Z")
        let before = try XCTUnwrap(parser.date(from: "2026-11-22T15:00:00Z"))
        XCTAssertEqual(parser.string(from: try XCTUnwrap(ServiceSchedule.nextSunday(from: before)).service), "2026-11-22T16:30:00Z")
        let after = try XCTUnwrap(parser.date(from: "2026-11-22T17:00:00Z"))
        XCTAssertEqual(parser.string(from: try XCTUnwrap(ServiceSchedule.nextSunday(from: after)).service), "2026-11-29T16:30:00Z")
    }

    func testPickupRules() {
        let ok = PickupInput(code: "4821", expectedCode: "4821", guardianAuthorized: true, custodyRestricted: false, adultsOnDuty: 2)
        XCTAssertTrue(PickupRules.evaluate(ok).allowed)
        XCTAssertFalse(PickupRules.evaluate(PickupInput(code: ok.code, expectedCode: ok.expectedCode, guardianAuthorized: true, custodyRestricted: false, adultsOnDuty: 1)).allowed)
        XCTAssertFalse(PickupRules.evaluate(PickupInput(code: "0000", expectedCode: "4821", guardianAuthorized: true, custodyRestricted: false, adultsOnDuty: 2)).allowed)
        XCTAssertFalse(PickupRules.evaluate(PickupInput(code: "4821", expectedCode: "4821", guardianAuthorized: true, custodyRestricted: true, adultsOnDuty: 2)).allowed)
    }

    func testDirectoryHidesPrivateFields() {
        let projected = DirectoryProjection.project(viewerId: "person-avery", people: SampleChurch.directory)
        let casey = projected.first { $0.id == "person-casey" }
        XCTAssertEqual(casey?.email, "")
        XCTAssertEqual(casey?.phone, "")
        XCTAssertEqual(projected.first { $0.id == "person-harper" }?.phone, "214-555-0100")
    }

    func testDemoGiftIsNeverCharged() {
        let result = GivingRules.prepare(live: false)
        XCTAssertFalse(result.charged)
        XCTAssertEqual(result.processor, "demo")
        XCTAssertTrue(result.sample)
    }

    func testSpanishChrome() {
        XCTAssertEqual(L10n.text(.home, language: .es), "Inicio")
        XCTAssertEqual(L10n.text(.give, language: .en), "Give")
    }
}
