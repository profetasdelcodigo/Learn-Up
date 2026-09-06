from pathlib import Path
p=Path('learn-up/src/components/JarvisGlobalWidget.tsx')
s=p.read_text(encoding='utf-8')

# Preserve all visual classes/structure; replace only selector data and action handlers.
stale={
'openrouter/dots-studio/dots-3-note-preview:free':'openrouter/openai/gpt-oss-120b:free',
'openrouter/nvidia/nemotron-3.5-lightning:free':'openrouter/openai/gpt-oss-20b:free',
'nvidia/z-ai/glm-5.2':'gemini/gemini-3.6-flash',
'nvidia/nemotron-3-ultra-550b-a55b':'nvidia/nemotron-3-super-120b-a12b',
'Dots 3 Note':'GPT OSS 120B','Dots 3':'GPT OSS 120B',
'Nemotron 3.5 Lightning':'GPT OSS 20B','Nem 3.5':'GPT OSS 20B',
'GLM-5.2':'Gemini 3.6 Flash','Nemotron 550B':'Nemotron 3 Super 120B'
}
for a,b in stale.items(): s=s.replace(a,b)

# Replace the first model-array body in the selector with exactly 10 verified models.
marker='          {showModelMenu && ('
base=s.find(marker)
arr=s.find('              {[',base)
end=s.find('              ].map(m => (',arr)
if arr>=0 and end>arr:
    new='''              {[
                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },
                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },
                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },
                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },
                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },
                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },
                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },
                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },
                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },
                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },
'''
    s=s[:arr]+new+s[end:]

# Remove the stale duplicate mini section immediately following the first 10-model array.
# It starts with the old NVIDIA heading; delete through its second button-map close.
dup_start=s.find('              <div className="text-[9px] font-semibold text-gray-500 mt-2 mb-1 px-2 uppercase">NVIDIA NIM</div>', end)
if dup_start>=0:
    dup_end=s.find('            </div>\n          )}', dup_start)
    if dup_end>dup_start:
        s=s[:dup_start]+s[dup_end:]

# Use real workflow-aware action handlers for visible tool cards.
if 'const executeClientAction = async' not in s:
    anchor='  const renderToolCard = (action: any) => {'
    helper='''  const executeClientAction = async (action: any) => {\n    if (action.tool === "navigate_app" && action.args?.route) {\n      router.push(String(action.args.route));\n      return;\n    }\n    if (action.tool === "open_url" && action.args?.url) {\n      const url = new URL(String(action.args.url), window.location.origin);\n      if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);\n      else window.open(url.toString(), "_blank", "noopener,noreferrer");\n      return;\n    }\n    if (action.workflowId) {\n      const result = await approveStableToolAction(action.tool, action.args || {});\n      if (result?.response) setMessages((prev) => [...prev, { role: "assistant", content: result.response, actions: result.actions }]);\n    }\n  };\n\n'''
    s=s.replace(anchor,helper+anchor,1)

# Imports and router.
if 'approveStableToolAction' not in s:
    s=s.replace('import { askJarvis } from "@/actions/jarvis";','import { askJarvis } from "@/actions/jarvis";\nimport { approveStableToolAction, cancelStableToolAction } from "@/actions/stable-ai-agents";\nimport { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";')
if 'useRouter' not in s:
    s=s.replace('import { usePathname } from "next/navigation";','import { usePathname, useRouter } from "next/navigation";')
if 'const router = useRouter();' not in s:
    s=s.replace('  const pathname = usePathname();','  const pathname = usePathname();\n  const router = useRouter();',1)

# Persist skills.
if 'getPersistedSkillPacks().then' not in s:
    s=s.replace('  const toggleWidget = () => {','  useEffect(() => { let cancelled=false; getPersistedSkillPacks().then((skills)=>{if(!cancelled&&skills.length)setActiveSkills(skills)}).catch(()=>{}); return ()=>{cancelled=true}; }, []);\n\n  const toggleWidget = () => {',1)
s=s.replace('''        onToggleSkill={(skillId) => {\n          setActiveSkills(prev => \n            prev.includes(skillId) \n              ? prev.filter(id => id !== skillId)\n              : [...prev, skillId]\n          );\n        }}''','''        onToggleSkill={(skillId) => {\n          setActiveSkills(prev => { const next = prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]; void saveSkillPacks(next); return next; });\n        }}''',1)

# Hook card buttons without changing classes.
s=s.replace('onClick={() => window.open(action.args.url, "_blank")}', 'onClick={() => void executeClientAction(action)}',1)
s=s.replace('''<button className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">\n              Confirmar y Agendar\n            </button>''','''<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">\n              Confirmar y Agendar\n            </button>''',1)
s=s.replace('''<button className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">\n              Proceder con la Búsqueda\n            </button>''','''<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">\n              Proceder con la Búsqueda\n            </button>''',1)
s=s.replace('''<button className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">\n              Generar y Practicar\n            </button>''','''<button onClick={() => void executeClientAction(action)} className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">\n              Generar y Practicar\n            </button>''',1)

p.write_text(s,encoding='utf-8')
print('[DONE] final Jarvis selector/action repair')
