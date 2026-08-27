import { tool } from "ai";
import { z } from "zod";
import { executeToolAction, ToolSchemas } from "@/lib/ai-tools";
import { AiToolDefinition } from "./agent-registry";
import { getToolDefinition, shouldExecuteTool } from "./tool-contract";

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string,
): Record<string, any> {
  const vercelTools: Record<string, any> = {};
  const mode = isAutonomous ? "autopilot" : "manual" as const;

  for (const def of agentTools) {
    const contract = getToolDefinition(def.name);
    const schema = contract?.schema || ToolSchemas[def.name] || z.object({});

    // Backend policy is authoritative. The prompt cannot grant execution rights.
    const decision = contract
      ? shouldExecuteTool(contract, mode, contract.risk, ["ai.tools.execute"])
      : "deny";

    if (decision === "execute") {
      vercelTools[def.name] = tool({
        description: def.description,
        inputSchema: schema,
        execute: async (args: any) => {
          console.log(`[TOOL] ${def.name} status=running`);
          try {
            const result = await executeToolAction(def.name, { ...args, userId });
            console.log(`[TOOL] ${def.name} status=${result.success ? "success" : "error"}`);
            return result;
          } catch (error: any) {
            console.error(`[TOOL] ${def.name} status=error`);
            return { success: false, displayMessage: "No se pudo completar la acción.", error: error?.message || "Error de herramienta" };
          }
        },
      } as any);
    } else {
      // The model may request a confirmation-only tool, but server execution is absent until approved.
      vercelTools[def.name] = tool({
        description: def.description,
        inputSchema: schema,
      } as any);
    }
  }

  return vercelTools;
}
