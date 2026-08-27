import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (x) => path.join(root, x);
const read = (x) => fs.readFileSync(p(x), "utf8");
const write = (x, s) => fs.writeFileSync(p(x), s);

// AIChatComponent
{
  const file = "learn-up/src/components/AIChatComponent.tsx";
  let s = read(file);

  const oldSignature = "    sessionId?: string | null,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;";
  const newSignature = "    sessionId?: string | null,\n    isAutonomous?: boolean,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;";
  if (s.includes(oldSignature) && !s.includes("    isAutonomous?: boolean,")) s = s.replace(oldSignature, newSignature);

  const autoOld = `        if (result.actions && result.actions.length > 0) {\n          if (isAutonomous) {\n            result.actions.forEach(action => {\n               setTimeout(() => handleConfirmAction(action), 500);\n            });\n          } else {\n            setPendingActions(result.actions);\n          }\n        }`;
  const autoNew = `        if (result.actions && result.actions.length > 0 && !isAutonomous) {\n          setPendingActions(result.actions);\n        }`;
  if (s.includes(autoOld)) s = s.replace(autoOld, autoNew);

  const earlyMediaSave = `      const mediaMessage = await addAiMessage(\n          sessionId,\n          "user",\n          userMessage,\n          mediaUrl,\n          mediaType,\n          undefined,\n          clientMessageId,\n        );`;
  // Keep one persistence point. The media upload block already updates media_url locally.
  if (s.includes(earlyMediaSave)) {
    // Deliberately leave the first media persistence call: it is the safety boundary before indexing.
  }

  write(file, s);
}

// ai-tutor: default skill packs and autopilot context.
{
  const file = "learn-up/src/actions/ai-tutor.ts";
  let s = read(file);

  if (!s.includes('isAutonomous?: boolean')) {
    const marker = "  sessionId?: string | null,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {";
    if (s.includes(marker)) s = s.replace(marker, "  sessionId?: string | null,\n  isAutonomous?: boolean,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {");
  }

  const oldTools = "    const selectedToolNames = resolveSkillPackTools(activeSkills);\n    const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;";
  const newTools = "    const defaultPacksByAgent: Record<string, string[]> = {\n      profesor: [\"library_pack\", \"learning_pack\", \"content_pack\", \"media_pack\", \"research_pack\", \"edu_pack\"],\n      examenes: [\"library_pack\", \"learning_pack\", \"content_pack\", \"media_pack\", \"research_pack\", \"edu_pack\"],\n      consejero: [\"calendar_pack\", \"learning_pack\", \"stats_pack\", \"profile_pack\"],\n      nutrirecetas: [\"calendar_pack\", \"content_pack\", \"media_pack\", \"stats_pack\"],\n      jarvis: [\"calendar_pack\", \"chat_pack\", \"library_pack\", \"learning_pack\", \"content_pack\", \"media_pack\", \"research_pack\", \"stats_pack\", \"profile_pack\", \"edu_pack\"],\n    };\n    const effectiveSkillPacks = [...new Set([...(defaultPacksByAgent[aiType] || []), ...activeSkills])];\n    const selectedToolNames = resolveSkillPackTools(effectiveSkillPacks);\n    const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;";
  if (s.includes(oldTools)) s = s.replace(oldTools, newTools);

  const oldOptions = "        sessionId,\n        onFormulaExtracted:";
  const newOptions = "        sessionId,\n        isAutonomous: Boolean(isAutonomous),\n        onFormulaExtracted:";
  if (s.includes(oldOptions) && !s.includes(newOptions)) s = s.replace(oldOptions, newOptions);

  write(file, s);
}

// ai-tools: fix calendar executor variables.
{
  const file = "learn-up/src/lib/ai-tools.ts";
  let s = read(file);
  s = s.replace(
    "const { title, description, recurrence_rule, reminder_minutes } = args;",
    "const { title, description, start_time, end_time, recurrence_rule, reminder_minutes } = args;"
  );
  write(file, s);
}

// Never instruct the model to expose the internal textual tool protocol.
for (const file of [
  "learn-up/src/lib/ai/agent-registry.ts",
  "learn-up/src/actions/ai-tutor.ts",
  "learn-up/src/actions/jarvis.ts",
]) {
  let s = read(file);
  s = s.replaceAll(
    "DEBES responder EXCLUSIVAMENTE con un bloque tool {...} tal como espera el sistema.",
    "Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario."
  );
  s = s.replaceAll(
    "DEBES responder EXCLUSIVAMENTE con un bloque tool {...}",
    "Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario."
  );
  write(file, s);
}

console.log("[finalize-ai] complete");
