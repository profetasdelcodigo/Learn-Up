import { tool } from "ai";
import { z } from "zod";
import { aiRegistry } from "./skills"; // from our new registry
import { AiToolDefinition } from "./agent-registry"; // legacy import

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string
): Record<string, any> {
  const vercelTools: Record<string, any> = {};

  for (const def of agentTools) {
    // Find the tool in our new modular registry
    const registeredTool = aiRegistry.getTool(def.name);
    
    if (registeredTool) {
      const shouldAutoExecute = isAutonomous 
        ? registeredTool.supportsAutopilot
        : !registeredTool.requiresConfirmation;

      if (shouldAutoExecute && registeredTool.execute) {
        vercelTools[registeredTool.id] = (tool as any)({
          description: registeredTool.description,
          parameters: registeredTool.schema,
          execute: async (args: any) => {
            console.log(`[TOOL] Ejecutando: ${registeredTool.id}`);
            try {
              return await registeredTool.execute!(args, { userId });
            } catch (error: any) {
              console.error(`[TOOL] Error ejecutando ${registeredTool.id}:`, error);
              return { success: false, error: error.message };
            }
          },
        });
      } else {
        // If it requires confirmation, or we are manual, or it has no execute, don't provide execute
        vercelTools[registeredTool.id] = (tool as any)({
          description: registeredTool.description,
          parameters: registeredTool.schema,
        });
      }
    } else {
      // Fallback: wrap the legacy executeToolAction so no tools are dropped
      const shouldAutoExecute = isAutonomous
        ? !def.requiresConfirmation
        : !def.requiresConfirmation && !def.externalEffect;

      if (shouldAutoExecute) {
        vercelTools[def.name] = (tool as any)({
          description: def.description,
          parameters: z.record(z.any()).describe("Arguments for the tool"),
          execute: async (args: any) => {
            console.log(`[TOOL-LEGACY] Ejecutando: ${def.name}`);
            try {
              const { confirmAndExecuteTool } = await import("@/actions/ai-tutor");
              return await confirmAndExecuteTool(def.name, args);
            } catch (error: any) {
              console.error(`[TOOL-LEGACY] Error ejecutando ${def.name}:`, error);
              return { success: false, error: error.message };
            }
          },
        });
      } else {
        vercelTools[def.name] = (tool as any)({
          description: def.description,
          parameters: z.record(z.any()).describe("Arguments for the tool"),
        });
      }
    }
  }

  return vercelTools;
}
