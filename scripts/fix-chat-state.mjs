import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve(process.cwd(), "learn-up/src/components/AIChatComponent.tsx");
let source = fs.readFileSync(filePath, "utf8");
const original = source;

// Prevent history hydration from blanking the live optimistic UI.
source = source.replace(
  'const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);',
  'const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);',
);

// Remove the duplicated currentSessionId hydration effect.
const effectPattern = /\n  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{[\s\S]*?\n  \}, \[currentSessionId\]\);/g;
const effects = [...source.matchAll(effectPattern)];
if (effects.length > 1) {
  const duplicate = effects[effects.length - 1];
  source = source.slice(0, duplicate.index) + source.slice(duplicate.index + duplicate[0].length);
}

// Add durable client-side identity to optimistic messages.
source = source.replace(
  '  tool_calls?: ToolAction[];\n}',
  '  tool_calls?: ToolAction[];\n  clientMessageId?: string;\n  status?: "sending" | "streaming" | "tool_pending" | "tool_running" | "completed" | "failed";\n}',
);

source = source.replace(
  '  const isCreatingSession = useRef(false);\n  const supabase = createClient();',
  '  const isCreatingSession = useRef(false);\n  const submitInFlight = useRef(false);\n  const supabase = createClient();',
);

source = source.replace(
  '    if ((!input.trim() && !file) || loading) return;',
  '    if ((!input.trim() && !file) || submitInFlight.current || uploadingMedia) return;\n    submitInFlight.current = true;',
);

source = source.replace(
  '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientSideUserMsg: Message = {\n      role: "user",',
  '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\n      ? crypto.randomUUID()\n      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;\n    const clientSideUserMsg: Message = {\n      id: clientMessageId,\n      clientMessageId,\n      status: "sending",\n      role: "user",',
);

source = source.replace(
  '      setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));',
  '      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      submitInFlight.current = false;',
);

source = source.replace(
  '          prev.map(m => m === clientSideUserMsg ? { ...m, media_url: mediaUrl } : m)',
  '          prev.map(m => m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl } : m)',
);

source = source.replace(
  '      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);',
  '      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);',
);

source = source.replace(
  '      const historyForGroq = messages.map((m) => ({',
  '      const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({',
);

source = source.replace(
  '        setMessages((prev) => [\n          ...prev,\n          { role: "assistant", content: result.response, tool_calls: result.executedActions },\n        ]);',
  '        setMessages((prev) => prev\n          .map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "completed" } : m)\n          .concat({ id: `assistant-${clientMessageId}`, role: "assistant", content: result.response, status: "completed", tool_calls: result.executedActions }));',
);

source = source.replace(
  '        await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions);',
  '        await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions, `assistant-${clientMessageId}`);',
);

// Ensure one in-flight send is released on every path.
source = source.replace(
  '    } finally {\n      setLoading(false);\n    }\n  };',
  '    } finally {\n      setLoading(false);\n      submitInFlight.current = false;\n    }\n  };',
);

if (source === original) {
  console.log("No chat-state changes were necessary.");
} else {
  fs.writeFileSync(filePath, source);
  console.log("Applied deterministic AIChatComponent state fixes.");
}
