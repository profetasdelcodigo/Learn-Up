import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (x) => path.join(root, x);
const read = (x) => fs.readFileSync(p(x), "utf8");
const write = (x, s) => fs.writeFileSync(p(x), s);

function replaceRequired(file, oldText, newText, label) {
  const s = read(file);
  const count = s.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  write(file, s.replace(oldText, newText));
}

// AIChatComponent: persist exactly once and never re-execute agent actions in autopilot.
{
  const file = "learn-up/src/components/AIChatComponent.tsx";
  let s = read(file);

  if (!s.includes("isAutonomous?: boolean,")) {
    s = s.replace(
      `    sessionId?: string | null,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;`,
      `    sessionId?: string | null,\n    isAutonomous?: boolean,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;`
    );
  }

  const autoBlock = `        if (result.actions && result.actions.length > 0) {\n          if (isAutonomous) {\n            result.actions.forEach(action => {\n               setTimeout(() => handleConfirmAction(action), 500);\n            });\n          } else {\n            setPendingActions(result.actions);\n          }\n        }`;
  if (s.includes(autoBlock)) {
    s = s.replace(autoBlock, `        if (result.actions && result.actions.length > 0 && !isAutonomous) {\n          setPendingActions(result.actions);\n        }`);
  }

  const duplicateSave = `    try {\n      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n      mediaMessageSaved = true;\n      messagePersisted = true;`;
  if (s.includes(duplicateSave)) {
    s = s.replace(duplicateSave, `    try {\n      if (!messagePersisted) {\n        const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n        if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n        messagePersisted = true;\n      }`);
  }
  s = s.replace(/\n    let mediaMessageSaved = false;/g, "");
  s = s.replace(/\n      mediaMessageSaved = true;/g, "");

  write(file, s);
}

// ai-tutor: always pass autopilot state into the agent loop and give each agent sane default skill packs.
{
  const file = "learn-up/src/actions/ai-tutor.ts";
  let s = read(file);

  if (!s.includes('isAutonomous?: boolean')) {
    const marker = `  sessionId?: string | null,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`;
    if (s.includes(marker)) {
      s = s.replace(marker, `  sessionId?: string | null,\n  isAutonomous?: boolean,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`);
    }
  }

  const activeBlock = `    const selectedToolNames = resolveSkillPackTools(activeSkills);\n    const toolDefs = ` + "`\\n${getToolDefinitions(selectedToolNames)}`" + `;`;
  if (s.includes(activeBlock)) {
    const replacement = `    const defaultPacksByAgent: Record<string, string[]> = {\n      profesor: ["library_pack", "learning_pack", "content_pack", "media_pack", "research_pack", "edu_pack"],\n      examenes: ["library_pack", "learning_pack", "content_pack", "media_pack", "research_pack", "edu_pack"],\n      consejero: ["calendar_pack", "learning_pack", "stats_pack", "profile_pack"],\n      nutrirecetas: ["calendar_pack", "content_pack", "media_pack", "stats_pack"],\n      jarvis: ["calendar_pack", "chat_pack", "library_pack", "learning_pack", "content_pack", "media_pack", "research_pack", "stats_pack", "profile_pack", "edu_pack"],\n    };\n    const effectiveSkillPacks = [...new Set([...(defaultPacksByAgent[aiType] || []), ...activeSkills])];\n    const selectedToolNames = resolveSkillPackTools(effectiveSkillPacks);\n    const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;`;
    s = s.replace(activeBlock, replacement);
  }

  const runOptionsMarker = `        sessionId,\n        onFormulaExtracted:`;
  if (s.includes(runOptionsMarker) && !s.includes(`        isAutonomous: Boolean(isAutonomous),\n        onFormulaExtracted:`)) {
    s = s.replace(runOptionsMarker, `        sessionId,\n        isAutonomous: Boolean(isAutonomous),\n        onFormulaExtracted:`);
  }

  write(file, s);
}

// ai-tools: fix calendar arguments used by the executor.
{
  const file = "learn-up/src/lib/ai-tools.ts";
  let s = read(file);
  s = s.replace(
    `const { title, description, recurrence_rule, reminder_minutes } = args;`,
    `const { title, description, start_time, end_time, recurrence_rule, reminder_minutes } = args;`
  );
  write(file, s);
}

// Remove explicit raw tool protocol wording wherever it still exists.
for (const file of [
  "learn-up/src/lib/ai/agent-registry.ts",
  "learn-up/src/actions/ai-tutor.ts",
  "learn-up/src/actions/jarvis.ts",
]) {
  let s = read(file);
  s = s.replace(/DEBES responder EXCLUSIVAMENTE con un bloque tool \{\.\.\.\} tal como espera el sistema\./g,
    "Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario.");
  s = s.replace(/DEBES responder EXCLUSIVAMENTE con un bloque tool \{\.\.\.\}/g,
    "Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario.");
  write(file, s);
}

console.log("[finalize-ai] complete");
