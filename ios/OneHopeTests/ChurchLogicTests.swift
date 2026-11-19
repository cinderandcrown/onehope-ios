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
        let beforeWindow = try XCTUnwrap(ServiceSchedule.nextSunday(from: before))
        XCTAssertEqual(parser.string(from: beforeWindow.service), "2026-11-22T16:30:00Z")
        let after = try XCTUnwrap(parser.date(from: "2026-11-22T17:00:00Z"))
        let afterWindow = try XCTUnwrap(ServiceSchedule.nextSunday(from: after))
        XCTAssertEqual(parser.string(from: afterWindow.service), "2026-11-29T16:30:00Z")
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

    private static let homeJSON = """
    {"ok":true,"church":{"name":"One Hope","address":"1251 S. Sherman St.","leadPastors":["Derek Miller","Jen Miller"]},"countdown":{"service":"2026-11-22T16:30:00.000Z"},"announcements":[{"id":"a","title":"Sunday","body":"10:30","sample":false}],"events":[{"id":"e","title":"Sunday gathering","location":"Richardson","sample":false,"start":1795365000000,"end":1795370400000,"url":null},{"id":"cc-1","title":"Giving Tree 2026","location":"Dallas","sample":false,"url":"https://weareonehope.churchcenter.com/registrations/events/3990859"}],"visit":{"welcome":"We are excited to meet you!","directions":"Just off of US 75","serviceTime":"Sundays at 10:30 a.m.","arrival":"Come early","kids":"Kids","address":"1251 S. Sherman St.","mapsUrl":"https://maps.apple.com/","calendarPath":"/api/events/e/ics","websiteUrl":"https://www.weareonehope.com/plan-your-visit"},"giving":{"message":"Generosity","verse":{"reference":"2 Corinthians 9:7","text":"cheerful giver"},"online":{"url":"https://weareonehope.churchcenter.com/giving","note":"Online"},"text":{"number":"84321","note":"Text"},"mail":{"address":"PO Box 211926, Dallas, TX 75211","note":"Mail"},"seasonal":{"title":"Christmas Giving Tree","note":"Choose Christmas Giving Tree","until":1798264800000}},"invite":{"title":"Come sit with me","body":"Sundays","url":"https://www.weareonehope.com/plan-your-visit","mapsUrl":"https://maps.apple.com/"},"sampleSermon":{"title":""}}
    """

    private static func publicReply(_ path: String) -> (Int, Data)? {
        switch path {
        case "/api/home":
            (200, Data(homeJSON.utf8))
        case "/api/sermons":
            (200, Data(#"{"videos":[{"id":"s1","title":"Short","published":"2026-11-17T15:00:00+00:00","link":"https://www.youtube.com/shorts/s1","thumbnail":null,"kind":"short"},{"id":"m1","title":"Sunday message","published":"2026-11-16T15:00:00+00:00","link":"https://www.youtube.com/watch?v=m1","thumbnail":"https://i.ytimg.com/vi/m1/hqdefault.jpg","kind":"message"}]}"#.utf8))
        case "/api/groups":
            (200, Data(#"{"groups":[{"id":"unlocking-freedom","name":"Unlocking Freedom","summary":"","sample":false,"joined":false,"category":"Year Around Groups","schedule":"Sundays, 6–8 p.m.","area":"","leaders":["Allison Burke"],"joinType":"request","url":"https://weareonehope.churchcenter.com/groups/year-around-groups/unlocking-freedom"}]}"#.utf8))
        case "/api/know-jesus":
            (200, Data(#"{"gospel":{"intro":"Good news","steps":[{"title":"God loves you","reference":"John 3:16","text":"For God so loved the world"}],"prayer":"Lord Jesus","baptism":"Baptism","baptismVerse":{"reference":"Romans 6:4","text":"newness of life"},"growthTrack":"Growth Track"},"journey":[{"day":1,"title":"You are loved","reference":"John 3:17","text":"saved","prompt":"Thank God"}]}"#.utf8))
        case "/api/daily-word":
            (200, Data(#"{"reading":{"reference":"John 14:6","text":"I am the way","read":"John 14","prompt":"Follow","day":"2026-11-18"},"streak":null}"#.utf8))
        default:
            nil
        }
    }

    func testGuestLoadsTheChurchWithoutAnAccount() async throws {
        let transport = FixtureTransport { url, _ in
            Self.publicReply(url.path) ?? (401, Data(#"{"ok":false,"error":"Sign in again.","code":"unauthenticated"}"#.utf8))
        }
        let client = try ChurchClient(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:8787")), transport: transport)
        let snapshot = try await client.loadGuest()
        XCTAssertFalse(snapshot.signedIn)
        XCTAssertEqual(snapshot.sermons.filter(\.isShort).map(\.id), ["s1"])
        XCTAssertEqual(snapshot.sermonTitle, "Sunday message")
        XCTAssertEqual(snapshot.giving.text.number, "84321")
        XCTAssertEqual(snapshot.giving.seasonal?.title, "Christmas Giving Tree")
        XCTAssertEqual(snapshot.events.last?.url?.host, "weareonehope.churchcenter.com")
        XCTAssertFalse(try XCTUnwrap(snapshot.groups.first).joinsInApp)
        XCTAssertEqual(snapshot.gospel?.steps.first?.reference, "John 3:16")
        XCTAssertEqual(snapshot.daily?.day, "2026-11-18")
        XCTAssertNil(snapshot.dailyStreak)
    }

    func testClientReadsTheMemberContract() async throws {
        let transport = FixtureTransport { url, _ in
            if let reply = Self.publicReply(url.path) {
                return reply
            }
            switch url.path {
            case "/api/events/mine":
                return (200, Data(#"{"events":[{"id":"e","registered":true}]}"#.utf8))
            case "/api/giving/mine":
                return (401, Data(#"{"ok":false,"error":"step up","code":"step_up_required"}"#.utf8))
            case "/api/prayers":
                return (200, Data(#"{"prayers":[{"id":"p","serve":"Pray for my family","body":"Need","contactRequested":true,"sample":false,"approved":false,"mine":true}]}"#.utf8))
            default:
                return (200, Data(#"{"token":"abc","people":[],"person":{"displayName":"Avery Sample","email":"avery@sample.onehope"},"kids":[{"id":"child-remy","displayName":"Remy Sample","classroom":"Preschool","sample":true}],"assignments":[],"steps":[{"id":"baptism","title":"Baptism","status":"in-progress"}],"funds":[{"id":"general","name":"General"}],"open":false}"#.utf8))
            }
        }
        let client = try ChurchClient(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:8787")), transport: transport)
        let token = try await client.login(email: "avery@sample.onehope", password: "hope-sample")
        XCTAssertEqual(token, "abc")
        let snapshot = try await client.loadMember(token: token)
        XCTAssertTrue(snapshot.fromAPI)
        XCTAssertTrue(snapshot.signedIn)
        XCTAssertEqual(snapshot.churchName, "One Hope")
        XCTAssertTrue(snapshot.needsStepUp)
        XCTAssertTrue(snapshot.gifts.isEmpty)
        XCTAssertEqual(snapshot.kids.first?.displayName, "Remy Sample")
        XCTAssertEqual(snapshot.pathway.first?.title, "Baptism")
        XCTAssertEqual(snapshot.events.first?.registered, true)
        XCTAssertEqual(snapshot.prayers.first?.serve, "Pray for my family")
        XCTAssertEqual(snapshot.prayers.first?.contactRequested, true)
        XCTAssertTrue(snapshot.serving.isEmpty)
    }

    func testDailyWordStreakMatchesTheServer() {
        XCTAssertEqual(StreakRules.next(lastDay: nil, count: 0, today: "2026-11-18"), 1)
        XCTAssertEqual(StreakRules.next(lastDay: "2026-11-18", count: 3, today: "2026-11-18"), 3)
        XCTAssertEqual(StreakRules.next(lastDay: "2026-11-30", count: 3, today: "2026-12-01"), 4)
        XCTAssertEqual(StreakRules.next(lastDay: "2026-11-15", count: 3, today: "2026-11-18"), 1)
        XCTAssertEqual(StreakRules.current(lastDay: "2026-11-17", count: 2, today: "2026-11-18"), 2)
        XCTAssertEqual(StreakRules.current(lastDay: "2026-11-15", count: 2, today: "2026-11-18"), 0)
    }

    func testGuestFollowUpNeedsANameAndConsentForContact() {
        XCTAssertEqual(FollowUpRequest.guest(kind: .salvation, name: " ", email: "", phone: "", consent: false), .failure(.name))
        XCTAssertEqual(FollowUpRequest.guest(kind: .visit, name: "Sam", email: "sam@example.com", phone: "", consent: false), .failure(.consent))
        let sent = FollowUpRequest.guest(kind: .visit, name: " Sam ", email: "", phone: "", consent: false)
        XCTAssertEqual(sent, .success(FollowUpRequest(kind: .visit, name: "Sam", email: "", phone: "", consent: false)))
    }

    func testSpanishChrome() {
        XCTAssertEqual(L10n.text(.home, language: .es), "Inicio")
        XCTAssertEqual(L10n.text(.give, language: .en), "Give")
    }
}
