import { assertTruthful } from "./adapter-registry";
import { CAPABILITIES } from "./capabilities";
import { AccessError, assertNever, assertNoCardData, isAccessError } from "./domain";
import { originAllowed } from "./public-url";
import { facebookLive } from "./adapters";
import { cachedSermons, isCacheablePublicGet, pageOf, withPublicCache } from "./http-cache";
import {
  bookingBodySchema,
  codeBodySchema,
  giftBodySchema,
  healthSchema,
  integrationBodySchema,
  announcementBodySchema,
  archiveBodySchema,
  cancelBodySchema,
  claimBodySchema,
  inviteBodySchema,
  checkInBodySchema,
  householdPickupBodySchema,
  childBodySchema,
  eventBodySchema,
  followUpBodySchema,
  supportBodySchema,
  followUpStatusBodySchema,
  socialBodySchema,
  myFiveBodySchema,
  testimonyBodySchema,
  milestoneBodySchema,
  outreachBodySchema,
  personCreateBodySchema,
  personEditBodySchema,
  servingAssignBodySchema,
  servingRespondBodySchema,
  neighborhoodPrayerBodySchema,
  coffeeOrderBodySchema,
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
  featureBodySchema,
  roleChangeBodySchema,
  stepUpBodySchema,
} from "./contracts";
import { createLogger, noopReporter, type ErrorReporter, type Logger } from "./logger";
import type { ChurchStore } from "./store";
import { parseChicagoLocal } from "./staff-desk";
import { VERSION } from "./version";
import type { ZodType } from "zod";

export const API_ROUTES = [
  ["GET", "/api/health"],
  ["GET", "/api/tenant"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/signup"],
  ["POST", "/api/auth/claim"],
  ["POST", "/api/security/invites"],
  ["POST", "/api/auth/mfa"],
  ["POST", "/api/auth/totp/start"],
  ["POST", "/api/auth/totp/confirm"],
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
  ["POST", "/api/prayers/{id}/report"],
  ["GET", "/api/kids/mine"],
  ["GET", "/api/serving/mine"],
  ["POST", "/api/serving/{id}/respond"],
  ["GET", "/api/pathways/mine"],
  ["POST", "/api/kids/check-in"],
  ["POST", "/api/kids/clock-in"],
  ["POST", "/api/kids/clock-out"],
  ["GET", "/api/kids/roster"],
  ["GET", "/api/kids/station"],
  ["POST", "/api/kids/staff-check-in"],
  ["POST", "/api/kids/household-pickup"],
  ["POST", "/api/household/children"],
  ["POST", "/api/announcements"],
  ["POST", "/api/announcements/{id}"],
  ["POST", "/api/announcements/{id}/archive"],
  ["GET", "/api/staff/announcements"],
  ["POST", "/api/events"],
  ["POST", "/api/events/{id}"],
  ["POST", "/api/events/{id}/cancel"],
  ["GET", "/api/staff/events"],
  ["GET", "/api/staff/outreach"],
  ["POST", "/api/outreach/{id}"],
  ["POST", "/api/outreach/{id}/cancel"],
  ["POST", "/api/groups"],
  ["GET", "/api/giving/quickbooks"],
  ["GET", "/api/audit"],
  ["GET", "/api/kids/{id}/label"],
  ["POST", "/api/kids/pickup"],
  ["POST", "/api/communications/push"],
  ["GET", "/api/media/featured"],
  ["POST", "/api/media/feature"],
  ["POST", "/api/media/feature/clear"],
  ["GET", "/api/modules"],
  ["GET", "/api/security/seats"],
  ["POST", "/api/security/roles"],
  ["POST", "/api/security/master-admin/proposals"],
  ["GET", "/api/capabilities"],
  ["GET", "/api/integrations"],
  ["POST", "/api/integrations/{provider}"],
  ["GET", "/api/ministry"],
  ["POST", "/api/facilities/bookings"],
  ["GET", "/api/know-jesus"],
  ["GET", "/api/daily-word"],
  ["POST", "/api/daily-word/read"],
  ["POST", "/api/follow-ups"],
  ["POST", "/api/support"],
  ["GET", "/api/growth"],
  ["GET", "/api/care/follow-ups"],
  ["GET", "/api/care/testimonies"],
  ["GET", "/api/care/reported-prayers"],
  ["POST", "/api/care/follow-ups/{id}"],
  ["GET", "/api/social"],
  ["POST", "/api/social"],
  ["GET", "/api/coffee"],
  ["GET", "/api/coffee/catalog"],
  ["POST", "/api/coffee/orders"],
  ["POST", "/api/coffee/square-webhook"],
  ["GET", "/api/community"],
  ["POST", "/api/neighborhood/prayers"],
  ["POST", "/api/prayers/{id}/pray"],
  ["GET", "/api/my-five"],
  ["POST", "/api/my-five"],
  ["POST", "/api/testimonies"],
  ["POST", "/api/testimonies/{id}/moderate"],
  ["POST", "/api/milestones"],
  ["POST", "/api/outreach"],
  ["POST", "/api/outreach/{id}/rsvp"],
  ["POST", "/api/outreach/{id}/undo"],
  ["GET", "/api/staff/home"],
  ["GET", "/api/staff/people"],
  ["POST", "/api/staff/people"],
  ["POST", "/api/staff/people/{id}"],
  ["POST", "/api/staff/people/{id}/undo"],
  ["POST", "/api/staff/serving"],
  ["POST", "/api/staff/serving/{id}/undo"],
  ["GET", "/api/staff/groups/{id}"],
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
    if (request.method === "OPTIONS") {
      return finish(deps, request, new Response(null, { status: 204 }));
    }
    if (request.method === "POST" && url.pathname === "/api/coffee/square-webhook") {
      try {
        const raw = await request.text();
        const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
        const result = deps.store.recordSquareWebhook(raw, signature);
        return finish(deps, request, Response.json({ ok: true, ...result }));
      } catch (error) {
        if (isAccessError(error)) {
          return finish(
            deps,
            request,
            Response.json(
              { ok: false, error: error.message, code: error.code },
              { status: statusFor(error.code) },
            ),
          );
        }
        return finish(
          deps,
          request,
          Response.json({ ok: false, error: "Something went wrong.", code: "error" }, { status: 500 }),
        );
      }
    }
    try {
      assertMutation(request);
      const token = bearerOrCookie(request);
      const body = request.method === "GET" || request.method === "HEAD" ? {} : await readBody(request);
      if (request.method !== "GET" && request.method !== "HEAD") assertNoCardData(body);
      if (request.method === "GET" && url.pathname === "/api/audit" && url.searchParams.get("format") === "csv") {
        if (!token) throw new AccessError("unauthenticated", "Sign in again.");
        const csv = deps.store.auditCsv(token, dayRange(url.searchParams));
        return finish(
          deps,
          request,
          new Response(csv, {
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": 'attachment; filename="onehope-audit.csv"',
            },
          }),
        );
      }
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
      const result = await route(
        deps,
        token,
        request.method,
        url.pathname,
        body,
        clientAddress(request),
        url.searchParams,
      );
      log.log("info", "request", { method: request.method, path: url.pathname, status: 200 });
      if (isCacheablePublicGet(request.method, url.pathname, token !== null)) {
        return finish(deps, request, withPublicCache(request, result));
      }
      return finish(deps, request, Response.json({ ok: true, ...result }));
    } catch (error) {
      if (isAccessError(error)) {
        log.log("info", "request_denied", { method: request.method, path: url.pathname, code: error.code });
        return finish(
          deps,
          request,
          Response.json(
            { ok: false, error: friendlyError(error), code: error.code },
            { status: statusFor(error.code) },
          ),
        );
      }
      reporter.capture(error, { path: url.pathname, method: request.method });
      log.log("error", "request_failed", { method: request.method, path: url.pathname });
      return finish(
        deps,
        request,
        Response.json({ ok: false, error: "Something went wrong.", code: "error" }, { status: 500 }),
      );
    }
  };
}

function finish(deps: Deps, request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  if (origin && originAllowed(origin, deps.store.config.publicBaseUrl)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("access-control-allow-headers", "authorization, content-type");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("vary", "Origin");
  }
  return new Response(response.body, { status: response.status, headers });
}

async function route(
  deps: Deps,
  token: string | null,
  method: string,
  path: string,
  body: unknown,
  client: string,
  query: URLSearchParams = new URLSearchParams(),
): Promise<Record<string, unknown>> {
  const store = deps.store;
  const need = () => {
    if (!token) throw new AccessError("unauthenticated", "Sign in again.");
    return token;
  };
  if (method === "GET" && path === "/api/health") return parseOut(healthSchema, store.status(VERSION));
  if (method === "GET" && path === "/api/tenant") return { tenant: store.currentTenant() };
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
  if (method === "POST" && path === "/api/auth/totp/start") return store.beginTotp(need());
  if (method === "POST" && path === "/api/auth/totp/confirm")
    return store.confirmTotp(need(), parse(codeBodySchema, body).code);
  if (method === "POST" && path === "/api/auth/step-up")
    return store.stepUp(need(), parse(stepUpBodySchema, body));
  if (method === "POST" && path === "/api/auth/logout") {
    store.logout(need());
    return {};
  }
  if (method === "POST" && path === "/api/auth/sample-staff")
    return store.loginSampleStaff({ ip: "api", userAgent: "sample-preview" });
  if (method === "GET" && path === "/api/me") return { person: store.me(need()) };
  if (method === "POST" && path === "/api/me")
    return { person: store.updateProfile(need(), parse(profileBodySchema, body)) };
  if (method === "POST" && path === "/api/account/delete") return store.deleteSelf(need());
  if (method === "GET" && path === "/api/home") return store.publicHome();
  if (method === "GET" && path === "/api/sermons") {
    const all = await cachedSermons(deps.fetchImpl ?? fetch, store.config.youtubeChannelId);
    const page = pageOf(query, { limit: 50, max: 100 });
    const kind = query.get("kind");
    const filtered = kind === "message" || kind === "short" ? all.filter((video) => video.kind === kind) : all;
    const videos = filtered.slice(page.offset, page.offset + page.limit);
    const next = page.offset + videos.length;
    return {
      videos,
      sample: all.length === 0,
      total: filtered.length,
      nextOffset: next < filtered.length ? next : null,
    };
  }
  const ics = path.match(/^\/api\/events\/([^/]+)\/ics$/);
  if (method === "GET" && ics?.[1]) return { ics: store.ics(decodeURIComponent(ics[1])) };
  const register = path.match(/^\/api\/events\/([^/]+)\/register$/);
  if (method === "POST" && register?.[1]) return store.register(need(), decodeURIComponent(register[1]));
  if (method === "GET" && path === "/api/directory") {
    const page = pageOf(query, { limit: 200, max: 500 });
    const needle = (query.get("q") ?? "").trim().toLowerCase();
    const everyone = store.directory(need());
    const matching = needle
      ? everyone.filter((person) => person.displayName.toLowerCase().includes(needle))
      : everyone;
    const people = matching.slice(page.offset, page.offset + page.limit);
    const next = page.offset + people.length;
    return { people, total: matching.length, nextOffset: next < matching.length ? next : null };
  }
  if (method === "GET" && path === "/api/giving/funds")
    return { funds: store.funds(), ...store.givingAvailability() };
  if (method === "POST" && path === "/api/giving/gifts")
    return { gift: await store.createGift(need(), parse(giftBodySchema, body)) };
  if (method === "GET" && path === "/api/giving/mine") return { gifts: store.myGifts(need()) };
  if (method === "GET" && path === "/api/giving/all") return { gifts: store.allGifts(need()) };
  if (method === "GET" && path === "/api/groups") return { groups: store.listGroups(token) };
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
    return store.moderatePrayer(
      need(),
      decodeURIComponent(moderate[1]),
      parse(moderateBodySchema, body).approved,
    );
  }
  const report = path.match(/^\/api\/prayers\/([^/]+)\/report$/);
  if (method === "POST" && report?.[1]) return store.reportPrayer(need(), decodeURIComponent(report[1]));
  if (method === "GET" && path === "/api/kids/mine") {
    const token = need();
    return { kids: store.myKids(token), duty: store.kidsDuty(token) };
  }
  if (method === "GET" && path === "/api/serving/mine") return { assignments: store.serving(need()) };
  const respondServing = path.match(/^\/api\/serving\/([^/]+)\/respond$/);
  if (method === "POST" && respondServing?.[1]) {
    return store.respond(need(), decodeURIComponent(respondServing[1]), parse(servingRespondBodySchema, body).accept);
  }
  if (method === "GET" && path === "/api/pathways/mine") return store.myPathway(need());
  if (method === "POST" && path === "/api/kids/check-in")
    return store.checkIn(need(), parse(checkInBodySchema, body).childId);
  if (method === "POST" && path === "/api/kids/clock-in") return store.clockIn(need());
  if (method === "POST" && path === "/api/kids/clock-out") return store.clockOut(need());
  if (method === "GET" && path === "/api/kids/roster") {
    return { children: store.roster(need(), query.get("classroom")) };
  }
  if (method === "GET" && path === "/api/kids/station") {
    return { station: store.stationBoard(need(), query.get("classroom")) };
  }
  if (method === "POST" && path === "/api/kids/staff-check-in") {
    return store.staffCheckIn(need(), parse(checkInBodySchema, body).childId);
  }
  if (method === "POST" && path === "/api/kids/household-pickup")
    return store.householdPickup(need(), parse(householdPickupBodySchema, body));
  if (method === "POST" && path === "/api/household/children")
    return { child: store.addChild(need(), parse(childBodySchema, body)) };
  if (method === "POST" && path === "/api/announcements")
    return { announcement: store.createAnnouncement(need(), parse(announcementBodySchema, body)) };
  const archiveAnnouncement = path.match(/^\/api\/announcements\/([^/]+)\/archive$/);
  if (method === "POST" && archiveAnnouncement?.[1]) {
    return store.archiveAnnouncement(
      need(),
      decodeURIComponent(archiveAnnouncement[1]),
      parse(archiveBodySchema, body).archived,
    );
  }
  const editAnnouncement = path.match(/^\/api\/announcements\/([^/]+)$/);
  if (method === "POST" && editAnnouncement?.[1]) {
    return {
      announcement: store.updateAnnouncement(
        need(),
        decodeURIComponent(editAnnouncement[1]),
        parse(announcementBodySchema, body),
      ),
    };
  }
  if (method === "GET" && path === "/api/staff/announcements") {
    return { announcements: store.staffAnnouncements(need()) };
  }
  if (method === "GET" && path === "/api/events/mine") return { events: store.listEvents(need()) };
  if (method === "POST" && path === "/api/events")
    return { event: store.createEvent(need(), parse(eventBodySchema, body)) };
  const cancelEvent = path.match(/^\/api\/events\/([^/]+)\/cancel$/);
  if (method === "POST" && cancelEvent?.[1]) {
    return store.cancelEvent(need(), decodeURIComponent(cancelEvent[1]), parse(cancelBodySchema, body).cancelled);
  }
  const editEvent = path.match(/^\/api\/events\/([^/]+)$/);
  if (method === "POST" && editEvent?.[1] && editEvent[1] !== "mine") {
    return {
      event: store.updateEvent(need(), decodeURIComponent(editEvent[1]), parse(eventBodySchema, body)),
    };
  }
  if (method === "GET" && path === "/api/staff/events") return { events: store.staffEvents(need()) };
  if (method === "GET" && path === "/api/staff/outreach") return { serveDays: store.staffServeDays(need()) };
  const cancelServe = path.match(/^\/api\/outreach\/([^/]+)\/cancel$/);
  if (method === "POST" && cancelServe?.[1]) {
    return store.cancelOutreach(
      need(),
      decodeURIComponent(cancelServe[1]),
      parse(cancelBodySchema, body).cancelled,
    );
  }
  const editServe = path.match(/^\/api\/outreach\/([^/]+)$/);
  if (method === "POST" && editServe?.[1]) {
    const input = parse(outreachBodySchema, body);
    return {
      outreach: store.updateOutreach(need(), decodeURIComponent(editServe[1]), {
        ...input,
        detail: input.detail ?? "",
      }),
    };
  }
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
  if (method === "GET" && path === "/api/media/featured") return { message: store.featuredMessage() };
  if (method === "POST" && path === "/api/media/feature")
    return { message: store.featureMessage(need(), parse(featureBodySchema, body)) };
  if (method === "POST" && path === "/api/media/feature/clear") return store.clearFeaturedMessage(need());
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
    assertTruthful();
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
  if (method === "GET" && path === "/api/know-jesus") return store.knowJesus();
  if (method === "GET" && path === "/api/daily-word") return store.dailyWord(token);
  if (method === "POST" && path === "/api/daily-word/read") return store.markDailyWordRead(need());
  if (method === "POST" && path === "/api/follow-ups")
    return { followUp: store.submitFollowUp(token, parse(followUpBodySchema, body), client) };
  if (method === "POST" && path === "/api/support")
    return { support: store.submitSupport(token, parse(supportBodySchema, body), client) };
  if (method === "GET" && path === "/api/growth") return store.growth();
  if (method === "GET" && path === "/api/social") return { links: store.socialLinks() };
  if (method === "POST" && path === "/api/social")
    return { links: store.setSocialLinks(need(), parse(socialBodySchema, body).links) };
  if (method === "GET" && path === "/api/coffee") return store.coffeePublic();
  if (method === "GET" && path === "/api/coffee/catalog") return store.coffeeCatalog();
  if (method === "POST" && path === "/api/coffee/orders")
    return store.placeCoffeeOrder(token, parse(coffeeOrderBodySchema, body));
  if (method === "GET" && path === "/api/community") return store.community(token);
  if (method === "POST" && path === "/api/neighborhood/prayers")
    return store.submitNeighborhoodPrayer(parse(neighborhoodPrayerBodySchema, body).body, client);
  const pray = path.match(/^\/api\/prayers\/([^/]+)\/pray$/);
  if (method === "POST" && pray?.[1]) return store.markPrayed(need(), decodeURIComponent(pray[1]));
  if (method === "GET" && path === "/api/my-five") return store.myFiveNames(need());
  if (method === "POST" && path === "/api/my-five")
    return store.saveMyFive(need(), parse(myFiveBodySchema, body).names);
  if (method === "POST" && path === "/api/testimonies")
    return store.submitTestimony(need(), parse(testimonyBodySchema, body));
  const testimony = path.match(/^\/api\/testimonies\/([^/]+)\/moderate$/);
  if (method === "POST" && testimony?.[1]) {
    return store.moderateTestimony(
      need(),
      decodeURIComponent(testimony[1]),
      parse(moderateBodySchema, body).approved,
    );
  }
  if (method === "POST" && path === "/api/milestones")
    return store.publishMilestone(need(), parse(milestoneBodySchema, body));
  if (method === "POST" && path === "/api/outreach") {
    const input = parse(outreachBodySchema, body);
    return { outreach: store.createOutreach(need(), { ...input, detail: input.detail ?? "" }) };
  }
  const rsvp = path.match(/^\/api\/outreach\/([^/]+)\/rsvp$/);
  if (method === "POST" && rsvp?.[1]) return store.rsvpOutreach(need(), decodeURIComponent(rsvp[1]));
  const undoOutreach = path.match(/^\/api\/outreach\/([^/]+)\/undo$/);
  if (method === "POST" && undoOutreach?.[1])
    return store.undoOutreach(need(), decodeURIComponent(undoOutreach[1]));
  if (method === "GET" && path === "/api/staff/home") return store.staffHome(need());
  if (method === "GET" && path === "/api/staff/people") return { people: store.staffPeople(need()) };
  if (method === "POST" && path === "/api/staff/people")
    return { person: store.addPerson(need(), parse(personCreateBodySchema, body)) };
  const editPerson = path.match(/^\/api\/staff\/people\/([^/]+)$/);
  if (method === "POST" && editPerson?.[1]) {
    return {
      person: store.editPerson(need(), decodeURIComponent(editPerson[1]), parse(personEditBodySchema, body)),
    };
  }
  const undoPerson = path.match(/^\/api\/staff\/people\/([^/]+)\/undo$/);
  if (method === "POST" && undoPerson?.[1])
    return store.undoAddPerson(need(), decodeURIComponent(undoPerson[1]));
  if (method === "POST" && path === "/api/staff/serving")
    return { assignment: store.assignServing(need(), parse(servingAssignBodySchema, body)) };
  const undoServing = path.match(/^\/api\/staff\/serving\/([^/]+)\/undo$/);
  if (method === "POST" && undoServing?.[1])
    return store.undoServing(need(), decodeURIComponent(undoServing[1]));
  const roster = path.match(/^\/api\/staff\/groups\/([^/]+)$/);
  if (method === "GET" && roster?.[1])
    return { group: store.groupRoster(need(), decodeURIComponent(roster[1])) };
  if (method === "GET" && path === "/api/care/follow-ups") return { followUps: store.followUpsFor(need()) };
  if (method === "GET" && path === "/api/care/testimonies") {
    return { testimonies: store.pendingTestimonies(need()) };
  }
  if (method === "GET" && path === "/api/care/reported-prayers") {
    return { prayers: store.reportedPrayers(need()) };
  }
  const followUp = path.match(/^\/api\/care\/follow-ups\/([^/]+)$/);
  if (method === "POST" && followUp?.[1]) {
    return {
      followUp: store.updateFollowUp(
        need(),
        decodeURIComponent(followUp[1]),
        parse(followUpStatusBodySchema, body),
      ),
    };
  }
  throw new AccessError("not_found", "That route isn't part of this API.");
}

/** Vercel sets x-forwarded-for to the caller; the first entry is the client. */
function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
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

function dayRange(query: URLSearchParams): { from: number | null; to: number | null } {
  const fromRaw = query.get("from") ?? "";
  const toRaw = query.get("to") ?? "";
  const from = fromRaw ? parseChicagoLocal(fromRaw) : null;
  const toStart = toRaw ? parseChicagoLocal(toRaw) : null;
  return { from, to: toStart === null ? null : toStart + 24 * 60 * 60 * 1000 - 1 };
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
    case "rate_limited":
      return 429;
    default:
      return assertNever(code);
  }
}
