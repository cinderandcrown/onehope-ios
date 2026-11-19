// Generated from server/migrations by server/scripts/generate-table-types.mjs. Do not edit.

export const tableNames = ["households","people","gifts","kids","care_notes","care_note_shares","prayers","background_checks","audit_log","retention_settings","sync_cursors","demo_runtime","tenants","tenant_domains","accounts","mfa_factors","snapshot_imports","demo_runtime_backup","memberships","sessions","alerts","proposals","station_duty","groups","group_messages","events","registrations","announcements","schedule_assignments","volunteers","rooms","bookings","expenses","pathways","visitors","care_requests","message_drafts","member_invites","follow_ups","streaks","rate_limits","prayer_amens","my_five","testimonies","milestones","outreach_events","outreach_rsvps","coffee_orders","social_links","tenant_modules","tenant_themes","tenant_integrations","tenant_links","locations","outbox_jobs","webhook_inbox","exports","operator_grants","pickup_settings","tenant_runtime","tenant_passwords"] as const;

export type TableName = (typeof tableNames)[number];

export type HouseholdsRow = {
  id: string;
  name: string;
};

export type PeopleRow = {
  id: string;
  household_id: string;
  role: string;
  display_name: string;
  email: string;
  email_public: boolean;
  phone: string;
  phone_public: boolean;
};

export type GiftsRow = {
  id: string;
  household_id: string;
  person_id: string;
  amount_ciphertext: string;
  sample: boolean;
};

export type KidsRow = {
  id: string;
  household_id: string;
  display_name: string;
  medical_ciphertext: string;
  restricted: boolean;
};

export type CareNotesRow = {
  id: string;
  subject_person_id: string;
  body_ciphertext: string;
};

export type CareNoteSharesRow = {
  note_id: string;
  person_id: string;
};

export type PrayersRow = {
  id: string;
  author_id: string;
  body: string;
  visibility: string;
  approved: boolean;
};

export type BackgroundChecksRow = {
  id: string;
  person_id: string;
  status: string;
  notes_ciphertext: string;
};

export type AuditLogRow = {
  id: string;
  at: string;
  actor_id: string;
  action: string;
  resource: string;
  resource_id: string;
  tier: number;
};

export type RetentionSettingsRow = {
  domain: string;
  years: number;
};

export type SyncCursorsRow = {
  idempotency_key: string;
  job_name: string;
  status: string;
  attempts: number;
  updated_at: string;
};

export type DemoRuntimeRow = {
  id: string;
  payload: string;
  updated_at: string;
};

export type TenantsRow = {
  id: string;
  name: string;
  kind: string;
  timezone: string;
  created_at: string;
};

export type TenantDomainsRow = {
  host: string;
  tenant_id: string;
};

export type AccountsRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type MfaFactorsRow = {
  id: string;
  account_id: string;
  kind: string;
  secret_ciphertext: string;
  created_at: string;
};

export type SnapshotImportsRow = {
  id: string;
  status: string;
  source_checksum: string;
  row_counts: string;
  imported_at: string;
};

export type DemoRuntimeBackupRow = {
  id: string;
  payload: string;
  backed_up_at: string;
};

export type MembershipsRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  person_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SessionsRow = {
  token: string;
  tenant_id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type AlertsRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type ProposalsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type StationDutyRow = {
  tenant_id: string;
  person_id: string;
  created_at: string;
};

export type GroupsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type GroupMessagesRow = {
  tenant_id: string;
  id: string;
  group_id: string;
  author_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type EventsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type RegistrationsRow = {
  tenant_id: string;
  id: string;
  event_id: string;
  person_id: string;
  status: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type AnnouncementsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type ScheduleAssignmentsRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type VolunteersRow = {
  tenant_id: string;
  person_id: string;
  record: string;
  updated_at: string;
};

export type RoomsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type BookingsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type ExpensesRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type PathwaysRow = {
  tenant_id: string;
  person_id: string;
  record: string;
  updated_at: string;
};

export type VisitorsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type CareRequestsRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type MessageDraftsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type MemberInvitesRow = {
  tenant_id: string;
  token_hash: string;
  email: string;
  expires_ms: string;
  record: string;
};

export type FollowUpsRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type StreaksRow = {
  tenant_id: string;
  person_id: string;
  record: string;
  updated_at: string;
};

export type RateLimitsRow = {
  tenant_id: string;
  bucket_key: string;
  record: string;
  updated_at: string;
};

export type PrayerAmensRow = {
  tenant_id: string;
  prayer_id: string;
  person_id: string;
};

export type MyFiveRow = {
  tenant_id: string;
  person_id: string;
  record: string;
  updated_at: string;
};

export type TestimoniesRow = {
  tenant_id: string;
  id: string;
  author_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type MilestonesRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type OutreachEventsRow = {
  tenant_id: string;
  id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type OutreachRsvpsRow = {
  tenant_id: string;
  id: string;
  outreach_id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type CoffeeOrdersRow = {
  tenant_id: string;
  id: string;
  person_id: string;
  record: string;
  created_at: string;
  updated_at: string;
};

export type SocialLinksRow = {
  tenant_id: string;
  id: string;
  record: string;
  updated_at: string;
};

export type TenantModulesRow = {
  tenant_id: string;
  module_id: string;
  enabled: boolean;
};

export type TenantThemesRow = {
  tenant_id: string;
  tokens: string;
};

export type TenantIntegrationsRow = {
  tenant_id: string;
  provider: string;
  mode: string;
  credentials_ciphertext: string;
  key_id: string;
  last4: string;
  scopes: string;
  connected_by: string;
  connected_at: string;
  revoked_at: string;
};

export type TenantLinksRow = {
  tenant_id: string;
  from_tenant: string;
  to_tenant: string;
  kind: string;
  show_in_app: boolean;
};

export type LocationsRow = {
  tenant_id: string;
  id: string;
  name: string;
  timezone: string;
};

export type OutboxJobsRow = {
  id: string;
  tenant_id: string;
  job_name: string;
  idempotency_key: string;
  payload: string;
  status: string;
  attempts: number;
  available_at: string;
  last_error: string;
  created_at: string;
  updated_at: string;
};

export type WebhookInboxRow = {
  id: string;
  tenant_id: string;
  provider: string;
  event_id: string;
  payload: string;
  received_at: string;
};

export type ExportsRow = {
  id: string;
  tenant_id: string;
  schema_version: string;
  row_counts: string;
  created_at: string;
};

export type OperatorGrantsRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  approved_by: string;
  tier3: boolean;
  expires_at: string;
  created_at: string;
};

export type PickupSettingsRow = {
  tenant_id: string;
  pickup_only: boolean;
  delivery_enabled: boolean;
  timezone: string;
};

export type TenantRuntimeRow = {
  tenant_id: string;
  seeded_at: string;
};

export type TenantPasswordsRow = {
  tenant_id: string;
  person_id: string;
  password_hash: string;
};
