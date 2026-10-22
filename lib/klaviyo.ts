import { createHash, randomBytes } from "node:crypto";
import { logError } from "./log";

const DEFAULT_SCOPES = "usage:read";
const DEFAULT_REVISION = "2026-10-15";
const RANDOM_TOKEN_BYTES = 32;
const PKCE_VERIFIER_BYTES = 48; // 64 chars, inside the 43-128 PKCE range
const DEFAULT_RETRY_AFTER_SECONDS = 1;

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string; // base64, 32 bytes
  scopes: string; // space separated
  revision: string;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): Config {
  const requireEnv = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing env ${name}`);
    return value;
  };
  return {
    clientId: requireEnv("KLAVIYO_CLIENT_ID"),
    clientSecret: requireEnv("KLAVIYO_CLIENT_SECRET"),
    redirectUri: requireEnv("KLAVIYO_REDIRECT_URI"),
    tokenKey: requireEnv("TOKEN_KEY"),
    scopes: env.KLAVIYO_SCOPES ?? DEFAULT_SCOPES,
    revision: env.KLAVIYO_REVISION ?? DEFAULT_REVISION,
  };
}

export const AUTHORIZE_URL = "https://www.klaviyo.com/oauth/authorize";
// Token and revoke must go through a.klaviyo.com (www blocked since 2025-03-31).
export const API_BASE = "https://a.klaviyo.com";

export function randomToken(bytes = RANDOM_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(PKCE_VERIFIER_BYTES)
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(config: Config, state: string, challenge: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

export class KlaviyoError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(`Klaviyo error ${status} ${code}`); // never include response bodies: they can echo tokens
  }
}

type Fetch = typeof fetch;

function basic(config: Config): string {
  return "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

async function tokenCall(config: Config, body: Record<string, string>, fetchFn: Fetch): Promise<TokenResponse> {
  const res = await fetchFn(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basic(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    let code = "token_error";
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch (error) {
      logError("tokenCall", { status: res.status }, error);
    }
    throw new KlaviyoError(res.status, code);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(config: Config, code: string, verifier: string, fetchFn: Fetch = fetch) {
  return tokenCall(
    config,
    { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUri },
    fetchFn,
  );
}

export function refreshToken(config: Config, refreshValue: string, fetchFn: Fetch = fetch) {
  return tokenCall(config, { grant_type: "refresh_token", refresh_token: refreshValue }, fetchFn);
}

export async function revokeToken(config: Config, refreshValue: string, fetchFn: Fetch = fetch): Promise<void> {
  const res = await fetchFn(`${API_BASE}/oauth/revoke`, {
    method: "POST",
    headers: { Authorization: basic(config), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token_type_hint: "refresh_token", token: refreshValue }).toString(),
  });
  if (!res.ok) throw new KlaviyoError(res.status, "revoke_error");
}

/** Single call, no retry loop. Caller decides about refresh and 429. */
export async function fetchBillingUsage(config: Config, accessToken: string, fetchFn: Fetch = fetch): Promise<unknown> {
  const res = await fetchFn(`${API_BASE}/api/billing-usage`, {
    headers: { Authorization: `Bearer ${accessToken}`, revision: config.revision, accept: "application/vnd.api+json" },
  });
  if (res.status === 429) throw new KlaviyoError(429, "rate_limited", Number(res.headers.get("retry-after") ?? DEFAULT_RETRY_AFTER_SECONDS));
  if (!res.ok) throw new KlaviyoError(res.status, res.status === 401 ? "unauthorized" : "api_error");
  return res.json();
}
