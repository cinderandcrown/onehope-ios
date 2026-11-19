/**
 * Scripture and next-step content shared by the phone, the member web page,
 * and the Command Center. Every verse is the King James Version, which is in
 * the public domain. Prompts are short and neutral so pastors can replace them
 * later without changing any client.
 */

export type Verse = { reference: string; text: string };

export type DailyReading = Verse & { read: string; prompt: string };

export type JourneyDay = Verse & { day: number; title: string; prompt: string };

export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number] | "prayer" | "support";

/**
 * Next steps anyone can send. "prayer" comes only from a prayer request that
 * asks for contact, and "support" only from the Support/Assistance form.
 */
export const FOLLOW_UP_KINDS = ["salvation", "baptism", "new", "growth_track", "visit"] as const;

export const FOLLOW_UP_LABELS: Record<FollowUpKind, string> = {
  salvation: "Decided to follow Jesus",
  baptism: "Wants to be baptized",
  new: "New to One Hope",
  growth_track: "Growth Track",
  visit: "Coming this Sunday",
  prayer: "Prayer request: please contact me",
  support: "Support/Assistance request",
};

export const FOLLOW_UP_STATUSES = ["new", "contacted", "closed"] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/** The default next steps follow the church's own public mission: know Jesus, discover purpose, make a difference. */
export const DEFAULT_PATHWAY: readonly { id: string; title: string }[] = [
  { id: "know-jesus", title: "Know Jesus" },
  { id: "baptism", title: "Water baptism" },
  { id: "growth-track", title: "Growth Track" },
  { id: "small-group", title: "Join a Small Group" },
  { id: "serve", title: "Serve on a team" },
];

/** Which pathway step a follow-up moves, and to what. */
export const FOLLOW_UP_PATHWAY: Partial<Record<FollowUpKind, { stepId: string; status: string }>> = {
  salvation: { stepId: "know-jesus", status: "done" },
  baptism: { stepId: "baptism", status: "requested" },
  growth_track: { stepId: "growth-track", status: "requested" },
};

export const GOSPEL = {
  intro:
    "At One Hope it is our desire to lead people into a personal relationship with Jesus. This is the good news, straight from the Bible.",
  steps: [
    {
      title: "God loves you",
      reference: "John 3:16",
      text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    },
    {
      title: "Sin separates us from God",
      reference: "Romans 3:23",
      text: "For all have sinned, and come short of the glory of God;",
    },
    {
      title: "Jesus died and rose again for you",
      reference: "1 Corinthians 15:3-4",
      text: "For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures; And that he was buried, and that he rose again the third day according to the scriptures:",
    },
    {
      title: "Salvation is a gift",
      reference: "Ephesians 2:8-9",
      text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.",
    },
    {
      title: "Receive Him today",
      reference: "Romans 10:9",
      text: "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.",
    },
  ],
  prayer:
    "Lord Jesus, I believe you died for my sins and rose again. I turn to you and receive your forgiveness. Be my Lord and Savior. Amen.",
  baptism:
    "Water baptism is an outward profession of a person's inward commitment to Jesus Christ as Savior.",
  baptismVerse: {
    reference: "Romans 6:4",
    text: "Therefore we are buried with him by baptism into death: that like as Christ was raised up from the dead by the glory of the Father, even so we also should walk in newness of life.",
  },
  growthTrack:
    "Learn more about One Hope through our Growth Track classes. You'll hear the vision of our church, discover your purpose and find out how you can make a difference in our community.",
} as const;

/** Seven days for someone who just decided to follow Jesus. Pastors can edit these later. */
export const NEW_BELIEVER_JOURNEY: readonly JourneyDay[] = [
  {
    day: 1,
    title: "You are loved",
    reference: "John 3:17",
    text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
    prompt: "Thank God for His love. Name one thing you are grateful for today.",
  },
  {
    day: 2,
    title: "You are forgiven",
    reference: "Ephesians 1:7",
    text: "In whom we have redemption through his blood, the forgiveness of sins, according to the riches of his grace;",
    prompt: "Bring anything that weighs on you to God, and receive His forgiveness.",
  },
  {
    day: 3,
    title: "You are new",
    reference: "2 Corinthians 5:17",
    text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
    prompt: "What is one old habit you want to leave behind with God's help?",
  },
  {
    day: 4,
    title: "Talk with God",
    reference: "Matthew 7:7",
    text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:",
    prompt: "Spend five minutes in prayer. Talk to God like a friend who loves you.",
  },
  {
    day: 5,
    title: "Read His Word",
    reference: "2 Timothy 3:16",
    text: "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:",
    prompt: "Read John chapter 1. Write down one thing you learn about Jesus.",
  },
  {
    day: 6,
    title: "Be baptized",
    reference: "Romans 6:4",
    text: "Therefore we are buried with him by baptism into death: that like as Christ was raised up from the dead by the glory of the Father, even so we also should walk in newness of life.",
    prompt: "Ask a pastor about water baptism, the next step after salvation.",
  },
  {
    day: 7,
    title: "You belong",
    reference: "Hebrews 10:24-25",
    text: "And let us consider one another to provoke unto love and to good works: Not forsaking the assembling of ourselves together, as the manner of some is; but exhorting one another: and so much the more, as ye see the day approaching.",
    prompt: "Plan to be with your church family this Sunday, and invite someone to come with you.",
  },
];

export const DAILY_READINGS: readonly DailyReading[] = [
  {
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    read: "John 3",
    prompt: "Who in your life needs to hear about this love?",
  },
  {
    reference: "Romans 5:8",
    text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
    read: "Romans 5",
    prompt: "God loved you first. How does that change how you see today?",
  },
  {
    reference: "Ephesians 2:8-9",
    text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.",
    read: "Ephesians 2",
    prompt: "Thank God for a gift you could never earn.",
  },
  {
    reference: "Romans 10:9",
    text: "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.",
    read: "Romans 10",
    prompt: "Say out loud what you believe about Jesus.",
  },
  {
    reference: "2 Corinthians 5:17",
    text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
    read: "2 Corinthians 5",
    prompt: "What is God making new in you?",
  },
  {
    reference: "John 14:6",
    text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.",
    read: "John 14",
    prompt: "Where do you need Jesus to lead the way today?",
  },
  {
    reference: "Psalm 23:1",
    text: "The LORD is my shepherd; I shall not want.",
    read: "Psalm 23",
    prompt: "Rest in the care of the Good Shepherd.",
  },
  {
    reference: "Proverbs 3:5-6",
    text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    read: "Proverbs 3",
    prompt: "Hand one decision to God in prayer today.",
  },
  {
    reference: "Isaiah 40:31",
    text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    read: "Isaiah 40",
    prompt: "Ask God for strength for what is in front of you.",
  },
  {
    reference: "Philippians 4:6-7",
    text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    read: "Philippians 4",
    prompt: "Trade one worry for a prayer with thanksgiving.",
  },
  {
    reference: "Philippians 4:13",
    text: "I can do all things through Christ which strengtheneth me.",
    read: "Philippians 4",
    prompt: "Where do you need Christ's strength today?",
  },
  {
    reference: "Matthew 11:28",
    text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    read: "Matthew 11",
    prompt: "Bring what is heavy to Jesus.",
  },
  {
    reference: "Romans 8:28",
    text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    read: "Romans 8",
    prompt: "Thank God that He is at work, even when you can't see it.",
  },
  {
    reference: "Romans 8:38-39",
    text: "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come, Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.",
    read: "Romans 8",
    prompt: "Nothing can separate you from His love. Let that settle in.",
  },
  {
    reference: "Lamentations 3:22-23",
    text: "It is of the LORD'S mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    read: "Lamentations 3",
    prompt: "Start fresh today in His mercy.",
  },
  {
    reference: "Jeremiah 29:11",
    text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.",
    read: "Jeremiah 29",
    prompt: "Trust God with your future.",
  },
  {
    reference: "Psalm 119:105",
    text: "Thy word is a lamp unto my feet, and a light unto my path.",
    read: "Psalm 119:97-112",
    prompt: "Let one verse guide a step you take today.",
  },
  {
    reference: "Joshua 1:9",
    text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    read: "Joshua 1",
    prompt: "God goes with you. Where do you need courage?",
  },
  {
    reference: "1 John 1:9",
    text: "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.",
    read: "1 John 1",
    prompt: "Receive His forgiveness and walk in it.",
  },
  {
    reference: "John 10:10",
    text: "The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly.",
    read: "John 10",
    prompt: "Ask Jesus to fill today with His life.",
  },
  {
    reference: "Galatians 2:20",
    text: "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.",
    read: "Galatians 2",
    prompt: "How can Christ's life show through yours today?",
  },
  {
    reference: "Romans 12:2",
    text: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
    read: "Romans 12",
    prompt: "What thought do you want God to renew?",
  },
  {
    reference: "Matthew 6:33",
    text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    read: "Matthew 6",
    prompt: "Put God first in one choice today.",
  },
  {
    reference: "Hebrews 11:1",
    text: "Now faith is the substance of things hoped for, the evidence of things not seen.",
    read: "Hebrews 11",
    prompt: "What are you trusting God for?",
  },
  {
    reference: "Psalm 46:1",
    text: "God is our refuge and strength, a very present help in trouble.",
    read: "Psalm 46",
    prompt: "Run to God first today.",
  },
  {
    reference: "1 Peter 5:7",
    text: "Casting all your care upon him; for he careth for you.",
    read: "1 Peter 5",
    prompt: "Give God the care you are carrying.",
  },
  {
    reference: "Micah 6:8",
    text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    read: "Micah 6",
    prompt: "Show mercy to someone today.",
  },
  {
    reference: "Matthew 5:16",
    text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.",
    read: "Matthew 5",
    prompt: "How can you shine His light for someone today?",
  },
  {
    reference: "John 15:5",
    text: "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.",
    read: "John 15",
    prompt: "Stay close to Jesus through prayer today.",
  },
  {
    reference: "Psalm 37:4",
    text: "Delight thyself also in the LORD; and he shall give thee the desires of thine heart.",
    read: "Psalm 37",
    prompt: "Take a moment to enjoy God's presence.",
  },
  {
    reference: "2 Timothy 1:7",
    text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    read: "2 Timothy 1",
    prompt: "Pray against fear and receive His peace.",
  },
];

/** The calendar day in the church's time zone, as YYYY-MM-DD. */
export function churchDay(at: number, timeZone = "America/Chicago"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** The same reading for everyone on the same church day. */
export function dailyReading(at: number): DailyReading & { day: string } {
  const day = churchDay(at);
  const index = dayNumber(day) % DAILY_READINGS.length;
  const reading = DAILY_READINGS[index] ?? DAILY_READINGS[0];
  if (!reading) throw new Error("Daily readings are empty.");
  return { ...reading, day };
}

/**
 * Streak after reading on `today`. Reading twice the same day keeps the count.
 * Missing a day starts over at one.
 */
export function nextStreak(previous: { lastDay: string; count: number } | null, today: string): number {
  if (!previous) return 1;
  const gap = dayNumber(today) - dayNumber(previous.lastDay);
  if (gap === 0) return previous.count;
  if (gap === 1) return previous.count + 1;
  return 1;
}

/** A streak only counts if the last read was today or yesterday. */
export function currentStreak(previous: { lastDay: string; count: number } | null, today: string): number {
  if (!previous) return 0;
  const gap = dayNumber(today) - dayNumber(previous.lastDay);
  return gap === 0 || gap === 1 ? previous.count : 0;
}

/** A short line when a streak hits a mark. Not attributed to any person. */
export function streakEncouragement(count: number): string | null {
  if (count === 1) return "You opened the Word today.";
  if (count === 3) return "Three days in a row.";
  if (count === 7) return "A week of showing up.";
  if (count === 14) return "Two weeks. Keep going.";
  if (count === 21) return "Three weeks in the Word.";
  if (count === 30) return "Thirty days. This is a habit now.";
  if (count > 30 && count % 30 === 0) return `${count} days in a row.`;
  return null;
}

export function greeting(at: number, name: string | null, timeZone = "America/Chicago"): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(at)),
  );
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (first.length < 2 || first.toLowerCase() === "former") return hello;
  return `${hello}, ${first}`;
}

/**
 * Thirty days for someone who just said yes to Jesus. Days 1–7 match the
 * shorter journey. Every verse is KJV. Prompts are app copy, not a person's words.
 */
export const JOURNEY_MONTH: readonly JourneyDay[] = [
  ...NEW_BELIEVER_JOURNEY,
  {
    day: 8,
    title: "Hide the Word",
    reference: "Psalm 119:11",
    text: "Thy word have I hid in mine heart, that I might not sin against thee.",
    prompt: "Read the verse once more and carry one phrase into the day.",
  },
  {
    day: 9,
    title: "You belong to Him",
    reference: "John 1:12",
    text: "But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:",
    prompt: "Thank God that you are His.",
  },
  {
    day: 10,
    title: "No condemnation",
    reference: "Romans 8:1",
    text: "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.",
    prompt: "When shame shows up, answer it with this verse.",
  },
  {
    day: 11,
    title: "He loved first",
    reference: "1 John 4:19",
    text: "We love him, because he first loved us.",
    prompt: "Tell God you love Him, in your own words.",
  },
  {
    day: 12,
    title: "Taste and see",
    reference: "Psalm 34:8",
    text: "O taste and see that the LORD is good: blessed is the man that trusteth in him.",
    prompt: "Name one way God has been good to you.",
  },
  {
    day: 13,
    title: "Do not fear",
    reference: "Isaiah 41:10",
    text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
    prompt: "Hand God the fear that has been loudest.",
  },
  {
    day: 14,
    title: "His peace",
    reference: "John 14:27",
    text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.",
    prompt: "Sit quietly for a minute and receive His peace.",
  },
  {
    day: 15,
    title: "The God of hope",
    reference: "Romans 15:13",
    text: "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.",
    prompt: "Ask God to fill you with hope today.",
  },
  {
    day: 16,
    title: "Fruit of the Spirit",
    reference: "Galatians 5:22-23",
    text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, Meekness, temperance: against such there is no law.",
    prompt: "Ask the Spirit for one of these fruits in a real conversation today.",
  },
  {
    day: 17,
    title: "Be kind",
    reference: "Ephesians 4:32",
    text: "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you.",
    prompt: "Show kindness to one person on purpose.",
  },
  {
    day: 18,
    title: "He will finish",
    reference: "Philippians 1:6",
    text: "Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:",
    prompt: "Thank God that He started this and He will finish it.",
  },
  {
    day: 19,
    title: "Come boldly",
    reference: "Hebrews 4:16",
    text: "Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.",
    prompt: "Pray about a real need. You can come close.",
  },
  {
    day: 20,
    title: "Called into light",
    reference: "1 Peter 2:9",
    text: "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light:",
    prompt: "Thank God for calling you out of darkness.",
  },
  {
    day: 21,
    title: "Light of the world",
    reference: "Matthew 5:14",
    text: "Ye are the light of the world. A city that is set on an hill cannot be hid.",
    prompt: "How can you be a light for one neighbor today?",
  },
  {
    day: 22,
    title: "Witnesses",
    reference: "Acts 1:8",
    text: "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.",
    prompt: "Pray for one person who lives near you.",
  },
  {
    day: 23,
    title: "Work as for the Lord",
    reference: "Colossians 3:23",
    text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;",
    prompt: "Do one ordinary task today as for the Lord.",
  },
  {
    day: 24,
    title: "Ask for wisdom",
    reference: "James 1:5",
    text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.",
    prompt: "Ask God for wisdom about one decision.",
  },
  {
    day: 25,
    title: "My light",
    reference: "Psalm 27:1",
    text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?",
    prompt: "Say this verse out loud.",
  },
  {
    day: 26,
    title: "Love one another",
    reference: "John 15:12",
    text: "This is my commandment, That ye love one another, as I have loved you.",
    prompt: "Love someone the way Jesus has loved you.",
  },
  {
    day: 27,
    title: "A living offering",
    reference: "Romans 12:1",
    text: "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.",
    prompt: "Offer God this day before it starts running you.",
  },
  {
    day: 28,
    title: "Fullness of joy",
    reference: "Psalm 16:11",
    text: "Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore.",
    prompt: "Spend a few minutes just being with God.",
  },
  {
    day: 29,
    title: "Let it shine",
    reference: "Matthew 5:16",
    text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.",
    prompt: "Do one good thing a neighbor can see, for God's glory.",
  },
  {
    day: 30,
    title: "All things new",
    reference: "Revelation 21:5",
    text: "And he that sat upon the throne said, Behold, I make all things new. And he said unto me, Write: for these words are true and faithful.",
    prompt: "Thank Jesus that He makes things new, including you.",
  },
];
