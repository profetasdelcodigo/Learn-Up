import { describe, expect, it } from "vitest";
import {
  getToolDefinition,
  isReadOnlyTool,
  normalizeToolName,
  shouldExecuteTool,
} from "./tool-contract";

describe("tool contract", () => {
  it("normalizes legacy calendar and group names", () => {
    expect(normalizeToolName("create_calendar_event")).toBe("add_calendar_event");
    expect(normalizeToolName("create_group")).toBe("create_study_group");
  });

  it("allows parallel research/page tools", () => {
    expect(getToolDefinition("browse_web_page").supportsParallel).toBe(true);
    expect(getToolDefinition("search_web").supportsParallel).toBe(true);
  });

  it("keeps destructive operations behind confirmation", () => {
    expect(shouldExecuteTool("delete_calendar_event", "manual", true)).toBe("pending_confirmation");
    expect(shouldExecuteTool("delete_calendar_event", "autopilot", true)).toBe("pending_confirmation");
  });

  it("allows read-only tools in autopilot", () => {
    expect(isReadOnlyTool("search_web")).toBe(true);
    expect(shouldExecuteTool("search_web", "autopilot", true)).toBe("execute");
  });

  it("denies every tool when backend permission is missing", () => {
    expect(shouldExecuteTool("search_web", "autopilot", false)).toBe("deny");
  });
});
