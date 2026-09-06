from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "learn-up" / "src" / "components"


def replace_once(text, old, new, label):
    if old not in text:
        print(f"[SKIP] {label}: patrón no encontrado")
        return text
    print(f"[OK] {label}")
    return text.replace(old, new, 1)


# ---------------- AIChatComponent ----------------
p = ROOT / "AIChatComponent.tsx"
s = p.read_text(encoding="utf-8")

s = s.replace('import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";', 'import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";')
s = s.replace('  requiresConfirm: boolean;\n}', '  requiresConfirm: boolean;\n  workflowId?: string;\n  client_message_id?: string;\n}')
s = s.replace('useState(defaultModel || "groq/llama-3.3-70b-versatile")', 'useState(defaultModel || "groq/openai/gpt-oss-20b")')

# Remove the duplicated currentSessionId effect while preserving the first one.
pattern = re.compile(r'\n  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{\n      if \(isCreatingSession\.current\) \{\n        // Prevent clearing messages when a new session was created in the current active chat flow\n        isCreatingSession\.current = false;\n        return;\n      \}\n      loadSessionMessages\(currentSessionId\);\n    \} else \{\n      setMessages\(\[\]\);\n    \}\n  \}, \[currentSessionId\]\);\n', re.M)
matches = list(pattern.finditer(s))
if len(matches) >= 2:
    s = s[:matches[1].start()] + s[matches[1].end():]
    print("[OK] removed duplicated currentSessionId effect")
else:
    print("[SKIP] duplicated currentSessionId effect not found twice")

old_load = '''  const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);\n    const msgs = await getAiMessages(sessionId);\n    setMessages(msgs);\n    setLoading(false);\n  };'''
new_load = '''  const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);\n    try {\n      const msgs = await getAiMessages(sessionId);\n      setMessages((prev) => {\n        const persistedById = new Map((msgs as Message[]).filter((m) => m.id).map((m) => [m.id, m]));\n        const persistedByClient = new Map((msgs as Message[]).filter((m) => m.client_message_id).map((m) => [m.client_message_id, m]));\n        const optimistic = prev.filter((m) =>\n          !m.id || (!persistedById.has(m.id) && !(m.client_message_id && persistedByClient.has(m.client_message_id)))\n        );\n        return [...(msgs as Message[]), ...optimistic];\n      });\n    } finally {\n      setLoading(false);\n    }\n  };'''
s = replace_once(s, old_load, new_load, "reconcile session messages without clearing optimistic state")

# Generate an id for the optimistic user message and persist the same id server-side.
old_msg = '''    const clientSideUserMsg: Message = {\n      role: "user",\n      content: userMessage,\n      media_url: file ? URL.createObjectURL(file) : undefined,\n      media_type: mediaType,\n    };'''
new_msg = '''    const clientSideUserMsg: Message = {\n      id: crypto.randomUUID(),\n      client_message_id: crypto.randomUUID(),\n      role: "user",\n      content: userMessage,\n      media_url: file ? URL.createObjectURL(file) : undefined,\n      media_type: mediaType,\n    };'''
s = replace_once(s, old_msg, new_msg, "stable optimistic message ids")
s = s.replace('setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));', 'setMessages((prev) => prev.filter((m) => m.id !== clientSideUserMsg.id));')

old_save = '      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);'
new_save = '''      const savedUser = await addAiMessage(\n        sessionId,\n        "user",\n        userMessage,\n        mediaUrl,\n        mediaType,\n        undefined,\n        clientSideUserMsg.client_message_id,\n      );\n      if (savedUser?.message?.id) {\n        setMessages((prev) => prev.map((m) =>\n          m.id === clientSideUserMsg.id\n            ? { ...m, id: savedUser.message.id, client_message_id: clientSideUserMsg.client_message_id, media_url: mediaUrl, media_type: mediaType }\n            : m\n        ));\n      }'''
s = replace_once(s, old_save, new_save, "idempotent user-message persistence")
s = s.replace('const historyForGroq = messages.map((m) => ({', 'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({', 1)

# Use the workflow-aware approval action so approving a pending tool resumes the remaining workflow.
s = s.replace('actionResult = await confirmAndExecuteTool(action.tool, action.args);', '''actionResult = (action as any).workflowId\n          ? await approveStableToolAction(action.tool, action.args)\n          : await confirmAndExecuteTool(action.tool, action.args);''', 1)

# Handle workflow continuation responses before legacy direct-result handling.
needle = '''        if (!actionResult.success && actionResult.data?.suggestions) {'''
replacement = '''        if (actionResult?.response || Array.isArray(actionResult?.actions)) {\n            if (actionResult.response) {\n              if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.response, undefined, undefined, actionResult.executedActions);\n              setMessages((prev) => [...prev, { role: "assistant", content: actionResult.response, tool_calls: actionResult.executedActions }]);\n            }\n            if (actionResult.actions?.length) setPendingActions(actionResult.actions);\n            else setPendingActions([]);\n        } else if (!actionResult.success && actionResult.data?.suggestions) {'''
s = replace_once(s, needle, replacement, "workflow continuation after approval")

# Make the reject action cancel the persisted workflow when possible.
s = replace_once(s, '  const handleRejectAction = async () => {', '  const handleRejectAction = async (rejectedAction?: ToolAction) => {', "reject action accepts workflow")
s = s.replace('    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', '    if (rejectedAction) {\n      await cancelStableToolAction(rejectedAction.tool, rejectedAction.args);\n    }\n    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', 1)
s = s.replace('onClick={handleRejectAction}', 'onClick={() => handleRejectAction(action)}', 1)

# ---------------- JarvisGlobalWidget ----------------
p2 = ROOT / "JarvisGlobalWidget.tsx"
j = p2.read_text(encoding="utf-8")

j = j.replace('useState("openrouter/dots-studio/dots-3-note-preview:free")', 'useState("groq/openai/gpt-oss-20b")')
j = j.replace('selectedModel.includes("dots-3") ? "Dots 3" :', 'selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :')
j = j.replace('selectedModel.includes("nemotron-3.5") ? "Nem 3.5" :', 'selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :')
j = j.replace('selectedModel.includes("gpt-oss-20b") ? "OSS 20B" :', 'selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :')
j = j.replace('selectedModel.includes("glm") ? "GLM-5.2" :', 'selectedModel.includes("gemini-3.7") ? "Gemini 3.7 Flash" :')
j = j.replace('selectedModel.includes("nemotron-3-ultra") ? "Nem 550B" :', 'selectedModel.includes("nemotron-3-super") ? "Nemotron 3 Super 120B" :')

# Replace only the model data arrays; JSX structure/classes remain untouched.
old_open = '''              {[\n                { id: "openrouter/dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
new_open = '''              {[\n                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },\n                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
j = replace_once(j, old_open, new_open, "Jarvis OpenRouter/Groq model list")

old_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">NVIDIA NIM</div>\n              {[\n                { id: "nvidia/z-ai/glm-5.2", name: "GLM-5.2", icon: <Bot className="w-3 h-3 text-emerald-400" /> },\n                { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B", icon: <Zap className="w-3 h-3 text-emerald-500" /> },\n              ].map(m => ('''
new_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">Gemini / NVIDIA NIM</div>\n              {[\n                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },\n                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n              ].map(m => ('''
j = replace_once(j, old_nvidia, new_nvidia, "Jarvis Gemini/NVIDIA model list")

# Ensure no stale model labels remain in these user-facing components.
for stale, fresh in [
    ("Dots 3 Note", "GPT OSS 120B"),
    ("Nemotron 3.5 Lightning", "Nemotron 3 Super 120B"),
    ("GLM-5.2", "Gemini 3.6 Flash"),
    ("Nemotron 550B", "Nemotron 3 Super 120B"),
]:
    j = j.replace(stale, fresh)

p.write_text(s, encoding="utf-8")
p2.write_text(j, encoding="utf-8")
print("[DONE] AI client logic patches applied")
