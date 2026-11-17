# Security

One Hope is one church. There is no `tenant_id` and no white-label build. The privacy boundary is the member and their household.

## Data classes

| Tier | Examples                                                                              | Who can read                                                                              |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0    | Sermons, public events, approved public prayers, announcements                        | Anyone                                                                                    |
| 1    | Own profile, group membership, directory                                              | Signed-in members. Directory fields are opt-in.                                           |
| 2    | Rosters, attendance, serving schedules, room bookings                                 | The matching staff role, after MFA                                                        |
| 3    | Giving, kids medical / allergy / guardian / custody, pastoral care, background checks | The household or the role that owns that domain, after MFA (if staff) and a fresh step-up |

Step-up lasts five minutes. Staff sessions idle out after 15 minutes. Member sessions idle out after 12 hours. A new IP or user agent records an alert on the next sign-in. The alert is stored. It is not emailed or texted.

## Roles

Master Admin sits above the others. The seeded seats are:

1. Nicholas Will, `nicholas.will@cinderandcrown.com`, from `MASTER_ADMIN_PRIMARY_EMAIL`. No password is stored.
2. Lead Pastor. `MASTER_ADMIN_SECONDARY_EMAIL` is empty until Nicholas sets it.

While only one seat is filled, in-app Master Admin changes are rejected. When both are seated, a revoke runs only after both current Master Admins approve, and the audit log records the proposal and the result. Granting a third Master Admin is rejected. Filling an empty seat is an environment change on the next boot, not a single-person click.

Other roles: pastor, care team, finance, kids director, team leader, volunteer, member. The matrix is `permissionMatrix()` and the Security page. Pastors cannot grant finance, care, or kids-director access and cannot read or write integration secrets. Promoting someone into a staff role clears MFA on their open sessions.

Master Admins do not bypass Tier 3. They need MFA and step-up, and the read is audited.

## Kids check-in

Pickup is allowed only when all of these are true:

- Two staff members are clocked into the station.
- The adult is on the child's guardian list.
- That adult is not on the custody restriction list.
- The four-digit code matches.

The code and medical notes are encrypted. The roster endpoint returns names and classrooms only.

## Giving

Card data is rejected if a client sends it. Stripe is the only processor, and only after the three live flags in the README. A PaymentIntent, when created, is built on the server from amount and fund. `charged` stays false until a confirmation path exists; that confirmation webhook is not built. Demo mode never sets `charged` to true.

## Encryption and audit

Tier 3 payloads use AES-256-GCM. The key is `FIELD_ENCRYPTION_KEY` (32 bytes, base64). Without it, demo mode derives a key with scrypt and reports `fieldEncryption: "demo"`. Production refuses to boot without the key, and refuses to boot the in-memory store at all.

The audit log is append-only in the API (no update method) and in SQL (`REVOKE UPDATE, DELETE` on `audit_log`, no update policy). Postgres cannot fire a trigger on `SELECT`, so Tier 3 **reads** are logged by the API. Writes are logged by the API and by the gift trigger. Audit rows do not contain the decrypted body.

## Member rights

A member can export their profile and, after step-up, their household gifts, kids notes, and care notes about them. The export does not include another household. Deleting a sole household member removes that household's gifts and kids. Deleting one person in a shared household removes their login and private prayers and leaves the household gifts for the other member.

Retention years (audit, giving, care, kids) default to 7 and live in `retention_settings`. A function reports whether a timestamp is past retention. There is no scheduled purge job yet.

## Threat model

| Threat                                        | What we do                                                          | Gap                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Member A reads member B's giving or care note | API filter and Postgres RLS, both tested                            | A database superuser bypasses RLS. The app role does not.                              |
| Stolen staff session used to browse giving    | MFA, 15-minute idle timeout, step-up                                | No device binding. Passkeys are not built.                                             |
| Staff reads Tier 3 without a trace            | API writes an audit row per record, including Master Admins         | Direct SQL `SELECT` is not audited. App credentials cannot `SELECT` another household. |
| Card number stored on our server              | Request rejected; Stripe holds cards                                | Live charge confirmation is not built.                                                 |
| Secret leaked to the browser                  | Secrets encrypted at rest; API returns last 4 to Master Admins only | Demo encryption key is derived, not a KMS key.                                         |
| Cross-site form posts the staff cookie        | Cookie mutations require a same-origin `Origin`                     | Bearer tokens are for the app and skip that check.                                     |
| Sample login left on in production            | `loginSampleStaff` throws when `ONEHOPE_ENV=production`             | Sample users still exist only in the demo store, which production refuses to boot.     |
| Audit log edited                              | No update API; SQL revoke                                           | A superuser can still edit.                                                            |

## Tests that prove the boundary

`server/test/access.test.ts` drives the API store as two households and the staff roles. `server/test/rls.test.ts` applies `server/migrations` to PGlite, `SET ROLE app_user`, and asserts member C cannot see household A's gifts or kids, finance without step-up sees no gifts, a shared care note is visible only to the shared person, directory email is masked, and `UPDATE audit_log` fails.

pgTAP is not used. PGlite does not ship the extension. The SQL policies are executed; they are not a document that nothing runs.
