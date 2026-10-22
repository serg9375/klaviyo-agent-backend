import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../lib/mcp";
import { buildOpenApi } from "../lib/openapi";

describe("buildOpenApi", () => {
  it("describes every MCP tool as a POST operation named after the tool", () => {
    const spec = buildOpenApi("https://example.test");
    const operationIds = Object.values(spec.paths).map((path) => path.post.operationId);
    expect(operationIds.sort()).toEqual(MCP_TOOLS.map((tool) => tool.name).sort());
  });

  it("points servers at the given base url", () => {
    expect(buildOpenApi("https://example.test").servers[0].url).toBe("https://example.test");
  });
});
