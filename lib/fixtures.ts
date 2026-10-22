import underCap from "../fixtures/under-cap.json";
import atCap from "../fixtures/at-cap.json";
import afterCleanup from "../fixtures/after-cleanup.json";

export const FIXTURES = {
  "under-cap": underCap,
  "at-cap": atCap,
  "after-cleanup": afterCleanup,
} as const;

export type FixtureName = keyof typeof FIXTURES;
