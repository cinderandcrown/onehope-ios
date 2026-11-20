import OneHopeCore
import XCTest

final class MediaTests: XCTestCase {
    func testOnlyHttpsPhotosAreUsed() {
        let images = ChurchImages(slots: ["hero": "https://img.example.org/h.jpg", "kids": "http://img.example.org/k.jpg", "about": ""])
        XCTAssertEqual(images.url(named: "hero")?.host, "img.example.org")
        XCTAssertNil(images.url(named: "kids"))
        XCTAssertNil(images.url(named: "about"))
        XCTAssertNil(images.url(named: "missing"))
        XCTAssertEqual(images.allURLs.count, 1)
    }

    func testTeamAndMinistriesDecodeAndDropBadLinks() throws {
        let json = Data(#"{"id":"k","title":"Kids","blurb":"A safe place.","photo":"https://img.example.org/k.jpg","url":"javascript:alert(1)"}"#.utf8)
        let card = try JSONDecoder().decode(MinistryCard.self, from: json)
        XCTAssertEqual(card.photoURL?.lastPathComponent, "k.jpg")
        XCTAssertNil(card.link)
        let person = try JSONDecoder().decode(TeamMember.self, from: Data(#"{"id":"p","name":"Pat Sample","role":"Teacher","photo":""}"#.utf8))
        XCTAssertNil(person.photoURL)
    }

    func testWarmListPutsTheFirstScreenFirstAndHasNoRepeats() throws {
        var snapshot = ChurchSnapshot.bundled()
        snapshot.images = ChurchImages(slots: [
            "zebra": "https://img.example.org/z.jpg",
            "hero": "https://img.example.org/h.jpg",
            "revival": "https://img.example.org/r.jpg",
        ])
        let photo = try JSONDecoder().decode(GalleryPhoto.self, from: Data(#"{"id":"g","caption":"Latte","url":"https://img.example.org/r.jpg"}"#.utf8))
        snapshot.media = ChurchMedia(revivalGallery: [photo])
        let urls = snapshot.warmURLs.map(\.lastPathComponent)
        XCTAssertEqual(urls.prefix(2), ["h.jpg", "r.jpg"])
        XCTAssertEqual(urls.count, Set(urls).count)
        XCTAssertTrue(urls.contains("z.jpg"))
    }

    func testBundledChurchHasNoPhotosAndNoMedia() {
        let snapshot = ChurchSnapshot.bundled()
        XCTAssertTrue(snapshot.warmURLs.isEmpty)
        XCTAssertTrue(snapshot.media.team.isEmpty)
    }
}
