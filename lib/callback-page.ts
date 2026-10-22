export type ResultKind = "connected" | "denied" | "expired" | "invalid" | "error";

const PAGES: Record<ResultKind, { title: string; body: string; isGood: boolean }> = {
  connected: { title: "Connected", body: "Go back to your chat and tell your assistant:", isGood: true },
  denied: { title: "Nothing was connected", body: "You chose not to allow access, so there is nothing to show yet. Go back to your chat if you change your mind.", isGood: false },
  expired: { title: "That link expired", body: "Go back to your chat and ask to connect again.", isGood: false },
  invalid: { title: "That link is not valid", body: "Go back to your chat and ask to connect again.", isGood: false },
  error: { title: "Something went wrong", body: "Nothing was connected. Go back to your chat and try again.", isGood: false },
};

// Same colors as the landing page; inline because this page is a plain response, not a React page.
const STYLE = `
:root{--bg:#eeefe9;--card:#fff;--ink:#151515;--muted:#5b5d54;--line:#d0d1c9;--good:#1f9d55;--warn:#e0791a}
@media(prefers-color-scheme:dark){:root{--bg:#1d1f27;--card:#2a2c36;--ink:#f4f4f1;--muted:#a9acb8;--line:#3e4250}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.card{width:100%;max-width:440px;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 3px 0 var(--line);padding:36px 24px}
.icon{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:grid;place-items:center;font-size:32px;font-weight:700;color:#fff}
.good{background:var(--good)}.warn{background:var(--warn)}
h1{margin:0 0 8px;font-size:1.6rem;letter-spacing:-.02em}
p{margin:0;color:var(--muted)}
.say{display:inline-block;margin:16px 0 8px;padding:8px 22px;border-radius:999px;font:700 1.3rem ui-monospace,Menlo,monospace;color:#fff;background:linear-gradient(90deg,#0457ff,#ff5c1c)}
.close{font-size:.85rem}
`;

export function renderResultPage(kind: ResultKind): string {
  const { title, body, isGood } = PAGES[kind];
  const extra = isGood ? `<div class="say">done</div><p class="close">Then you can close this page.</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${STYLE}</style></head><body><main class="card"><div class="icon ${isGood ? "good" : "warn"}">${isGood ? "✓" : "!"}</div><h1>${title}</h1><p>${body}</p>${extra}</main></body></html>`;
}
