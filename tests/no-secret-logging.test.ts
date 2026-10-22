import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const roots = ["lib", "app"];
const SENSITIVE = /(access_token|refresh_token|accessToken|refreshToken|client_secret|clientSecret|code_verifier|verifier|authorization|tokenKey|TOKEN_KEY)/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

describe("logging", () => {
  it("no console call mentions a sensitive field", () => {
    const offenders: string[] = [];
    for (const f of roots.flatMap((r) => files(fileURLToPath(new URL(`../${r}`, import.meta.url))))) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/console\.\w+\(/.test(line) && SENSITIVE.test(line)) offenders.push(`${f}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
