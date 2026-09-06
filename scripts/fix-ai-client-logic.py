from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "learn-up" / "src" / "components"

# Patch client chat logic without changing JSX classes/layout.
p = ROOT / "AIChatComponent.tsx"
s = p.read_text(encoding="utf-8")

s = s.replace('import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";', 'import { confirmAndExecuteTool, indexAiDocumentFromUrl } from "@/actions/ai-tutor";\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";')
s = s.replace('  requiresConfirm: boolean;\n}', '  requiresConfirm: boolean;\n  workflowId?: string;\n  client_message_id?: string;\n}')
s = s.replace('useState(defaultModel || "groq/llama-3.3-70b-versatile")', 'useState(defaultModel || "groq/openai/gpt-oss-20b")')

# Remove the second duplicated session effect.
effect = '''\n  useEffect(() => {\n    if (currentSessionId) {\n      if (isCreatingSession.current) {\n        // Prevent clearing messages when a new session was created in the current active chat flow\n        isCreatingSession.current = false;\n        return;\n      }\n      loadSessionMessages(currentSessionId);\n    } else {\n      setMessages([]);\n    }\n  }, [currentSessionId]);\n'''
parts = s.split(effect)
if len(parts) == 3:
    s = parts[0] + effect + parts[2]
else:
    print(f"[INFO] session effect occurrences={len(parts)-1}")

old_load = '''  const loadSessionMessages = async (sessionId: string) => {\n    setMessages([]);\n    setLoading(true);\n    const msgs = await getAiMessages(sessionId);\n    setMessages(msgs);\n    setLoading(false);\n  };'''
new_load = '''  const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);\n    try {\n      const msgs = await getAiMessages(sessionId) as Message[];\n      setMessages((prev) => {\n        const ids = new Set(msgs.map((m) => m.id).filter(Boolean));\n        const clientIds = new Set(msgs.map((m) => m.client_message_id).filter(Boolean));\n        const optimistic = prev.filter((m) => !m.id || (!ids.has(m.id) && !(m.client_message_id && clientIds.has(m.client_message_id))));\n        return [...msgs, ...optimistic];\n      });\n    } finally {\n      setLoading(false);\n    }\n  };'''
if old_load in s:
    s = s.replace(old_load, new_load, 1)
else:
    print('[INFO] loadSessionMessages pattern already patched')

old_msg = '''    const clientSideUserMsg: Message = {\n      role: "user",\n      content: userMessage,\n      media_url: file ? URL.createObjectURL(file) : undefined,\n      media_type: mediaType,\n    };'''
new_msg = '''    const clientSideUserMsg: Message = {\n      id: crypto.randomUUID(),\n      client_message_id: crypto.randomUUID(),\n      role: "user",\n      content: userMessage,\n      media_url: file ? URL.createObjectURL(file) : undefined,\n      media_type: mediaType,\n    };'''
if old_msg in s: s = s.replace(old_msg, new_msg, 1)
s = s.replace('setMessages((prev) => prev.filter((m) => m !== clientSideUserMsg));', 'setMessages((prev) => prev.filter((m) => m.id !== clientSideUserMsg.id));', 1)

old_save = '      await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType);'
new_save = '''      const savedUser = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientSideUserMsg.client_message_id);\n      if (savedUser?.message?.id) {\n        setMessages((prev) => prev.map((m) => m.id === clientSideUserMsg.id ? { ...m, id: savedUser.message.id, client_message_id: clientSideUserMsg.client_message_id, media_url: mediaUrl, media_type: mediaType } : m));\n      }'''
if old_save in s: s = s.replace(old_save, new_save, 1)
s = s.replace('const historyForGroq = messages.map((m) => ({', 'const historyForGroq = [...messages, clientSideUserMsg].map((m) => ({', 1)

s = s.replace('actionResult = await confirmAndExecuteTool(action.tool, action.args);', '''actionResult = (action as any).workflowId\n          ? await approveStableToolAction(action.tool, action.args)\n          : await confirmAndExecuteTool(action.tool, action.args);''', 1)

needle = '        if (!actionResult.success && actionResult.data?.suggestions) {'
cont = '''        if (actionResult?.response || Array.isArray(actionResult?.actions)) {\n            if (actionResult.response) {\n              if (currentSessionId) await addAiMessage(currentSessionId, "assistant", actionResult.response, undefined, undefined, actionResult.executedActions);\n              setMessages((prev) => [...prev, { role: "assistant", content: actionResult.response, tool_calls: actionResult.executedActions }]);\n            }\n            setPendingActions(actionResult.actions?.length ? actionResult.actions : []);\n        } else if (!actionResult.success && actionResult.data?.suggestions) {'''
if needle in s: s = s.replace(needle, cont, 1)

s = s.replace('  const handleRejectAction = async () => {', '  const handleRejectAction = async (rejectedAction?: ToolAction) => {', 1)
s = s.replace('    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', '    if (rejectedAction) await cancelStableToolAction(rejectedAction.tool, rejectedAction.args);\n    const msg = "Entendido, no realicé la acción. ¿Necesitas algo más?";', 1)
s = s.replace('onClick={handleRejectAction}', 'onClick={() => handleRejectAction(action)}', 1)

# Replace the existing model catalog while preserving its rendering structure.
old_models = '''                  {[\n                    {\n                      category: "OPENROUTER",\n                      models: [\n                        { id: "openrouter/dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", icon: <Brain className="w-4 h-4 text-purple-400" />, tag: "Preview" },\n                        { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                        { id: "openrouter/openai/gpt-oss-20b:free", name: "GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      ]\n                    },\n                    {\n                      category: "NVIDIA NIM",\n                      models: [\n                        { id: "nvidia/z-ai/glm-5.2", name: "GLM-5.2", icon: <Bot className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                        { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Gratis" },\n                      ]\n                    }\n                  ].map(cat => ('''
new_models = '''                  {[\n                    { category: "GROQ", models: [\n                      { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Rápido" },\n                      { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-4 h-4 text-purple-400" />, tag: "Potente" },\n                      { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-4 h-4 text-cyan-400" />, tag: "General" },\n                    ] },\n                    { category: "OPENROUTER", models: [\n                      { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-4 h-4 text-cyan-400" />, tag: "Research" },\n                    ] },\n                    { category: "GEMINI", models: [\n                      { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Multimodal" },\n                      { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Agente" },\n                      { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Rápido" },\n                    ] },\n                    { category: "NVIDIA NIM", models: [\n                      { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Reasoning" },\n                    ] },\n                  ].map(cat => ('''
if old_models in s: s = s.replace(old_models, new_models, 1)
else: print('[INFO] AIChat model catalog pattern already patched')

# Update compact selected-model label mapping.
s = s.replace('if (selectedModel.includes("dots-3")) return "Dots 3 Note";', 'if (selectedModel.includes("gpt-oss-120b")) return "GPT OSS 120B";')
s = s.replace('if (selectedModel.includes("nemotron-3.5-lightning")) return "Nemotron 3.5";', 'if (selectedModel.includes("gpt-oss-20b")) return "GPT OSS 20B";')
s = s.replace('if (selectedModel.includes("gpt-oss-20b")) return "OSS 20B";', 'if (selectedModel.includes("gemini-3.8")) return "Gemini 3.8";')
s = s.replace('if (selectedModel.includes("glm-5.2")) return "GLM 5.2";', 'if (selectedModel.includes("gemini-3.7")) return "Gemini 3.7";')
s = s.replace('if (selectedModel.includes("nemotron-3-ultra")) return "Nemotron 550B";', 'if (selectedModel.includes("nemotron-3-super")) return "Nemotron Super";')

p.write_text(s, encoding="utf-8")

# ---------------- JarvisGlobalWidget ----------------
p = ROOT / "JarvisGlobalWidget.tsx"
j = p.read_text(encoding="utf-8")
j = j.replace('useState("openrouter/dots-studio/dots-3-note-preview:free")', 'useState("groq/openai/gpt-oss-20b")')
j = j.replace('selectedModel.includes("dots-3") ? "Dots 3" :', 'selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :')
j = j.replace('selectedModel.includes("nemotron-3.5") ? "Nem 3.5" :', 'selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :')
j = j.replace('selectedModel.includes("gpt-oss-20b") ? "OSS 20B" :', 'selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :')
j = j.replace('selectedModel.includes("glm") ? "GLM-5.2" :', 'selectedModel.includes("gemini-3.7") ? "Gemini 3.7 Flash" :')
j = j.replace('selectedModel.includes("nemotron-3-ultra") ? "Nem 550B" :', 'selectedModel.includes("nemotron-3-super") ? "Nemotron Super 120B" :')
old_open = '''              {[\n                { id: "openrouter/dots-studio/dots-3-note-preview:free", name: "Dots 3 Note", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "openrouter/nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
new_open = '''              {[\n                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },\n                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n              ].map(m => ('''
if old_open in j: j = j.replace(old_open, new_open, 1)
old_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">NVIDIA NIM</div>\n              {[\n                { id: "nvidia/z-ai/glm-5.2", name: "GLM-5.2", icon: <Bot className="w-3 h-3 text-emerald-400" /> },\n                { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B", icon: <Zap className="w-3 h-3 text-emerald-500" /> },\n              ].map(m => ('''
new_nvidia = '''              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">Gemini / NVIDIA NIM</div>\n              {[\n                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },\n                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n              ].map(m => ('''
if old_nvidia in j: j = j.replace(old_nvidia, new_nvidia, 1)
for stale, fresh in [("Dots 3 Note", "GPT OSS 120B"), ("Nemotron 3.5 Lightning", "Nemotron 3 Super 120B"), ("GLM-5.2", "Gemini 3.6 Flash"), ("Nemotron 550B", "Nemotron 3 Super 120B")]: j = j.replace(stale, fresh)
p.write_text(j, encoding="utf-8")
print("[DONE] client AI logic repair complete")
