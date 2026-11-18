import { z } from "zod";

import { ACTIONS, MODULES, ROLES } from "./domain";

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
  })
  .strict();

export const eventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(160),
    start: z.number().int(),
    end: z.number().int(),
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
    fundId: z.enum(["general", "outreach", "kids", "benevolence"]),
    recurring: z.enum(["once", "weekly", "monthly"]),
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
    recurring: z.enum(["once", "weekly", "monthly"]),
    charged: z.boolean(),
    processor: z.enum(["demo", "stripe"]),
    sample: z.boolean(),
    createdAt: z.number(),
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
