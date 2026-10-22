import type { Breakdown } from "./calc";
import type { UsageResult } from "./connector";

// Plain-text answers for assistants that can only open web addresses. Every reply is
// written so the assistant can relay it to a merchant without technical words.

type NotOkUsage = Exclude<UsageResult["kind"], "ok">;

const PROBLEM_MESSAGES: Record<NotOkUsage, string> = {
  not_connected:
    "Not connected yet. Ask the user to open the sign-in link and press Allow, then try again. Do not give any numbers until then.",
  needs_reauth:
    "The connection to Klaviyo ended. Ask the user to start over from the beginning to sign in again. Do not give any numbers.",
  forbidden:
    "Klaviyo did not allow reading billing numbers for this account. Tell the user this account cannot be read, and offer a summary for Klaviyo support.",
  not_found: "Klaviyo has no billing numbers for this account. Tell the user that plainly. Do not guess.",
  rate_limited: "Klaviyo asked us to slow down. Ask the user to wait a minute and ask again.",
  error: "Something went wrong while reading the numbers. Ask the user to try again in a minute. Do not guess numbers.",
};

export function startText(connectUrl: string, sessionId: string): string {
  return [
    "Step 1 of 2. Give the user this sign-in link and ask them to open it and press Allow. It is Klaviyo's own page, read-only, and it never shows a password to you.",
    "",
    `Sign-in link: ${connectUrl}`,
    "",
    "Then ask the user to tell you 'done'. Keep this code for the next step (do not show it to the user):",
    `Session code: ${sessionId}`,
    "",
    "Step 2 of 2. After 'done', open /api/usage?session=<the session code above> on the same website and explain what it says.",
    "Speak in plain words only. No technical terms.",
  ].join("\n");
}

function breakdownText(breakdown: Breakdown): string {
  if (!breakdown.ok) return breakdown.message;
  return [
    ...breakdown.items.map((item) => item.line),
    `Days left in this billing period: ${breakdown.daysLeft}.`,
    `Data last updated about ${breakdown.dataAgeHours} hours ago.`,
    ...breakdown.notes,
  ].join("\n");
}

export function usageText(result: { kind: "ok"; breakdown: Breakdown } | { kind: NotOkUsage }): string {
  return result.kind === "ok" ? breakdownText(result.breakdown) : PROBLEM_MESSAGES[result.kind];
}
