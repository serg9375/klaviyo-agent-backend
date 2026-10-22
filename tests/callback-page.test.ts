import { describe, expect, it } from "vitest";
import { renderResultPage } from "../lib/callback-page";

const BANNED_WORDS = /\b(api|token|mcp|oauth|json|demo|sample)\b/i;
const visibleText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

describe("renderResultPage", () => {
  it("tells a connected merchant to say done in their chat", () => {
    const html = renderResultPage("connected");
    expect(html).toContain("Connected");
    expect(html).toMatch(/done/);
  });

  it.each(["connected", "denied", "expired", "invalid", "error"] as const)("is a complete phone-friendly page without technical words for %s", (kind) => {
    const html = renderResultPage(kind);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("viewport");
    expect(visibleText(html)).not.toMatch(BANNED_WORDS);
  });
});
