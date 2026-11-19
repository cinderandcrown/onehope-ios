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
