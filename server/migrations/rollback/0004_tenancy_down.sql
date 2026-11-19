-- Manual rollback for 0004_tenancy.sql. migrate() does not run this file.
-- Redeploy the previous release first if you still need demo_runtime.
-- This drops tenant tables. It does not delete demo_runtime or demo_runtime_backup.

DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
DROP FUNCTION IF EXISTS reject_audit_mutation();

DROP TABLE IF EXISTS tenant_runtime, pickup_settings, operator_grants, exports, webhook_inbox,
  outbox_jobs, locations, tenant_links, tenant_integrations, tenant_themes, tenant_modules,
  social_links, coffee_orders, outreach_rsvps, outreach_events, milestones, testimonies,
  my_five, prayer_amens, rate_limits, streaks, follow_ups, member_invites, message_drafts,
  care_requests, visitors, pathways, expenses, bookings, rooms, volunteers, schedule_assignments,
  announcements, registrations, events, group_messages, groups, station_duty, proposals, alerts,
  sessions, memberships, mfa_factors, accounts, tenant_domains, snapshot_imports, tenants CASCADE;

-- Columns added to the original tables are left in place so a half-applied rollback
-- does not destroy ciphertext. Drop them in a follow-up only after a backup.
