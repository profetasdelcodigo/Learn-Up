import { describe, expect, it } from "vitest";
import { getToolDefinition, shouldExecuteTool } from "./tool-contract";
import { parseToolCalls } from "./tool-parser";

describe("tool contract", () => {
  it("uses the canonical calendar tool name", () => {
    const tool = getToolDefinition("add_calendar_event");
    expect(tool?.name).toBe("add_calendar_event");
    expect(getToolDefinition("create_calendar_event")).toBeNull();
  });

  it("blocks confirmation-required writes in manual mode", () => {
    const tool = getToolDefinition("add_calendar_event");
    expect(tool).not.toBeNull();
    expect(shouldExecuteTool(tool!, "manual", tool!.risk, ["ai.tools.execute"])).toBe("pending_confirmation");
  });

  it("allows safe read-only tools in autopilot", () => {
    const tool = getToolDefinition("search_web");
    expect(shouldExecuteTool(tool!, "autopilot", tool!.risk, ["ai.tools.execute"])).toBe("execute");
  });

  it("denies execution without backend permission", () => {
    const tool = getToolDefinition("search_web");
    expect(shouldExecuteTool(tool!, "autopilot", tool!.risk, [])).toBe("deny");
  });
});

describe("tool parser", () => {
  it("extracts multiple actions and removes internal syntax from visible text", () => {
    const raw = `Voy a revisar esto.\n\n{\"tool\":\"search_web\",\"args\":{\"query\":\"Perú noticias\"}}\n{\"tool\":\"search_web\",\"args\":{\"query\":\"Lima hoy\"}}`;
    const parsed = parseToolCalls(raw);
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.cleanText).not.toContain('"tool"');
    expect(parsed.cleanText).toContain("Voy a revisar esto.");
  });
});
