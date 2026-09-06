from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "learn-up" / "src" / "components"

p = ROOT / "AIChatComponent.tsx"
s = p.read_text(encoding="utf-8")

# Imports: persisted skill state.
if 'getPersistedSkillPacks' not in s:
    anchor = 'import ThinkingBlock from "./ai/ThinkingBlock";'
    s = s.replace(anchor, anchor + '\nimport { getPersistedSkillPacks, saveSkillPacks } from "@/lib/ai/core/skill-state";')

# Initialize and persist active skills for this session + globally.
old_effect = '''  useEffect(() => {\n    if (currentSessionId) {\n      if (isCreatingSession.current) {\n        isCreatingSession.current = false;\n        return;\n      }\n      loadSessionMessages(currentSessionId);\n    } else {\n      setMessages([]);\n    }\n  }, [currentSessionId]);'''
new_effect = '''  useEffect(() => {\n    let cancelled = false;\n    if (!currentSessionId) {\n      setMessages([]);\n      getPersistedSkillPacks().then((skills) => { if (!cancelled) setActiveSkills(skills); }).catch(() => {});\n      return () => { cancelled = true; };\n    }\n    if (isCreatingSession.current) {\n      isCreatingSession.current = false;\n    } else {\n      loadSessionMessages(currentSessionId);\n    }\n    getPersistedSkillPacks(currentSessionId).then((skills) => { if (!cancelled && skills.length) setActiveSkills(skills); }).catch(() => {});\n    return () => { cancelled = true; };\n  }, [currentSessionId]);'''
if old_effect in s:
    s = s.replace(old_effect, new_effect, 1)

old_toggle = '''                onToggleSkill={(id) => {\n                  setActiveSkills(prev => \n                    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]\n                  );\n                }}'''
new_toggle = '''                onToggleSkill={(id) => {\n                  setActiveSkills(prev => {\n                    const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];\n                    void saveSkillPacks(next, currentSessionId);\n                    void saveSkillPacks(next);\n                    return next;\n                  });\n                }}'''
if old_toggle in s:
    s = s.replace(old_toggle, new_toggle, 1)

# Preserve pending workflow actions after submit; do not clear them in finally.
s = s.replace('      if (!actionResult?.data?.suggestions) setPendingActions([]);', '      if (!actionResult?.data?.suggestions && !actionResult?.actions?.length) setPendingActions([]);', 1)

# Internal navigation should use Next router; external URLs still open normally.
old_open = '''        window.open(safeUrl, "_blank", "noopener,noreferrer");\n        const msg = `Abriendo: ${action.args.title || safeUrl}`;'''
new_open = '''        try {\n          const url = new URL(safeUrl, window.location.origin);\n          if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);\n          else window.open(url.toString(), "_blank", "noopener,noreferrer");\n        } catch {\n          throw new Error("No pude interpretar la URL de navegación.");\n        }\n        const msg = `Abriendo: ${action.args.title || safeUrl}`;'''
if old_open in s:
    s = s.replace(old_open, new_open, 1)

# Keep model selector visual structure; replace data only using markers.
start_marker = '                  {['
start = s.find(start_marker)
if start >= 0:
    cat_open = s.find('                    {\n                      category: "OPENROUTER",', start)
    cat_end = s.find('                  ].map(cat => (', cat_open)
    if cat_open >= 0 and cat_end >= 0:
        model_array = '''                    { category: "GROQ", models: [\n                      { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Rápido" },\n                      { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-4 h-4 text-purple-400" />, tag: "Potente" },\n                      { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-4 h-4 text-cyan-400" />, tag: "General" },\n                    ] },\n                    { category: "OPENROUTER", models: [\n                      { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-4 h-4 text-gray-200" />, tag: "Gratis" },\n                      { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-4 h-4 text-cyan-400" />, tag: "Research" },\n                    ] },\n                    { category: "GEMINI", models: [\n                      { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Multimodal" },\n                      { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Agente" },\n                      { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-4 h-4 text-blue-400" />, tag: "Rápido" },\n                    ] },\n                    { category: "NVIDIA NIM", models: [\n                      { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-4 h-4 text-emerald-400" />, tag: "Reasoning" },\n                    ] },\n'''
        s = s[:cat_open] + model_array + s[cat_end:]

# Remove stale labels from compact selected-model logic.
for old, new in [
    ('if (selectedModel.includes("dots-3")) return "Dots 3 Note";', 'if (selectedModel.includes("gpt-oss-120b")) return "GPT OSS 120B";'),
    ('if (selectedModel.includes("nemotron-3.5-lightning")) return "Nemotron 3.5";', 'if (selectedModel.includes("gpt-oss-20b")) return "GPT OSS 20B";'),
    ('if (selectedModel.includes("gpt-oss-20b")) return "OSS 20B";', 'if (selectedModel.includes("gemini-3.8")) return "Gemini 3.8";'),
    ('if (selectedModel.includes("glm-5.2")) return "GLM 5.2";', 'if (selectedModel.includes("gemini-3.7")) return "Gemini 3.7";'),
    ('if (selectedModel.includes("nemotron-3-ultra")) return "Nemotron 550B";', 'if (selectedModel.includes("nemotron-3-super")) return "Nemotron Super";'),
]: s = s.replace(old, new)

p.write_text(s, encoding="utf-8")

# Jarvis: replace all stale user-visible model names/ids in the existing selector without touching CSS/layout.
p = ROOT / "JarvisGlobalWidget.tsx"
j = p.read_text(encoding="utf-8")
j = j.replace('useState("openrouter/dots-studio/dots-3-note-preview:free")', 'useState("groq/openai/gpt-oss-20b")')
for old, new in {
    'openrouter/dots-studio/dots-3-note-preview:free':'openrouter/openai/gpt-oss-120b:free',
    'openrouter/nvidia/nemotron-3.5-lightning:free':'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/z-ai/glm-5.2':'gemini/gemini-3.6-flash',
    'nvidia/nemotron-3-ultra-550b-a55b':'nvidia/nemotron-3-super-120b-a12b',
    'Dots 3':'GPT OSS 120B',
    'Dots 3 Note':'GPT OSS 120B',
    'Nemotron 3.5 Lightning':'Nemotron 3 Super 120B',
    'Nem 3.5':'GPT OSS 20B',
    'GLM-5.2':'Gemini 3.6 Flash',
    'Nemotron 550B':'Nemotron 3 Super 120B',
}.items(): j = j.replace(old, new)
j = j.replace('selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :\n                   selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :\n                   selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :\n                   selectedModel.includes("glm") ? "Gemini 3.6 Flash" :\n                   selectedModel.includes("nemotron-3-super") ? "Nemotron Super 120B" :', 'selectedModel.includes("gpt-oss-120b") ? "GPT OSS 120B" :\n                   selectedModel.includes("gpt-oss-20b") ? "GPT OSS 20B" :\n                   selectedModel.includes("gemini-3.8") ? "Gemini 3.8 Flash" :\n                   selectedModel.includes("gemini-3.7") ? "Gemini 3.7 Flash" :\n                   selectedModel.includes("gemini-3.6") ? "Gemini 3.6 Flash" :\n                   selectedModel.includes("nemotron-3-super") ? "Nemotron Super 120B" :')
# Replace Jarvis selector data array using category markers when present.
cat = j.find('              [{')
if cat >= 0:
    o = j.find('{ id: "openrouter/openai/gpt-oss-120b:free"', cat)
    end = j.find('              ].map(m => (', o)
    if o >= 0 and end >= 0:
        # Find beginning of models after '[' and replace whole array content.
        arr_start = cat + len('              ')
        j = j[:arr_start] + '''[\n                { id: "groq/openai/gpt-oss-20b", name: "Groq · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "groq/openai/gpt-oss-120b", name: "Groq · GPT OSS 120B", icon: <Brain className="w-3 h-3 text-purple-400" /> },\n                { id: "groq/llama-3.3-70b-versatile", name: "Groq · Llama 3.3 70B", icon: <BrainCircuit className="w-3 h-3 text-cyan-400" /> },\n                { id: "openrouter/openai/gpt-oss-120b:free", name: "OpenRouter · GPT OSS 120B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "openrouter/openai/gpt-oss-20b:free", name: "OpenRouter · GPT OSS 20B", icon: <Sparkles className="w-3 h-3 text-gray-200" /> },\n                { id: "gemini/gemini-3.8-flash", name: "Gemini · 3.8 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.7-flash", name: "Gemini · 3.7 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "gemini/gemini-3.6-flash", name: "Gemini · 3.6 Flash", icon: <Sparkles className="w-3 h-3 text-blue-400" /> },\n                { id: "openrouter/deepseek/deepseek-v4-flash-0731", name: "OpenRouter · DeepSeek V4 Flash", icon: <Globe className="w-3 h-3 text-cyan-400" /> },\n                { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA · Nemotron 3 Super 120B", icon: <Zap className="w-3 h-3 text-emerald-400" /> },\n              ''' + j[end:]
p.write_text(j, encoding="utf-8")
print('[DONE] final AI client logic repair')
