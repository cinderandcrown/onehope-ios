import OneHopeCore
import XCTest

private struct FixtureTransport: HTTPTransport {
    let respond: @Sendable (URL, String) -> (Int, Data)
    func send(url: URL, method: String, body: Data?, bearer: String?) async throws -> (status: Int, body: Data) {
        respond(url, method)
    }
}

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

    func testClientReadsTheHomeContract() async throws {
        let home = """
        {"ok":true,"church":{"name":"One Hope","address":"1251 S. Sherman St.","leadPastors":["Derek Miller","Jen Miller"]},"countdown":{"service":"2026-11-22T16:30:00.000Z"},"announcements":[{"id":"a","title":"Sunday","body":"10:30","sample":false}],"events":[{"id":"e","title":"Sunday gathering","location":"Richardson","sample":false}],"sampleSermon":{"title":"Sample: title"}}
        """.data(using: .utf8) ?? Data()
        let transport = FixtureTransport { url, _ in
            if url.path == "/api/auth/login" {
                return (200, Data("{\"token\":\"abc\"}".utf8))
            }
            if url.path == "/api/home" { return (200, home) }
            if url.path == "/api/giving/mine" {
                return (401, Data("{\"ok\":false,\"error\":\"step up\",\"code\":\"step_up_required\"}".utf8))
            }
            return (200, Data("{\"people\":[],\"groups\":[],\"prayers\":[],\"videos\":[],\"person\":{\"displayName\":\"Avery Sample\",\"email\":\"avery@sample.onehope\"}}".utf8))
        }
        let client = ChurchClient(baseURL: try XCTUnwrap(URL(string: "http://127.0.0.1:8787")), transport: transport)
        let token = try await client.login(email: "avery@sample.onehope", password: "hope-sample")
        XCTAssertEqual(token, "abc")
        let snapshot = try await client.loadMember(token: token)
        XCTAssertTrue(snapshot.fromAPI)
        XCTAssertEqual(snapshot.churchName, "One Hope")
        XCTAssertTrue(snapshot.needsStepUp)
        XCTAssertTrue(snapshot.gifts.isEmpty)
    }

    func testSpanishChrome() {
        XCTAssertEqual(L10n.text(.home, language: .es), "Inicio")
        XCTAssertEqual(L10n.text(.give, language: .en), "Give")
    }
}
