import { allows, type Role } from "@onehope/server";

import type { SectionId } from "./i18n";

/** Home cards, events, and push throw for roles that cannot publish. Hide those links. */
export function canOpenSection(role: Role, section: SectionId): boolean {
  if (section === "communications" || section === "push") {
    return allows(role, "compose_communications") || role === "team_leader";
  }
  if (section === "tasks") return allows(role, "work_care_tasks");
  if (section === "playbooks") return allows(role, "manage_playbooks");
  if (section === "import") return allows(role, "import_people");
  if (section === "duplicates") return allows(role, "merge_people");
  if (section === "events") return allows(role, "manage_events") || role === "team_leader";
  return true;
}
