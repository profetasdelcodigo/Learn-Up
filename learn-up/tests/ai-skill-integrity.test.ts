import { describe, expect, it } from "vitest";
import { aiRegistry } from "@/lib/ai/skills";
import { buildToolsForAgent } from "@/lib/ai/tool-definitions";
import { AI_AGENT_REGISTRY } from "@/lib/ai/agent-registry";

describe("Learn Up AI skills", () => {
  it("registers all universal skill packs", () => {
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

  it("has a real executor and schema for every registered tool", () => {
    const tools = aiRegistry.getAllTools();
    expect(tools.length).toBeGreaterThan(1);
    const ids = new Set<string>();

    for (const toolDef of tools) {
      expect(toolDef.id).toBeTruthy();
      expect(ids.has(toolDef.id)).toBe(false);
      ids.add(toolDef.id);
      expect(toolDef.description).toBeTruthy();
      expect(toolDef.schema).toBeTruthy();
      expect(typeof toolDef.execute).toBe("function");
      expect(["read", "write", "destructive"].includes(toolDef.risk)).toBe(true);
      expect(typeof toolDef.requiresConfirmation).toBe("boolean");
      expect(typeof toolDef.supportsAutopilot).toBe("boolean");
      if (toolDef.risk === "destructive") expect(toolDef.requiresConfirmation).toBe(true);
    }
  });

  it("exposes the registered tools to every conversational agent", () => {
    const registryToolIds = aiRegistry.getAllTools().map((toolDef) => toolDef.id);
    const agents = Object.keys(AI_AGENT_REGISTRY);
    expect(agents).toEqual(expect.arrayContaining(["profesor", "consejero", "nutrirecetas", "jarvis"]));

    for (const agentId of agents) {
      const agent = AI_AGENT_REGISTRY[agentId as keyof typeof AI_AGENT_REGISTRY];
      const exposed = buildToolsForAgent(
        agent.tools,
        false,
        "00000000-0000-0000-0000-000000000000",
        agentId,
        [],
      );
      for (const toolId of registryToolIds) expect(exposed[toolId]).toBeDefined();
    }
  });

  it("covers the critical destinations for calendar, chat, library, learning and research", () => {
    const critical = [
      "add_calendar_event",
      "read_calendar",
      "update_calendar_event",
      "delete_calendar_event",
      "search_calendar_events",
      "read_habits",
      "add_habit",
      "complete_habit",
      "send_message",
      "read_full_conversation",
      "search_user_by_name",
      "search_library",
      "search_documents",
      "save_learned_concept",
      "generate_flashcards",
      "generate_practice_questions",
      "search_web",
      "deep_research",
    ];

    for (const toolId of critical) {
      const tool = aiRegistry.getTool(toolId);
      expect(tool, `missing registered tool: ${toolId}`).toBeDefined();
      expect(typeof tool?.execute).toBe("function");
    }
  });
});