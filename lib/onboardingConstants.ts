/** Beginner flow: curated tickers that exist in the replay dataset. */
export const STARTER_TICKERS = ["HBL", "HUBC", "OGDC", "PSO"] as const;

export type StarterTicker = (typeof STARTER_TICKERS)[number];

/** Plain-language blurbs; avoids repeating formal issuer descriptions. */
export const STARTER_BLURBS: Record<StarterTicker, string> = {
  HBL: "A well-known bank - a familiar name while you learn how buying works.",
  HUBC: "A major power company - many investors use it to understand steady, large businesses.",
  OGDC: "A big energy producer - useful for seeing how a core sector moves.",
  PSO: "Pakistan's main fuel supplier - easy to relate to day to day.",
};

export const ONBOARDING_GOALS = [
  {
    id: "grow",
    title: "Grow savings",
    description: "I want to practice growing money over time.",
  },
  {
    id: "income",
    title: "Dividend income",
    description: "I am curious about payouts companies sometimes make.",
  },
  {
    id: "learn",
    title: "Learn the market",
    description: "I want to learn how PSX works before anything else.",
  },
] as const;

export type GoalId = (typeof ONBOARDING_GOALS)[number]["id"];

export const PRACTICE_AMOUNTS = [5_000, 10_000, 25_000, 50_000] as const;
