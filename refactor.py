import os

filepath = 'learn-up/src/components/AIChatComponent.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add useChat import
code = code.replace(
    'import { useState, useEffect, useRef, type ReactNode } from "react";',
    'import { useState, useEffect, useRef, type ReactNode } from "react";\nimport { useChat } from "@ai-sdk/react";'
)

# 2. Add visual tool procedure component BEFORE AIMessageContent
visual_proc = """
function VisualProcedure({ invocations }: { invocations: any[] }) {
  if (!invocations || invocations.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mt-2 w-full max-w-[85%] md:max-w-[70%]">
      {invocations.map((inv, idx) => {
         const isDone = inv.state === 'result';
         return (
           <div key={idx} className="flex items-center gap-2 p-2 px-3 bg-black/20 border border-white/10 rounded-lg text-xs text-gray-300">
             {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold" /> : <Loader2 className="w-3.5 h-3.5 text-brand-gold animate-spin" />}
             <span>{isDone ? `Completado: ${inv.toolName}` : `Ejecutando: ${inv.toolName}...`}</span>
           </div>
         );
      })}
    </div>
  );
}
"""
code = code.replace('function AIMessageContent', visual_proc + '\nfunction AIMessageContent')

# 3. Update state hooks
state_hook_target = '  const [messages, setMessages] = useState<Message[]>([]);'

state_hook_replace = """
  const currentSessionIdRef = useRef(currentSessionId);
  useEffect(() => { currentSessionIdRef.current = currentSessionId; }, [currentSessionId]);

  const { messages: aiMessages, input, handleInputChange, setInput, append, isLoading: aiLoading, setMessages: setAiMessages } = useChat({
    api: "/api/chat",
    body: { aiType, isAutonomous, activeSkill },
    onFinish: async (msg) => {
      if (currentSessionIdRef.current) {
        await addAiMessage(currentSessionIdRef.current, "assistant", msg.content, undefined, undefined, msg.toolInvocations as any);
      }
    }
  });

  const messages = aiMessages as any[];
  const setMessages = setAiMessages as any;

  // Sync initial messages from DB
  useEffect(() => {
    if (currentSessionId) {
       getAiMessages(currentSessionId).then(msgs => {
          const adapted = msgs.map(m => ({
             id: m.id || Math.random().toString(),
             role: m.role,
             content: m.content,
             toolInvocations: m.tool_calls as any,
             media_url: m.media_url,
             media_type: m.media_type
          }));
          setAiMessages(adapted as any);
       });
    } else {
       setAiMessages([]);
    }
  }, [currentSessionId, setAiMessages]);
"""
code = code.replace(state_hook_target, state_hook_replace)

# 3.5 Strip duplicate input state
code = code.replace('  const [input, setInput] = useState("");\n', '')

# 4. Remove old loadSessionMessages to avoid errors
import re
code = re.sub(r'const loadSessionMessages = async \(\) => \{.*?setMessages\(msgs\);\n\s*setLoading\(false\);\n\s*\};\n', '', code, flags=re.DOTALL)

# 5. Update handleSubmit
submit_start = code.find('const handleSubmit = async (e: React.FormEvent) => {')
submit_end = code.find('const handleConfirmAction = async (action: ToolAction) => {', submit_start)

if submit_start != -1 and submit_end != -1:
    new_submit = """const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !file) || loading || aiLoading) return;

    let userMessage = input.trim();
    if (!userMessage && file) {
      const mType = getMediaType(file);
      if (mType === "image") userMessage = "Analiza esta imagen.";
      else if (mType === "audio") userMessage = "Transcribe y analiza este audio.";
      else if (mType === "video") userMessage = "Analiza este video.";
      else userMessage = "Analiza este documento.";
    }

    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError("");
    setHasFileAttached(false);
    setLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const { session } = await createAiSession(aiType, userMessage.substring(0, 30) || "Nueva Sesión");
        if (session) {
          sessionId = session.id;
          onSessionChange(session.id);
        }
      } catch (err) {}
    }

    if (sessionId) {
      await addAiMessage(sessionId, "user", userMessage, undefined, file ? getMediaType(file) : undefined);
    }
    
    append({ role: "user", content: userMessage });
    setInput("");
    setLoading(false);
  };

  // ── Manejar confirmación/rechazo de acciones de IA ──
  """
    code = code[:submit_start] + new_submit + code[submit_end:]

# 6. Inject VisualProcedure inside map loop
map_index = code.find('{messages.map((message, index) => (')
if map_index != -1:
   after_content = code.find('<AIMessageContent text={message.content} />', map_index)
   if after_content != -1:
      injection = '<AIMessageContent text={message.content} />\n                    {message.toolInvocations && <VisualProcedure invocations={message.toolInvocations} />}'
      len_match = len('<AIMessageContent text={message.content} />')
      code = code[:after_content] + injection + code[after_content + len_match:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactor complete!")
