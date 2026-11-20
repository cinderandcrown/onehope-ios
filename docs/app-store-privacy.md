# App Store privacy answers for One Hope (build 10)

DRAFT for Nicholas and the church to confirm in App Store Connect. These answers describe what the app and its server do today. If a feature changes (in-app giving with Stripe, push notifications, analytics), redo this page first.

Apple's rule of thumb: "collect" means data leaves the device to our server or a partner and is kept longer than needed to answer the request. Data a signed-in user sends to the church's own server counts. Data that never leaves the phone does not.

## Tracking

- **Do you or your third-party partners use data to track users?** No.
- No advertising SDK, no advertising identifier, no data broker sharing. `PrivacyInfo.xcprivacy` already says `NSPrivacyTracking = false`.

## Data types collected (all linked to the user's identity, none used for tracking)

| Apple category                                       | Data in the app                                                           | Collected?                         | Linked to user | Tracking | Purposes                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- | -------------- | -------- | ---------------------------------------------------------- |
| Contact Info: Name                                   | Account name, child's name, follow-up and visit-card name                 | Yes                                | Yes            | No       | App Functionality                                          |
| Contact Info: Email Address                          | Account email, optional follow-up email                                   | Yes                                | Yes            | No       | App Functionality                                          |
| Contact Info: Phone Number                           | Optional phone for the directory and follow-up                            | Yes                                | Yes            | No       | App Functionality                                          |
| Contact Info: Physical Address, Other                | Not collected                                                             | No                                 |                |          |                                                            |
| Health & Fitness: Health                             | Child's allergy and medical notes for kids check-in (entered by a parent) | Yes                                | Yes            | No       | App Functionality                                          |
| Financial Info: Payment Info                         | None collected. Card numbers never reach the app or its server.           | No                                 |                |          | If in-app giving is turned on: Stripe handles it.          |
| Financial Info: Other Financial Info                 | Gift amount, fund, date (only if in-app giving is enabled)                | No today. Yes if giving is enabled | Yes            | No       | App Functionality                                          |
| Contacts, Location, Search History, Browsing History | Not collected                                                             | No                                 |                |          |                                                            |
| User Content: Other User Content                     | Prayer requests, group messages, Know Jesus decisions, support requests   | Yes                                | Yes            | No       | App Functionality                                          |
| User Content: Photos, Audio, Customer Support        | Not collected                                                             | No                                 |                |          |                                                            |
| Identifiers: User ID                                 | Account ID and session token                                              | Yes                                | Yes            | No       | App Functionality                                          |
| Identifiers: Device ID                               | Not collected (no IDFA, no IDFV sent)                                     | No                                 |                |          |                                                            |
| Usage Data: Product Interaction                      | Not collected (no analytics SDK in this build)                            | No                                 |                |          | If PostHog or similar is added, change to Yes (Analytics). |
| Diagnostics: Crash, Performance                      | Not collected by the app                                                  | No                                 |                |          | Apple's own crash reports are not "collected" by us.       |
| Other Data Types                                     | Server security log: IP address, device type and time at sign-in          | Yes                                | Yes            | No       | App Functionality (account security)                       |
| Sensitive Info                                       | Not collected                                                             | No                                 |                |          |                                                            |

Notes for the form:

- **Kids' data**: parents enter it about their own children. The app is not directed to children under 13, and children have no accounts. In App Store Connect the age rating should be answered for a general church app (no mature content). Do not select "Made for Kids".
- **Health & Fitness** is selected only because of the allergy and medical notes. Apple's definition of "Health" includes medical information a user provides.
- **Prayer requests** can reveal religion. Apple lists "Sensitive Info" for racial or ethnic data, religious or philosophical beliefs, and similar. A church prayer request is voluntary user content, but a reviewer could read it as religious belief. Safer answer: also declare **Sensitive Info**, Linked to User, not tracking, App Functionality. Confirm with the church's attorney.
- Third-party embedded content (YouTube player, Church Center pages, Apple Maps) is outside the app's own collection, but YouTube may collect data when a video plays. Apple expects you to disclose data collected by third-party code inside the app. The player runs in a web view. Disclose **Usage Data: Product Interaction** only if the church decides YouTube's playback counts. This is a judgment call to review with an attorney.

## Other App Store Connect items

- **Privacy Policy URL (required)**: needs a public web page. The in-app draft is the source text. Publish the final text on the church's site and put the URL in App Store Connect.
- **Account deletion (guideline 5.1.1(v))**: in app at More > Profile > Delete my account (password required). It starts from the signed-in profile and finishes in the app.
- **Sign in with Apple**: only required when the app offers third-party social login. It offers none.
- **Encryption export**: the app uses only standard HTTPS. Answer that it uses standard encryption and qualifies for the exemption.
- **Camera**: not used. The unused camera permission string was removed in build 10. **Calendar**: write-only, when the user adds an event.
- **Push notifications**: this build schedules only a local Sunday reminder. No APNs registration, so no push data is collected. Redo this page if server push is added.
