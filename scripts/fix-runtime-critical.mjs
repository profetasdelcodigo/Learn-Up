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
  s = s.replace(
    'const toolDefs = `\\n\\${getToolDefinitions(selectedToolNames)}`;',
    'const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;'
  );
  s = s.replace(
    'const toolDefs = `\\n\\${getToolDefinitions(activeSkills)}`;',
    'const toolDefs = `\\n${getToolDefinitions(resolveSkillPackTools(activeSkills))}`;'
  );
  s = s.replace(/const MODEL = "gemini-3\.6-flash";/g, 'const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.7-flash";');
  s = s.replace(/const VISION_MODEL = "gemini-3\.6-flash";/g, 'const VISION_MODEL = process.env.GEMINI_MULTIMODAL_MODEL || "gemini-3.7-flash";');
  s = s.replace(/const toolDefs = `\\n\$\{getToolDefinitions\(selectedToolNames\)\}`;/g, 'const toolDefs = `\\n${getToolDefinitions(selectedToolNames)}`;');
  return s;
});

edit("learn-up/src/components/AIChatComponent.tsx", (s) => {
  // Repair an accidentally nested failure branch produced by earlier automated patches.
  const broken = /      if \(!messagePersisted\) \{\n        if \(!messagePersisted\) \{\n        if \(!messagePersisted\) \{\n        setMessages\(\(prev\) => prev\.filter\(\(m\) => m\.clientMessageId !== clientMessageId\)\);\n      \} else \{\n        setMessages\(\(prev\) => prev\.map\(\(m\) => m\.clientMessageId === clientMessageId \? \{ \.\.\.m, status: "failed" \} : m\)\);\n      \}\n      \} else \{\n        setMessages\(\(prev\) => prev\.map\(\(m\) => m\.clientMessageId === clientMessageId \? \{ \.\.\.m, status: "failed" \} : m\)\);\n      \}\n      \} else \{\n        setMessages\(\(prev\) => prev\.map\(\(m\) => m\.clientMessageId === clientMessageId \? \{ \.\.\.m, status: "failed" \} : m\)\);\n      \}/m;
  s = s.replace(broken,
`      if (!messagePersisted) {
        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      } else {
        setMessages((prev) => prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m
        ));
      }`);
  // Don't keep an unused secondary flag.
  s = s.replace(/\n    let mediaMessageSaved = false;/g, "");
  s = s.replace(/\n        mediaMessageSaved = true;/g, "");
  s = s.replace(/\n      mediaMessageSaved = true;/g, "");
  return s;
});

edit("learn-up/src/lib/ai.ts", (s) => {
  s = s.replace(/openRouterFast: "meta-llama\/llama-3\.1-8b-instruct:free",/g,
    'openRouterFast: process.env.OPENROUTER_MODEL || "openrouter/free",');
  return s;
});

console.log("[runtime-fix] done");
