import SwiftUI

/// Plain-language terms of use. A draft until the church and an attorney review it.
struct TermsScreen: View {
    var body: some View {
        LegalDocument(
            title: "Terms of Use",
            banner: "DRAFT. These terms are waiting for review by the church and an attorney. They are not legal advice and are not final.",
            sections: Self.sections,
            identifier: "terms-screen"
        )
    }

    static let sections: [LegalSection] = [
        LegalSection(heading: "Using the app", paragraphs: [
            "This app is a ministry of One Hope Church. By using it you agree to these terms and to the Privacy Policy. You must be at least 13 to make an account. Keep your password private. You are responsible for what happens under your account.",
        ]),
        LegalSection(heading: "Being kind", paragraphs: [
            "Do not post anything hateful, threatening, harassing, or unlawful, and do not share other people's private information. Church staff may remove content or close an account that harms others.",
            "The app is a ministry tool. It is not used to support or oppose any candidate for public office.",
        ]),
        LegalSection(heading: "Prayer and care", paragraphs: [
            "Prayer requests go to church leaders. The app is not an emergency service and is not professional counseling or medical advice. In an emergency call 911. In the United States, you can call or text 988 for the Suicide and Crisis Lifeline.",
        ]),
        LegalSection(heading: "Giving", paragraphs: [
            "Gifts are voluntary and go to One Hope Church. Giving links open the church's online giving page or use text-to-give or mail. A gift statement says whether any goods or services were provided in return. The church does not give tax advice. Ask a tax adviser how a gift applies to you.",
        ]),
        LegalSection(heading: "Kids check-in", paragraphs: [
            "Only a parent or legal guardian may add a child. Give accurate allergy, medical, and pickup information. The security code is needed to pick up a child. Keep it private.",
        ]),
        LegalSection(heading: "Content and credits", paragraphs: [
            "Photos, videos, and writing in the app belong to the church or the people credited under About & Credits. Do not copy them except as the law allows. Scripture is the King James Version.",
        ]),
        LegalSection(heading: "No guarantees", paragraphs: [
            "The app is provided as is. We try to keep it available and correct, but it may have errors or be down. To the extent the law allows, the church is not responsible for losses from using it. This does not limit rights you have under the law.",
        ]),
        LegalSection(heading: "Ending your use", paragraphs: [
            "You can stop using the app and delete your account at any time. The church may suspend an account that breaks these terms.",
        ]),
        LegalSection(heading: "Changes and contact", paragraphs: [
            "These terms may change, and the new version will appear here. Governing law and the church's legal name and address are to be added by the church and its attorney before this draft is final. Contact the church office using the details at weareonehope.com.",
        ]),
    ]
}
