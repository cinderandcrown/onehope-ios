# One Hope

Member app and staff tools for One Hope Church, built by Cinder & Crown. This replaces the Church Center app for members. It does not replace the public website at [weareonehope.com](https://www.weareonehope.com).

One church. One login. One data set. The iPhone app and the Staff Command Center both talk to `@onehope/server`.

## Layout

| Path                     | What it is                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `ios/`                   | SwiftUI app, iOS 17+, XcodeGen. Bundle `com.cinderandcrown.onehope`, team `GDNRT9DJ58`. |
| `web/`                   | Next.js Staff Command Center.                                                           |
| `server/`                | Shared domain, access rules, demo store, SQL migrations.                                |
| `contracts/openapi.json` | HTTP contract. A test fails if a route is missing from it.                              |

## Church facts used here

From the public site only: One Hope, 1251 S. Sherman St., Ste. 112, Richardson, TX 75081. Lead pastors Derek and Jen Miller. Sundays 10:30 a.m., with coffee at 10:00 a.m. YouTube `@Weareonehope`. Facebook and Instagram `iamonehope`. Colors are the site's olive `#3F4903` and terracotta `#DF8052`. Logo and photographs are the site's own files.

Invented records are labeled **Sample**. Public facts are not.

## Run the Command Center

```bash
npm ci
npm test
npm run build
npm run start -w web
```

Open `/login` and use **Preview as sample pastor**. The sample password for fictional staff is `hope-sample`. The sample TOTP secret is `JBSWY3DPEHPK3PXP`. Both are refused by the sample shortcut when `ONEHOPE_ENV=production`. Nicholas Will's Master Admin seat has no password in this repo.

## iOS

```bash
cd ios
brew install xcodegen swiftlint swiftformat
xcodegen generate
open OneHope.xcodeproj
```

Tabs: Home, Watch, Give, Connect, More. Feature code is local Swift packages under `ios/Packages/OneHopeKit` (Core, Design, and one package per tab). State is a small MVVM / unidirectional model: views send intents, models hold state. See `docs/adr/0003-mvvm-not-tca.md`.

## Apple guideline 3.2.1(vi)

Approved nonprofits may collect donations with Apple Pay in their own free app. Donations are not In-App Purchases. One Hope's Candid Seal is the transparency credential for Apple's nonprofit enrollment. **Apple Pay nonprofit approval is pending.**

Until `STRIPE_SECRET_KEY`, `GIVING_LIVE=true`, and `APPLE_PAY_NONPROFIT_APPROVED=true` are all set, the server will not create a Stripe PaymentIntent. The phone never accepts a card number. Demo gifts are stored with `charged: false`.

## Capability matrix

Live calls stay off until that provider's env vars are set. "Enforced demo" means the product path exists and tests prove it does not perform the live side effect. "Scaffolded" means the adapter or note is there and is not called.

| Provider                                   | Read                       | Write                        | Status                          |
| ------------------------------------------ | -------------------------- | ---------------------------- | ------------------------------- |
| Planning Center People                     | yes                        | yes                          | scaffolded                      |
| Planning Center Groups                     | yes (memberships writable) | memberships                  | scaffolded                      |
| Planning Center Calendar                   | yes                        | no in this build             | scaffolded                      |
| Planning Center Registrations              | yes                        | no in this build             | scaffolded                      |
| Planning Center Check-Ins                  | yes                        | no; check-in is native       | scaffolded                      |
| Planning Center Services                   | yes                        | plan-person status when live | scaffolded                      |
| Planning Center Giving                     | yes                        | no card charges              | scaffolded                      |
| Planning Center Publishing / Church Center | no                         | no                           | not used                        |
| Stripe PaymentIntents                      | yes                        | yes, gated                   | enforced demo                   |
| YouTube public RSS                         | yes                        | no                           | enforced, no API key            |
| Facebook Live                              | placeholder                | no                           | scaffolded until a Page token   |
| Instagram                                  | no until a token           | no                           | scaffolded                      |
| Resend, Twilio, APNs                       | —                          | adapters present             | enforced: composers do not send |
| ICS / Maps                                 | yes                        | no Google write              | enforced                        |
| API.Bible                                  | public-domain KJV fallback | no                           | enforced demo                   |
| QuickBooks                                 | Sample CSV                 | no OAuth post                | enforced demo                   |
| PostHog                                    | no                         | no-op until a key            | scaffolded                      |

Planning Center scopes are the public OAuth list (`people`, `groups`, `calendar`, `registrations`, `check_ins`, `services`, `giving`). Group definitions, Calendar events, Registrations signups, and Check-Ins records are treated as read-only here. People records and group memberships are the writes we would turn on after credentials exist.

## Security

See [SECURITY.md](SECURITY.md). Short version: members see their own household. Tier 3 (giving, kids medical and custody, care notes, background checks) is encrypted, requires step-up, and every read is audited. Master Admin is Nicholas Will plus an empty Lead Pastor seat. Changing that role takes both seated Master Admins.

## TestFlight secrets

Repository secrets, none of which are committed:

| Secret              | What it is                           |
| ------------------- | ------------------------------------ |
| `ASC_KEY_ID`        | App Store Connect API key id         |
| `ASC_ISSUER_ID`     | App Store Connect issuer id          |
| `ASC_KEY_P8_BASE64` | Base64 of the `AuthKey_XXXX.p8` file |

Run the manual **TestFlight** workflow. It decodes the key in the runner temp directory, archives with automatic signing (`-allowProvisioningUpdates`), uploads, and deletes the key. The team id `GDNRT9DJ58` is in the Xcode project, not a secret.

## What is enforced and tested

- Household isolation for gifts, kids, private prayers, and care notes, in the API and in Postgres RLS (PGlite, non-owner role).
- Directory opt-in per field, including a SQL view that masks email.
- Step-up before Tier 3 plaintext. MFA before staff routes. Session timeout. New-IP alert.
- Master Admin two-person revoke, and the block while the Lead Pastor seat is empty.
- Demo giving never charges. Card numbers are rejected. Push and campaign sends stay off.
- Kids pickup: two adults, authorized guardian, matching code, custody flag.
- Field encryption round trip. Integration secrets are not returned to the client.
- Idempotent sync retry. Versioned migrations apply once.

## What is scaffolded

- A provisioned Postgres database. The SQL is in `server/migrations` and is executed in CI with PGlite. Production refuses the in-memory store (`ONEHOPE_ENV=production`) and there is no hosted database in this repo yet.
- Live Planning Center, Stripe, Resend, Twilio, APNs, QuickBooks, PostHog, and Facebook. Adapters or notes exist; the side effect is not performed.
- Passkeys. Staff MFA is TOTP. WebAuthn is not implemented.
- Pixel snapshot baselines for iOS. UI tests assert the five tabs and attach screenshots; they do not compare against stored images.
- Swift Package feature modules are real. The member app does not yet call the HTTP API; offline sample data is what the tabs show. The server is the authority when a client uses it. The Command Center does.
- String Catalog export. English and Spanish chrome strings are a typed table (`L10n` on iOS, `web/lib/i18n.ts` on the web).
- Branch protection. Required checks are described in CONTRIBUTING.md. This agent cannot turn the rule on.
- Making the GitHub repo public. This session's GitHub access cannot change repository visibility.

## Modules

Feature flags default on for this one church: discipleship, serving, worship, kids, communications, facilities, finance, missions, admin, media, groups, events, giving, check-in, prayer. A Master Admin can turn a module off. The sample preview signs in as a pastor, who cannot.
