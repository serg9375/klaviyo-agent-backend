import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/crypto";

const key = randomBytes(32).toString("base64");

describe("crypto", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt("secret", key), key)).toBe("secret");
  });

  it("rejects a wrong-length key when decrypting", () => {
    const blob = encrypt("secret", key);
    expect(() => decrypt(blob, randomBytes(16).toString("base64"))).toThrow("TOKEN_KEY must be 32 bytes");
  });

  it("rejects a wrong-length key when encrypting", () => {
    expect(() => encrypt("secret", "short")).toThrow("TOKEN_KEY must be 32 bytes");
  });

  it("fails on a different valid key", () => {
    expect(() => decrypt(encrypt("secret", key), randomBytes(32).toString("base64"))).toThrow();
  });
});
