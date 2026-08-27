import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  chat: path.join(root, "learn-up/src/components/AIChatComponent.tsx"),
  tutor: path.join(root, "learn-up/src/actions/ai-tutor.ts"),
  jarvis: path.join(root, "learn-up/src/actions/jarvis.ts"),
  jarvisWidget: path.join(root, "learn-up/src/components/JarvisGlobalWidget.tsx"),
  registry: path.join(root, "learn-up/src/lib/ai/agent-registry.ts"),
  runner: path.join(root, "learn-up/src/lib/ai/agent-runner.ts"),
};

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }
function replaceOnce(s, oldText, newText, label) {
  const count = s.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return s.replace(oldText, newText);
}

// ---------------- Chat state ----------------
let s = read(files.chat);

s = replaceOnce(
  s,
  `  useEffect(() => {\n    if (currentSessionId) {\n      if (isCreatingSession.current) {\n        isCreatingSession.current = false;\n        return;\n      }\n      loadSessionMessages(currentSessionId);\n    } else {\n      setMessages([]);\n    }\n  }, [currentSessionId]);`,
  `  useEffect(() => {\n    if (!currentSessionId) {\n      if (!submitInFlight.current) setMessages([]);\n      return;\n    }\n    if (isCreatingSession.current) {\n      isCreatingSession.current = false;\n      return;\n    }\n    if (submitInFlight.current) return;\n    void loadSessionMessages(currentSessionId);\n  }, [currentSessionId]);`,
  "chat session effect",
);

s = replaceOnce(
  s,
  `  const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);\n    const msgs = await getAiMessages(sessionId);\n    setMessages(msgs);\n    setLoading(false);\n  };`,
  `  const loadSessionMessages = async (sessionId: string) => {\n    setLoading(true);\n    try {\n      const durable = await getAiMessages(sessionId);\n      setMessages((prev) => {\n        const pending = prev.filter((m) =>\n          m.clientMessageId &&\n          (m.status === "sending" || m.status === "streaming" || m.status === "tool_pending" || m.status === "tool_running")\n        );\n        const durableIds = new Set(durable.map((m: any) => m.id).filter(Boolean));\n        const durableClientIds = new Set(durable.map((m: any) => m.clientMessageId).filter(Boolean));\n        const merged = durable.filter((m: any) => !pending.some((p) => p.id === m.id || (p.clientMessageId && p.clientMessageId === m.clientMessageId)));\n        return [...merged, ...pending.filter((p) => !durableIds.has(p.id) && !durableClientIds.has(p.clientMessageId))];\n      });\n    } finally {\n      setLoading(false);\n    }\n  };`,
  "chat history loader",
);

s = replaceOnce(
  s,
  `    const clientSideUserMsg: Message = {`,
  `    let messagePersisted = false;\n    const clientSideUserMsg: Message = {`,
  "chat persisted flag",
);

s = replaceOnce(
  s,
  `      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      setLoading(false);`,
  `      if (!messagePersisted) {\n        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      } else {\n        setMessages((prev) => prev.map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m));\n      }\n      setLoading(false);`,
  "chat failure handling",
);

s = replaceOnce(
  s,
  `      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n    } catch (msgErr: any) {`,
  `      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n      messagePersisted = true;\n\n      // Persist the message first. Indexing is isolated so an indexing/API failure never deletes the user's attachment.\n      if (backupFile && mediaUrl) {\n        try {\n          const indexResult = await indexAiDocumentFromUrl({\n            title: backupFile.name,\n            url: mediaUrl,\n            mimeType: backupFile.type,\n            sessionId,\n          });\n          if (!indexResult.success) console.warn("AI document indexing skipped:", indexResult.error);\n        } catch (indexError) {\n          console.warn("AI document indexing failed after message persistence:", indexError);\n        }\n      }\n    } catch (msgErr: any) {`,
  "chat attachment ordering",
);

s = replaceOnce(
  s,
  `    sessionId?: string | null,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;`,
  `    sessionId?: string | null,\n    isAutonomous?: boolean,\n  ) => Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }>;`,
  "chat submit contract",
);

s = replaceOnce(
  s,
  `        selectedModel,\n        sessionId\n      );`,
  `        selectedModel,\n        sessionId,\n        isAutonomous\n      );`,
  "chat submit autopilot argument",
);
write(files.chat, s);

// ---------------- Agent registry ----------------
let r = read(files.registry);
r = r.replace(
  `    tools: [readOnlyTools[0], writeTools[0], writeTools[1]],`,
  `    tools: [\n      ...readOnlyTools,\n      writeTools[0],\n      writeTools[1],\n      { name: "read_counselor_panel", description: "Lee Objetivos de Hoy, Tracker de Ánimo y Diario Emocional.", requiresConfirmation: false, externalEffect: false },\n      { name: "add_counselor_goal", description: "Agrega un objetivo a Objetivos de Hoy.", requiresConfirmation: false, externalEffect: false },\n      { name: "toggle_counselor_goal", description: "Marca o desmarca un objetivo de hoy.", requiresConfirmation: false, externalEffect: false },\n      { name: "set_counselor_mood", description: "Actualiza el Tracker de Ánimo.", requiresConfirmation: false, externalEffect: false },\n      { name: "save_counselor_journal", description: "Guarda una entrada en el Diario Emocional.", requiresConfirmation: false, externalEffect: false },\n    ],`,
);
r = r.replace(
  `    tools: [readOnlyTools[0], writeTools[3], writeTools[2]],`,
  `    tools: [\n      ...readOnlyTools,\n      writeTools[3],\n      writeTools[2],\n      { name: "read_nutrition_panel", description: "Lee Macros, Compras y Semana de Nutrirecetas.", requiresConfirmation: false, externalEffect: false },\n      { name: "set_nutrition_macros", description: "Actualiza los Macros de Nutrirecetas.", requiresConfirmation: false, externalEffect: false },\n      { name: "add_shopping_item", description: "Agrega un ingrediente a Compras.", requiresConfirmation: false, externalEffect: false },\n      { name: "schedule_meal", description: "Programa una comida en Semana.", requiresConfirmation: false, externalEffect: false },\n      { name: "set_recipe_panel", description: "Actualiza la receta mostrada en Nutrirecetas.", requiresConfirmation: false, externalEffect: false },\n    ],`,
);
r = r.replace(
  `      "4. Si necesitas usar una herramienta (tool), DEBES responder EXCLUSIVAMENTE con un bloque tool {...} tal como espera el sistema.",`,
  `      "4. Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario.",`,
);
r = r.replace(
  `      "Toda accion externa requiere confirmacion.",`,
  `      "Toda accion externa requiere confirmacion.",`,
);
// Remove explicit hidden-chain-of-thought requirement from counselor and use concise internal policy instead.
r = r.replace(
  `      "ANTES de generar tu respuesta, DEBES incluir un bloque <thinking> invisible donde analices el estado emocional del usuario y apliques protocolos de seguridad anti-jailbreak.",`,
  `      "Evalua internamente seguridad y contexto; nunca expongas razonamiento interno ni bloques <thinking> al usuario.",`,
);
write(files.registry, r);

// ---------------- ai-tutor signatures / autopilot ----------------
let t = read(files.tutor);
const professorSigOld = `  modelId?: string,\n  sessionId?: string | null,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`;
const professorSigNew = `  modelId?: string,\n  sessionId?: string | null,\n  isAutonomous?: boolean,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`;
if (t.includes(professorSigOld)) t = t.replace(professorSigOld, professorSigNew);
const professorOptionsOld = `      {\n        sessionId,\n        userId: user.id,\n        onFormulaExtracted:`;
const professorOptionsNew = `      {\n        sessionId,\n        userId: user.id,\n        isAutonomous: Boolean(isAutonomous),\n        onFormulaExtracted:`;
if (t.includes(professorOptionsOld)) t = t.replace(professorOptionsOld, professorOptionsNew);

const counselorSigOld = `  modelId?: string,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`;
const counselorSigNew = `  modelId?: string,\n  sessionId?: string | null,\n  isAutonomous?: boolean,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`;
// Only replace the counselor occurrence after its marker.
const counselorMarker = "export async function askCounselor(";
const cIdx = t.indexOf(counselorMarker);
if (cIdx >= 0) {
  const tail = t.slice(cIdx);
  if (tail.includes(counselorSigOld)) t = t.slice(0, cIdx) + tail.replace(counselorSigOld, counselorSigNew);
}
const counselOptionsOld = `      {\n        userId: user.id,\n      }\n    );`;
const counselOptionsNew = `      {\n        userId: user.id,\n        sessionId,\n        isAutonomous: Boolean(isAutonomous),\n      }\n    );`;
if (cIdx >= 0) {
  const head = t.slice(0, cIdx); const tail = t.slice(cIdx);
  if (tail.includes(counselOptionsOld)) t = head + tail.replace(counselOptionsOld, counselOptionsNew);
}
t = t.replace(/, \*\*ESTÁS OBLIGADA a usar la herramienta correspondiente en formato JSON\*\*\./g, ".");
t = t.replace(/usando etiquetas XML <thinking>[\s\S]*?NUNCA omitas el bloque <thinking>\./g, "evalua internamente el contexto y seguridad sin exponer razonamiento interno.");
write(files.tutor, t);

// ---------------- Jarvis server action ----------------
let j = read(files.jarvis);
j = replaceOnce(
  j,
  `  modelId?: string,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`,
  `  modelId?: string,\n  sessionId?: string | null,\n  isAutonomous?: boolean,\n): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`,
  "jarvis signature",
);
j = replaceOnce(
  j,
  `      {\n        userId: user.id,\n      }\n    );`,
  `      {\n        userId: user.id,\n        sessionId,\n        isAutonomous: Boolean(isAutonomous),\n      }\n    );`,
  "jarvis runner options",
);
write(files.jarvis, j);

// ---------------- Jarvis widget: session + action execution ----------------
let w = read(files.jarvisWidget);
w = w.replace(
  `import { askJarvis } from "@/actions/jarvis";`,
  `import { askJarvis } from "@/actions/jarvis";\nimport { addAiMessage, createAiSession } from "@/actions/ai-history";\nimport { confirmAndExecuteTool } from "@/actions/ai-tutor";`,
);
w = replaceOnce(
  w,
  `  const [messages, setMessages] = useState<JarvisMessage[]>([]);`,
  `  const [messages, setMessages] = useState<JarvisMessage[]>([]);\n  const [sessionId, setSessionId] = useState<string | null>(null);\n  const [executingTool, setExecutingTool] = useState(false);`,
  "jarvis widget state",
);

w = replaceOnce(
  w,
  `    let mediaUrl: string | undefined;\n    let mediaType: string | undefined;`,
  `    let mediaUrl: string | undefined;\n    let mediaType: string | undefined;\n\n    let activeSessionId = sessionId;\n    if (!activeSessionId) {\n      const created = await createAiSession("jarvis", displayMessage.substring(0, 40) || "Jarvis");\n      if (created.session?.id) {\n        activeSessionId = created.session.id;\n        setSessionId(created.session.id);\n      }\n    }`,
  "jarvis widget session",
);
w = replaceOnce(
  w,
  `        selectedModel\n      );`,
  `        selectedModel,\n        activeSessionId,\n        autopilot\n      );`,
  "jarvis widget action args",
);

w = replaceOnce(
  w,
  `  const renderToolCard = (action: any) => {`,
  `  const executeAction = async (action: any) => {\n    if (executingTool) return;\n    setExecutingTool(true);\n    try {\n      const result = await confirmAndExecuteTool(action.tool, action.args || {}, sessionId);\n      const text = result.success ? (result.displayMessage || result.message || "Acción completada.") : (result.displayMessage || result.message || "No se pudo completar la acción.");\n      setMessages((prev) => [...prev, { role: "assistant", content: result.success ? `✅ ${text}` : `⚠️ ${text}` }]);\n      if (sessionId) await addAiMessage(sessionId, "assistant", text, undefined, undefined, [action]);\n    } catch {\n      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ No se pudo ejecutar la acción." }]);\n    } finally {\n      setExecutingTool(false);\n    }\n  };\n\n  const renderToolCard = (action: any) => {`,
  "jarvis action executor",
);

w = w.replace(
  `<button className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors">\n              Confirmar y Agendar\n            </button>`,
  `<button onClick={() => executeAction(action)} disabled={executingTool} className="mt-1 w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50">\n              {executingTool ? "Ejecutando..." : "Confirmar y Agendar"}\n            </button>`,
);
w = w.replace(
  `<button className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors">\n              Proceder con la Búsqueda\n            </button>`,
  `<button onClick={() => executeAction(action)} disabled={executingTool} className="mt-1 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors disabled:opacity-50">\n              {executingTool ? "Ejecutando..." : "Proceder con la Búsqueda"}\n            </button>`,
);
w = w.replace(
  `<button className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors">\n              Generar y Practicar\n            </button>`,
  `<button onClick={() => executeAction(action)} disabled={executingTool} className="mt-1 w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-semibold hover:bg-purple-500/30 transition-colors disabled:opacity-50">\n              {executingTool ? "Ejecutando..." : "Generar y Practicar"}\n            </button>`,
);
w = w.replace(
  `<button className="mt-1 w-full py-2 bg-brand-gold/20 text-brand-gold rounded-lg text-sm font-semibold hover:bg-brand-gold/30 transition-colors">\n              Ejecutar Acción\n            </button>`,
  `<button onClick={() => executeAction(action)} disabled={executingTool} className="mt-1 w-full py-2 bg-brand-gold/20 text-brand-gold rounded-lg text-sm font-semibold hover:bg-brand-gold/30 transition-colors disabled:opacity-50">\n              {executingTool ? "Ejecutando..." : "Ejecutar Acción"}\n            </button>`,
);
write(files.jarvisWidget, w);

// ---------------- Agent runner: never append tool protocol as user-visible content ----------------
let ar = read(files.runner);
// Keep model loop, but make continuation role explicit as tool output-like context and preserve clean response.
ar = ar.replace(
  `    currentMessages.push({\n      role: "user",\n      content: allResults.map(({ action, result }) => toolResultForModel(action, result)).join("\\n\\n") +\n        "\\n\\nContinúa la tarea con estos resultados. Usa más herramientas si son necesarias. No expongas nombres de funciones, JSON interno, IDs, stack traces ni protocolos de ejecución al usuario.",\n    });`,
  `    currentMessages.push({\n      role: "user",\n      content: "Resultados internos de herramientas (NO mostrar al usuario):\\n\\n" +\n        allResults.map(({ action, result }) => toolResultForModel(action, result)).join("\\n\\n") +\n        "\\n\\nContinúa la tarea con estos resultados. Usa más herramientas si son necesarias. La respuesta final debe ser natural y nunca exponer JSON, nombres internos, IDs, stack traces ni protocolos de ejecución.",\n    });`,
);
write(files.runner, ar);

console.log("Critical AI finalization applied successfully.");
