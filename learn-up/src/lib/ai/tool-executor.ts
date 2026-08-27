import { executeToolAction, ToolSchemas, type ToolResult } from "@/lib/ai-tools";
import { executePanelTool, isPanelTool } from "./panel-tools";

export async function executeUnifiedTool(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  sessionId?: string | null,
): Promise<ToolResult> {
  if (isPanelTool(toolName)) {
    return (await executePanelTool(toolName, args, userId, sessionId)) as ToolResult;
  }

  if (!ToolSchemas[toolName]) {
    return {
      success: false,
      message: "La herramienta solicitada no está disponible.",
    };
  }

  return executeToolAction(toolName, { ...args, userId, sessionId });
}
