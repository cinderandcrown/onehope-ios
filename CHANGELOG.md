# Changelog

## Hotfix - 2026-11-18

### Fixed

- iOS Watch: videos showed YouTube "Error 153, video player configuration error". The player loaded the embed URL directly, so YouTube got no HTTP Referer, the API client identity it now requires. The player page now loads with `loadHTMLString(_:baseURL:)` under `https://com.cinderandcrown.onehope` (the bundle id, as Google's Required Minimum Functionality rules specify), uses the IFrame Player API with `playsinline`, `origin` and `widget_referrer`, and reports player errors back to the app.
- If YouTube still refuses a video, the player is covered with "Play on YouTube", which opens the YouTube app or Safari. The same button sits under every video.
- Web Watch: the embed sets `referrerpolicy="strict-origin-when-cross-origin"` explicitly and has a "Play on YouTube" link.

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
