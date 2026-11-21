# Architecture

```mermaid
flowchart LR
  subgraph clients
    Phone[iOS app]
    Web[Staff Command Center]
    Member[Member page]
  end
  subgraph server [server package]
    API[HTTP API]
    Rules[authorize]
    Store[Church store]
    SQL[Postgres migrations]
  end
  Phone -->|HTTP when a base URL is set| API
  Web --> Store
  Member --> Store
  API --> Rules
  Rules --> Store
  Store -->|snapshot when DATABASE_URL is set| SQL
  SQL -.->|RLS tested in PGlite| Rules
```

The Command Center, the member page, and the HTTP API share `ChurchStore`. With `DATABASE_URL` or `POSTGRES_URL`, each request loads that tenant's rows and writes only the rows that changed. Without a database URL, the process keeps one in-memory copy, which is what CI uses. The iPhone app calls the API when `-apiBaseURL` or `API_BASE_URL` is set. It does not send a tenant id. The server reads the host. Offline reads can use the last saved response. Pickup and giving do not.

## iOS modules

`ios/Packages/OneHopeKit` is one Swift package with a product per tab plus Core and Design. Tabs do not import each other. The app target composes them. Core has no SwiftUI. Design has color, type, photos, and haptics.

View state is a small `@State` or `@Observable` model. Intents are button actions. We did not add The Composable Architecture; see the ADR.

Strict concurrency is on for the app target (`SWIFT_STRICT_CONCURRENCY = complete`) and warnings are errors. There are no force-unwraps in the Swift sources.

## Web

Next.js App Router, server components, server actions. Request bodies that hit the HTTP API are parsed with Zod. The Command Center calls the store in process, which is the same object the API uses. No `any`.

## Data

`server/migrations/0001_init.sql` is the original RLS schema. `0004_tenancy.sql` adds `tenant_id`, accounts, memberships, the outbox, and the tables the app reads. `migrate()` records versions and does not reapply them. The down script in `server/migrations/rollback/` is manual. `server/scripts/generate-table-types.mjs --check` fails if `server/src/generated/tables.ts` drifts.

`outbox_jobs` is the durable retry queue. The in-memory sync helper remains for tests that do not open a database. See `docs/runbooks/phase-1-migration.md`.

## Performance

Targets, not device-lab measurements: Command Center first view under a second on a warm server, iOS cold launch to the first tab under two seconds on a recent iPhone, lists virtualized by SwiftUI and by HTML tables that stay on one screen of sample rows. There is no benchmark harness in CI.
