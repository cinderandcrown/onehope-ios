import XCTest

final class ReleaseEndpointTests: XCTestCase {
    func testReleaseBuildPointsAtTheChurch() throws {
        #if DEBUG
        throw XCTSkip("Debug leaves API_BASE_URL empty. Release is what ships to TestFlight.")
        #else
        let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
        XCTAssertFalse(raw.isEmpty)
        XCTAssertEqual(raw, "https://onehope-beryl.vercel.app")
        #endif
    }
}
