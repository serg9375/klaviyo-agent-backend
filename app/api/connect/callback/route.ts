import { handleCallback } from "@/lib/connector";
import { liveDeps } from "@/lib/deps";
import { renderResultPage, type ResultKind } from "@/lib/callback-page";
import { logError } from "@/lib/log";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let kind: ResultKind = "error";
  try {
    kind = (await handleCallback(liveDeps(), { code: params.get("code"), state: params.get("state"), error: params.get("error") })).kind;
  } catch (error) {
    logError("connect callback", { hasState: params.has("state") }, error);
  }
  return new Response(renderResultPage(kind),
    { status: kind === "connected" || kind === "denied" ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
