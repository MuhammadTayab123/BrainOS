import { describe, expect, it } from "vitest";

import { createToolRegistry } from "../../src/services/tools/tool.container";

describe("Task tool registration", () => {
  it("registers all task tools", () => {
    const registry = createToolRegistry();

    expect(registry.has("create_task")).toBe(true);
    expect(registry.has("list_tasks")).toBe(true);
    expect(registry.has("get_task")).toBe(true);
    expect(registry.has("update_task")).toBe(true);
    expect(registry.has("complete_task")).toBe(true);
    expect(registry.has("delete_task")).toBe(true);
  });

  it("exposes the expected create_task definition", () => {
    const registry = createToolRegistry();

    const tool = registry.get("create_task");

    expect(tool).toBeDefined();
    expect(tool?.name).toBe("create_task");
    expect(tool?.description).toContain("authenticated BrainOS user");
    expect(tool?.parameters).toMatchObject({
      type: "object",
      required: ["title"],
    });
  });
});
