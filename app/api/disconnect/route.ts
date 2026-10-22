import { disconnect } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";

export async function POST(request: Request) {
  const { session_id } = (await request.json().catch(() => ({}))) as { session_id?: string };
  if (!session_id) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await disconnect(liveDeps(), session_id));
}
