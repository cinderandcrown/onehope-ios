import { CHURCH } from "./domain";

/**
 * Public wording from weareonehope.com (home, Plan Your Visit, Give, and
 * Community pages). Nothing here is invented about the church.
 */
export const CHURCH_ADDRESS = `${CHURCH.addressLine}, ${CHURCH.city}, ${CHURCH.region} ${CHURCH.postalCode}`;

export const PLAN_YOUR_VISIT_URL = "https://www.weareonehope.com/plan-your-visit";

export const VISIT = {
  welcome: "We are excited to meet you!",
  directions: "Just off of US 75 & Spring Valley Rd.",
  serviceTime: "Sundays at 10:30 a.m.",
  arrival: "Come early for donuts & coffee at 10:00 a.m.",
  kids: "One Hope Kids is available during our Sunday services for ages 3 months to 5th grade. Kids meet friends, have fun, and learn about God in an age-appropriate process.",
  address: CHURCH_ADDRESS,
  mapsUrl: CHURCH.mapsUrl,
  calendarPath: "/api/events/event-sunday/ics",
  websiteUrl: PLAN_YOUR_VISIT_URL,
} as const;

export const GIVING_WAYS = {
  message:
    "We believe generosity flows from a heart of gratitude. We see generosity as a privilege. We're generous with our time, talents and treasure. God has given richly towards us, it's our honor to give back to him.",
  verse: {
    reference: "2 Corinthians 9:7",
    text: "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.",
  },
  online: {
    url: "https://weareonehope.churchcenter.com/giving",
    note: "Simple and secure. Give a single gift, or schedule a recurring gift using your debit or credit card.",
  },
  text: { number: "84321", note: "Text any amount to 84321 and follow the prompts." },
  mail: { address: "PO Box 211926, Dallas, TX 75211", note: "Mail your check or money order." },
  seasonal: {
    title: "Christmas Giving Tree",
    note: "To give to the Christmas Giving Tree, choose Christmas Giving Tree in the fund dropdown on the online giving page.",
    /** Hidden after Christmas Day in Chicago. */
    until: Date.parse("2026-12-26T06:00:00.000Z"),
  },
} as const;

export const INVITE = {
  title: "Come sit with me at One Hope this Sunday",
  body: `Sundays at 10:30 a.m. Come early for donuts & coffee at 10:00. ${CHURCH_ADDRESS}`,
  url: PLAN_YOUR_VISIT_URL,
  mapsUrl: CHURCH.mapsUrl,
} as const;

const CC = "https://weareonehope.churchcenter.com";

export type PublicGroup = {
  id: string;
  name: string;
  summary: string;
  category: "Small Groups" | "Year Around Groups";
  schedule: string;
  area: string;
  leaders: string[];
  joinType: "open" | "request";
  url: string;
};

/**
 * Open groups as listed on Church Center (Groups) on Nov 18, 2026. Leaders are
 * only the names the church lists publicly. Areas are city level, not homes.
 */
export const CHURCH_GROUPS: readonly PublicGroup[] = [
  {
    id: "artisan-exchange-saturdays-revival-coffee",
    name: "Artisan Exchange | Saturdays @ Revival Coffee",
    summary: "A monthly gathering at Revival Coffee Shop.",
    category: "Small Groups",
    schedule: "Once a month on Saturdays, 9–11 a.m. Next: Nov 21.",
    area: "Revival Coffee Shop",
    leaders: [],
    joinType: "open",
    url: `${CC}/groups/small-groups/artisan-exchange-saturdays-revival-coffee`,
  },
  {
    id: "discipleship-through-sonship-sunday-mornings-starts-09-27-26",
    name: "Discipleship Through Sonship | Sunday Mornings",
    summary: "Led by Pastors Derek & Jen.",
    category: "Small Groups",
    schedule: "Sundays, 9–9:30 a.m., Generations Classroom.",
    area: "One Hope, Richardson",
    leaders: [],
    joinType: "open",
    url: `${CC}/groups/small-groups/discipleship-through-sonship-sunday-mornings-starts-09-27-26`,
  },
  {
    id: "game-night-social-group",
    name: "Game Night Social Group",
    summary: "A social game night.",
    category: "Small Groups",
    schedule: "Fall meetups. Next: Nov 20.",
    area: "Plano",
    leaders: ["Jordan Boyer"],
    joinType: "open",
    url: `${CC}/groups/small-groups/game-night-social-group`,
  },
  {
    id: "latte-s-littles-fridays-starts-9-18-26",
    name: "Latte's & Littles | Fridays",
    summary: "Coffee with little ones at rotating coffee shops.",
    category: "Small Groups",
    schedule: "Fridays, every other week.",
    area: "Rotating coffee shops",
    leaders: ["Taylor Sauce"],
    joinType: "open",
    url: `${CC}/groups/small-groups/latte-s-littles-fridays-starts-9-18-26`,
  },
  {
    id: "marriage-family-sundays-starts-9-20-26",
    name: "Marriage & Family | Sundays",
    summary: "For couples and families. Childcare 6–8 p.m., $10 per child.",
    category: "Small Groups",
    schedule: "Sundays at 6 p.m., monthly.",
    area: "Dallas",
    leaders: [],
    joinType: "open",
    url: `${CC}/groups/small-groups/marriage-family-sundays-starts-9-20-26`,
  },
  {
    id: "men-s-mentorship-group",
    name: "Men's Mentorship Group",
    summary: "An 8-week book study. The book is $20 at the first meeting.",
    category: "Small Groups",
    schedule: "Tuesdays at 6:30 p.m.",
    area: "One Hope, Richardson",
    leaders: ["Tony Neis"],
    joinType: "open",
    url: `${CC}/groups/small-groups/men-s-mentorship-group`,
  },
  {
    id: "one-hope-young-adults-starts-9-20-26",
    name: "One Hope Young Adults",
    summary: "Ages 18–30.",
    category: "Small Groups",
    schedule: "Every other Sunday at 6 p.m.",
    area: "Dallas",
    leaders: ["Derek Miller", "Jennifer Miller"],
    joinType: "open",
    url: `${CC}/groups/small-groups/one-hope-young-adults-starts-9-20-26`,
  },
  {
    id: "one-hope-youth",
    name: "One Hope Youth",
    summary: "Grades 6–12.",
    category: "Small Groups",
    schedule: "Wednesdays, 6:30–8:30 p.m.",
    area: "Richardson",
    leaders: [
      "Carson Yow",
      "Ian Vizcaino",
      "Jaylee Strickland",
      "Kylee Kreaemer",
      "Pierce Miller",
      "Skylar Poper",
    ],
    joinType: "open",
    url: `${CC}/groups/small-groups/one-hope-youth`,
  },
  {
    id: "prophetic-activation-starts-9-23-26",
    name: "Prophetic Activation",
    summary: "Potluck at 6:30, group at 7.",
    category: "Small Groups",
    schedule: "Every other Wednesday, 6:30–8 p.m.",
    area: "Dallas",
    leaders: ["Faith Wuenschel", "Allison Burke", "Crystal Hexamer"],
    joinType: "open",
    url: `${CC}/groups/small-groups/prophetic-activation-starts-9-23-26`,
  },
  {
    id: "women-s-bible-study-wednesdays-10-am",
    name: "Women's Bible Study | Wednesdays",
    summary: "Studying 1 & 2 Peter. Littles welcome.",
    category: "Small Groups",
    schedule: "Wednesdays at 10 a.m.",
    area: "Richardson",
    leaders: ["Kayla Dutton"],
    joinType: "open",
    url: `${CC}/groups/small-groups/women-s-bible-study-wednesdays-10-am`,
  },
  {
    id: "dream-center-food-distribution",
    name: "Dream Center Food Distribution",
    summary: "Food for 35+ families in Oak Cliff.",
    category: "Year Around Groups",
    schedule: "First Saturday of the month, 8:45 a.m.–12 p.m.",
    area: "Oak Cliff, Dallas",
    leaders: ["Allison Burke"],
    joinType: "request",
    url: `${CC}/groups/year-around-groups/dream-center-food-distribution`,
  },
  {
    id: "sunday-morning-prayer",
    name: "Sunday Morning Prayer",
    summary: "Pray together before the gathering.",
    category: "Year Around Groups",
    schedule: "Sundays, 9:30–10 a.m., in the sanctuary.",
    area: "One Hope, Richardson",
    leaders: [],
    joinType: "open",
    url: `${CC}/groups/year-around-groups/sunday-morning-prayer`,
  },
  {
    id: "unlocking-freedom",
    name: "Unlocking Freedom",
    summary: "Hope City Recovery.",
    category: "Year Around Groups",
    schedule: "Sundays, 6–8 p.m.",
    area: "Revival Coffee Shop",
    leaders: ["Allison Burke", "Kayla Dutton"],
    joinType: "request",
    url: `${CC}/groups/year-around-groups/unlocking-freedom`,
  },
];

/** Placeholder groups from builds 1–5. Build 6 replaces them with the church's real groups. */
export const RETIRED_GROUP_IDS: readonly string[] = ["group-kids", "group-small", "group-growth"];

export type PublicEvent = {
  id: string;
  title: string;
  start: number;
  end: number;
  location: string;
  description: string;
  url: string;
};

/** Open registrations on Church Center on Nov 18, 2026. Signup stays on Church Center. */
export const CHURCH_EVENTS: readonly PublicEvent[] = [
  {
    id: "cc-2569980",
    title: "Thanksgiving at Hope Farm",
    start: Date.parse("2026-11-20T00:00:00.000Z"),
    end: Date.parse("2026-11-20T02:30:00.000Z"),
    location: "Hope Farm, South Dallas",
    description: "Free. Register on Church Center.",
    url: `${CC}/registrations/events/2569980`,
  },
  {
    id: "cc-3990859",
    title: "Giving Tree 2026",
    start: Date.parse("2026-12-05T15:00:00.000Z"),
    end: Date.parse("2026-12-05T18:00:00.000Z"),
    location: "Christ For The Nations, 444 Fawn Ridge Drive, Dallas, TX 75224",
    description: "Free. Register on Church Center. Give through the Christmas Giving Tree fund.",
    url: `${CC}/registrations/events/3990859`,
  },
];

/** The six boxes on the church's Support/Assistance Request form (Church Center form 109520). */
export const SUPPORT_NEEDS = [
  { id: "counseling", label: "Short term pastoral counseling" },
  { id: "premarital", label: "Pre-marital counseling" },
  { id: "hospital", label: "Hospital visitation request" },
  { id: "recovery", label: "One Hope recovery group" },
  { id: "volunteer", label: "I'd like to volunteer" },
  { id: "clothing", label: "In need of clothing" },
] as const;

export type SupportNeedId = (typeof SUPPORT_NEEDS)[number]["id"];

export const SUPPORT_NEED_IDS = SUPPORT_NEEDS.map((need) => need.id) as [SupportNeedId, ...SupportNeedId[]];

export const SUPPORT = {
  title: "Support and assistance",
  intro: "Please fill out this form and you will be contacted soon.",
  prompt: "Please check each box below that applies.",
  needs: SUPPORT_NEEDS,
};

/**
 * The church's published Toolkit page, word for word in titles and links.
 * Scripture text is the King James Version for the references the church lists.
 */
export const TOOLKIT = {
  title: "Toolkit for Spiritual Growth",
  source: `${CC}/pages/toolkit`,
  readingPlan: {
    title: "Bible Reading Plan",
    url: "https://docs.google.com/document/d/1QGwdCS6bq1FIb9smmBfbuYMDqCE59fG7T0Q20djxx2c/edit",
  },
  staffReads: [
    { title: "Unoffendable", author: "Brant Hansen" },
    { title: "The Power To Change", author: "Craig Groeschel" },
    { title: "Destined to Reign", author: "Joseph Prince" },
    { title: "Destined to Reign Daily Devotional", author: "Joseph Prince" },
    { title: "What's So Amazing About Grace", author: "Philip Yancy" },
  ],
  podcasts: [
    "Joseph Prince",
    "Charles Nieman",
    "The Awake Podcast",
    "Dr. Caroline Leaf",
    "Dr. Creflo Dollar",
    "Unlocking Freedom",
    "Judah Smith",
  ],
  playlist: { title: "Spotify Playlist", url: "https://spotify.link/zxs5Bwl33Cb" },
  scriptures: [
    {
      reference: "2 Timothy 1:7",
      text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    },
    {
      reference: "Isaiah 53:4",
      text: "Surely he hath borne our griefs, and carried our sorrows: yet we did esteem him stricken, smitten of God, and afflicted.",
    },
    {
      reference: "Psalm 91:10",
      text: "There shall no evil befall thee, neither shall any plague come nigh thy dwelling.",
    },
    {
      reference: "Psalm 91:7-8",
      text: "A thousand shall fall at thy side, and ten thousand at thy right hand; but it shall not come nigh thee. Only with thine eyes shalt thou behold and see the reward of the wicked.",
    },
    {
      reference: "Ephesians 2:14",
      text: "For he is our peace, who hath made both one, and hath broken down the middle wall of partition between us;",
    },
    {
      reference: "Isaiah 54:17",
      text: "No weapon that is formed against thee shall prosper; and every tongue that shall rise against thee in judgment thou shalt condemn. This is the heritage of the servants of the LORD, and their righteousness is of me, saith the LORD.",
    },
    {
      reference: "Deuteronomy 28:13",
      text: "And the LORD shall make thee the head, and not the tail; and thou shalt be above only, and thou shalt not be beneath; if that thou hearken unto the commandments of the LORD thy God, which I command thee this day, to observe and to do them:",
    },
    {
      reference: "Philippians 2:9-11",
      text: "Wherefore God also hath highly exalted him, and given him a name which is above every name: that at the name of Jesus every knee should bow, of things in heaven, and things in earth, and things under the earth; and that every tongue should confess that Jesus Christ is Lord, to the glory of God the Father.",
    },
  ],
  proclamations: {
    title: "Daily Proclamations",
    url: "https://hopecitydallas-my.sharepoint.com/:b:/g/personal/dmiller_weareonehope_com/ET0Tud21jPhFrJ-1dGVDR70B_R5SHg9i37l2P5yk_2ewMg?e=kbLNYw",
  },
};

/** The church's Recovery page. Worksheet answers stay on the person's device. */
export const RECOVERY = {
  title: "Hope City Recovery",
  subtitle: "Unlocking Freedom",
  source: `${CC}/pages/recovery`,
  groupId: "unlocking-freedom",
  worksheet: {
    title: "Life Evaluation Worksheet",
    prompt: "Rate each area of your life from 1 to 10.",
    areas: [
      "Faith/Spirituality",
      "Marriage/Intimacy",
      "Family & Friends",
      "Physical Health",
      "Serving/Giving",
      "Finances",
      "Career/Purpose",
      "Personal Growth",
      "Fun/Recreation",
      "Physical Environment",
    ],
    pdfUrl: "https://drive.google.com/file/d/1DOgF87z5wVt4kuWYi-FiqH6GnPNIpcnA/view?usp=sharing",
  },
};

/**
 * Funds the app may offer once Stripe is live. "Christmas Giving Tree" is the
 * only fund name Church Center publishes; "general" stands for a gift to the
 * church with no fund chosen, until the church confirms the rest of its list.
 */
export const GIVING_FUNDS = [
  { id: "general", name: "One Hope Church" },
  { id: "christmas-giving-tree", name: "Christmas Giving Tree" },
] as const;

export const GIVING_FUND_IDS = GIVING_FUNDS.map((fund) => fund.id) as [string, ...string[]];

/** The same frequencies as the Church Center giving form. */
export const GIVING_FREQUENCIES = [
  { id: "once", label: "Once" },
  { id: "weekly", label: "Weekly" },
  { id: "every_other_week", label: "Every other week" },
  { id: "twice_monthly", label: "Twice monthly" },
  { id: "monthly", label: "Monthly" },
] as const;

export type GivingFrequency = (typeof GIVING_FREQUENCIES)[number]["id"];

export const GIVING_FREQUENCY_IDS = GIVING_FREQUENCIES.map((item) => item.id) as [
  GivingFrequency,
  ...GivingFrequency[],
];
