from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "learn-up" / "src" / "components"


def replace_block(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    end = text.find(end_marker, start if start >= 0 else 0)
    if start < 0 or end < 0 or end <= start:
        print(f"[WARN] {label}: markers not found")
        return text
    print(f"[OK] {label}")
    return text[:start] + replacement + text[end:]

p = ROOT / "AIChatComponent.tsx"
s = p.read_text(encoding="utf-8")

if 'approveStableToolAction' not in s:
    s = s.replace('import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";', 'import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";')

if 'workflowId?: string;' not in s:
    s = s.replace('  requiresConfirm: boolean;\n}', '  requiresConfirm: boolean;\n  workflowId?: string;\n  client_message_id?: string;\n}', 1)

s = s.replace('useState(defaultModel || "groq/llama-3.3-70b-versatile")', 'useState(defaultModel || "groq/openai/gpt-oss-20b")')

loader = '''  const loadSessionMessages = async (sessionId: string) => {
    setLoading(true);
    try {
      const msgs = await getAiMessages(sessionId) as Message[];
      setMessages((prev) => {
        const persistedIds = new Set(msgs.map((m) => m.id).filter(Boolean));
        const persistedClientIds = new Set(msgs.map((m) => m.client_message_id).filter(Boolean));
        const optimistic = prev.filter((m) => !m.id || (!persistedIds.has(m.id) && !(m.client_message_id && persistedClientIds.has(m.client_message_id))));
        return [...msgs, ...optimistic];
      });
    } finally {
      setLoading(false);
    }
  };

'''
s = replace_block(s, '  const loadSessionMessages = async (sessionId: string) => {', '  const getMediaType', loader, 'reconcile session loader')

# Remove duplicate currentSession effect by exact block count.
effect = '''  useEffect(() => {
    if (currentSessionId) {
      if (isCreatingSession.current) {
        // Prevent clearing messages when a new session was created in the current active chat flow
        isCreatingSession.current = false;
        return;
      }
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);'''
while s.count(effect) > 1:
    idx = s.find(effect, s.find(effect) + 1)
    s = s[:idx] + s[idx + len(effect):]
    print('[OK] removed duplicate currentSessionId effect')

# Stable optimistic message IDs.
msg_start = s.find('    const clientSideUserMsg: Message = {')
msg_end = s.find('    };', msg_start)
if msg_start >= 0 and msg_end >= 0:
    block = s[msg_start:msg_end]
    if 'client_message_id:' not in block:
        inner = block[len('    const clientSideUserMsg: Message = {'):]
        if 'id:' not in inner:
            inner = '\n      id: crypto.randomUUID(),' + inner
        inner = '\n      client_message_id: crypto.randomUUID(),' + inner
        s = s[:msg_start] + '    const clientSideUserMsg: Message = {' + inner + '\n' + s[msg_end:]

s = s.replace('setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));', 'setMessages((prev) => prev.filter((m) => m.id !== clientSideUserMsg.id));')
s = s.replace('      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);', '      const savedUser = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientSideUserMsg.client_message_id);\n      if (savedUser?.message?.id) setMessages((prev) => prev.map((m) => m.id === clientSideUserMsg.id ? { ...m, id: savedUser.message.id, client_message_id: clientSideUserMsg.client_message_id, media_url: mediaUrl, media_type: mediaType } : m));', 1)
s = s.replace('const historyForGroq = messages.map((m) => ({', 'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({', 1)

# Workflow-aware confirmation.
s = s.replace('actionResult = await confirmAndExecuteTool(action.tool, action.args);', 'actionResult = (action as any).workflowId ? await approveStableToolAction(action.tool, action.args) : await confirmAndExecuteTool(action.tool, action.args);', 1)
s = s.replace('        if (!actionResult.success && actionResult.data?.suggestions) {', '        if (actionResult?.response || Array.isArray(actionResult?.actions)) {\n            if (actionResult.response) {\n              if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.response, undefined, undefined, actionResult.executedActions);\n              setMessages((prev) => [...prev, { role: "assistant", content: actionResult.response, tool_calls: actionResult.executedActions }]);\n            }\n            setPendingActions(actionResult.actions?.length ? actionResult.actions : []);\n        } else if (!actionResult.success && actionResult.data?.suggestions) {', 1)
s = s.replace('  const handleRejectAction = async () => {', '  const handleRejectAction = async (rejectedAction?: ToolAction) => {', 1)
s = s.replace('    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', '    if (rejectedAction) await cancelStableToolAction(rejectedAction.tool, rejectedAction.args);\n    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', 1)
s = s.replace('onClick={handleRejectAction}', 'onClick={() => handleRejectAction(action)}', 1)

# Replace stale model IDs in the existing selector data and labels without touching layout/classes.
replacements = {
    'openrouter/dots-studio/dots-3-note-preview:free': 'openrouter/openai/gpt-oss-120b:free',
    'openrouter/nvidia/nemotron-3.5-lightning:free': 'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/z-ai/glm-5.2': 'gemini/gemini-3.6-flash',
    'nvidia/nemotron-3-ultra-550b-a55b': 'nvidia/nemotron-3-super-120b-a12b',
    'Dots 3 Note': 'GPT OSS 120B',
    'Nemotron 3.5 Lightning': 'Nemotron 3 Super 120B',
    'GLM-5.2': 'Gemini 3.6 Flash',
    'Nemotron 550B': 'Nemotron 3 Super 120B',
}
for old, new in replacements.items():
    s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

p = ROOT / "JarvisGlobalWidget.tsx"
j = p.read_text(encoding="utf-8")
j = j.replace('useState("openrouter/dots-studio/dots-3-note-preview:free")', 'useState("groq/openai/gpt-oss-20b")')
for old, new in replacements.items():
    j = j.replace(old, new)
# Replace the three stale display branches explicitly.
j = j.replace('selectedModel.includes("dots-3") ? "Dots 3" :', 'selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :')
j = j.replace('selectedModel.includes("nemotron-3.5") ? "Nem 3.5" :', 'selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :')
j = j.replace('selectedModel.includes("gpt-oss-20b") ? "OSS 20B" :', 'selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :')
j = j.replace('selectedModel.includes("glm") ? "GLM-5.2" :', 'selectedModel.includes("gemini-3.7") ? "Gemini 3.7 Flash" :')
j = j.replace('selectedModel.includes("nemotron-3-ultra") ? "Nem 550B" :', 'selectedModel.includes("nemotron-3-super") ? "Nemotron Super 120B" :')
p.write_text(j, encoding="utf-8")
print('[DONE] one-shot AI client logic repair')
