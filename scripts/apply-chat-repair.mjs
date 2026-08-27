import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    console.log(`[chat-repair] pattern not found: ${label}`);
    return source;
  }
  return source.replace(from, to);
}

function patchChat() {
  const p = "learn-up/src/components/AIChatComponent.tsx";
  let source = read(p);

  // Never blank the live message list while hydrating a session.
  source = replaceOnce(
    source,
    'const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);',
    'const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);',
    "remove history blanking",
  );

  // Keep only one session hydration effect. The duplicated effect was a direct
  // source of optimistic messages disappearing and reappearing.
  const effectPattern = /\n  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{[\s\S]*?\n  \}, \[currentSessionId\]\);/g;
  const matches = [...source.matchAll(effectPattern)];
  if (matches.length > 1) {
    for (let i = matches.length - 1; i >= 1; i--) {
      const m = matches[i];
      source = source.slice(0, m.index) + source.slice(m.index + m[0].length);
    }
    console.log(`[chat-repair] removed ${matches.length - 1} duplicated session effects`);
  }

  if (!source.includes("clientMessageId?: string")) {
    source = replaceOnce(
      source,
      '  tool_calls?: ToolAction[];\n}',
      '  tool_calls?: ToolAction[];\n  clientMessageId?: string;\n  status?: "sending" | "streaming" | "tool_pending" | "tool_running" | "completed" | "failed";\n}',
      "message metadata",
    );
  }

  source = replaceOnce(
    source,
    '  const isCreatingSession = useRef(false);',
    '  const isCreatingSession = useRef(false);\n  const submitInFlight = useRef(false);',
    "submit lock ref",
  );

  source = replaceOnce(
    source,
    '    if ((!input.trim() && !file) || loading) return;',
    '    if ((!input.trim() && !file) || submitInFlight.current || uploadingMedia) return;\n    submitInFlight.current = true;',
    "submit guard",
  );

  if (!source.includes("const clientMessageId = typeof crypto")) {
    source = replaceOnce(
      source,
      '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientSideUserMsg: Message = {\n      role: "user",',
      '    const mediaType = file ? getMediaType(file) : undefined;\n    const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\n      ? crypto.randomUUID()\n      : String(Date.now()) + "-" + Math.random().toString(36).slice(2);\n    const clientSideUserMsg: Message = {\n      id: clientMessageId,\n      clientMessageId,\n      status: "sending",\n      role: "user",',
      "client message id",
    );
  }

  source = source.replaceAll(
    'setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));',
    'setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));',
  );

  source = source.replaceAll(
    'prev.map(m => m === clientSideUserMsg ? { ...m, media_url: mediaUrl } : m)',
    'prev.map(m => m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl } : m)',
  );

  source = source.replaceAll(
    'await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);',
    'const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);',
  );

  source = source.replaceAll(
    'const historyForGroq = messages.map((m) => ({',
    'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({',
  );

  source = source.replaceAll(
    'setMessages((prev) => [\n          ...prev,\n          { role: "assistant", content: result.response, tool_calls: result.executedActions },\n        ]);',
    'setMessages((prev) => prev\n          .map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "completed" } : m)\n          .concat({ id: "assistant-" + clientMessageId, role: "assistant", content: result.response, status: "completed", tool_calls: result.executedActions }));',
  );

  source = source.replaceAll(
    'await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions);',
    'await addAiMessage(sessionId, "assistant", result.response, undefined, undefined, result.executedActions, "assistant-" + clientMessageId);',
  );

  source = source.replaceAll(
    'confirmAndExecuteTool(action.tool, action.args)',
    'confirmAndExecuteTool(action.tool, action.args, currentSessionId)',
  );

  // Option buttons must follow the same persistence/idempotency path.
  source = replaceOnce(
    source,
    '    const clientSideUserMsg: Message = { role: "user", content: option };',
    '    const clientMessageId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\n      ? crypto.randomUUID()\n      : String(Date.now()) + "-" + Math.random().toString(36).slice(2);\n    const clientSideUserMsg: Message = { id: clientMessageId, clientMessageId, status: "sending", role: "user", content: option };',
    "option client message id",
  );
  source = source.replaceAll(
    'await addAiMessage(sessionId, "user", option);',
    'await addAiMessage(sessionId, "user", option, undefined, undefined, undefined, clientMessageId);',
  );
  source = source.replaceAll(
    'const historyForGroq = messages.map((m) => ({ role: m.role, content: m.content }));',
    'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({ role: m.role, content: m.content }));',
  );

  // Ensure pending actions can render even when result.response is empty.
  const pendingPlacement = '      if (result.error) {\n        setError(result.error);\n      } else if (result.response) {';
  if (source.includes(pendingPlacement)) {
    source = source.replace(
      pendingPlacement,
      '      if (result.error) {\n        setError(result.error);\n      }\n      if (result.actions && result.actions.length > 0) {\n        setPendingActions(result.actions);\n      }\n      if (result.response) {',
    );
    source = source.replaceAll(
      '        if (result.actions && result.actions.length > 0) {\n          setPendingActions(result.actions);\n        }\n',
      '',
    );
  }

  // Prevent a second response from being inserted over an optimistic user message.
  source = source.replaceAll(
    '    } finally {\n      setLoading(false);\n    }\n  };',
    '    } finally {\n      setLoading(false);\n      submitInFlight.current = false;\n    }\n  };',
  );

  write(p, source);
  console.log("[chat-repair] AIChatComponent repaired");
}

patchChat();
