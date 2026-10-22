import { createHash } from "node:crypto";
import { decrypt, encrypt } from "./crypto";
import {
  Config,
  KlaviyoError,
  authorizeUrl,
  exchangeCode,
  fetchBillingUsage,
  pkcePair,
  randomToken,
  refreshToken,
  revokeToken,
} from "./klaviyo";
import { logError } from "./log";
import type { Store } from "./store";

export interface Deps {
  store: Store;
  config: Config;
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

type Status = "active" | "needs_reauth";

interface MerchantRecord {
  status: Status;
  scopes: string;
  accessEnc?: string;
  refreshEnc?: string;
  accessExpiresAt?: number;
  connectedAt: number;
  lastUsedAt: number;
}

export const STATE_TTL_SECONDS = 600;
const MAX_429_RETRIES = 2;
const REFRESH_LOCK_TTL_SECONDS = 10;
const LOCK_WAIT_MS = 500;
const TOKEN_EXPIRY_SKEW_MS = 60_000;
const MAX_RETRY_WAIT_MS = 5000;
const DEFAULT_RETRY_AFTER_SECONDS = 1;
const MS_PER_SECOND = 1000;

// The session id is a bearer held by the assistant. Only its hash is used as a storage key.
const hashSession = (sessionId: string) => createHash("sha256").update(sessionId).digest("hex");
const merchantKey = (sessionId: string) => `merchant:${hashSession(sessionId)}`;
// Lives as long as the sign-in link, so "link not used yet" can be told apart from "start over".
const pendingKey = (sessionId: string) => `pending:${hashSession(sessionId)}`;

async function load(deps: Deps, sessionId: string): Promise<MerchantRecord | null> {
  const raw = await deps.store.get(merchantKey(sessionId));
  return raw ? (JSON.parse(raw) as MerchantRecord) : null;
}
const save = (deps: Deps, sessionId: string, record: MerchantRecord) =>
  deps.store.set(merchantKey(sessionId), JSON.stringify(record));

export async function startConnect(deps: Deps): Promise<{ connectUrl: string; sessionId: string }> {
  const sessionId = randomToken();
  const state = randomToken();
  const { verifier, challenge } = pkcePair();
  await deps.store.set(`state:${state}`, JSON.stringify({ verifier, sessionId }), STATE_TTL_SECONDS);
  await deps.store.set(pendingKey(sessionId), "1", STATE_TTL_SECONDS);
  return { connectUrl: authorizeUrl(deps.config, state, challenge), sessionId };
}

export type CallbackResult =
  | { kind: "connected" }
  | { kind: "denied" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "error" };

export async function handleCallback(
  deps: Deps,
  params: { code?: string | null; state?: string | null; error?: string | null },
): Promise<CallbackResult> {
  if (!params.state) return { kind: "invalid" };
  const raw = await deps.store.take(`state:${params.state}`); // single use
  if (!raw) return { kind: "invalid" };
  const { verifier, sessionId } = JSON.parse(raw) as { verifier: string; sessionId: string };
  await deps.store.del(pendingKey(sessionId));
  if (params.error === "access_denied") return { kind: "denied" };
  if (params.error || !params.code) return { kind: "error" };
  try {
    const tokens = await exchangeCode(deps.config, params.code, verifier, deps.fetch);
    const now = deps.now();
    await save(deps, sessionId, {
      status: "active",
      scopes: tokens.scope ?? deps.config.scopes,
      accessEnc: encrypt(tokens.access_token, deps.config.tokenKey),
      refreshEnc: encrypt(tokens.refresh_token, deps.config.tokenKey),
      accessExpiresAt: now + tokens.expires_in * MS_PER_SECOND,
      connectedAt: now,
      lastUsedAt: now,
    });
    return { kind: "connected" };
  } catch (error) {
    if (error instanceof KlaviyoError && error.code === "invalid_grant") return { kind: "expired" };
    logError("handleCallback", { merchant: merchantKey(sessionId) }, error);
    return { kind: "error" };
  }
}

export type UsageResult =
  | { kind: "ok"; raw: unknown }
  | { kind: "not_connected" } // never started, link expired, or already disconnected
  | { kind: "waiting_for_allow" } // link issued, Allow not pressed yet
  | { kind: "needs_reauth" }
  | { kind: "forbidden" } // scope missing (403)
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "error" };

/** Refresh once. Returns the usable access token, or null when the connection ended. */
async function refresh(deps: Deps, sessionId: string, record: MerchantRecord): Promise<string | null> {
  const hasLock = await deps.store.lock(`lock:${merchantKey(sessionId)}`, REFRESH_LOCK_TTL_SECONDS);
  if (!hasLock) {
    // Someone else is refreshing (refresh cap is 10/min). Use whatever they stored.
    await deps.sleep(LOCK_WAIT_MS);
    const fresh = await load(deps, sessionId);
    return fresh?.status === "active" && fresh.accessEnc ? decrypt(fresh.accessEnc, deps.config.tokenKey) : null;
  }
  try {
    const tokens = await refreshToken(deps.config, decrypt(record.refreshEnc!, deps.config.tokenKey), deps.fetch);
    await save(deps, sessionId, {
      ...record,
      accessEnc: encrypt(tokens.access_token, deps.config.tokenKey),
      // Klaviyo may rotate the refresh token; keep the old one if none is returned.
      refreshEnc: tokens.refresh_token ? encrypt(tokens.refresh_token, deps.config.tokenKey) : record.refreshEnc,
      accessExpiresAt: deps.now() + tokens.expires_in * MS_PER_SECOND,
    });
    return tokens.access_token;
  } catch (error) {
    if (!(error instanceof KlaviyoError && error.code === "invalid_grant")) throw error;
    // Treat as uninstall: drop tokens, ask the merchant to reconnect.
    await save(deps, sessionId, {
      status: "needs_reauth",
      scopes: record.scopes,
      connectedAt: record.connectedAt,
      lastUsedAt: deps.now(),
    });
    return null;
  }
}

async function fetchUsage(deps: Deps, sessionId: string, initial: MerchantRecord): Promise<UsageResult> {
  let access: string | null = decrypt(initial.accessEnc!, deps.config.tokenKey);
  if ((initial.accessExpiresAt ?? 0) - TOKEN_EXPIRY_SKEW_MS < deps.now()) {
    access = await refresh(deps, sessionId, initial);
    if (!access) return { kind: "needs_reauth" };
  }
  let hasRefreshed = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = await fetchBillingUsage(deps.config, access!, deps.fetch);
      const latest = (await load(deps, sessionId)) ?? initial;
      await save(deps, sessionId, { ...latest, lastUsedAt: deps.now() });
      return { kind: "ok", raw };
    } catch (error) {
      if (!(error instanceof KlaviyoError)) throw error;
      if (error.status === 401 && !hasRefreshed) {
        hasRefreshed = true;
        access = await refresh(deps, sessionId, initial);
        if (!access) return { kind: "needs_reauth" };
        continue;
      }
      if (error.status === 429) {
        if (attempt >= MAX_429_RETRIES) return { kind: "rate_limited" };
        await deps.sleep(Math.min((error.retryAfter ?? DEFAULT_RETRY_AFTER_SECONDS) * MS_PER_SECOND, MAX_RETRY_WAIT_MS));
        continue;
      }
      if (error.status === 403) return { kind: "forbidden" };
      if (error.status === 404) return { kind: "not_found" };
      throw error;
    }
  }
}

export async function getUsage(deps: Deps, sessionId: string): Promise<UsageResult> {
  const record = await load(deps, sessionId);
  if (!record) return (await deps.store.get(pendingKey(sessionId))) ? { kind: "waiting_for_allow" } : { kind: "not_connected" };
  if (record.status === "needs_reauth" || !record.accessEnc || !record.refreshEnc) return { kind: "needs_reauth" };
  try {
    return await fetchUsage(deps, sessionId, record);
  } catch (error) {
    logError("getUsage", { merchant: merchantKey(sessionId) }, error);
    return { kind: "error" };
  }
}

export async function disconnect(deps: Deps, sessionId: string): Promise<{ kind: "disconnected" | "not_connected" }> {
  const record = await load(deps, sessionId);
  if (!record) return { kind: "not_connected" };
  if (record.refreshEnc) {
    try {
      await revokeToken(deps.config, decrypt(record.refreshEnc, deps.config.tokenKey), deps.fetch);
    } catch (error) {
      // Best effort: we still delete our copy. Merchant can also remove the app in Klaviyo.
      logError("disconnect revoke", { merchant: merchantKey(sessionId) }, error);
    }
  }
  await deps.store.del(merchantKey(sessionId));
  return { kind: "disconnected" };
}
