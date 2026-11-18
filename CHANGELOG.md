# Changelog

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
