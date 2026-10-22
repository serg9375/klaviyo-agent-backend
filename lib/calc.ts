// Pure billing math. No network, no LLM. The assistant only explains what this returns.

export interface UsageItem {
  id: string;
  used: number;
  max: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  asOf: string;
}

export type ItemStatus = "ok" | "near" | "over";

export interface BreakdownItem {
  id: string;
  label: string;
  used: number;
  max: number;
  unit: string;
  percent: number;
  headroom: number; // negative when over the cap
  status: ItemStatus;
  line: string;
}

export type Breakdown =
  | {
      ok: true;
      items: BreakdownItem[];
      daysLeft: number;
      dataAgeHours: number;
      stale: boolean;
      asOf: string;
      periodStart: string;
      periodEnd: string;
      notes: string[];
    }
  | { ok: false; reason: "no_active_profiles" | "no_data"; message: string };

const ACTIVE_PROFILES_ID = "active_profiles";
const NEAR_PERCENT = 80;
const MAX_CATCHUP_HOURS = 72;
const STALE_HOURS = 36; // active_profiles refreshes about twice a day
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const LABELS: Record<string, string> = {
  active_profiles: "contacts you can email",
  email_sends: "emails sent",
  sms_credits: "text message credits",
  reviews_orders: "review orders",
  k_social_active_profiles: "social contacts",
  customer_hub_active_profiles: "customer hub contacts",
  ai_credits: "AI credits",
};

// The skill promises never to state dollar amounts, so money-denominated items are not reported.
const MONEY_UNIT = "USD";

const UNIT_WORDS: Record<string, string> = {
  profiles: "contacts",
  messages: "emails",
  credits: "credits",
};

// Klaviyo returns JSON:API-style items: { id, attributes: { usage_used, ... } }.
// The wrapper shape is read from the reference examples; flat items are accepted too.
export function normalizeUsage(raw: unknown): UsageItem[] {
  const list = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const items: UsageItem[] = [];
  for (const entry of list) {
    const record = entry as Record<string, unknown> | null;
    if (typeof record?.id !== "string") continue;
    const fields = (record.attributes ?? record) as Record<string, unknown>;
    const used = Number(fields.usage_used);
    const max = Number(fields.usage_max);
    if (!Number.isFinite(used) || !Number.isFinite(max)) continue;
    items.push({
      id: record.id,
      used,
      max,
      unit: String(fields.unit ?? ""),
      periodStart: String(fields.period_start ?? ""),
      periodEnd: String(fields.period_end ?? ""),
      asOf: String(fields.as_of ?? ""),
    });
  }
  return items;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function describe(item: UsageItem): BreakdownItem {
  const percent = item.max > 0 ? Math.round((item.used / item.max) * 1000) / 10 : 0;
  const headroom = item.max - item.used;
  const status: ItemStatus = item.used > item.max ? "over" : percent >= NEAR_PERCENT ? "near" : "ok";
  const label = LABELS[item.id] ?? item.id.replace(/_/g, " ");
  const word = UNIT_WORDS[item.unit] ?? item.unit;
  let line = `${label}: ${formatCount(item.used)} of ${formatCount(item.max)} ${word} (${percent}%).`;
  if (status === "over") line += ` That is ${formatCount(-headroom)} over the plan limit.`;
  else line += ` ${formatCount(headroom)} left before the limit.`;
  return { id: item.id, label, used: item.used, max: item.max, unit: item.unit, percent, headroom, status, line };
}

export function calcBreakdown(items: UsageItem[], now: Date): Breakdown {
  if (items.length === 0) {
    return { ok: false, reason: "no_data", message: "No billing usage was returned for this account." };
  }
  const active = items.find((i) => i.id === ACTIVE_PROFILES_ID);
  if (!active) {
    return {
      ok: false,
      reason: "no_active_profiles",
      message: "The contacts you can email are not reported for this account.",
    };
  }

  const end = Date.parse(active.periodEnd);
  const daysLeft = Number.isFinite(end) ? Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS)) : 0;

  const asOfMs = Date.parse(active.asOf);
  const dataAgeHours = Number.isFinite(asOfMs)
    ? Math.max(0, Math.round(((now.getTime() - asOfMs) / HOUR_MS) * 10) / 10)
    : 0;
  const stale = dataAgeHours > STALE_HOURS;

  const notes: string[] = [];
  if (stale) {
    notes.push(
      `This reading is ${Math.round(dataAgeHours)} hours old. Contacts you stopped recently may not show yet; it can take up to ${MAX_CATCHUP_HOURS} hours.`,
    );
  }

  return {
    ok: true,
    items: items.filter((i) => i.unit !== MONEY_UNIT).map(describe),
    daysLeft,
    dataAgeHours,
    stale,
    asOf: active.asOf,
    periodStart: active.periodStart,
    periodEnd: active.periodEnd,
    notes,
  };
}
