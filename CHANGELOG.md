# Changelog

## Build 10 - 2026-11-20

### Added

- The church's own photos, from its public websites, replace the colored placeholders on Home, Plan a Visit, Revival Coffee, About, and Watch. Photos, the team, ministry cards, and the Revival gallery arrive at runtime from tenant config (`ONEHOPE_MEDIA_JSON`). None are stored in git, and a missing photo falls back to the brand colors.
- Home is warmer: a hero photo, quick shortcuts, a Revival Coffee feature, the latest messages with sharp thumbnails, ministries, and a team teaser.
- Revival Coffee is first in More and on Home, with its menu, hours, gallery, and directions.
- Our Team screen, a redesigned More menu with icons and one-line descriptions, and friendlier empty states.
- Images are cached in memory and on disk, warmed after the church loads, and fade in.

- Accessibility: text and icon colors reach 4.5:1 (a darker orange for anything readable, dark-mode safe), 44 pt tap targets, Dynamic Type layouts that reflow instead of clipping, Reduce Motion respected, labeled photos and silent decorative ones, visible form labels, VoiceOver announcements for form results, YouTube captions on by default, and an automated accessibility audit in UI tests.
- Legal drafts in More: Privacy Policy and Terms of Use (marked DRAFT pending church and attorney review, also reachable from signup), and an About & Credits screen with photo credits and open-source licenses. `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md` added. Giving statements say no goods or services were provided. App Store privacy answers are in `docs/app-store-privacy.md`.

### Changed

- Smoother tab changes, a haptic tap, and filled icons for the selected tab.
- Public GET endpoints send cache headers and ETags; sermons and the directory accept paging; the sermon feed keeps a short cache and serves stale if YouTube is slow; the app loads its sections at the same time.

## Build 8 - 2026-11-19

### Added

- Today on Home: a greeting, the Daily Word, a prayer moment, this Sunday, Revival Coffee, and Follow along.
- Follow along uses only the three links printed on weareonehope.com: Instagram, Facebook, and YouTube. Staff can edit them on the desk. Tapping one opens the phone's app when it is installed.
- Revival Coffee: the menu, hours, and address from myrevivalcoffee.com. Weekend hours stay TBD. There is no phone number on their site, so the app offers directions and email. Order ahead stays off until `COFFEE_ORDERING_LIVE` and Square are set. Card numbers never come to our server.
- A 30-day journey of KJV verses after someone says yes to Jesus, and a public invite page a neighbor can open.
- A staff desk with plain cards: kids here today, people to talk with, prayers to share, help needed Sunday, what's coming up, and giving. Giving stays hidden until the person confirms it's them, and nothing is charged.
- The app is ready for `app.weareonehope.com`. See DOMAIN_SETUP.md. Nothing was changed at the DNS host or in Vercel.
- DESIGN.md records the website's colors and type.

### Changed

- The look follows the church website more closely: olive, terracotta, sky, and dove, with ink edges and the church's own photos.
- The button that used to say "I decided to follow Jesus" now says "I said yes to Jesus."

## Build 7 - 2026-11-18

### Added

- Support and assistance: the church's Support/Assistance Request with its six boxes (pastoral counseling, pre-marital counseling, hospital visitation, One Hope recovery group, volunteering, clothing). Guests and members send it to the staff care queue; the boxes are encrypted with the contact. `POST /api/support` is rate limited and needs consent, and a guest must leave an email or phone.
- Toolkit for Spiritual Growth from the church's Church Center page: Bible reading plan, scriptures to speak (KJV), Daily Proclamations, staff reads, podcast picks, and the Spotify playlist. `GET /api/growth` (public).
- Hope City Recovery / Unlocking Freedom: the group with request-to-join on Church Center, and the Life Evaluation Worksheet (ten areas rated 1 to 10) with its printable PDF. Ratings stay on the device.
- In-app giving form with the Church Center frequencies (Once, Weekly, Every other week, Twice monthly, Monthly). It asks for the password and stays behind `GIVING_LIVE`.
- Kids check-in shows who is checked in. A family picks up with the code from check-in.

### Changed

- Giving funds are "One Hope Church" and "Christmas Giving Tree". The placeholder funds (Outreach, Kids, Benevolence) are no longer offered; gifts already recorded against them keep their names.
- Check-in codes come from a cryptographic random source. A code works for one pickup, and pickup locks for an hour after five wrong tries.

## Build 6 - 2026-11-18

### Added

- Guests can use Home, Watch, Know Jesus, Plan a Visit, and Give on the phone and at `/member` without an account. Connect lists groups and events for everyone and asks for sign-in to join, send a prayer request, or check in kids.
- Know Jesus: the gospel in five KJV passages, a prayer, and next-step buttons (follow Jesus, baptism, new, Growth Track) that land in the staff care queue. A decision opens a 7-day new-believer journey.
- `POST /api/follow-ups` (guest or member, rate limited, contact details only with consent), `GET /api/care/follow-ups`, `POST /api/care/follow-ups/{id}`, `GET /api/know-jesus`, `GET /api/daily-word`, `POST /api/daily-word/read`.
- Daily Word with a streak, kept on the phone for guests and synced for members.
- New accounts start on the default next-steps pathway.
- Plan a Visit from weareonehope.com, with an "I'm coming" heads-up for the welcome team, and a shareable Sunday invite.
- Watch shows thumbnails and dates, keeps Shorts apart from messages, and shares each video. Home features the latest message.
- Give lists Church Center online giving, text 84321, mail, and the Christmas Giving Tree until Christmas. The in-app card form stays behind `GIVING_LIVE`.
- The church's 13 open Church Center groups and its two open registrations replace the placeholder groups. Request-to-join groups and Church Center events link out instead of signing people up in the app.
- Prayer requests ask Church Center's questions. "Please contact me" adds a care-queue row for the pastors.

### Changed

- Snapshots saved by earlier builds load unchanged. On load the placeholder groups (`group-kids`, `group-small`, `group-growth`) and their notes are removed, real groups are upserted by id with memberships kept, and the Sunday event moves to the next Sunday once it has passed.

### Fixed (TestFlight build 6 hotfix)

- iOS Watch: videos showed YouTube "Error 153, video player configuration error". The player loaded the embed URL directly, so YouTube got no HTTP Referer, the API client identity it now requires. The player page now loads with `loadHTMLString(_:baseURL:)` under `https://com.cinderandcrown.onehope` (the bundle id, as Google's Required Minimum Functionality rules specify), uses the IFrame Player API with `playsinline`, `origin` and `widget_referrer`, and reports player errors back to the app.
- If YouTube still refuses a video, the player is covered with "Play on YouTube", which opens the YouTube app or Safari. The same button sits under every video.
- Web Watch: the embed sets `referrerpolicy="strict-origin-when-cross-origin"` explicitly and has a "Play on YouTube" link.

## 1.0.0 - 2026-11-17

### Added

- SwiftUI member app with Home, Watch, Give, Connect, and More, plus the ministry modules those tabs carry.
- Staff Command Center for people, care, gatherings, giving, stewardship, and the role matrix.
- Shared server with household access rules, Tier 3 encryption, Master Admin two-person revoke, and demo integrations that do not charge or send.
- Postgres migrations and RLS tests.
- GitHub Actions for iOS, the web app, and a manual TestFlight upload.
- The iPhone tabs load from the shared API when a base URL is set, and keep a labeled sample if it is not.
- Connect shows the signed-in household's classrooms, next steps, and serving assignments. Medical notes, allergy text, and security codes stay off that response.
- The staff site, `/member` (installable on a phone home screen), and `/api` share one store. With `DATABASE_URL` or `POSTGRES_URL` that store is a Postgres snapshot seeded with labeled demo rows. See `docs/deploy.md`.
- Release builds of the iPhone app read the live API from `ios/Config/Release.xcconfig`. `codemagic.yaml` workflow `ios-testflight` archives that build for TestFlight. The App Store Connect key stays in the Codemagic integration.
