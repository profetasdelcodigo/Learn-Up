import { describe, expect, it } from "vitest";
import { aiRegistry } from "@/lib/ai/skills";
import { getToolDefinition } from "@/lib/ai/tool-contract";
import { AI_AGENT_REGISTRY } from "@/lib/ai/agent-registry";

describe("Learn Up AI skills", () => {
  it("registers the universal skill packs", () => {
    const skillIds = aiRegistry.getAllSkills().map((skill) => skill.id).sort();
    expect(skillIds).toEqual([
      "analytics",
      "calendar",
      "chat",
      "content_generation",
      "education",
      "knowledge-graph",
      "library",
      "multimedia",
      "research",
      "social",
    ]);
  });

  it("has schema + executor + safe policy for every registered tool", () => {
    const tools = aiRegistry.getAllTools();
    expect(tools.length).toBeGreaterThan(50);
    const ids = new Set<string>();

    for (const tool of tools) {
      expect(tool.id).toBeTruthy();
      expect(ids.has(tool.id)).toBe(false);
      ids.add(tool.id);
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeTruthy();
      expect(typeof tool.execute).toBe("function");
      expect(["read", "write", "destructive"].includes(tool.risk)).toBe(true);
      expect(typeof tool.requiresConfirmation).toBe("boolean");
      expect(typeof tool.supportsAutopilot).toBe("boolean");
      if (tool.risk === "destructive") {
        expect(tool.requiresConfirmation).toBe(true);
        expect(tool.supportsAutopilot).toBe(false);
      }
    }
  });

  it("keeps every conversational role available", () => {
    expect(Object.keys(AI_AGENT_REGISTRY)).toEqual(expect.arrayContaining([
      "profesor",
      "examenes",
      "consejero",
      "nutrirecetas",
      "jarvis",
    ]));
  });

  it("exposes the complete registry to every conversational role", async () => {
    const { buildToolsForAgent } = await import("@/lib/ai/tool-definitions");
    const registeredIds = aiRegistry.getAllTools().map((tool) => tool.id);
    for (const [agentId, agent] of Object.entries(AI_AGENT_REGISTRY)) {
      const exposed = buildToolsForAgent(agent.tools, false, "00000000-0000-0000-0000-000000000000", agentId, []);
      for (const id of registeredIds) expect(exposed[id], `${agentId} missing ${id}`).toBeDefined();
    }
  });

  it("keeps the policy catalog resolvable for every registered tool", () => {
    for (const tool of aiRegistry.getAllTools()) {
      const definition = getToolDefinition(tool.id);
      expect(definition.id).toBe(tool.id);
      expect(definition.schema).toBe(tool.schema);
      if (tool.risk !== "read") expect(definition.requiresConfirmation).toBe(true);
    }
  });
});
