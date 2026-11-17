export type Capability = {
  provider: string;
  product: string;
  read: boolean;
  write: boolean;
  status: "enforced-demo" | "scaffolded";
  notes: string;
};

/**
 * Planning Center notes follow the public OAuth scope list
 * (people, groups, calendar, registrations, check_ins, services, giving,
 * publishing, home) and the product behavior this build relies on.
 * Live calls stay off until server env vars are set. Write flags marked
 * false are not used, even if a later API revision adds them.
 */
export const CAPABILITIES: readonly Capability[] = [
  {
    provider: "Planning Center",
    product: "OAuth",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "Authorization code flow. Scopes are requested per product. The client secret stays on the server.",
  },
  {
    provider: "Planning Center",
    product: "People",
    read: true,
    write: true,
    status: "scaffolded",
    notes:
      "People, emails, phones, addresses, and households support read and write. This build syncs only after PLANNING_CENTER credentials are set.",
  },
  {
    provider: "Planning Center",
    product: "Groups",
    read: true,
    write: true,
    status: "scaffolded",
    notes:
      "Memberships can be created and updated. Group definitions are treated as read-only here and stay owned in One Hope until a write is verified.",
  },
  {
    provider: "Planning Center",
    product: "Calendar",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "Events are read from Calendar. New events, registrations, and room bookings are stored in One Hope. Add-to-calendar uses an ICS file and does not need Google credentials.",
  },
  {
    provider: "Planning Center",
    product: "Registrations",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "Signup records are readable. This build takes registrations itself, including the waitlist, and does not post them back.",
  },
  {
    provider: "Planning Center",
    product: "Check-Ins",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "Stations and history are readable. Check-in and pickup run in One Hope. Zebra labels are ZPL text; Brother receives the same label fields. No printer socket is opened in demo.",
  },
  {
    provider: "Planning Center",
    product: "Services",
    read: true,
    write: true,
    status: "scaffolded",
    notes:
      "Plans, teams, and songs are readable. Accept or decline updates a plan person's status when the live adapter is on. Blockout dates are part of scheduling.",
  },
  {
    provider: "Planning Center",
    product: "Giving",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "Donations, funds, and pledges are readable. Card charges are not sent to Planning Center. Online gifts, when live, are Stripe PaymentIntents created on this server.",
  },
  {
    provider: "Planning Center",
    product: "Publishing and Home",
    read: false,
    write: false,
    status: "enforced-demo",
    notes:
      "Not used. The member app replaces Church Center. There is no link that hands a person off to Church Center.",
  },
  {
    provider: "Stripe",
    product: "PaymentIntents and PaymentSheet",
    read: true,
    write: true,
    status: "enforced-demo",
    notes:
      "The server can create a PaymentIntent. The app confirms with PassKit and Stripe PaymentSheet. Demo mode never charges. Live mode also requires GIVING_LIVE and APPLE_PAY_NONPROFIT_APPROVED. Card numbers are rejected if a client sends them.",
  },
  {
    provider: "YouTube",
    product: "Public RSS",
    read: true,
    write: false,
    status: "enforced-demo",
    notes: "Channel @Weareonehope (UCq2WteT5jNlWmXNofRMvQfw) via the public Atom feed. No API key.",
  },
  {
    provider: "Facebook",
    product: "Graph live video",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "The Watch tab keeps a Live slot. It stays a placeholder until FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN are set on the server. The token is never sent to the app.",
  },
  {
    provider: "Instagram",
    product: "Graph media",
    read: true,
    write: false,
    status: "scaffolded",
    notes:
      "iamonehope can be read when INSTAGRAM_ACCESS_TOKEN is set. The media page shows not connected until then.",
  },
  {
    provider: "Resend",
    product: "Email",
    read: false,
    write: true,
    status: "enforced-demo",
    notes: "The adapter is present. Campaign and push composers do not call it. Sends stay off.",
  },
  {
    provider: "Twilio",
    product: "Text-to-give and SMS",
    read: false,
    write: true,
    status: "enforced-demo",
    notes: "The adapter is present for a future text-to-give number. This build does not send SMS.",
  },
  {
    provider: "Apple",
    product: "APNs push",
    read: false,
    write: true,
    status: "enforced-demo",
    notes:
      "The composer previews a segmented notification. The send endpoint refuses. No device token is contacted.",
  },
  {
    provider: "Google",
    product: "Calendar and Maps",
    read: true,
    write: false,
    status: "enforced-demo",
    notes:
      "ICS files work without a Google account. Maps opens the public Richardson address. A Google Calendar OAuth write is not turned on.",
  },
  {
    provider: "API.Bible",
    product: "Passages",
    read: true,
    write: false,
    status: "enforced-demo",
    notes:
      "With API_BIBLE_KEY the server fetches a passage. Without it, sermon notes show a short public-domain KJV excerpt and say so.",
  },
  {
    provider: "QuickBooks Online",
    product: "Export",
    read: false,
    write: true,
    status: "enforced-demo",
    notes:
      "Finance can download a Sample CSV. OAuth posting to a QuickBooks company is scaffolded and does not run.",
  },
  {
    provider: "PostHog",
    product: "Product analytics",
    read: false,
    write: true,
    status: "scaffolded",
    notes: "Capture is a no-op until POSTHOG_KEY is set. Demo usage is not sent.",
  },
];

export const PUBLIC_KJV = {
  reference: "John 3:16",
  translation: "KJV",
  publicDomain: true,
  text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
} as const;
