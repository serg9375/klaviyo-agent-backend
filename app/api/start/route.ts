import { startConnect } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { logError } from "@/lib/log";
import { startText } from "@/lib/text";

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
const NOT_CONFIGURED = "The billing helper is not set up yet. Tell the user it is temporarily unavailable. Do not give any numbers.";

// GET so an assistant that can only open web addresses can start the sign-in.
export async function GET() {
  try {
    const { connectUrl, sessionId } = await startConnect(liveDeps());
    return new Response(startText(connectUrl, sessionId), { headers: TEXT_HEADERS });
  } catch (error) {
    logError("api start", {}, error);
    return new Response(NOT_CONFIGURED, { status: 503, headers: TEXT_HEADERS });
  }
}
