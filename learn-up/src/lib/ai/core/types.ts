import { z } from "zod";

export type ToolRisk = "read" | "write" | "destructive";

export interface ToolDefinition<TArgs = any> {
  id: string;
  name?: string;
  category: string;
  description: string;
  schema: z.ZodType<TArgs>;
  risk: ToolRisk;
  requiresConfirmation: boolean;
  supportsAutopilot: boolean;
  supportsParallel?: boolean;
  execute?: (args: TArgs, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userId?: string;
  roomId?: string;
  referer?: string;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  tools: ToolDefinition[];
}
