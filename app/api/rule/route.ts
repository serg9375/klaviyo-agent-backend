import { RULES } from "@/lib/rules";
import { ruleText } from "@/lib/text";

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

// GET twin of /api/tools/rule: the payload is a fixed topic list, and assistants that cannot POST still need it.
export async function GET(request: Request) {
  const topic = new URL(request.url).searchParams.get("topic") ?? "";
  return new Response(ruleText(topic), { status: topic in RULES ? 200 : 404, headers: TEXT_HEADERS });
}
