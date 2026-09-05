import { tool } from "ai";
import { z } from "zod";
import { aiRegistry } from "./skills";
import { AiToolDefinition } from "./agent-registry";

const PACK_TO_SKILL: Record<string, string> = {
  calendar_pack: "calendar",
  chat_pack: "chat",
  library_pack: "library",
  learning_pack: "knowledge-graph",
  content_pack: "content",
  media_pack: "multimedia",
  research_pack: "research",
  stats_pack: "analytics",
  profile_pack: "social",
  edu_pack: "education",
};

const ALL_PACKS = Object.keys(PACK_TO_SKILL);

function selectedRegistryTools(activeSkills: string[] = []) {
  const requested = activeSkills.length ? activeSkills : ALL_PACKS;
  const skillIds = requested
    .map((id) => PACK_TO_SKILL[id] || id)
    .filter((id): id is string => Boolean(id));
  const allowed = new Set(skillIds);

  return aiRegistry.getAllSkills()
    .filter((skill) => allowed.has(skill.id))
    .flatMap((skill) => skill.tools);
}

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string,
  agentId?: string,
  activeSkills: string[] = [],
): Record<string, any> {
  const vercelTools: Record<string, any> = {};
  const registryTools = selectedRegistryTools(activeSkills);

  // The modular registry is the source of truth for all skill packs.
  // Legacy tools remain as compatibility fallback only when a registry tool does not exist.
  const toolDefs = new Map<string, any>();

  for (const registeredTool of registryTools) {
    toolDefs.set(registeredTool.id, {
      kind: "registry",
      definition: registeredTool,
    });
  }

  // Preserve non-pack agent-specific tools that are not represented in the new registry.
  for (const def of agentTools) {
    if (!toolDefs.has(def.name)) {
      toolDefs.set(def.name, { kind: "legacy", definition: def });
    }
  }

  for (const [toolId, entry] of toolDefs.entries()) {
    if (entry.kind === "registry") {
      const registeredTool = entry.definition;
      const shouldAutoExecute = isAutonomous
        ? registeredTool.supportsAutopilot
        : !registeredTool.requiresConfirmation;

      const execute = async (args: any) => {
        console.log(`[TOOL] Ejecutando: ${registeredTool.id}`);
        try {
          return await registeredTool.execute!(args, {
            userId,
            referer: undefined,
          });
        } catch (error: any) {
          console.error(`[TOOL] Error ejecutando ${registeredTool.id}:`, error);
          return { success: false, error: error?.message || "Tool execution failed" };
        }
      };

      vercelTools[toolId] = (tool as any)({
        description: registeredTool.description,
        parameters: registeredTool.schema,
        ...(shouldAutoExecute && registeredTool.execute ? { execute } : {}),
      });
      continue;
    }

    const def = entry.definition;
    const shouldAutoExecute = isAutonomous
      ? !def.requiresConfirmation
      : !def.requiresConfirmation && !def.externalEffect;

    vercelTools[toolId] = (tool as any)({
      description: def.description,
      parameters: z.record(z.any()).describe("Arguments for the tool"),
      ...(shouldAutoExecute
        ? {
            execute: async (args: any) => {
              console.log(`[TOOL-LEGACY] Ejecutando: ${def.name}`);
              try {
                const { confirmAndExecuteTool } = await import("@/actions/ai-tutor");
                return await confirmAndExecuteTool(def.name, args);
              } catch (error: any) {
                console.error(`[TOOL-LEGACY] Error ejecutando ${def.name}:`, error);
                return { success: false, error: error?.message || "Tool execution failed" };
              }
            },
          }
        : {}),
    });
  }

  // Explicitly expose all registry tools to Jarvis even if its legacy registry is incomplete.
  if (agentId === "jarvis" && activeSkills.length === 0) {
    for (const registeredTool of aiRegistry.getAllTools()) {
      if (vercelTools[registeredTool.id]) continue;
      const shouldAutoExecute = isAutonomous
        ? registeredTool.supportsAutopilot
        : !registeredTool.requiresConfirmation;
      vercelTools[registeredTool.id] = (tool as any)({
        description: registeredTool.description,
        parameters: registeredTool.schema,
        ...(shouldAutoExecute && registeredTool.execute
          ? {
              execute: async (args: any) => registeredTool.execute!(args, { userId }),
            }
          : {}),
      });
    }
  }

  return vercelTools;
}
