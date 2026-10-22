import { describe, expect, it } from "vitest";
import { handleMcpMessage, type ToolCaller } from "../lib/mcp";

const echoCaller: ToolCaller = async (name, args) => ({ status: 200, body: { name, args } });

describe("handleMcpMessage", () => {
  it("lists the four network tools with input schemas", async () => {
    const reply = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, echoCaller);
    const names = reply?.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(["get_usage", "explain_rule", "connect_link", "disconnect"]);
    expect(reply?.result.tools.every((tool: { inputSchema: unknown }) => tool.inputSchema)).toBe(true);
  });

  it("returns tool output as text content on success", async () => {
    const reply = await handleMcpMessage(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "explain_rule", arguments: { topic: "count_delay" } } },
      echoCaller,
    );
    expect(reply?.result.isError).toBe(false);
    expect(JSON.parse(reply?.result.content[0].text)).toEqual({ name: "explain_rule", args: { topic: "count_delay" } });
  });

  it("flags a failing tool response as an error the model can read", async () => {
    const failing: ToolCaller = async () => ({ status: 404, body: { error: "unknown_topic" } });
    const reply = await handleMcpMessage(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "explain_rule", arguments: { topic: "nope" } } },
      failing,
    );
    expect(reply?.result.isError).toBe(true);
    expect(reply?.result.content[0].text).toContain("unknown_topic");
  });

  it("rejects an unknown tool with a JSON-RPC error", async () => {
    const reply = await handleMcpMessage(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "handoff", arguments: {} } },
      echoCaller,
    );
    expect(reply?.error.code).toBe(-32602);
  });

  it("answers initialize with the tools capability", async () => {
    const reply = await handleMcpMessage({ jsonrpc: "2.0", id: 5, method: "initialize", params: {} }, echoCaller);
    expect(reply?.result.capabilities).toHaveProperty("tools");
  });

  it("sends no reply to a notification", async () => {
    const reply = await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, echoCaller);
    expect(reply).toBeNull();
  });
});
