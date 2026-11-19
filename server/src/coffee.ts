/**
 * Revival Coffee, published on myrevivalcoffee.com (menu, visit, events,
 * catering) on Nov 19, 2026. Prices are omitted when the page did not print
 * one. Weekend hours are the site's own "TBD". No phone number is published.
 * Order-ahead stays off until COFFEE_ORDERING_LIVE and Square credentials exist.
 */

export type CoffeeItem = {
  id: string;
  name: string;
  detail: string;
  /** Cents. Null when the site lists the item without a price. */
  priceCents: number | null;
};

export type CoffeeSection = { name: string; items: CoffeeItem[] };

export const COFFEE_SOURCE = {
  menu: "https://myrevivalcoffee.com/menu",
  visit: "https://myrevivalcoffee.com/visit",
  events: "https://myrevivalcoffee.com/events",
  catering: "https://myrevivalcoffee.com/catering",
  readOn: "2026-11-19",
} as const;

export const COFFEE_SHOP = {
  name: "Revival Coffee",
  tagline: "Coffee. Community. Welcome.",
  about:
    "Revival Coffee is Richardson's community coffee shop, connected to One Hope Church. Great coffee, real food, and a welcoming space where everyone belongs.",
  address: "1251 S. Sherman St. Ste. 112, Richardson, TX 75081",
  email: "info@myrevivalcoffee.com",
  mapsUrl:
    "https://maps.apple.com/?address=1251%20S.%20Sherman%20St.%20Ste.%20112%2C%20Richardson%2C%20TX%2075081",
  website: "https://myrevivalcoffee.com/",
  phone: null as string | null,
  gettingHere: [
    "By car: easy access from US-75 (Central Expressway). Parking on site.",
    "By DART: near the Spring Valley station (Red and Orange lines).",
    "Order at the counter. Free Wi-Fi. We share the building with One Hope Church.",
  ],
  hours: [
    { day: "Monday", hours: "7:00 AM – 3:00 PM" },
    { day: "Tuesday", hours: "7:00 AM – 3:00 PM" },
    { day: "Wednesday", hours: "7:00 AM – 3:00 PM" },
    { day: "Thursday", hours: "7:00 AM – 3:00 PM" },
    { day: "Friday", hours: "7:00 AM – 3:00 PM" },
    { day: "Saturday", hours: "TBD" },
    { day: "Sunday", hours: "TBD" },
  ],
  menuNote:
    "Crafted with care, served with a smile. Prices may vary. Ask your barista about today's specials.",
  menuFoot:
    "Menu items and prices subject to change. Ask about seasonal specials, dairy alternatives, and dietary accommodations.",
  eventsTitle: "Events",
  eventsBody:
    "Revival Coffee is more than a coffee shop. It's a gathering place. The events page says coming soon: they're planning community events, workshops, and special happenings. No dated events were listed.",
  catering:
    "Coffee catering in Richardson and nearby North Dallas. They quote each event. Email info@myrevivalcoffee.com. No package prices are published.",
} as const;

export const COFFEE_MENU: readonly CoffeeSection[] = [
  {
    name: "Coffee & Drinks",
    items: [
      { id: "espresso", name: "Espresso", detail: "Bold, rich single or double shot", priceCents: 350 },
      {
        id: "americano",
        name: "Americano",
        detail: "Espresso with hot water for a smooth, full-bodied cup",
        priceCents: 400,
      },
      {
        id: "latte",
        name: "Latte",
        detail: "Espresso with steamed milk and a touch of foam",
        priceCents: 500,
      },
      {
        id: "cappuccino",
        name: "Cappuccino",
        detail: "Equal parts espresso, steamed milk, and foam",
        priceCents: 500,
      },
      {
        id: "cold-brew",
        name: "Cold Brew",
        detail: "Slow-steeped for 18 hours. Smooth, bold, naturally sweet",
        priceCents: 500,
      },
      { id: "iced-latte", name: "Iced Latte", detail: "Espresso over ice with cold milk", priceCents: 550 },
      {
        id: "mocha",
        name: "Mocha",
        detail: "Espresso, chocolate, and steamed milk topped with whipped cream",
        priceCents: 550,
      },
      {
        id: "flat-white",
        name: "Flat White",
        detail: "Velvety microfoam over a double shot of espresso",
        priceCents: 500,
      },
      {
        id: "macchiato",
        name: "Macchiato",
        detail: "Espresso marked with a dollop of foam",
        priceCents: 400,
      },
      { id: "drip", name: "Drip Coffee", detail: "Freshly brewed house blend", priceCents: 300 },
    ],
  },
  {
    name: "Food & Pastries",
    items: [
      {
        id: "breakfast-sandwich",
        name: "Breakfast Sandwich",
        detail: "Egg, cheese, and your choice of protein on a toasted brioche bun",
        priceCents: 700,
      },
      {
        id: "avocado-feta-toast",
        name: "Avocado Feta Toast",
        detail:
          "Smashed avocado on sourdough with cherry tomatoes, feta, walnuts, and olive oil. Add egg $1.",
        priceCents: 1000,
      },
      {
        id: "overnight-oats",
        name: "Overnight Oats Chia Pudding",
        detail:
          "Blueberry or strawberry, with cinnamon, vanilla, and fresh seasonal fruit. The menu does not list a price.",
        priceCents: null,
      },
      {
        id: "yogurt-parfait",
        name: "Yogurt Parfait",
        detail: "Greek yogurt with granola and fresh seasonal fruit",
        priceCents: 600,
      },
      {
        id: "grilled-cheese",
        name: "Three Cheese Sourdough Grilled Cheese",
        detail: "Sharp cheddar, fontina, and Gruyère on sourdough. Served with kettle chips.",
        priceCents: 1000,
      },
      {
        id: "tomato-mozzarella",
        name: "Tomato Mozzarella Sandwich",
        detail: "Roasted cherry tomatoes, basil pesto, and mozzarella on focaccia. Served with kettle chips.",
        priceCents: 1000,
      },
      {
        id: "chicken-pesto-wrap",
        name: "Chicken Pesto Wrap",
        detail:
          "Rotisserie chicken, basil pesto, avocado, and Italian seasoning on a spinach wrap. Served with kettle chips.",
        priceCents: 1000,
      },
      {
        id: "turkey-club-wrap",
        name: "Turkey Club Wrap",
        detail: "Turkey, bacon, lettuce, tomato, and ranch in a flour tortilla",
        priceCents: 900,
      },
      {
        id: "pastries",
        name: "Fresh Pastries",
        detail: "Rotating selection of croissants, muffins, and scones",
        priceCents: 400,
      },
    ],
  },
];

export function coffeeGuide(ordering: {
  live: boolean;
  applicationId: string;
  locationId: string;
  environment: string;
}) {
  return {
    shop: COFFEE_SHOP,
    menu: COFFEE_MENU,
    source: COFFEE_SOURCE,
    ordering: ordering.live
      ? {
          live: true as const,
          applicationId: ordering.applicationId,
          locationId: ordering.locationId,
          environment: ordering.environment,
          message: "Order ahead uses Square. Card numbers stay with Square.",
        }
      : {
          live: false as const,
          message: "Order ahead coming soon. Come to the counter, or get directions.",
        },
  };
}
