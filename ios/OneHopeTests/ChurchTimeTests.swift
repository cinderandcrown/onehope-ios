import Foundation
import OneHopeCore
import XCTest

/// Service and event times must read in Richardson time even when the phone (or CI simulator) is on UTC.
final class ChurchTimeTests: XCTestCase {
    private var savedZone = TimeZone.current

    override func setUp() {
        super.setUp()
        savedZone = NSTimeZone.default
        NSTimeZone.default = TimeZone(identifier: "UTC") ?? .gmt
    }

    override func tearDown() {
        NSTimeZone.default = savedZone
        super.tearDown()
    }

    private let english = Locale(identifier: "en_US")

    /// Sunday, November 22, 2026 at 16:30 UTC, which is 10:30 a.m. in Chicago.
    private func sundayService() throws -> Date {
        try XCTUnwrap(parseISODate("2026-11-22T16:30:00.000Z"))
    }

    func testServiceLineIsChicagoTimeOnAUTCDevice() throws {
        XCTAssertEqual(TimeZone.current.secondsFromGMT(), 0)
        let line = try ChurchTime.serviceLine(sundayService(), locale: english)
        XCTAssertTrue(line.contains("Sunday"), line)
        XCTAssertTrue(line.contains("10:30"), line)
        XCTAssertTrue(line.contains("AM"), line)
        XCTAssertFalse(line.contains("4:30"), line)
    }

    func testEventAndDayLinesUseChicagoDates() throws {
        let event = try ChurchTime.eventLine(sundayService(), locale: english)
        XCTAssertTrue(event.contains("November 22, 2026"), event)
        XCTAssertTrue(event.contains("10:30"), event)
        // 03:00 UTC on Nov 23 is still the evening of Nov 22 in Chicago.
        let late = try XCTUnwrap(parseISODate("2026-11-23T03:00:00Z"))
        XCTAssertEqual(ChurchTime.dayLine(late, locale: english), "Nov 22, 2026")
    }

    func testNextSundayIsTenThirtyChicagoOnAUTCDevice() throws {
        let tuesday = try XCTUnwrap(parseISODate("2026-11-17T18:00:00Z"))
        let window = try XCTUnwrap(ServiceSchedule.nextSunday(from: tuesday))
        XCTAssertEqual(window.service, try sundayService())
        XCTAssertTrue(ChurchTime.serviceLine(window.service, locale: english).contains("10:30"))
    }
}
