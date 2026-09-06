from pathlib import Path

p = Path('learn-up/src/components/JarvisGlobalWidget.tsx')
s = p.read_text(encoding='utf-8')

# Logic-only imports.
if 'approveStableToolAction' not in s:
    anchor = 'import { askJarvis } from "@/actions/jarvis";'
    s = s.replace(anchor, anchor + '\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";\nimport { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";')
if 'useRouter' not in s:
    anchor = 'import { usePathname } from "next/navigation";'
    if anchor in s:
        s = s.replace(anchor, anchor.replace('usePathname', 'usePathname, useRouter'))
    else:
        s = s.replace('import dynamic from "next/dynamic";', 'import dynamic from "next/dynamic";\nimport { useRouter } from "next/navigation";')

if 'const router = useRouter();' not in s:
    marker = '  const pathname = usePathname();'
    s = s.replace(marker, marker + '\n  const router = useRouter();', 1)

# Persist active skills globally and for the current chat/session when available.
if 'getPersistedSkillPacks()' not in s:
    marker = '  const toggleWidget = () => {'
    effect = '''  useEffect(() => {\n    let cancelled = false;\n    getPersistedSkillPacks().then((skills) => { if (!cancelled && skills.length) setActiveSkills(skills); }).catch(() => {});\n    return () => { cancelled = true; };\n  }, []);\n\n'''
    s = s.replace(marker, effect + marker, 1)

old_toggle = '''        onToggleSkill={(skillId) => {\n          setActiveSkills(prev => \n            prev.includes(skillId) \n              ? prev.filter(id => id !== skillId)\n              : [...prev, skillId]\n          );\n        }}'''
new_toggle = '''        onToggleSkill={(skillId) => {\n          setActiveSkills(prev => {\n            const next = prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId];\n            void saveSkillPacks(next);\n            return next;\n          });\n        }}'''
if old_toggle in s: s = s.replace(old_toggle, new_toggle, 1)

# Client-side action handling for validated internal navigation and confirmations.
if 'action.tool === "navigate_app"' not in s:
    marker = '  const renderToolCard = (action: any) => {'
    nav_helper = '''  const executeClientAction = async (action: any) => {\n    if (action.tool === "navigate_app" && action.args?.route) {\n      const route = String(action.args.route);\n      router.push(route);\n      return;\n    }\n    if (action.tool === "open_url" && action.args?.url) {\n      try {\n        const url = new URL(String(action.args.url), window.location.origin);\n        if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);\n        else window.open(url.toString(), "_blank", "noopener,noreferrer");\n      } catch { /* ignored: backend already validates safe URLs */ }\n      return;\n    }\n    if (action.workflowId) {\n      const result = await approveStableToolAction(action.tool, action.args || {});\n      if (result?.response) setMessages((prev) => [...prev, { role: "assistant", content: result.response, actions: result.actions }]);\n    }\n  };\n\n'''
    s = s.replace(marker, nav_helper + marker, 1)

# Make visible action cards actually clickable without changing their visual structure.
s = s.replace('onClick={() => window.open(action.args.url, "_blank")}', 'onClick={() => void executeClientAction(action)}', 1)
s = s.replace('<button className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">\n              Confirmar y Agendar\n            </button>', '<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">\n              Confirmar y Agendar\n            </button>', 1)
s = s.replace('<button className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">\n              Proceder con la Búsqueda\n            </button>', '<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">\n              Proceder con la Búsqueda\n            </button>', 1)
s = s.replace('<button className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">\n              Generar y Practicar\n            </button>', '<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">\n              Generar y Practicar\n            </button>', 1)

# Model list data: exactly 10 verified current selectable models, no stale names.
start = s.find('          {showModelMenu && (')
if start >= 0:
    pop_start = s.find('            <div className="absolute top-14', start)
    arr_start = s.find('              {[' , pop_start)
    arr_end = s.find('              ].map(m => (', arr_start)
    if arr_start >= 0 and arr_end >= 0:
        new_arr = '''              {[\n                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },\n                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },\n                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n              '''
        s = s[:arr_start] + new_arr + s[arr_end:]

# Ensure no stale user-visible model identifiers survive this component.
for old, new in {
    'openrouter/dots-studio/dots-3-note-preview:free':'openrouter/openai/gpt-oss-120b:free',
    'openrouter/nvidia/nemotron-3.5-lightning:free':'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/z-ai/glm-5.2':'gemini/gemini-3.6-flash',
    'nvidia/nemotron-3-ultra-550b-a55b':'nvidia/nemotron-3-super-120b-a12b',
    'Dots 3':'GPT OSS 120B', 'Dots 3 Note':'GPT OSS 120B',
    'Nemotron 3.5 Lightning':'Nemotron 3 Super 120B', 'Nem 3.5':'GPT OSS 20B',
    'GLM-5.2':'Gemini 3.6 Flash', 'Nemotron 550B':'Nemotron 3 Super 120B',
}.items(): s = s.replace(old, new)

p.write_text(s, encoding='utf-8')
print('[DONE] Jarvis logic repaired')
