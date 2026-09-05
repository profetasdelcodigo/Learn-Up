import { describe, expect, it } from "vitest";
import { aiRegistry } from "../skills";

const EXPECTED: Record<string, number> = {
  calendar: 27,
  chat: 25,
  library: 22,
  "knowledge-graph": 15,
  content: 22,
  multimedia: 15,
  research: 18,
  analytics: 14,
  social: 17,
  education: 20,
};

describe("Learn Up skill registry", () => {
  it("registers all 10 packs with the specified tool counts", () => {
    const skills = aiRegistry.getAllSkills();
    expect(skills).toHaveLength(10);
    for (const [id, expectedCount] of Object.entries(EXPECTED)) {
      const skill = aiRegistry.getSkill(id);
      expect(skill, `Missing skill ${id}`).toBeDefined();
      expect(skill!.tools).toHaveLength(expectedCount);
    }
  });

  it("does not contain duplicate tool ids", () => {
    const tools = aiRegistry.getAllTools();
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks destructive actions for confirmation and never autopilots them", () => {
    for (const tool of aiRegistry.getAllTools()) {
      if (tool.risk === "destructive") {
        expect(tool.requiresConfirmation).toBe(true);
        expect(tool.supportsAutopilot).toBe(false);
      }
    }
  });
});
