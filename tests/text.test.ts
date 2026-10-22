import { describe, expect, it } from "vitest";
import { calcBreakdown, normalizeUsage } from "../lib/calc";
import { ruleText, startText, usageText } from "../lib/text";

const BANNED_WORDS = /\b(api|token|mcp|oauth|json|demo|sample)\b/i;

const usage = {
  data: [
    {
      id: "active_profiles",
      attributes: {
        usage_used: 8000,
        usage_max: 10000,
        unit: "profiles",
        period_start: "2026-10-01T00:00:00Z",
        period_end: "2026-11-01T00:00:00Z",
        as_of: "2026-10-22T06:00:00Z",
      },
    },
  ],
};
const NOW = new Date("2026-10-22T12:00:00Z");

describe("startText", () => {
  it("gives the sign-in link and the session id, and says what to do next", () => {
    const text = startText("https://klaviyo.example/authorize?x=1", "SESSION123");
    expect(text).toContain("https://klaviyo.example/authorize?x=1");
    expect(text).toContain("SESSION123");
    expect(text).toMatch(/done/i);
  });

  it("tells the assistant not to use technical words with the user", () => {
    expect(startText("https://klaviyo.example/a", "S")).toMatch(/plain words/i);
  });
});

describe("usageText", () => {
  it("reports real numbers for a connected account", () => {
    const breakdown = calcBreakdown(normalizeUsage(usage), NOW);
    const text = usageText({ kind: "ok", breakdown });
    expect(text).toContain("8,000 of 10,000");
    expect(text).toContain("80%");
    expect(text).toMatch(/days? left/i);
  });

  it("names the billing period and the exact time of the data", () => {
    const text = usageText({ kind: "ok", breakdown: calcBreakdown(normalizeUsage(usage), NOW) });
    expect(text).toContain("Billing period: 1 Oct to 1 Nov.");
    expect(text).toContain("Data as of 2026-10-22 06:00 UTC.");
  });

  it("says the numbers are plan usage, not invoice amounts", () => {
    const text = usageText({ kind: "ok", breakdown: calcBreakdown(normalizeUsage(usage), NOW) });
    expect(text).toMatch(/invoice amounts are not visible/i);
  });

  it("leaves out the billing period when Klaviyo did not send its dates", () => {
    const withoutPeriod = { data: [{ ...usage.data[0], attributes: { ...usage.data[0].attributes, period_start: undefined } }] };
    const text = usageText({ kind: "ok", breakdown: calcBreakdown(normalizeUsage(withoutPeriod), NOW) });
    expect(text).not.toContain("Billing period");
  });

  it("tells the assistant to wait for Allow, not to restart, when sign-in is pending", () => {
    const text = usageText({ kind: "waiting_for_allow" });
    expect(text).toMatch(/press Allow/i);
    expect(text).not.toMatch(/start (again|over)/i);
  });

  it("tells the assistant to start over when the link or code is no longer valid", () => {
    expect(usageText({ kind: "not_connected" })).toMatch(/start over from the beginning/i);
  });

  it("asks to connect again, without any numbers, when sign-in is not finished", () => {
    const text = usageText({ kind: "not_connected" });
    expect(text).toMatch(/not connected/i);
    expect(text).not.toMatch(/\d{2,}/);
  });

  it("states how long the sign-in link works", () => {
    expect(startText("https://klaviyo.example/a", "S")).toMatch(/10 minutes/);
  });

  it.each(["waiting_for_allow", "needs_reauth", "forbidden", "not_found", "rate_limited", "error"] as const)(
    "gives a plain-words message for %s and never invents numbers",
    (kind) => {
      const text = usageText({ kind });
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/\d{2,}/);
      expect(text).not.toMatch(BANNED_WORDS);
    },
  );

  it("says plainly when the account has no usable billing data", () => {
    const breakdown = calcBreakdown([], NOW);
    expect(usageText({ kind: "ok", breakdown })).toContain("No billing usage");
  });
});

describe("ruleText", () => {
  it("gives the rule, says it comes from Klaviyo's help pages, and links the source", () => {
    const text = ruleText("count_delay");
    expect(text).toMatch(/72 hours/);
    expect(text).toMatch(/Klaviyo's help pages/);
    expect(text).toContain("https://help.klaviyo.com/");
  });

  it("lists the known topics when the topic is unknown, so the assistant can retry", () => {
    expect(ruleText("nope")).toContain("emailable_counts");
  });
});
