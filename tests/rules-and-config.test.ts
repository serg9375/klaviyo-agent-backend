import { describe, expect, it } from "vitest";
import { configFromEnv } from "../lib/klaviyo";
import { explainRule } from "../lib/rules";

describe("explainRule", () => {
  it("returns text and source for a known topic", () => {
    expect(explainRule("count_delay")?.source).toMatch(/^https:\/\//);
  });

  it("returns null for an unknown topic", () => {
    expect(explainRule("nope")).toBeNull();
  });
});

describe("configFromEnv", () => {
  const env = {
    KLAVIYO_CLIENT_ID: "id",
    KLAVIYO_CLIENT_SECRET: "secret",
    KLAVIYO_REDIRECT_URI: "https://app.example/cb",
    TOKEN_KEY: "key",
  };

  it("applies defaults for optional vars", () => {
    expect(configFromEnv(env).scopes).toBe("usage:read");
  });

  it("throws naming the missing var", () => {
    expect(() => configFromEnv({ ...env, TOKEN_KEY: undefined })).toThrow("Missing env TOKEN_KEY");
  });
});
