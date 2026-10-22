import { startConnect } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { logError } from "@/lib/log";

export async function POST() {
  try {
    const { connectUrl, sessionId } = await startConnect(liveDeps());
    return Response.json({ connect_url: connectUrl, session_id: sessionId });
  } catch (error) {
    logError("connect start", {}, error);
    return Response.json({ error: "connector_not_configured" }, { status: 503 });
  }
}
