/**
 * Tables a route reads or writes. Null means every table, which is the safe
 * default for routes that were not listed. An empty list reads nothing.
 */
export function tablesFor(method: string, path: string): readonly string[] | null {
  if (method === "GET" && EMPTY_GET.has(path)) return [];
  if (method === "GET" && path === "/api/home") return ["announcements", "events", "social_links"];
  if (method === "GET" && path === "/api/social") return ["social_links"];
  if (method === "GET" && path === "/api/growth") return ["groups"];
  if (method === "GET" && path === "/api/modules") return ["tenant_modules"];
  if (method === "GET" && path === "/api/groups") return ["groups", "people", "sessions"];
  if (method === "GET" && path === "/api/prayers") return ["prayers", "prayer_amens", "people", "sessions"];
  if (method === "GET" && path === "/api/daily-word") return ["streaks", "people", "sessions"];
  if (method === "GET" && path === "/api/me") return ["people", "sessions"];
  if (method === "GET" && path === "/api/directory") return ["people", "sessions"];
  if (method === "GET" && path === "/api/kids/mine") return ["kids", "people", "sessions"];
  if (method === "GET" && path === "/api/serving/mine") return ["schedule_assignments", "people", "sessions"];
  if (method === "GET" && path === "/api/pathways/mine") return ["pathways", "people", "sessions"];
  if (method === "GET" && path === "/api/events/mine") return ["events", "registrations", "people", "sessions"];
  if (method === "GET" && (path === "/api/giving/mine" || path === "/api/giving/all")) {
    return ["gifts", "people", "sessions"];
  }
  if (method === "GET" && /^\/api\/events\/[^/]+\/ics$/.test(path)) return ["events"];
  return null;
}

const EMPTY_GET = new Set([
  "/api/health",
  "/api/tenant",
  "/api/sermons",
  "/api/know-jesus",
  "/api/giving/funds",
  "/api/coffee",
  "/api/coffee/catalog",
  "/api/capabilities",
]);
