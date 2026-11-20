import SwiftUI

/// What the app really collects and does with it. A draft until the church and an attorney review it.
struct PrivacyScreen: View {
    var body: some View {
        LegalDocument(
            title: "Privacy Policy",
            banner: "DRAFT. This policy is waiting for review by the church and an attorney. It is not legal advice and is not final.",
            sections: Self.sections,
            identifier: "privacy-screen"
        )
    }

    static let sections: [LegalSection] = [
        LegalSection(heading: "Who this is for", paragraphs: [
            "This app belongs to One Hope Church (\"the church\"). This policy says what the app collects, why, who can see it, and how you can have it deleted.",
            "Effective date: to be set by the church when this draft is approved.",
        ]),
        LegalSection(heading: "What the app collects", paragraphs: [
            "• Account: your name, email, and password. Your password is stored only in scrambled (hashed) form. A phone number is optional.",
            "• Directory choices: whether your email, your phone, and a listing for you show to other signed-in members. You choose, and you can change it any time under Profile.",
            "• Prayer requests: what you write and whether you want the church to contact you. Pastors and the care team can read them. A request appears to others only after it is approved.",
            "• Kids check-in: a guardian enters a child's name, classroom, allergy and medical notes, and a security code. Church staff can add pickup and custody notes. These notes are encrypted in storage and open only to the staff roles who need them.",
            "• Church activity: events you sign up for, groups you join, places you serve, steps in your faith pathway, Daily Word streak, and messages in your groups.",
            "• Follow-up requests: a name, and an email or phone only if you give them, and only if you check the box allowing the church to contact you.",
            "• Giving: this version of the app does not take payments. Giving opens the church's online giving page, a text-to-give number, or the mailing address. If in-app giving is turned on later, card details go straight to the payment processor, Stripe, and are never stored on the church's app servers. The app would keep only the amount, fund, and date.",
            "• Security records: when you sign in, the server records the time, your IP address, and your device type to protect accounts and spot misuse. It keeps a log of who opened or changed sensitive records.",
        ]),
        LegalSection(heading: "What it does not collect", paragraphs: [
            "The app does not use advertising, does not track you across other apps or websites, and does not include third-party analytics in this version. It does not read your contacts or photos, and it does not know your location.",
            "The camera is used only if you choose to scan a kids check-in code. Calendar access is write-only and only when you add an event. Notifications are used only for the Sunday reminder you turn on.",
        ]),
        LegalSection(heading: "Who can see your information", paragraphs: [
            "• You, always.",
            "• Church staff, only the roles that need it, such as pastors for prayer requests or the kids team for check-in. Sensitive records need a second confirmation before a staff member opens them.",
            "• Other members, only what you choose to show in the directory, and prayer requests the church approved.",
            "• Service providers that run the app for the church, such as the web host and database host. They handle the data for the church and not for their own use.",
            "• Others only if the law requires it, or to protect someone's safety.",
            "The church does not sell your information.",
        ]),
        LegalSection(heading: "Third-party content", paragraphs: [
            "Sermon videos play in YouTube's player. YouTube (Google) may collect information when you play a video, under its own policy. Church Center pages for giving and events, Apple Maps, and links to Instagram, Facebook, and YouTube open outside the app and follow those services' own policies.",
        ]),
        LegalSection(heading: "Children", paragraphs: [
            "The app is not directed to children under 13. You must be at least 13 to make an account.",
            "A parent or guardian may enter information about their own child for kids check-in. That information is used only for check-in, pickup, and the child's safety and care at church. A guardian can ask the church to delete a child's information by contacting the church (see Contact).",
            "If you believe a child under 13 has given us information on their own, contact the church and it will be deleted.",
        ]),
        LegalSection(heading: "Keeping and deleting your data", paragraphs: [
            "You can delete your account in the app: open More, then Profile, enter your password, and choose Delete my account. This removes your sign-in, your prayer requests, event sign-ups, group messages and membership, serving and pathway records, follow-up requests, and your kids' records when you are the last guardian in the household. Gift records for the household are removed when the last member of the household deletes their account. Your coffee orders stay but are no longer linked to you.",
            "A short audit record that something was deleted, without the deleted content, may be kept for security. Audit logs are kept for up to 7 years. If the church must keep a record, such as a financial record, it may be kept as required.",
            "You can also ask the church to delete or correct your information by contacting it.",
        ]),
        LegalSection(heading: "Security", paragraphs: [
            "Data travels over encrypted connections. Kids medical notes and giving details are encrypted in storage. No system is perfectly secure, and we cannot promise it will never be breached. Use a password you do not use anywhere else.",
        ]),
        LegalSection(heading: "Changes", paragraphs: [
            "If this policy changes, the new version will appear here with a new effective date.",
        ]),
        LegalSection(heading: "Contact", paragraphs: [
            "Questions, deletion requests, or a child's information: contact the church office using the details at weareonehope.com. A dedicated privacy email address is to be added here by the church before this draft is final.",
        ]),
    ]
}
