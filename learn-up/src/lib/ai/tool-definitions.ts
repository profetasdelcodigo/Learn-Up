import { tool } from "ai";
import { z } from "zod";
import { executeToolAction, ToolSchemas } from "@/lib/ai-tools";
import { AiToolDefinition } from "./agent-registry";
import { getToolDefinition, shouldExecuteTool } from "./tool-contract";

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

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string,
): Record<string, any> {
  const vercelTools: Record<string, any> = {};
  const mode = isAutonomous ? "autopilot" : "manual" as const;

  for (const def of agentTools) {
    const name = canonicalToolName(def.name);
    const contract = getToolDefinition(name);
    const schema = contract?.schema || ToolSchemas[name] || z.object({});

    if (!contract) {
      console.warn(`[TOOLS] Herramienta declarada pero no implementada: ${def.name}`);
      continue;
    }

    const decision = shouldExecuteTool(contract, mode, contract.risk, ["ai.tools.execute"]);

    if (decision === "execute") {
      vercelTools[name] = tool({
        description: contract.description || def.description,
        inputSchema: schema,
        execute: async (args: any) => {
          console.log(`[TOOL] ${name} status=running`);
          try {
            const result = await executeToolAction(name, { ...args, userId });
            console.log(`[TOOL] ${name} status=${result.success ? "success" : "error"}`);
            return result;
          } catch (error: any) {
            console.error(`[TOOL] ${name} status=error`);
            return {
              success: false,
              displayMessage: "No se pudo completar la acción.",
              error: error?.message || "Error de herramienta",
            };
          }
        },
      } as any);
    } else {
      // Confirmation-required tools are advertised to the model without an execute
      // handler. The client approval flow performs the actual server action.
      vercelTools[name] = tool({
        description: contract.description || def.description,
        inputSchema: schema,
      } as any);
    }
  }

  return vercelTools;
}
