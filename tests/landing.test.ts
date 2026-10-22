import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../app/layout";
import Home from "../app/page";
import { ASSISTANTS, ONBOARDING_SENTENCE } from "../lib/onboarding";

const BANNED_WORDS = /\b(api|token|mcp|oauth|json|repo|demo|sample)\b/i;
const visibleText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

describe("landing page", () => {
  const html = renderToStaticMarkup(createElement(Home));

  it("shows the one sentence the user pastes into their assistant", () => {
    expect(html).toContain(ONBOARDING_SENTENCE.replace(/&/g, "&amp;"));
  });

  it("lists every supported assistant", () => {
    for (const assistant of ASSISTANTS) expect(html).toContain(assistant.name);
  });

  it("uses no technical words a non-technical merchant would not know", () => {
    expect(visibleText(html)).not.toMatch(BANNED_WORDS);
  });

  it("points assistants that open the page to the instructions file", () => {
    const page = renderToStaticMarkup(createElement(RootLayout, null, createElement(Home)));
    expect(page).toContain('rel="llms.txt"');
    expect(html).toContain("/llms.txt");
  });
});

describe("onboarding sentence", () => {
  it("points at an instructions file that tells the assistant to connect before answering", () => {
    expect(ONBOARDING_SENTENCE).toContain("/llms.txt");
    const instructions = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
    expect(instructions).toContain("/api/start");
    expect(instructions).toContain("/api/usage");
    expect(instructions).not.toMatch(/demo|sample data/i);
  });
});

describe("not-found page", () => {
  it("points a lost assistant to llms.txt", async () => {
    const { default: NotFound } = await import("../app/not-found");
    expect(renderToStaticMarkup(createElement(NotFound))).toContain("/llms.txt");
  });
});
