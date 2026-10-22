import { calcBreakdown, normalizeUsage } from "@/lib/calc";
import { getUsage } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { logError } from "@/lib/log";
import { usageText } from "@/lib/text";

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
const MISSING_SESSION = "The session code is missing. Start again from the beginning to get a sign-in link.";
const NOT_CONFIGURED = "The billing helper is not set up yet. Tell the user it is temporarily unavailable. Do not give any numbers.";

// Real account data only. Without a finished sign-in this returns a message and no numbers.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session");
  if (!sessionId) return new Response(MISSING_SESSION, { status: 400, headers: TEXT_HEADERS });

  try {
    const result = await getUsage(liveDeps(), sessionId);
    const text = result.kind === "ok" ? usageText({ kind: "ok", breakdown: calcBreakdown(normalizeUsage(result.raw), new Date()) }) : usageText({ kind: result.kind });
    return new Response(text, { status: result.kind === "not_connected" ? 401 : 200, headers: TEXT_HEADERS });
  } catch (error) {
    logError("api usage", {}, error);
    return new Response(NOT_CONFIGURED, { status: 503, headers: TEXT_HEADERS });
  }
}
