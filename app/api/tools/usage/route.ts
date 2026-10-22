import { calcBreakdown, normalizeUsage } from "@/lib/calc";
import { getUsage } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";

// Body: { session_id: string }. Real account data only; there is no sample mode.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { session_id?: string };
  if (!body.session_id) return Response.json({ error: "bad_request" }, { status: 400 });

  const result = await getUsage(liveDeps(), body.session_id);
  if (result.kind !== "ok") return Response.json({ status: result.kind }, { status: result.kind === "not_connected" ? 401 : 200 });
  return Response.json({ status: "ok", breakdown: calcBreakdown(normalizeUsage(result.raw), new Date()) });
}
