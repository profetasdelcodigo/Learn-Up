import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

const historyPath = 'learn-up/src/actions/ai-history.ts';
let history = read(historyPath);
history = history.replace(
  '  mediaType?: string,\n  toolCalls?: any[]\n)',
  '  mediaType?: string,\n  toolCalls?: any[],\n  clientMessageId?: string\n)',
);
history = history.replace(
  '      media_type: mediaType || null,\n  };',
  '      media_type: mediaType || null,\n      client_message_id: clientMessageId || null,\n  };',
);
history = history.replace(
  '  const { data, error } = await supabase\n    .from("ai_messages")\n    .insert(payload)',
  '  const { data, error } = await supabase\n    .from("ai_messages")\n    .upsert(payload, { onConflict: "client_message_id", ignoreDuplicates: false })',
);
write(historyPath, history);

const migration = `-- Add an idempotency key for optimistic AI chat messages.\nALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS client_message_id text;\nCREATE UNIQUE INDEX IF NOT EXISTS ai_messages_client_message_id_uidx\n  ON public.ai_messages(client_message_id)\n  WHERE client_message_id IS NOT NULL;\n`;
write('learn-up/supabase/migrations/20260827000000_ai_message_idempotency.sql', migration);

const chatPath = 'learn-up/src/components/AIChatComponent.tsx';
let chat = read(chatPath);

// The component accidentally had the session-loading effect twice. Keep one effect only.
const effectBlock = /\n  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{[\s\S]*?\n  \}, \[currentSessionId\]\);/g;
const effects = [...chat.matchAll(effectBlock)];
if (effects.length > 1) {
  const second = effects[1];
  chat = chat.slice(0, second.index) + chat.slice(second.index + second[0].length);
}
chat = chat.replace('  const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);', '  const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);');
chat = chat.replace('  media_type?: string;\n  tool_calls?: ToolAction[];', '  media_type?: string;\n  tool_calls?: ToolAction[];\n  clientMessageId?: string;\n  status?: "sending" | "streaming" | "tool_pending" | "tool_running" | "completed" | "failed";');
chat = chat.replace('  const isCreatingSession = useRef(false);', '  const isCreatingSession = useRef(false);\n  const sendQueueRef = useRef(Promise.resolve());');
chat = chat.replace('    if ((!input.trim() && !file) || loading) return;', '    if ((!input.trim() && !file) || uploadingMedia) return;');
chat = chat.replace('    const clientSideUserMsg: Message = {\n      role: "user",', '    const clientMessageId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;\n    const clientSideUserMsg: Message = {\n      id: clientMessageId,\n      clientMessageId,\n      status: "sending",\n      role: "user",');
chat = chat.replace('      setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));', '      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));');
chat = chat.replace('      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);', '      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);');
chat = chat.replace('      const historyForGroq = messages.map((m) => ({\n        role: m.role,\n        content: m.content,\n      }));', '      const historyForGroq = [...messages, { ...clientSideUserMsg }].map((m) => ({\n        role: m.role,\n        content: m.content,\n      }));');
chat = chat.replace('        setMessages((prev) => [\n          ...prev,\n          { role: "assistant", content: result.response, tool_calls: result.executedActions },\n        ]);', '        setMessages((prev) => prev.map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "completed" } : m).concat({ id: `assistant-${clientMessageId}`, role: "assistant", content: result.response, status: "completed", tool_calls: result.executedActions }));');
chat = chat.replace('      await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions);', '      await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions, `assistant-${clientMessageId}`);');
chat = chat.replace('    const clientSideUserMsg: Message = { role: "user", content: option };', '    const clientMessageId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;\n    const clientSideUserMsg: Message = { id: clientMessageId, clientMessageId, status: "sending", role: "user", content: option };');
chat = chat.replace('      await addAiMessage(sessionId, "user", option);', '      await addAiMessage(sessionId, "user", option, undefined, undefined, undefined, clientMessageId);');
chat = chat.replace('        await addAiMessage(sessionId, "assistant", result.response);', '        await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, undefined, `assistant-${clientMessageId}`);');
chat = chat.replace('        setMessages((prev) => [...prev, { role: "assistant", content: result.response }]);', '        setMessages((prev) => prev.map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "completed" } : m).concat({ id: `assistant-${clientMessageId}`, role: "assistant", content: result.response, status: "completed" }));');
chat = chat.replace('disabled={loading || uploadingMedia}', 'disabled={uploadingMedia}');
chat = chat.replace('disabled={loading || uploadingMedia || (!input.trim() && !file)}', 'disabled={uploadingMedia || (!input.trim() && !file)}');

// Remove the artificial timer used to auto-submit a Jarvis trigger.
chat = chat.replace(/\n        setTimeout\(\(\) => \{\n          const form = document\.getElementById\('chat-form'\);\n          if \(form\) form\.dispatchEvent\(new Event\('submit', \{ cancelable: true, bubbles: true \}\)\);\n        \}, 100\);/, '\n        requestAnimationFrame(() => document.getElementById(\'chat-form\')?.requestSubmit());');

write(chatPath, chat);

// Canonicalize the legacy registry name without touching the rest of the registry content.
const regPath = 'learn-up/src/lib/ai/agent-registry.ts';
let reg = read(regPath);
reg = reg.replace(/name: "create_calendar_event"/g, 'name: "add_calendar_event"');
reg = reg.replace(/\n      "4\. Si necesitas usar una herramienta \(tool\), DEBES responder EXCLUSIVAMENTE con un bloque tool \{\.\.\.\} tal como espera el sistema\."/, '');
reg = reg.replace(/\n      "ANTES de generar tu respuesta, DEBES incluir un bloque <thinking>[^"]*"/, '');
write(regPath, reg);

// Make the native AI SDK route use the canonical tool policy rather than auto-running every tool in autopilot.
const defsPath = 'learn-up/src/lib/ai/tool-definitions.ts';
let defs = read(defsPath);
defs = defs.replace('import { AiToolDefinition } from "./agent-registry";', 'import { AiToolDefinition } from "./agent-registry";\nimport { getToolDefinition, shouldExecuteTool } from "./tool-contract";');
defs = defs.replace(/    const schema = ToolSchemas\[def\.name\] \|\| z\.object\(\{\}\);[\s\S]*?\n    const shouldAutoExecute = isAutonomous[\s\S]*?\n    if \(shouldAutoExecute\) \{/, '    const contract = getToolDefinition(def.name);\n    const schema = contract?.schema || ToolSchemas[def.name] || z.object({});\n    const decision = contract ? shouldExecuteTool(contract, isAutonomous ? "autopilot" : "manual", contract.risk, ["ai.tools.execute"]) : "deny";\n    if (decision === "execute") {');
defs = defs.replace(/    \} else \{\n      \/\/ If it requires confirmation, DO NOT provide an execute function\.[\s\S]*?\n    \}\n  \}/, '    } else {\n      // Confirmation-required tools are intentionally returned without execute().\n      vercelTools[def.name] = (tool as any)({ description: def.description, inputSchema: schema, parameters: schema });\n    }\n  }');
write(defsPath, defs);

console.log('AI reconstruction transform applied.');
