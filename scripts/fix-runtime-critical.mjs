import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = (p) => path.join(root, p);

function edit(rel, fn) {
  const p = file(rel);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    console.log(`[runtime-fix] ${rel}`);
  }
}

edit("learn-up/src/actions/ai-tutor.ts", (s) => {
  s = s.replace(/const MODEL = "gemini-3\.6-flash";/g, 'const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.7-flash";');
  s = s.replace(/const VISION_MODEL = "gemini-3\.6-flash";/g, 'const VISION_MODEL = process.env.GEMINI_MULTIMODAL_MODEL || "gemini-3.7-flash";');
  s = s.replace(/const toolDefs = `\\n\\\$\{getToolDefinitions\(selectedToolNames\)\}`;/g, 'const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;');
  s = s.replace(/const toolDefs = `\\n\\\$\{getToolDefinitions\(activeSkills\)\}`;/g, 'const toolDefs = `\\n${getToolDefinitions(resolveSkillPackTools(activeSkills))}`;');
  s = s.replace(/const toolDefs = `\\n\$\{getToolDefinitions\(selectedToolNames\)\}`;/g, 'const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;');
  return s;
});

edit("learn-up/src/lib/ai-tools.ts", (s) => {
  s = s.replace(
    /const \{ title, description, recurrence_rule, reminder_minutes \} = args;/g,
    'const { title, description, start_time, end_time, recurrence_rule, reminder_minutes } = args;'
  );
  return s;
});

edit("learn-up/src/components/AIChatComponent.tsx", (s) => {
  const attachmentStart = s.indexOf('        // Persist attachment metadata before any slow OCR/indexing work.');
  const attachmentCatch = s.indexOf('      } catch (uploadErr: any) {', attachmentStart);
  if (attachmentStart >= 0 && attachmentCatch > attachmentStart) {
    const canonicalAttachment = `        // Persist attachment metadata before any slow OCR/indexing work.\n        const mediaMessage = await addAiMessage(\n          sessionId,\n          "user",\n          userMessage,\n          mediaUrl,\n          mediaType,\n          undefined,\n          clientMessageId,\n        );\n        if (mediaMessage?.error) throw new Error(mediaMessage.error);\n        messagePersisted = true;\n        setMessages((prev) => prev.map((m) =>\n          m.clientMessageId === clientMessageId\n            ? { ...m, media_url: mediaUrl, status: "sending" }\n            : m\n        ));\n\n`;
    s = s.slice(0, attachmentStart) + canonicalAttachment + s.slice(attachmentCatch);
  }

  const failureStart = s.indexOf('      if (!messagePersisted) {');
  const failureEnd = s.indexOf('      setLoading(false);', failureStart);
  if (failureStart >= 0 && failureEnd > failureStart) {
    const canonicalFailure = `      if (!messagePersisted) {\n        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      } else {\n        setMessages((prev) => prev.map((m) =>\n          m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m\n        ));\n      }\n`;
    s = s.slice(0, failureStart) + canonicalFailure + s.slice(failureEnd);
  }

  const duplicateSave = /    try \{\n      const savedUserMessage = await addAiMessage\(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId\);\n      if \(savedUserMessage\?\.error\) throw new Error\(savedUserMessage\.error\);\n      messagePersisted = true;/m;
  if (duplicateSave.test(s)) {
    s = s.replace(duplicateSave,
`    try {
      if (!messagePersisted) {
        const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);
        if (savedUserMessage?.error) throw new Error(savedUserMessage.error);
        messagePersisted = true;
      }`);
  }

  const autoOld = /        if \(result\.actions && result\.actions\.length > 0\) \{\n          if \(isAutonomous\) \{[\s\S]*?\n          \} else \{\n            setPendingActions\(result\.actions\);\n          \}\n        \}/m;
  if (autoOld.test(s)) {
    s = s.replace(autoOld, `        if (result.actions && result.actions.length > 0 && !isAutonomous) {\n          setPendingActions(result.actions);\n        }`);
  }

  return s;
});

edit("learn-up/src/lib/ai.ts", (s) => {
  return s.replace(/openRouterFast: "meta-llama\/llama-3\.1-8b-instruct:free",/g,
    'openRouterFast: process.env.OPENROUTER_MODEL || "openrouter/free",');
});

console.log("[runtime-fix] normalized successfully");
