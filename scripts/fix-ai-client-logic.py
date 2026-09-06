from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "learn-up" / "src" / "components"

# Logic-only repair. Do not change visual classes/layout.
p = ROOT / "AIChatComponent.tsx"
s = p.read_text(encoding="utf-8")

# Imports for workflow-aware confirmation.
if 'approveStableToolAction' not in s:
    s = s.replace('import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";', 'import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";')

# Extend message metadata.
s = s.replace('  requiresConfirm: boolean;\n}', '  requiresConfirm: boolean;\n  workflowId?: string;\n  client_message_id?: string;\n}', 1)
s = s.replace('useState(defaultModel || "groq/llama-3.3-70b-versatile")', 'useState(defaultModel || "groq/openai/gpt-oss-20b")')

# Replace the session loader regardless of previous formatting.
loader = re.compile(r'  const loadSessionMessages = async \(sessionId: string\) => \{.*?\n  \};', re.S)
new_loader = '''  const loadSessionMessages = async (sessionId: string) => {
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
  };'''
if loader.search(s):
    s = loader.sub(new_loader, s, count=1)
else:
    print('[WARN] loadSessionMessages function not found')

# Remove an exact duplicated currentSession effect, if present.
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
occ = s.count(effect)
if occ > 1:
    first = s.find(effect)
    second = s.find(effect, first + len(effect))
    s = s[:second] + s[second + len(effect):]
    print('[OK] removed duplicated currentSessionId effect')

# Ensure optimistic message has stable IDs.
msg_pattern = re.compile(r'    const clientSideUserMsg: Message = \{\n(.*?)\n    \};', re.S)
match = msg_pattern.search(s)
if match and 'client_message_id' not in match.group(0):
    body = match.group(1)
    if 'id:' not in body:
        body = '      id: crypto.randomUUID(),\n' + body
    body = '      client_message_id: crypto.randomUUID(),\n' + body
    s = s[:match.start()] + '    const clientSideUserMsg: Message = {\n' + body + '\n    };' + s[match.end():]
    print('[OK] stable optimistic ids')

s = s.replace('setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));', 'setMessages((prev) => prev.filter((m) => m.id !== clientSideUserMsg.id));')

# Persist using clientMessageId.
old_save = '      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);'
if old_save in s:
    s = s.replace(old_save, '      const savedUser = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientSideUserMsg.client_message_id);\n      if (savedUser?.message?.id) setMessages((prev) => prev.map((m) => m.id === clientSideUserMsg.id ? { ...m, id: savedUser.message.id, client_message_id: clientSideUserMsg.client_message_id, media_url: mediaUrl, media_type: mediaType } : m));', 1)

s = s.replace('const historyForGroq = messages.map((m) => ({', 'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({', 1)

# Approvals resume the persisted workflow; rejection cancels it.
s = s.replace('actionResult = await confirmAndExecuteTool(action.tool, action.args);', 'actionResult = (action as any).workflowId ? await approveStableToolAction(action.tool, action.args) : await confirmAndExecuteTool(action.tool, action.args);', 1)
s = s.replace('        if (!actionResult.success && actionResult.data?.suggestions) {', '        if (actionResult?.response || Array.isArray(actionResult?.actions)) {\n            if (actionResult.response) {\n              if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.response, undefined, undefined, actionResult.executedActions);\n              setMessages((prev) => [...prev, { role: "assistant", content: actionResult.response, tool_calls: actionResult.executedActions }]);\n            }\n            setPendingActions(actionResult.actions?.length ? actionResult.actions : []);\n        } else if (!actionResult.success && actionResult.data?.suggestions) {', 1)
s = s.replace('  const handleRejectAction = async () => {', '  const handleRejectAction = async (rejectedAction?: ToolAction) => {', 1)
s = s.replace('    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', '    if (rejectedAction) await cancelStableToolAction(rejectedAction.tool, rejectedAction.args);\n    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', 1)
s = s.replace('onClick={handleRejectAction}', 'onClick={() => handleRejectAction(action)}', 1)

# Replace stale model selector entries with the verified current catalog.
old_models = '''                  {[\n                    {\n                      category: "OPENROUTER",\n                      models: [\n                        { id: "openrouter/dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", icon: <Brain className="w-4 h-4 text-purple-400" />, tag: "Preview" },\n                        { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                        { id: "openrouter/openai/gpt-oss-20b:free", name: "GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      ]\n                    },\n                    {\n                      category: "NVIDIA NIM",\n                      models: [\n                        { id: "nvidia/z-ai/glm-5.2", name: "GLM-5.2", icon: <Bot className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                        { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                      ]\n                    }\n                  ].map(cat => ('''
new_models = '''                  {[\n                    { category: "GROQ", models: [\n                      { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Rápido" },\n                      { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-4 h-4 text-purple-400" />, tag: "Potente" },\n                      { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-4 h-4 text-cyan-400" />, tag: "General" },\n                    ] },\n                    { category: "OPENROUTER", models: [\n                      { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-4 h-4 text-cyan-400" />, tag: "Research" },\n                    ] },\n                    { category: "GEMINI", models: [\n                      { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Multimodal" },\n                      { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Agente" },\n                      { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Rápido" },\n                    ] },\n                    { category: "NVIDIA NIM", models: [\n                      { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Reasoning" },\n                    ] },\n                  ].map(cat => ('''
if old_models in s:
    s = s.replace(old_models, new_models, 1)

for old, new in [
    ('if (selectedModel.includes("dots-3")) return "Dots 3 Note";', 'if (selectedModel.includes("gpt-oss-120b")) return "GPT OSS 120B";'),
    ('if (selectedModel.includes("nemotron-3.5-lightning")) return "Nemotron 3.5";', 'if (selectedModel.includes("gpt-oss-20b")) return "GPT OSS 20B";'),
    ('if (selectedModel.includes("gpt-oss-20b")) return "OSS 20B";', 'if (selectedModel.includes("gemini-3.8")) return "Gemini 3.8";'),
    ('if (selectedModel.includes("glm-5.2")) return "GLM 5.2";', 'if (selectedModel.includes("gemini-3.7")) return "Gemini 3.7";'),
    ('if (selectedModel.includes("nemotron-3-ultra")) return "Nemotron 550B";', 'if (selectedModel.includes("nemotron-3-super")) return "Nemotron Super";'),
]: s = s.replace(old, new)

# Jarvis model selector
jpath = ROOT / "JarvisGlobalWidget.tsx"
j = jpath.read_text(encoding="utf-8")
j = j.replace('useState("openrouter/dots-studio/dots-3-note-preview:free")', 'useState("groq/openai/gpt-oss-20b")')
old_open = '''              {[\n                { id: "openrouter/dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
new_open = '''              {[\n                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },\n                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
if old_open in j: j = j.replace(old_open, new_open, 1)
old_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">NVIDIA NIM</div>\n              {[\n                { id: "nvidia/z-ai/glm-5.2", name: "GLM-5.2", icon: <Bot className="w-3 h-3 text-emerald-400" /> },\n                { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B", icon: <Zap className="w-3 h-3 text-emerald-500" /> },\n              ].map(m => ('''
new_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">GEMINI / NVIDIA NIM</div>\n              {[\n                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },\n                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n              ].map(m => ('''
if old_nvidia in j: j = j.replace(old_nvidia, new_nvidia, 1)
for old, new in [
    ('selectedModel.includes("dots-3") ? "Dots 3" :', 'selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :'),
    ('selectedModel.includes("nemotron-3.5") ? "Nem 3.5" :', 'selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :'),
    ('selectedModel.includes("gpt-oss-20b") ? "OSS 20B" :', 'selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :'),
    ('selectedModel.includes("glm") ? "GLM-5.2" :', 'selectedModel.includes("gemini-3.7") ? "Gemini 3.7 Flash" :'),
    ('selectedModel.includes("nemotron-3-ultra") ? "Nem 550B" :', 'selectedModel.includes("nemotron-3-super") ? "Nemotron Super 120B" :'),
]: j = j.replace(old, new)
for old, new in {
    'openrouter/dots-studio/dots-3-note-preview:free':'openrouter/openai/gpt-oss-120b:free',
    'openrouter/nvidia/nemotron-3.5-lightning:free':'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/z-ai/glm-5.2':'gemini/gemini-3.6-flash',
    'nvidia/nemotron-3-ultra-550b-a55b':'nvidia/nemotron-3-super-120b-a12b',
    'Dots 3 Note':'GPT OSS 120B',
    'Nemotron 3.5 Lightning':'Nemotron 3 Super 120B',
    'GLM-5.2':'Gemini 3.6 Flash',
    'Nemotron 550B':'Nemotron 3 Super 120B',
}.items(): j = j.replace(old, new)

p.write_text(s, encoding="utf-8")
jpath.write_text(j, encoding="utf-8")
print('[DONE] one-shot AI client logic repair')
