import { handleCallback } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { logError } from "@/lib/log";

const MESSAGES = {
  connected: ["Connected", "Go back to your chat and tell your assistant: done. You can close this page."],
  denied: ["Nothing was connected", "You chose not to allow access, so there is nothing to show yet. Go back to your chat if you change your mind."],
  expired: ["That link expired", "Go back to your chat and ask to connect again."],
  invalid: ["That link is not valid", "Go back to your chat and ask to connect again."],
  error: ["Something went wrong", "Nothing was connected. Go back to your chat and try again."],
} as const;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let kind: keyof typeof MESSAGES = "error";
  try {
    kind = (await handleCallback(liveDeps(), { code: params.get("code"), state: params.get("state"), error: params.get("error") })).kind;
  } catch (error) {
    logError("connect callback", { hasState: params.has("state") }, error);
  }
  const [title, body] = MESSAGES[kind];
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px system-ui,sans-serif;padding:24px;max-width:480px;margin:auto"><h1>${title}</h1><p>${body}</p>`,
    { status: kind === "connected" || kind === "denied" ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
