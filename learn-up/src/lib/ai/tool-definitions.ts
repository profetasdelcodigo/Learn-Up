import { tool } from "ai";
import { z } from "zod";
import { AiToolDefinition } from "./agent-registry";
import { getToolDefinition, shouldExecuteTool } from "./tool-contract";
import { executeUnifiedTool } from "./tool-executor";

const TOOL_ALIASES: Record<string, string> = {
  create_calendar_event: "add_calendar_event",
  create_group: "create_study_group",
  edit_group: "edit_group_info",
  react_to_message: "react_with_emoji",
  delete_message: "delete_sent_message",
};

function canonicalToolName(name: string): string {
  return TOOL_ALIASES[name] || name;
}

const PANEL_TOOL_NAMES = [
  "read_professor_panel",
  "add_professor_formula",
  "add_professor_outline_item",
  "set_professor_document",
  "read_counselor_panel",
  "add_counselor_goal",
  "toggle_counselor_goal",
  "set_counselor_mood",
  "save_counselor_journal",
  "read_nutrition_panel",
  "set_nutrition_macros",
  "add_shopping_item",
  "schedule_meal",
  "set_recipe_panel",
];

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string,
  sessionId?: string | null,
): Record<string, any> {
  const vercelTools: Record<string, any> = {};
  const mode = isAutonomous ? "autopilot" : "manual" as const;
  const requested = new Map<string, AiToolDefinition>();

  for (const def of agentTools) requested.set(canonicalToolName(def.name), def);
  for (const name of PANEL_TOOL_NAMES) {
    if (!requested.has(name)) {
      requested.set(name, {
        name,
        description: `Herramienta real del panel: ${name.replace(/_/g, " ")}`,
        requiresConfirmation: false,
        externalEffect: false,
      });
    }
  }

  for (const [name, def] of requested) {
    const contract = getToolDefinition(name);
    if (!contract) {
      console.warn(`[TOOLS] Herramienta declarada pero no implementada: ${name}`);
      continue;
    }

    const decision = shouldExecuteTool(contract, mode, contract.risk, ["ai.tools.execute"]);
    const definition = {
      description: contract.description || def.description,
      inputSchema: contract.schema,
    };

    if (decision === "execute") {
      vercelTools[name] = tool({
        ...definition,
        execute: async (args: any) => {
          console.log(`[TOOL] ${name} status=running`);
          try {
            const result = await executeUnifiedTool(name, { ...args }, userId, sessionId);
            console.log(`[TOOL] ${name} status=${result.success ? "success" : "error"}`);
            return result;
          } catch (error: any) {
            console.error(`[TOOL] ${name} status=error`);
            return { success: false, displayMessage: "No se pudo completar la acción.", error: error?.message || "Error de herramienta" };
          }
        },
      } as any);
    } else {
      vercelTools[name] = tool(definition as any);
    }
  }

  return vercelTools;
}
