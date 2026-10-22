import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { disconnect, getUsage, handleCallback, startConnect, type Deps } from "../lib/connector";
import { memoryStore } from "../lib/store";

const SECRET = "client-secret-xyz";
const config = {
  clientId: "cid",
  clientSecret: SECRET,
  redirectUri: "https://app.example/api/connect/callback",
  tokenKey: randomBytes(32).toString("base64"),
  scopes: "usage:read",
  revision: "2026-10-15",
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const usageBody = { data: [{ id: "active_profiles", attributes: { usage_used: 1, usage_max: 2, unit: "profiles" } }] };

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  let t = 1_000_000;
  const d: Deps = {
    store: memoryStore(),
    config,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return handler(url, init);
    }) as typeof fetch,
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
  };
  return { d, calls, advance: (ms: number) => (t += ms) };
}

async function connected(handler: Parameters<typeof setup>[0]) {
  const s = setup(handler);
  const { connectUrl, sessionId } = await startConnect(s.d);
  const state = new URL(connectUrl).searchParams.get("state")!;
  const res = await handleCallback(s.d, { code: "abc", state });
  expect(res.kind).toBe("connected");
  return { ...s, sessionId, state, connectUrl };
}

const tokenOk = { access_token: "AT1", refresh_token: "RT1", expires_in: 3600 };

describe("startConnect", () => {
  it("builds a PKCE S256 URL with read-only scope and random state", async () => {
    const { d } = setup(() => json(200, {}));
    const a = await startConnect(d);
    const b = await startConnect(d);
    const u = new URL(a.connectUrl);
    expect(u.origin + u.pathname).toBe("https://www.klaviyo.com/oauth/authorize");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toBe("usage:read");
    expect(u.searchParams.get("client_secret")).toBeNull();
    expect(u.searchParams.get("state")).not.toBe(new URL(b.connectUrl).searchParams.get("state"));
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});

describe("handleCallback", () => {
  it("exchanges the code with Basic auth and the stored verifier, then encrypts tokens", async () => {
    const s = await connected((url) => (url.endsWith("/oauth/token") ? json(200, tokenOk) : json(404, {})));
    const call = s.calls[0];
    expect(call.url).toBe("https://a.klaviyo.com/oauth/token");
    expect((call.init.headers as Record<string, string>).Authorization).toBe(
      "Basic " + Buffer.from(`cid:${SECRET}`).toString("base64"),
    );
    const body = new URLSearchParams(call.init.body as string);
    expect(body.get("code_verifier")!.length).toBeGreaterThanOrEqual(43);
    expect(body.get("grant_type")).toBe("authorization_code");
    // Nothing stored in plain text
    const stored = await s.d.store.get(
      `merchant:${(await import("node:crypto")).createHash("sha256").update(s.sessionId).digest("hex")}`,
    );
    expect(stored).not.toContain("AT1");
    expect(stored).not.toContain("RT1");
  });

  it("denied consent connects nothing", async () => {
    const s = setup(() => json(200, tokenOk));
    const { connectUrl, sessionId } = await startConnect(s.d);
    const state = new URL(connectUrl).searchParams.get("state")!;
    expect((await handleCallback(s.d, { state, error: "access_denied" })).kind).toBe("denied");
    expect(s.calls).toHaveLength(0);
    expect((await getUsage(s.d, sessionId)).kind).toBe("not_connected");
  });

  it("rejects unknown, missing and replayed state", async () => {
    const s = setup(() => json(200, tokenOk));
    expect((await handleCallback(s.d, { code: "c", state: "nope" })).kind).toBe("invalid");
    expect((await handleCallback(s.d, { code: "c" })).kind).toBe("invalid");
    const { connectUrl } = await startConnect(s.d);
    const state = new URL(connectUrl).searchParams.get("state")!;
    expect((await handleCallback(s.d, { code: "c", state })).kind).toBe("connected");
    expect((await handleCallback(s.d, { code: "c", state })).kind).toBe("invalid");
  });

  it("a started sign-in that nobody finished yet is waiting_for_allow", async () => {
    const s = setup(() => json(200, {}));
    const { sessionId } = await startConnect(s.d);
    expect((await getUsage(s.d, sessionId)).kind).toBe("waiting_for_allow");
  });

  it("a sign-in link left unused for 10 minutes goes back to not_connected", async () => {
    vi.useFakeTimers();
    try {
      const s = setup(() => json(200, {}));
      const { sessionId } = await startConnect(s.d);
      vi.advanceTimersByTime(601_000);
      expect((await getUsage(s.d, sessionId)).kind).toBe("not_connected");
    } finally {
      vi.useRealTimers();
    }
  });

  it("expired state (after 10 minutes) is invalid", async () => {
    vi.useFakeTimers();
    try {
      const s = setup(() => json(200, tokenOk));
      const { connectUrl } = await startConnect(s.d);
      vi.advanceTimersByTime(601_000);
      const state = new URL(connectUrl).searchParams.get("state")!;
      expect((await handleCallback(s.d, { code: "c", state })).kind).toBe("invalid");
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalid_grant on code exchange means the code expired", async () => {
    const s = setup(() => json(400, { error: "invalid_grant" }));
    const { connectUrl } = await startConnect(s.d);
    const state = new URL(connectUrl).searchParams.get("state")!;
    expect((await handleCallback(s.d, { code: "c", state })).kind).toBe("expired");
  });
});

describe("getUsage", () => {
  it("reads usage with the bearer token and revision header", async () => {
    const s = await connected((url) => (url.endsWith("/oauth/token") ? json(200, tokenOk) : json(200, usageBody)));
    const r = await getUsage(s.d, s.sessionId);
    expect(r).toMatchObject({ kind: "ok" });
    const call = s.calls.at(-1)!;
    expect(call.url).toBe("https://a.klaviyo.com/api/billing-usage");
    expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer AT1");
    expect((call.init.headers as Record<string, string>).revision).toBe("2026-10-15");
  });

  it("unknown session is not_connected", async () => {
    const { d } = setup(() => json(200, {}));
    expect((await getUsage(d, "nobody")).kind).toBe("not_connected");
  });

  it("refreshes once when the access token is expired", async () => {
    let refreshes = 0;
    const s = await connected((url, init) => {
      if (url.endsWith("/oauth/token")) {
        if (new URLSearchParams(init.body as string).get("grant_type") === "refresh_token") {
          refreshes++;
          return json(200, { access_token: "AT2", refresh_token: "RT2", expires_in: 3600 });
        }
        return json(200, tokenOk);
      }
      return json(200, usageBody);
    });
    s.advance(3600 * 1000);
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("ok");
    expect(refreshes).toBe(1);
    expect((s.calls.at(-1)!.init.headers as Record<string, string>).Authorization).toBe("Bearer AT2");
  });

  it("invalid_grant on refresh marks needs_reauth and stops", async () => {
    const s = await connected((url, init) => {
      if (url.endsWith("/oauth/token")) {
        return new URLSearchParams(init.body as string).get("grant_type") === "refresh_token"
          ? json(400, { error: "invalid_grant", error_description: "RT1 revoked" })
          : json(200, tokenOk);
      }
      return json(200, usageBody);
    });
    s.advance(3600 * 1000);
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("needs_reauth");
    const before = s.calls.length;
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("needs_reauth");
    expect(s.calls.length).toBe(before); // no further network calls, no loop
  });

  it("a 401 triggers exactly one refresh and one retry, not a loop", async () => {
    let usageCalls = 0;
    const s = await connected((url, init) => {
      if (url.endsWith("/oauth/token")) {
        return json(200, new URLSearchParams(init.body as string).get("grant_type") === "refresh_token" ? { access_token: "AT2", refresh_token: "RT2", expires_in: 3600 } : tokenOk);
      }
      usageCalls++;
      return json(401, {});
    });
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("error");
    expect(usageCalls).toBe(2);
  });

  it("429 honors Retry-After, retries twice at most, then rate_limited", async () => {
    let usageCalls = 0;
    const s = await connected((url) => {
      if (url.endsWith("/oauth/token")) return json(200, tokenOk);
      usageCalls++;
      return json(429, {}, { "retry-after": "2" });
    });
    const t0 = s.d.now();
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("rate_limited");
    expect(usageCalls).toBe(3);
    expect(s.d.now() - t0).toBe(4000);
  });

  it("maps 403 and 404", async () => {
    for (const [status, kind] of [[403, "forbidden"], [404, "not_found"]] as const) {
      const s = await connected((url) => (url.endsWith("/oauth/token") ? json(200, tokenOk) : json(status, {})));
      expect((await getUsage(s.d, s.sessionId)).kind).toBe(kind);
    }
  });
});

describe("disconnect", () => {
  it("revokes at a.klaviyo.com and deletes the record", async () => {
    const s = await connected((url) => (url.endsWith("/oauth/token") ? json(200, tokenOk) : json(200, {})));
    expect((await disconnect(s.d, s.sessionId)).kind).toBe("disconnected");
    const revoke = s.calls.find((c) => c.url.endsWith("/oauth/revoke"))!;
    expect(revoke.url).toBe("https://a.klaviyo.com/oauth/revoke");
    expect(new URLSearchParams(revoke.init.body as string).get("token")).toBe("RT1");
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("not_connected");
  });

  it("still deletes locally when revoke fails", async () => {
    const s = await connected((url) => (url.endsWith("/oauth/token") ? json(200, tokenOk) : json(500, {})));
    expect((await disconnect(s.d, s.sessionId)).kind).toBe("disconnected");
    expect((await getUsage(s.d, s.sessionId)).kind).toBe("not_connected");
  });
});
