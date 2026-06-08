export const GATEWAY =
  process.env.NEXT_PUBLIC_SHELBY_GATEWAY || "https://gateway.shelby.network";

export const FEED_CATEGORIES = [
  "Graphic Design",
  "3D Art",
  "UI/UX",
  "Photography",
  "Motion Design",
  "Illustration",
  "Audio",
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number];
