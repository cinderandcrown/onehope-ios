import { CAPABILITIES } from "./capabilities";
import { AccessError, assertNever, assertNoCardData } from "./domain";
import { facebookLive, loadSermons } from "./adapters";
import {
  bookingBodySchema,
  codeBodySchema,
  giftBodySchema,
  healthSchema,
  integrationBodySchema,
  loginBodySchema,
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
  ["POST", "/api/auth/mfa"],
  ["POST", "/api/auth/step-up"],
  ["POST", "/api/auth/logout"],
  ["POST", "/api/auth/sample-staff"],
  ["GET", "/api/me"],
  ["GET", "/api/home"],
  ["GET", "/api/sermons"],
  ["GET", "/api/events/{id}/ics"],
  ["POST", "/api/events/{id}/register"],
  ["GET", "/api/directory"],
  ["GET", "/api/giving/funds"],
  ["POST", "/api/giving/gifts"],
  ["GET", "/api/giving/mine"],
  ["GET", "/api/giving/all"],
  ["GET", "/api/groups/{id}/messages"],
  ["POST", "/api/groups/{id}/messages"],
  ["POST", "/api/groups/{id}/join"],
  ["GET", "/api/prayers"],
  ["POST", "/api/prayers"],
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
      const result = await route(deps, token, request.method, url.pathname, body);
      log.log("info", "request", { method: request.method, path: url.pathname, status: 200 });
      return Response.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AccessError) {
        log.log("info", "request_denied", { method: request.method, path: url.pathname, code: error.code });
        return Response.json(
          { ok: false, error: error.message, code: error.code },
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
  if (method === "GET" && path === "/api/giving/funds") return { funds: store.funds() };
  if (method === "POST" && path === "/api/giving/gifts")
    return { gift: await store.createGift(need(), parse(giftBodySchema, body)) };
  if (method === "GET" && path === "/api/giving/mine") return { gifts: store.myGifts(need()) };
  if (method === "GET" && path === "/api/giving/all") return { gifts: store.allGifts(need()) };
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
  if (method === "GET" && path === "/api/prayers") return { prayers: store.listPrayers(token) };
  if (method === "POST" && path === "/api/prayers")
    return store.submitPrayer(need(), parse(prayerBodySchema, body));
  if (method === "POST" && path === "/api/kids/pickup")
    return store.pickup(need(), parse(pickupBodySchema, body));
  if (method === "POST" && path === "/api/communications/push")
    return store.sendPush(need(), parse(pushBodySchema, body));
  if (method === "GET" && path === "/api/modules") return { modules: store.modules() };
  if (method === "GET" && path === "/api/security/seats") return { seats: store.seats() };
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

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AccessError("invalid", "That request didn't match the contract.");
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
  const match = /(?:^|;\s*)onehope_session=([^;]+)/.exec(cookie);
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
