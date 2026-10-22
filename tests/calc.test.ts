import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calcBreakdown, normalizeUsage } from "../lib/calc";
import { explainRule } from "../lib/rules";

const load = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
const run = (name: string) => {
  const f = load(name);
  return calcBreakdown(normalizeUsage(f), new Date(f.now));
};

describe("calcBreakdown", () => {
  it("under the cap: percent, headroom, days left, fresh data", () => {
    const r = run("under-cap");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const contacts = r.items.find((i) => i.id === "active_profiles")!;
    expect(contacts.percent).toBe(84.2);
    expect(contacts.headroom).toBe(1580);
    expect(contacts.status).toBe("near");
    expect(contacts.line).toContain("8,420 of 10,000 contacts (84.2%)");
    expect(r.daysLeft).toBe(10);
    expect(r.stale).toBe(false);
    expect(r.notes).toEqual([]);
  });

  it("over the cap is flagged with the overage", () => {
    const r = run("at-cap");
    if (!r.ok) throw new Error("expected ok");
    const contacts = r.items.find((i) => i.id === "active_profiles")!;
    expect(contacts.status).toBe("over");
    expect(contacts.headroom).toBe(-140);
    expect(contacts.line).toContain("140 over the plan limit");
  });

  it("old reading adds the 72-hour note", () => {
    const r = run("after-cleanup");
    if (!r.ok) throw new Error("expected ok");
    expect(r.stale).toBe(true);
    expect(r.dataAgeHours).toBe(42);
    expect(r.notes[0]).toContain("72 hours");
  });

  it("missing active_profiles is not guessed", () => {
    const r = calcBreakdown(
      normalizeUsage([{ id: "email_sends", attributes: { usage_used: 1, usage_max: 2, unit: "messages" } }]),
      new Date("2026-10-22T00:00:00Z"),
    );
    expect(r).toMatchObject({ ok: false, reason: "no_active_profiles" });
  });

  it("empty or malformed input returns no_data", () => {
    expect(calcBreakdown(normalizeUsage(null), new Date())).toMatchObject({ ok: false, reason: "no_data" });
    expect(calcBreakdown(normalizeUsage({ data: [{ id: "x", attributes: { usage_used: "a" } }] }), new Date())).toMatchObject({
      ok: false,
      reason: "no_data",
    });
  });

  it("zero cap does not divide by zero; period already ended gives 0 days", () => {
    const r = calcBreakdown(
      [{ id: "active_profiles", used: 5, max: 0, unit: "profiles", periodStart: "2026-09-01T00:00:00Z", periodEnd: "2026-10-01T00:00:00Z", asOf: "2026-10-22T00:00:00Z" }],
      new Date("2026-10-22T01:00:00Z"),
    );
    if (!r.ok) throw new Error("expected ok");
    expect(r.items[0].percent).toBe(0);
    expect(r.daysLeft).toBe(0);
  });

  it("never states a dollar amount: items measured in USD are left out", () => {
    const r = calcBreakdown(
      normalizeUsage([
        { id: "active_profiles", usage_used: 0, usage_max: 250, unit: "profiles", period_end: "2026-11-01T00:00:00Z" },
        { id: "sms_credits", usage_used: 0, usage_max: 5, unit: "USD" },
      ]),
      new Date("2026-10-22T00:00:00Z"),
    );
    if (!r.ok) throw new Error("expected ok");
    expect(r.items.map((i) => i.id)).toEqual(["active_profiles"]);
    expect(JSON.stringify(r)).not.toMatch(/USD|\$/);
  });

  it("uses plain merchant words for every item a live account reports", () => {
    const ids = ["reviews_orders", "k_social_active_profiles", "customer_hub_active_profiles", "ai_credits"];
    const r = calcBreakdown(
      normalizeUsage([
        { id: "active_profiles", usage_used: 0, usage_max: 250, unit: "profiles" },
        ...ids.map((id) => ({ id, usage_used: 0, usage_max: 10, unit: "profiles" })),
      ]),
      new Date("2026-10-22T00:00:00Z"),
    );
    if (!r.ok) throw new Error("expected ok");
    const labels = r.items.filter((i) => ids.includes(i.id)).map((i) => i.label);
    expect(labels).toEqual(["review orders", "social contacts", "customer hub contacts", "AI credits"]);
  });

  it("accepts flat items as well as wrapped ones", () => {
    const items = normalizeUsage([{ id: "active_profiles", usage_used: 1, usage_max: 2, unit: "profiles" }]);
    expect(items[0]).toMatchObject({ id: "active_profiles", used: 1, max: 2 });
  });
});

describe("explainRule", () => {
  it("returns text and a source for known topics", () => {
    expect(explainRule("text_unsubscribe")?.source).toMatch(/^https:\/\/help\.klaviyo\.com/);
  });
  it("returns null for unknown topics", () => {
    expect(explainRule("nope")).toBeNull();
  });
});
