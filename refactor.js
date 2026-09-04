const fs = require('fs');

let code = fs.readFileSync('learn-up/src/components/AIChatComponent.useChat.tsx', 'utf8');

// 1. Add useChat import
code = code.replace(
  'import { useState, useEffect, useRef, type ReactNode } from "react";',
  'import { useState, useEffect, useRef, type ReactNode } from "react";\nimport { useChat } from "@ai-sdk/react";'
);

// 2. Add visual tool procedure component BEFORE AIMessageContent
const visualProc = `
function VisualProcedure({ invocations }: { invocations: any[] }) {
  if (!invocations || invocations.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mt-2 w-full max-w-[85%] md:max-w-[70%]">
      {invocations.map((inv, idx) => {
         const isDone = inv.state === 'result';
         return (
           <div key={idx} className="flex items-center gap-2 p-2 px-3 bg-black/20 border border-white/10 rounded-lg text-xs text-gray-300">
             {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold" /> : <Loader2 className="w-3.5 h-3.5 text-brand-gold animate-spin" />}
             <span>{isDone ? \`Completado: \${inv.toolName}\` : \`Ejecutando: \${inv.toolName}...\`}</span>
           </div>
         );
      })}
    </div>
  );
}
`;
code = code.replace('function AIMessageContent', visualProc + '\nfunction AIMessageContent');

// 3. Update state hooks
const stateHookTarget = `  const [messages, setMessages] = useState<Message[]>([]);`;

// We inject useChat and an adapter for the messages state
const stateHookReplace = `
  const currentSessionIdRef = useRef(currentSessionId);
  useEffect(() => { currentSessionIdRef.current = currentSessionId; }, [currentSessionId]);

  const { messages: aiMessages, input, handleInputChange, setInput, append, isLoading: aiLoading, setMessages: setAiMessages } = useChat({
    api: "/api/chat",
    body: { aiType, isAutonomous },
    onFinish: async (msg) => {
      if (currentSessionIdRef.current) {
        await addAiMessage(currentSessionIdRef.current, "assistant", msg.content, undefined, undefined, msg.toolInvocations as any);
      }
    }
  });

  const messages = aiMessages as any[];
  const setMessages = setAiMessages as any;
`;
code = code.replace(stateHookTarget, stateHookReplace);

// 4. Update handleSubmit
const submitStart = code.indexOf('const handleSubmit = async (e?: React.FormEvent) => {');
const submitEnd = code.indexOf('const handleConfirmAction = async (action: ToolAction) => {', submitStart);

if (submitStart !== -1 && submitEnd !== -1) {
  const newSubmit = `const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !file) || loading || aiLoading) return;

    let userMessage = input.trim();
    if (!userMessage && file) {
      userMessage = "Analiza el archivo adjunto.";
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
      await addAiMessage(sessionId, "user", userMessage, undefined, file ? "document" : undefined);
    }
    
    append({ role: "user", content: userMessage });
    setInput("");
    setLoading(false);
  };

  // ── Manejar confirmación/rechazo de acciones de IA ──
  `;
  code = code.substring(0, submitStart) + newSubmit + code.substring(submitEnd);
}

// 5. Inject VisualProcedure inside map loop
const mapIndex = code.indexOf('{messages.map((message, index) => (');
if (mapIndex !== -1) {
   const afterContent = code.indexOf('<AIMessageContent text={message.content} />', mapIndex);
   if (afterContent !== -1) {
      const injection = '<AIMessageContent text={message.content} />\n                    {message.toolInvocations && <VisualProcedure invocations={message.toolInvocations} />}';
      code = code.substring(0, afterContent) + injection + code.substring(afterContent + '<AIMessageContent text={message.content} />'.length);
   }
}

// Write back
fs.writeFileSync('learn-up/src/components/AIChatComponent.useChat.tsx', code);
console.log('Refactor complete!');
