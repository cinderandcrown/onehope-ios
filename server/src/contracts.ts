import { z } from "zod";

import { ACTIONS, MODULES, ROLES } from "./domain";
import { GIVING_FREQUENCY_IDS, GIVING_FUND_IDS, SUPPORT_NEED_IDS } from "./church-copy";
import { FOLLOW_UP_KINDS, FOLLOW_UP_STATUSES } from "./faith";

export const roleSchema = z.enum(ROLES);
export const moduleSchema = z.enum(MODULES);
export const actionSchema = z.enum(ACTIONS);

export const loginBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  })
  .strict();

export const signupBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(200),
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

export const profileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().max(40).optional(),
    emailPublic: z.boolean().optional(),
    phonePublic: z.boolean().optional(),
    listedInDirectory: z.boolean().optional(),
  })
  .strict();

export const childBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    classroom: z.enum(["Nursery", "Preschool", "Elementary"]),
  })
  .strict();

export const announcementBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(500),
    startsAt: z.number().int().nullable().optional(),
    endsAt: z.number().int().nullable().optional(),
  })
  .strict();

export const archiveBodySchema = z
  .object({
    archived: z.boolean(),
  })
  .strict();

export const eventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(160),
    start: z.number().int(),
    end: z.number().int(),
    description: z.string().trim().max(1000).optional(),
    capacity: z.number().int().positive().max(100_000).nullable().optional(),
  })
  .strict();

export const cancelBodySchema = z
  .object({
    cancelled: z.boolean(),
  })
  .strict();

export const groupBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
  })
  .strict();

export const checkInBodySchema = z
  .object({
    childId: z.string().min(1).max(80),
  })
  .strict();

export const householdPickupBodySchema = z
  .object({
    childId: z.string().min(1).max(80),
    code: z.string().regex(/^\d{4}$/),
  })
  .strict();

export const claimBodySchema = z
  .object({
    email: z.string().email(),
    inviteToken: z.string().min(8).max(80),
    password: z.string().min(8).max(200),
  })
  .strict();

export const inviteBodySchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export const moderateBodySchema = z
  .object({
    approved: z.boolean(),
  })
  .strict();

export const codeBodySchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

export const passwordBodySchema = z
  .object({
    password: z.string().min(1).max(200),
  })
  .strict();

export const stepUpBodySchema = z
  .object({
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    password: z.string().min(1).max(200).optional(),
  })
  .strict();

export const giftBodySchema = z
  .object({
    amountCents: z.number().int().positive().max(10_000_000),
    fundId: z.enum(GIVING_FUND_IDS),
    recurring: z.enum(GIVING_FREQUENCY_IDS),
  })
  .strict();

export const messageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(1000),
  })
  .strict();

export const prayerBodySchema = z
  .object({
    body: z.string().trim().min(1).max(1000),
    visibility: z.enum(["public", "private"]),
    /** Church Center's Prayer Request form asks "How can we serve you!" first. */
    serve: z.string().trim().max(300).optional(),
    /** "Please contact me" (true) or "Just pray for me" (false). */
    contact: z.boolean().optional(),
  })
  .strict();

export const pickupBodySchema = z
  .object({
    childId: z.string().min(1).max(80),
    guardianPersonId: z.string().min(1).max(80),
    code: z.string().regex(/^\d{4}$/),
  })
  .strict();

export const bookingBodySchema = z
  .object({
    roomId: z.string().min(1).max(80),
    start: z.number().int(),
    end: z.number().int(),
  })
  .strict();

export const roleChangeBodySchema = z
  .object({
    personId: z.string().min(1).max(80),
    role: roleSchema,
  })
  .strict();

export const proposalBodySchema = z
  .object({
    action: z.enum(["grant", "revoke"]),
    targetPersonId: z.string().min(1).max(80),
  })
  .strict();

export const integrationBodySchema = z
  .object({
    secret: z.string().min(8).max(500),
  })
  .strict();

export const pushBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(240),
    segment: z.enum(["members", "volunteers", "parents"]),
  })
  .strict();

export const personSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    email: z.string(),
    phone: z.string(),
    role: roleSchema,
    householdId: z.string().nullable(),
    sample: z.boolean(),
    emailPublic: z.boolean(),
    phonePublic: z.boolean(),
    listedInDirectory: z.boolean(),
  })
  .strict();

export const giftViewSchema = z
  .object({
    id: z.string(),
    householdId: z.string(),
    fundId: z.string(),
    fundName: z.string(),
    amountCents: z.number().int(),
    recurring: z.enum(GIVING_FREQUENCY_IDS),
    charged: z.boolean(),
    processor: z.enum(["demo", "stripe"]),
    sample: z.boolean(),
    createdAt: z.number(),
  })
  .strict();

const contactPhone = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^[0-9+().\-\s]{7,20}$/),
]);

/**
 * A next step from Know Jesus or Plan a Visit. Guests send only a name and,
 * with consent, an email or phone. Empty strings count as not given.
 */
export const followUpBodySchema = z
  .object({
    kind: z.enum(FOLLOW_UP_KINDS),
    name: z.string().trim().max(80).optional(),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
    phone: contactPhone.optional(),
    consent: z.boolean(),
  })
  .strict()
  .refine((body) => body.consent || (!body.email && !body.phone), {
    message: "Contact details need consent.",
  });

/**
 * The church's Support/Assistance Request: at least one of its six boxes.
 * The form promises a call back, so consent to be contacted is required.
 */
export const supportBodySchema = z
  .object({
    needs: z
      .array(z.enum(SUPPORT_NEED_IDS))
      .min(1)
      .max(SUPPORT_NEED_IDS.length)
      .refine((needs) => new Set(needs).size === needs.length, { message: "Each box counts once." }),
    name: z.string().trim().max(80).optional(),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
    phone: contactPhone.optional(),
    consent: z.literal(true),
  })
  .strict();

export const followUpStatusBodySchema = z.object({ status: z.enum(FOLLOW_UP_STATUSES) }).strict();

export const socialBodySchema = z
  .object({
    links: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(40),
            name: z.string().trim().min(1).max(40),
            url: z.string().trim().max(300),
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

export const myFiveBodySchema = z
  .object({ names: z.array(z.string().trim().min(1).max(80)).max(5) })
  .strict();

export const testimonyBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(2000),
    consent: z.literal(true),
  })
  .strict();

export const milestoneBodySchema = z
  .object({
    kind: z.enum(["baptism", "salvation"]),
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(500),
    consent: z.literal(true),
  })
  .strict();

export const outreachBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(1000).optional(),
    location: z.string().trim().min(1).max(200),
    start: z.number(),
    end: z.number(),
  })
  .strict();

export const personCreateBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional(),
  })
  .strict();

export const personEditBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .strict();

export const servingAssignBodySchema = z
  .object({
    personId: z.string().trim().min(1).max(80),
    position: z.string().trim().min(1).max(80),
  })
  .strict();

export const neighborhoodPrayerBodySchema = z.object({ body: z.string().trim().min(1).max(1000) }).strict();

export const coffeeOrderBodySchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            catalogObjectId: z.string().trim().min(1).max(80),
            quantity: z.number().int().positive().max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    sourceId: z.string().trim().min(6).max(200),
    idempotencyKey: z.string().trim().min(8).max(80),
    pickupName: z.string().trim().min(1).max(80),
  })
  .strict();

export const healthSchema = z
  .object({
    service: z.literal("onehope"),
    version: z.string(),
    env: z.enum(["demo", "production"]),
    fieldEncryption: z.enum(["demo", "configured"]),
    givingLive: z.boolean(),
    sendsEnabled: z.literal(false),
    church: z.literal("One Hope"),
    persistence: z.enum(["memory", "postgres"]),
  })
  .strict();

export const errorSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
    code: z.string(),
  })
  .strict();

export type LoginBody = z.infer<typeof loginBodySchema>;
export type GiftBody = z.infer<typeof giftBodySchema>;
export type GiftView = z.infer<typeof giftViewSchema>;
export type PersonView = z.infer<typeof personSchema>;
export type PickupBody = z.infer<typeof pickupBodySchema>;
export type PrayerBody = z.infer<typeof prayerBodySchema>;
export type PushBody = z.infer<typeof pushBodySchema>;
export type ProposalBody = z.infer<typeof proposalBodySchema>;
export type RoleChangeBody = z.infer<typeof roleChangeBodySchema>;
export type BookingBody = z.infer<typeof bookingBodySchema>;
export type IntegrationBody = z.infer<typeof integrationBodySchema>;
export type StepUpBody = z.infer<typeof stepUpBodySchema>;
export type FollowUpBody = z.infer<typeof followUpBodySchema>;
export type SupportBody = z.infer<typeof supportBodySchema>;
