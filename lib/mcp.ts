const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "klaviyo-billing", version: "0.1.0" };
const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;

// `handoff` is absent on purpose: it makes no network call and lives in the skill text.
export const MCP_TOOLS = [
  {
    name: "get_usage",
    description:
      "Read the merchant's connected account and get a ready breakdown (percent of limit, room left, days left, data age). Real data only; connect first.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string", description: "Returned by connect_link." } },
      required: ["session_id"],
    },
  },
  {
    name: "explain_rule",
    description: "Documented billing rule in plain words, with a source link.",
    inputSchema: {
      type: "object",
      properties: { topic: { type: "string", enum: ["emailable_counts", "stopped_contacts", "text_unsubscribe", "count_delay"] } },
      required: ["topic"],
    },
  },
  {
    name: "connect_link",
    description: "Start a read-only connection. Returns connect_url for the merchant to open and a session_id to keep.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "disconnect",
    description: "Remove the connection and delete stored access.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
];

export type ToolCaller = (name: string, args: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;

type JsonRpcRequest = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };

function success(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function callTool(request: JsonRpcRequest, caller: ToolCaller) {
  const name = String(request.params?.name ?? "");
  if (!MCP_TOOLS.some((tool) => tool.name === name)) return failure(request.id, INVALID_PARAMS, `Unknown tool: ${name}`);

  const { status, body } = await caller(name, (request.params?.arguments ?? {}) as Record<string, unknown>);
  return success(request.id, { isError: status >= 400, content: [{ type: "text", text: JSON.stringify(body) }] });
}

// Stateless: every request is answered on its own, so it runs on serverless without sessions.
export async function handleMcpMessage(request: JsonRpcRequest, caller: ToolCaller) {
  if (request.id === undefined) return null;

  switch (request.method) {
    case "initialize":
      return success(request.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case "ping":
      return success(request.id, {});
    case "tools/list":
      return success(request.id, { tools: MCP_TOOLS });
    case "tools/call":
      return callTool(request, caller);
    default:
      return failure(request.id, METHOD_NOT_FOUND, `Method not found: ${request.method}`);
  }
}
