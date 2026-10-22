import { MCP_TOOLS } from "./mcp";

const TOOL_PATHS: Record<string, string> = {
  get_usage: "/api/tools/usage",
  explain_rule: "/api/tools/rule",
  connect_link: "/api/connect/start",
  disconnect: "/api/disconnect",
};

// Built from MCP_TOOLS so the REST description cannot drift from the MCP tool list.
export function buildOpenApi(baseUrl: string) {
  const paths = Object.fromEntries(
    MCP_TOOLS.map((tool) => [
      TOOL_PATHS[tool.name],
      {
        post: {
          operationId: tool.name,
          description: tool.description,
          requestBody: { required: true, content: { "application/json": { schema: tool.inputSchema } } },
          responses: { "200": { description: "Tool result as JSON" } },
        },
      },
    ]),
  );
  return {
    openapi: "3.1.0",
    info: { title: "Klaviyo billing connector", version: "0.1.0", description: "Read-only tools that explain a Klaviyo bill in plain numbers." },
    servers: [{ url: baseUrl }],
    paths,
  };
}
