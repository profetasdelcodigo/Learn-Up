import { describe, expect, it } from "vitest";
import { parseToolCalls } from "./tool-parser";

describe("parseToolCalls", () => {
  it("parses a single textual tool call and removes its protocol", () => {
    const result = parseToolCalls('Necesito actuar. tool {"tool":"add_calendar_event","args":{"title":"Estudiar","date":"2026-08-27"}}');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe("add_calendar_event");
    expect(result.actions[0].requiresConfirm).toBe(true);
    expect(result.cleanText).not.toContain("tool {");
    expect(result.cleanText).not.toContain('"args"');
  });

  it("parses multiple tool calls in one response", () => {
    const result = parseToolCalls(
      'tool {"tool":"search_web","args":{"query":"A"}}\n' +
      'tool {"tool":"search_web","args":{"query":"B"}}\n' +
      'tool {"tool":"browse_web_page","args":{"url":"https://example.com"}}',
    );
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map(a => a.tool)).toEqual([
      "search_web",
      "search_web",
      "browse_web_page",
    ]);
  });

  it("ignores unknown tools instead of exposing raw JSON", () => {
    const result = parseToolCalls('tool {"tool":"non_existing_tool","args":{}}');
    expect(result.actions).toHaveLength(0);
  });
});
