# One church, household privacy

Superseded by [0007](0007-tenant-aware-platform.md). Household privacy below still applies inside a tenant. The "no tenant_id" decision does not.

One Hope was the only church in this codebase. A later message asked for multi-church tenancy and then withdrew it. ADR 0007 reverses that withdrawal: One Hope is tenant `onehope`, and household policies remain the second layer under `app.tenant_id`.

The row owner is the member and their household. Postgres policies and the API both enforce that. A second campus, such as the Oak Cliff outreach center named on the public site, is a location on this church, not another tenant.
