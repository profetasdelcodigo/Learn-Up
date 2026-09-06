import { tool } from "ai";
import { z } from "zod";
import { aiRegistry } from "./skills";
import { AiToolDefinition } from "./agent-registry";
import { materializeToolResult } from "./core/materialize-result";
import { panelTools } from "./core/panel-tools";
import { extractSources, finishToolEvent, startToolEvent } from "./core/tool-event-log";

const PACK_TO_SKILL: Record<string, string> = {
  calendar_pack: "calendar",
  chat_pack: "chat",
  library_pack: "library",
  learning_pack: "knowledge-graph",
  content_pack: "content_generation",
  media_pack: "multimedia",
  research_pack: "research",
  stats_pack: "analytics",
  profile_pack: "social",
  edu_pack: "education",
  web_search: "research",
  education_pack: "education",
  social_pack: "social",
  content_generation_pack: "content_generation",
};

const ALL_PACKS = [...new Set(Object.keys(PACK_TO_SKILL).filter((id) => id.endsWith("_pack")))];

export function normalizeSkillPackIds(activeSkills: string[] = []): string[] {
  const ids = activeSkills
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => value in PACK_TO_SKILL ? value : value === "research" ? "research_pack" : value === "education" ? "edu_pack" : value === "social" ? "profile_pack" : value === "multimedia" ? "media_pack" : value === "analytics" ? "stats_pack" : value === "knowledge-graph" ? "learning_pack" : value === "content_generation" ? "content_pack" : value);
  return [...new Set(ids)];
}

function selectedRegistryTools(activeSkills: string[] = []) {
  const normalized = normalizeSkillPackIds(activeSkills);
  const requested = normalized.length ? normalized : ALL_PACKS;
  const ids = new Set(requested.map((id) => PACK_TO_SKILL[id] || id));
  return aiRegistry
    .getAllSkills()
    .filter((skill) => ids.has(skill.id))
    .flatMap((skill) => skill.tools);
}

function packForTool(toolCategory: string, activeSkills: string[]) {
  const normalized = normalizeSkillPackIds(activeSkills);
  return normalized.find((pack) => PACK_TO_SKILL[pack] === toolCategory) || null;
}

function argsWithRuntimeContext(toolId: string, args: any, runtime?: { currentRoute?: string | null; mediaUrl?: string | null; mediaType?: string | null }) {
  const effective = { ...(args && typeof args === "object" ? args : {}) };
  if (!effective.image_url && runtime?.mediaUrl && ["analyze_image", "describe_math_image", "extract_colors_from_image", "extract_text_from_image"].includes(toolId)) {
    effective.image_url = runtime.mediaUrl;
  }
  if (!effective.audio_url && runtime?.mediaUrl && ["transcribe_audio"].includes(toolId)) {
    effective.audio_url = runtime.mediaUrl;
  }
  if (!effective.video_url && runtime?.mediaUrl && ["search_youtube_transcripts"].includes(toolId) && runtime.mediaUrl.match(/youtube\.com|youtu\.be/i)) {
    effective.video_url = runtime.mediaUrl;
  }
  return effective;
}

export function buildToolsForAgent(
  agentTools: AiToolDefinition[],
  isAutonomous: boolean,
  userId: string,
  agentId?: string,
  activeSkills: string[] = [],
  runtime?: { sessionId?: string | null; currentRoute?: string | null; mediaUrl?: string | null; mediaType?: string | null },
): Record<string, any> {
  const vercelTools: Record<string, any> = {};
  const registryTools = selectedRegistryTools(activeSkills);
  const toolDefs = new Map<string, any>();

  for (const registeredTool of registryTools) toolDefs.set(registeredTool.id, { kind: "registry", definition: registeredTool });
  for (const panelTool of panelTools) if (!toolDefs.has(panelTool.name)) toolDefs.set(panelTool.name, { kind: "panel", definition: panelTool });
  for (const def of agentTools) if (!toolDefs.has(def.name)) toolDefs.set(def.name, { kind: "legacy", definition: def });

  for (const [toolId, entry] of toolDefs.entries()) {
    if (entry.kind === "registry") {
      const registeredTool = entry.definition;
      const shouldAutoExecute = isAutonomous ? registeredTool.supportsAutopilot : !registeredTool.requiresConfirmation;
      const execute = async (args: any) => {
        const invocationId = crypto.randomUUID();
        const effectiveArgs = argsWithRuntimeContext(registeredTool.id, args, runtime);
        await startToolEvent({
          userId,
          sessionId: runtime?.sessionId,
          invocationId,
          toolName: registeredTool.id,
          skillPack: packForTool(registeredTool.category, activeSkills),
          aiType: agentId,
          mode: isAutonomous ? "autopilot" : "manual",
          risk: registeredTool.risk,
          arguments: effectiveArgs,
          currentRoute: runtime?.currentRoute,
        });
        try {
          const parsed = registeredTool.schema?.safeParse ? registeredTool.schema.safeParse(effectiveArgs) : { success: true, data: effectiveArgs };
          if (!parsed.success) {
            const message = `Argumentos inválidos para ${registeredTool.id}.`;
            await finishToolEvent({ userId, invocationId, success: false, error: message });
            return { success: false, error: message };
          }
          const result = await materializeToolResult(
            await registeredTool.execute!(parsed.data, { userId, currentRoute: runtime?.currentRoute, mediaUrl: runtime?.mediaUrl, mediaType: runtime?.mediaType } as any),
            registeredTool.id,
            effectiveArgs,
          );
          await finishToolEvent({ userId, invocationId, success: Boolean(result?.success), result, error: result?.success ? null : String(result?.error || result?.message || "Error de herramienta"), sources: extractSources(result) });
          return result;
        } catch (error: any) {
          const message = error?.message || "Tool execution failed";
          await finishToolEvent({ userId, invocationId, success: false, error: message });
          console.error(`[TOOL] ${registeredTool.id}`, error);
          return { success: false, error: message };
        }
      };
      vercelTools[toolId] = (tool as any)({ description: registeredTool.description, parameters: registeredTool.schema, ...(shouldAutoExecute && registeredTool.execute ? { execute } : {}) });
    } else if (entry.kind === "panel") {
      const panel = entry.definition;
      const shouldAutoExecute = isAutonomous ? panel.supportsAutopilot !== false : !panel.requiresConfirmation;
      vercelTools[toolId] = (tool as any)({ description: panel.description, parameters: panel.schema, ...(shouldAutoExecute ? {
        execute: async (args: any) => {
          const invocationId = crypto.randomUUID();
          await startToolEvent({ userId, sessionId: runtime?.sessionId, invocationId, toolName: panel.name, skillPack: null, aiType: agentId, mode: isAutonomous ? "autopilot" : "manual", risk: "write", arguments: args, currentRoute: runtime?.currentRoute });
          try {
            const result = await panel.execute(args);
            await finishToolEvent({ userId, invocationId, success: Boolean(result?.success), result, error: result?.success ? null : String(result?.error || result?.message || "Error de herramienta"), sources: extractSources(result) });
            return result;
          } catch (error: any) {
            const message = error?.message || "Panel tool execution failed";
            await finishToolEvent({ userId, invocationId, success: false, error: message });
            return { success: false, error: message };
          }
        },
      } : {}) });
    } else {
      const def = entry.definition;
      const shouldAutoExecute = isAutonomous ? !def.requiresConfirmation : !def.requiresConfirmation && !def.externalEffect;
      vercelTools[toolId] = (tool as any)({ description: def.description, parameters: z.record(z.any()).describe("Arguments for the tool"), ...(shouldAutoExecute ? {
        execute: async (args: any) => {
          const invocationId = crypto.randomUUID();
          await startToolEvent({ userId, sessionId: runtime?.sessionId, invocationId, toolName: def.name, skillPack: null, aiType: agentId, mode: isAutonomous ? "autopilot" : "manual", risk: def.externalEffect ? "external" : "read", arguments: args, currentRoute: runtime?.currentRoute });
          try {
            const { confirmAndExecuteTool } = await import("@/actions/ai-tutor");
            const result = await materializeToolResult(await confirmAndExecuteTool(def.name, args), def.name, args);
            await finishToolEvent({ userId, invocationId, success: Boolean(result?.success), result, error: result?.success ? null : String(result?.error || result?.message || "Error de herramienta"), sources: extractSources(result) });
            return result;
          } catch (error: any) {
            const message = error?.message || "Tool execution failed";
            await finishToolEvent({ userId, invocationId, success: false, error: message });
            return { success: false, error: message };
          }
        },
      } : {}) });
    }
  }
  return vercelTools;
}
