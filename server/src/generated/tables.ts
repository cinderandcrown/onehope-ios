// Generated from server/migrations by server/scripts/generate-table-types.mjs. Do not edit.

export const tableNames = ["households","people","gifts","kids","care_notes","care_note_shares","prayers","background_checks","audit_log","retention_settings","sync_cursors"] as const;

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
