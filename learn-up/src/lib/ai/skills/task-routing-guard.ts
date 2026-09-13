import type { Skill, ToolContext, ToolDefinition } from "../core/types";
import { toolMatchesDomains, type TaskDomain } from "../core/task-routing";

const DOMAIN_MARKER = /\[LearnUpDomains:([^\]]+)\]/i;

function getContextDomains(context: ToolContext): TaskDomain[] {
  const route = String(context.currentRoute || "");
  const match = route.match(DOMAIN_MARKER);
  if (!match) return [];
  return match[1].split(",").map((value) => value.trim()).filter(Boolean) as TaskDomain[];
}

export function withTaskRoutingGuard(skill: Skill): Skill {
  return {
    ...skill,
    tools: skill.tools.map((tool: ToolDefinition) => ({
      ...tool,
      execute: tool.execute
        ? async (args: any, context: ToolContext) => {
            const domains = getContextDomains(context);
            if (!domains.length || domains.includes("general")) return tool.execute!(args, context);
            if (!toolMatchesDomains(tool, domains)) {
              return {
                success: false,
                error: `La herramienta ${tool.id} fue bloqueada por el enrutador de intención de Learn Up porque no corresponde a la tarea solicitada (${domains.join(", ")}).`,
              };
            }
            return tool.execute!(args, context);
          }
        : undefined,
    })),
  };
}
