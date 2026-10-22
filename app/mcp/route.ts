import { POST as startConnect } from "@/app/api/connect/start/route";
import { POST as disconnect } from "@/app/api/disconnect/route";
import { POST as getRule } from "@/app/api/tools/rule/route";
import { POST as getUsage } from "@/app/api/tools/usage/route";
import { handleMcpMessage, type ToolCaller } from "@/lib/mcp";

const PARSE_ERROR = -32700;

// Reuses the REST handlers so MCP and REST can never disagree on behavior.
const HANDLERS: Record<string, (request: Request) => Promise<Response>> = {
  get_usage: getUsage,
  explain_rule: getRule,
  connect_link: startConnect,
  disconnect,
};

const callRestHandler: ToolCaller = async (name, args) => {
  const response = await HANDLERS[name](new Request("http://internal", { method: "POST", body: JSON.stringify(args) }));
  return { status: response.status, body: await response.json() };
};

export async function POST(request: Request) {
  const message = await request.json().catch(() => null);
  if (!message) return Response.json({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Invalid JSON" } }, { status: 400 });

  const reply = await handleMcpMessage(message, callRestHandler);
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

// Streamable HTTP clients probe GET for a server-push stream; this server has none.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
