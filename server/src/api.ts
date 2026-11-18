import { CAPABILITIES } from "./capabilities";
import { AccessError, assertNever, assertNoCardData } from "./domain";
import { facebookLive, loadSermons } from "./adapters";
import {
  bookingBodySchema,
  codeBodySchema,
  giftBodySchema,
  healthSchema,
  integrationBodySchema,
  announcementBodySchema,
  claimBodySchema,
  inviteBodySchema,
  checkInBodySchema,
  householdPickupBodySchema,
  childBodySchema,
  eventBodySchema,
  groupBodySchema,
  loginBodySchema,
  moderateBodySchema,
  profileBodySchema,
  signupBodySchema,
  messageBodySchema,
  pickupBodySchema,
  prayerBodySchema,
  proposalBodySchema,
  pushBodySchema,
  roleChangeBodySchema,
  stepUpBodySchema,
} from "./contracts";
import { createLogger, noopReporter, type ErrorReporter, type Logger } from "./logger";
import type { ChurchStore } from "./store";
import { VERSION } from "./version";
import type { ZodType } from "zod";

export const API_ROUTES = [
  ["GET", "/api/health"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/signup"],
  ["POST", "/api/auth/claim"],
  ["POST", "/api/security/invites"],
  ["POST", "/api/auth/mfa"],
  ["POST", "/api/auth/step-up"],
  ["POST", "/api/auth/logout"],
  ["POST", "/api/auth/sample-staff"],
  ["GET", "/api/me"],
  ["POST", "/api/me"],
  ["POST", "/api/account/delete"],
  ["GET", "/api/home"],
  ["GET", "/api/sermons"],
  ["GET", "/api/events/{id}/ics"],
  ["GET", "/api/events/mine"],
  ["POST", "/api/events/{id}/register"],
  ["GET", "/api/directory"],
  ["GET", "/api/giving/funds"],
  ["POST", "/api/giving/gifts"],
  ["GET", "/api/giving/mine"],
  ["GET", "/api/giving/all"],
  ["GET", "/api/groups"],
  ["GET", "/api/groups/{id}/messages"],
  ["POST", "/api/groups/{id}/messages"],
  ["POST", "/api/groups/{id}/join"],
  ["POST", "/api/groups/{id}/leave"],
  ["GET", "/api/prayers"],
  ["POST", "/api/prayers"],
  ["POST", "/api/prayers/{id}/moderate"],
  ["GET", "/api/kids/mine"],
  ["GET", "/api/serving/mine"],
  ["GET", "/api/pathways/mine"],
  ["POST", "/api/kids/check-in"],
  ["POST", "/api/kids/household-pickup"],
  ["POST", "/api/household/children"],
  ["POST", "/api/announcements"],
  ["POST", "/api/events"],
  ["POST", "/api/groups"],
  ["GET", "/api/giving/quickbooks"],
  ["GET", "/api/audit"],
  ["GET", "/api/kids/{id}/label"],
  ["POST", "/api/kids/pickup"],
  ["POST", "/api/communications/push"],
  ["GET", "/api/modules"],
  ["GET", "/api/security/seats"],
  ["POST", "/api/security/roles"],
  ["POST", "/api/security/master-admin/proposals"],
  ["GET", "/api/capabilities"],
  ["GET", "/api/integrations"],
  ["POST", "/api/integrations/{provider}"],
  ["GET", "/api/ministry"],
  ["POST", "/api/facilities/bookings"],
] as const;

type Deps = {
  store: ChurchStore;
  fetchImpl?: typeof fetch;
  log?: Logger;
  reporter?: ErrorReporter;
};

export function createApi(deps: Deps) {
  const log = deps.log ?? createLogger(() => undefined);
  const reporter = deps.reporter ?? noopReporter;
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      assertMutation(request);
      const token = bearerOrCookie(request);
      const body = request.method === "GET" || request.method === "HEAD" ? {} : await readBody(request);
      if (request.method !== "GET" && request.method !== "HEAD") assertNoCardData(body);
      const icsPath = url.pathname.match(/^\/api\/events\/([^/]+)\/ics$/);
      if (request.method === "GET" && icsPath?.[1]) {
        const calendar = deps.store.ics(decodeURIComponent(icsPath[1]));
        return new Response(calendar, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${decodeURIComponent(icsPath[1])}.ics"`,
          },
        });
      }
      const result = await route(deps, token, request.method, url.pathname, body);
      log.log("info", "request", { method: request.method, path: url.pathname, status: 200 });
      return Response.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AccessError) {
        log.log("info", "request_denied", { method: request.method, path: url.pathname, code: error.code });
        return Response.json(
          { ok: false, error: friendlyError(error), code: error.code },
          { status: statusFor(error.code) },
        );
      }
      reporter.capture(error, { path: url.pathname, method: request.method });
      log.log("error", "request_failed", { method: request.method, path: url.pathname });
      return Response.json({ ok: false, error: "Something went wrong.", code: "error" }, { status: 500 });
    }
  };
}

async function route(
  deps: Deps,
  token: string | null,
  method: string,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const store = deps.store;
  const need = () => {
    if (!token) throw new AccessError("unauthenticated", "Sign in again.");
    return token;
  };
  if (method === "GET" && path === "/api/health") return parseOut(healthSchema, store.status(VERSION));
  if (method === "POST" && path === "/api/auth/login") {
    const input = parse(loginBodySchema, body);
    return store.login({ ...input, ip: "api", userAgent: "api" });
  }
  if (method === "POST" && path === "/api/auth/signup") {
    const input = parse(signupBodySchema, body);
    return store.signup({ ...input, ip: "api", userAgent: "api" });
  }
  if (method === "POST" && path === "/api/auth/claim") {
    const input = parse(claimBodySchema, body);
    return store.claimInvite({ ...input, ip: "api", userAgent: "api" });
  }
  if (method === "POST" && path === "/api/auth/mfa")
    return store.verifyMfa(need(), parse(codeBodySchema, body).code);
  if (method === "POST" && path === "/api/auth/step-up")
    return store.stepUp(need(), parse(stepUpBodySchema, body));
  if (method === "POST" && path === "/api/auth/logout") {
    store.logout(need());
    return {};
  }
  if (method === "POST" && path === "/api/auth/sample-staff")
    return store.loginSampleStaff({ ip: "api", userAgent: "sample-preview" });
  if (method === "GET" && path === "/api/me") return { person: store.me(need()) };
  if (method === "POST" && path === "/api/me") return { person: store.updateProfile(need(), parse(profileBodySchema, body)) };
  if (method === "POST" && path === "/api/account/delete") return store.deleteSelf(need());
  if (method === "GET" && path === "/api/home") return store.publicHome();
  if (method === "GET" && path === "/api/sermons") {
    const videos = await loadSermons(deps.fetchImpl ?? fetch, store.config.youtubeChannelId);
    return { videos, sample: videos.length === 0 };
  }
  const ics = path.match(/^\/api\/events\/([^/]+)\/ics$/);
  if (method === "GET" && ics?.[1]) return { ics: store.ics(decodeURIComponent(ics[1])) };
  const register = path.match(/^\/api\/events\/([^/]+)\/register$/);
  if (method === "POST" && register?.[1]) return store.register(need(), decodeURIComponent(register[1]));
  if (method === "GET" && path === "/api/directory") return { people: store.directory(need()) };
  if (method === "GET" && path === "/api/giving/funds")
    return { funds: store.funds(), ...store.givingAvailability() };
  if (method === "POST" && path === "/api/giving/gifts")
    return { gift: await store.createGift(need(), parse(giftBodySchema, body)) };
  if (method === "GET" && path === "/api/giving/mine") return { gifts: store.myGifts(need()) };
  if (method === "GET" && path === "/api/giving/all") return { gifts: store.allGifts(need()) };
  if (method === "GET" && path === "/api/groups") return { groups: store.listGroups(need()) };
  const messages = path.match(/^\/api\/groups\/([^/]+)\/messages$/);
  if (messages?.[1] && method === "GET")
    return { messages: store.listMessages(need(), decodeURIComponent(messages[1])) };
  if (messages?.[1] && method === "POST") {
    return {
      message: store.postMessage(
        need(),
        decodeURIComponent(messages[1]),
        parse(messageBodySchema, body).body,
      ),
    };
  }
  const join = path.match(/^\/api\/groups\/([^/]+)\/join$/);
  if (method === "POST" && join?.[1]) return store.joinGroup(need(), decodeURIComponent(join[1]));
  const leave = path.match(/^\/api\/groups\/([^/]+)\/leave$/);
  if (method === "POST" && leave?.[1]) return store.leaveGroup(need(), decodeURIComponent(leave[1]));
  if (method === "GET" && path === "/api/prayers") return { prayers: store.listPrayers(token) };
  if (method === "POST" && path === "/api/prayers")
    return store.submitPrayer(need(), parse(prayerBodySchema, body));
  const moderate = path.match(/^\/api\/prayers\/([^/]+)\/moderate$/);
  if (method === "POST" && moderate?.[1]) {
    return store.moderatePrayer(need(), decodeURIComponent(moderate[1]), parse(moderateBodySchema, body).approved);
  }
  if (method === "GET" && path === "/api/kids/mine") return { kids: store.myKids(need()) };
  if (method === "GET" && path === "/api/serving/mine") return { assignments: store.serving(need()) };
  if (method === "GET" && path === "/api/pathways/mine") return store.myPathway(need());
  if (method === "POST" && path === "/api/kids/check-in")
    return store.checkIn(need(), parse(checkInBodySchema, body).childId);
  if (method === "POST" && path === "/api/kids/household-pickup")
    return store.householdPickup(need(), parse(householdPickupBodySchema, body));
  if (method === "POST" && path === "/api/household/children")
    return { child: store.addChild(need(), parse(childBodySchema, body)) };
  if (method === "POST" && path === "/api/announcements")
    return { announcement: store.createAnnouncement(need(), parse(announcementBodySchema, body)) };
  if (method === "GET" && path === "/api/events/mine") return { events: store.listEvents(need()) };
  if (method === "POST" && path === "/api/events")
    return { event: store.createEvent(need(), parse(eventBodySchema, body)) };
  if (method === "POST" && path === "/api/groups" && method === "POST")
    return { group: store.createGroup(need(), parse(groupBodySchema, body)) };
  if (method === "GET" && path === "/api/giving/quickbooks") return { csv: store.quickbooksCsv(need()) };
  if (method === "GET" && path === "/api/audit") return { audit: store.audit(need()) };
  const label = path.match(/^\/api\/kids\/([^/]+)\/label$/);
  if (method === "GET" && label?.[1]) return store.label(need(), decodeURIComponent(label[1]));
  if (method === "POST" && path === "/api/kids/pickup")
    return store.pickup(need(), parse(pickupBodySchema, body));
  if (method === "POST" && path === "/api/communications/push")
    return store.sendPush(need(), parse(pushBodySchema, body));
  if (method === "GET" && path === "/api/modules") return { modules: store.modules() };
  if (method === "GET" && path === "/api/security/seats") return { seats: store.seatsFor(need()) };
  if (method === "POST" && path === "/api/security/invites") {
    return store.issueInvite(need(), parse(inviteBodySchema, body).email);
  }
  if (method === "POST" && path === "/api/security/roles")
    return { person: store.changeRole(need(), parse(roleChangeBodySchema, body)) };
  if (method === "POST" && path === "/api/security/master-admin/proposals") {
    return { proposal: store.proposeMasterAdmin(need(), parse(proposalBodySchema, body)) };
  }
  if (method === "GET" && path === "/api/capabilities") {
    return {
      capabilities: CAPABILITIES,
      facebook: facebookLive({ pageId: store.config.facebookPageId, token: store.config.facebookPageToken }),
    };
  }
  if (method === "GET" && path === "/api/integrations") return { integrations: store.integrations(need()) };
  const integration = path.match(/^\/api\/integrations\/([^/]+)$/);
  if (method === "POST" && integration?.[1]) {
    return store.setIntegration(
      need(),
      decodeURIComponent(integration[1]),
      parse(integrationBodySchema, body).secret,
    );
  }
  if (method === "GET" && path === "/api/ministry") return { ministry: store.ministry(need()) };
  if (method === "POST" && path === "/api/facilities/bookings")
    return { booking: store.book(need(), parse(bookingBodySchema, body)) };
  throw new AccessError("not_found", "That route isn't part of this API.");
}

function friendlyError(error: AccessError): string {
  if (error.message.includes("contract") || error.message.includes("shape")) {
    return "Please check what you entered and try again.";
  }
  return error.message;
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AccessError("invalid", "Please check what you entered and try again.");
  return result.data;
}

function parseOut<T extends Record<string, unknown>>(schema: ZodType<T>, value: T): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Response failed validation.");
  return result.data;
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccessError("invalid", "The request body wasn't JSON.");
  }
}

function bearerOrCookie(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)onehope_(?:session|member)=([^;]+)/.exec(cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function assertMutation(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  if ((request.headers.get("authorization") ?? "").startsWith("Bearer ")) return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AccessError("forbidden", "The request origin wasn't valid.");
  }
  if (originHost !== host) throw new AccessError("forbidden", "Cross-site changes are refused.");
}

function statusFor(code: AccessError["code"]): number {
  switch (code) {
    case "unauthenticated":
    case "mfa_required":
    case "step_up_required":
    case "session_expired":
      return 401;
    case "forbidden":
    case "sends_disabled":
      return 403;
    case "not_found":
      return 404;
    case "invalid":
      return 400;
    case "seat_empty":
    case "two_person":
      return 409;
    default:
      return assertNever(code);
  }
}
