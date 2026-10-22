"use client";

import { useState } from "react";

const COPIED_MS = 2000;

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // Clipboard is blocked in some in-app browsers; the text stays selectable on the button.
      setState("failed");
    }
    setTimeout(() => setState("idle"), COPIED_MS);
  }

  return (
    <button type="button" className="copy" onClick={copy}>
      <span className="copy-text">{text}</span>
      <span className="copy-label" aria-live="polite">
        {state === "copied" ? "Copied ✓" : state === "failed" ? "Select the text and copy it" : "Copy"}
      </span>
    </button>
  );
}
