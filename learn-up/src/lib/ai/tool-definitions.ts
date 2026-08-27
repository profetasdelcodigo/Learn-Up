import { tool } from "ai";
import { z } from "zod";
import { executeToolAction, ToolSchemas } from "@/lib/ai-tools";
import { AiToolDefinition } from "./agent-registry";

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string
): Record<string, any> {
  const vercelTools: Record<string, any> = {};

  for (const def of agentTools) {
    const schema = ToolSchemas[def.name] || z.object({});
    
    // Determine if we should auto-execute this tool on the server
    const shouldAutoExecute = isAutonomous 
      ? true // In autopilot, we auto-execute everything (or based on policy)
      : !def.requiresConfirmation; // In manual, we only auto-execute if no confirmation is needed

    if (shouldAutoExecute) {
      vercelTools[def.name] = (tool as any)({
        description: def.description,
        inputSchema: schema,
        parameters: schema,
        execute: async (args: any) => {
          console.log(`[TOOL] Ejecutando automáticamente: ${def.name}`);
          try {
            const result = await executeToolAction(def.name, { ...args, userId });
            return result;
          } catch (error: any) {
            console.error(`[TOOL] Error ejecutando ${def.name}:`, error);
            return { success: false, error: error.message };
          }
        },
      });
    } else {
      // If it requires confirmation, DO NOT provide an execute function.
      vercelTools[def.name] = (tool as any)({
        description: def.description,
        inputSchema: schema,
        parameters: schema,
      });
    }
  }

  return vercelTools;
}
