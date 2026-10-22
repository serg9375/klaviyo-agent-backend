import { calcBreakdown, normalizeUsage } from "@/lib/calc";
import { getUsage } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { FIXTURES, FixtureName } from "@/lib/fixtures";

// Body: { source: "demo", fixture?: string } or { source: "live", session_id: string }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { source?: string; fixture?: string; session_id?: string };

  if (body.source === "demo") {
    const fixture = FIXTURES[(body.fixture as FixtureName) ?? "under-cap"] ?? FIXTURES["under-cap"];
    return Response.json({ source: "demo", company: fixture.company, breakdown: calcBreakdown(normalizeUsage(fixture), new Date(fixture.now)) });
  }

  if (body.source === "live" && body.session_id) {
    const result = await getUsage(liveDeps(), body.session_id);
    if (result.kind !== "ok") return Response.json({ source: "live", status: result.kind }, { status: result.kind === "not_connected" ? 401 : 200 });
    return Response.json({ source: "live", status: "ok", breakdown: calcBreakdown(normalizeUsage(result.raw), new Date()) });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}
