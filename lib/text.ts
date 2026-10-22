import type { Breakdown } from "./calc";
import { STATE_TTL_SECONDS, type UsageResult } from "./connector";
import { RULES, explainRule } from "./rules";

// Plain-text answers for assistants that can only open web addresses. Every reply is
// written so the assistant can relay it to a merchant without technical words.

type NotOkUsage = Exclude<UsageResult["kind"], "ok">;

const PROBLEM_MESSAGES: Record<NotOkUsage, string> = {
  waiting_for_allow:
    "The user has not pressed Allow yet. Ask them to open the same sign-in link and press Allow, then tell you 'done'. Do not give any numbers until then.",
  not_connected:
    "Not connected. The sign-in link has timed out or was never started. Start over from the beginning to get a fresh sign-in link and show it to the user. Do not give any numbers.",
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
    `The link works for ${LINK_MINUTES} minutes and only once. If it times out, start over from the beginning for a fresh one.`,
    "",
    "Then ask the user to tell you 'done'. Keep this code for the next step (do not show it to the user):",
    `Session code: ${sessionId}`,
    "",
    "Step 2 of 2. After 'done', open /api/usage?session=<the session code above> on the same website and explain what it says.",
    "Speak in plain words only. No technical terms.",
  ].join("\n");
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const SECONDS_PER_MINUTE = 60;
const LINK_MINUTES = STATE_TTL_SECONDS / SECONDS_PER_MINUTE;
const ISO_MINUTES_LENGTH = "2026-10-22T06:00".length;
const NO_INVOICE_NOTE = "These are plan usage numbers only. Invoice amounts are not visible here.";

const formatDay = (iso: string) => MONTH_FORMAT.format(new Date(iso));

// Klaviyo sometimes omits the dates; a missing period is left out rather than shown as "Invalid Date".
function periodLine(breakdown: { periodStart: string; periodEnd: string }): string[] {
  const hasDates = Number.isFinite(Date.parse(breakdown.periodStart)) && Number.isFinite(Date.parse(breakdown.periodEnd));
  return hasDates ? [`Billing period: ${formatDay(breakdown.periodStart)} to ${formatDay(breakdown.periodEnd)}.`] : [];
}

// An exact time, because "about 0 hours ago" reads like a defect.
function dataTimeLine(asOf: string): string[] {
  if (!Number.isFinite(Date.parse(asOf))) return [];
  const stamp = new Date(asOf).toISOString().slice(0, ISO_MINUTES_LENGTH).replace("T", " ");
  return [`Data as of ${stamp} UTC.`];
}

function breakdownText(breakdown: Breakdown): string {
  if (!breakdown.ok) return breakdown.message;
  return [
    ...breakdown.items.map((item) => item.line),
    ...periodLine(breakdown),
    `Days left in this billing period: ${breakdown.daysLeft}.`,
    ...dataTimeLine(breakdown.asOf),
    ...breakdown.notes,
    NO_INVOICE_NOTE,
  ].join("\n");
}

export function usageText(result: { kind: "ok"; breakdown: Breakdown } | { kind: NotOkUsage }): string {
  return result.kind === "ok" ? breakdownText(result.breakdown) : PROBLEM_MESSAGES[result.kind];
}

// Says where the rule comes from so the assistant does not present it as its own knowledge.
export function ruleText(topic: string): string {
  const rule = explainRule(topic);
  if (!rule) return `Unknown topic. Use one of: ${Object.keys(RULES).join(", ")}.`;
  return `${rule.text}\nThis rule comes from Klaviyo's help pages: ${rule.source}`;
}
