"use server";

import { getAICompletion } from "@/lib/ai";
import { parseToolCall, executeToolAction, type ToolAction } from "@/lib/ai-tools";
import { aiRegistry } from "@/lib/ai/skills";
import { normalizeToolName, shouldExecuteTool, type ToolMode } from "@/lib/ai/tool-contract";
import { materializeToolResult } from "@/lib/ai/core/materialize-result";
import { createClient } from "@/utils/supabase/server";
import { createPendingWorkflow, finishWorkflow, getWorkflow, updateWorkflow } from "@/lib/ai/core/workflow-store";
import { PROVIDER_LABELS } from "@/lib/ai/model-catalog";

export interface WorkflowRunOptions { mode: ToolMode; userId: string; sessionId?: string | null; aiType?: string | null; maxSteps?: number; maxParallelTools?: number; workflowId?: string | null; workflowMessages?: any[]; currentRoute?: string | null; mediaUrl?: string | null; mediaType?: string | null; }
export interface WorkflowRunResult { response: string; actions?: ToolAction[]; executedActions?: ToolAction[]; error?: string; }

const MAX_STEPS = 8;
const MAX_PARALLEL = 4;

function cleanText(text: string): string { return String(text || "").replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "").replace(/<function_call>[\s\S]*?<\/function_call>/gi, "").replace(/```(?:tool|function_call|json)\s*[\s\S]*?```/gi, "").replace(/^\s*\{\s*"(?:tool|function|function_call)"[\s\S]*?\}\s*$/gim, "").replace(/^\s*#{1,6}\s+/gm, "").replace(/^\s*(?:\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[ \t]*$/gm, "").replace(/^\s*[-*+][ \t]+/gm, "• ").replace(/^\s*(\d+)\.[ \t]+/gm, "$1. ").trim(); }

function normalizeAction(action: ToolAction): ToolAction { const tool = normalizeToolName(action.tool); const registered = aiRegistry.getTool(tool); return { ...action, tool, description: action.description || registered?.description || `Preparando ${tool}`, requiresConfirm: registered?.requiresConfirmation ?? action.requiresConfirm }; }
function serialize(value: unknown): string { try { return JSON.stringify(value, (_key, item) => typeof item === "string" && item.length > 8000 ? `${item.slice(0, 8000)}...[truncado]` : item); } catch { return String(value ?? ""); } }
function extractSources(data: any) { if (!data) return []; const raw = [data.sources, data.results, data.pages, data.evidence].filter(Array.isArray).flat().map((item: any) => ({ title: item?.title || item?.name || item?.url, url: item?.url || item?.sourceUrl || item?.link, provider: item?.provider })).filter((item: any) => typeof item.url === "string" && /^https?:\/\//i.test(item.url)); return [...new Map(raw.map((source: any) => [source.url, source])).values()]; }
function appendUsedSources(text: string, sources: Array<{ title?: string; url: string; provider?: string }>) { const unique = [...new Map(sources.map((source) => [source.url, source])).values()]; if (!unique.length) return text; if (/(^|\n)\s*Fuentes consultadas:\s*$/im.test(text)) return text; const lines = unique.slice(0, 12).map((source) => `• ${source.title || source.url} — ${source.url}`); return `${text.trim()}\n\nFuentes consultadas:\n${lines.join("\n")}`.trim(); }

function providerNotice(response: any) {
  const meta = response?._learnUp;
  if (!meta?.providerChanged) return "";
  const requested = meta.requestedModel ? String(meta.requestedModel).split("/")[0] : "otro proveedor";
  const active = meta.providerLabel || PROVIDER_LABELS[meta.provider as keyof typeof PROVIDER_LABELS] || "otro proveedor";
  return `ℹ️ Cambié temporalmente de ${requested} a ${active} para completar tu solicitud. Tu respuesta no fue descartada.`;
}

async function audit(userId: string, sessionId: string | null | undefined, step: number, action: ToolAction, status: string, output?: unknown, error?: string, currentRoute?: string | null) { const supabase = await createClient(); const registered = aiRegistry.getTool(action.tool); await supabase.from("ai_tool_events").insert({ user_id: userId, session_id: sessionId || null, step, skill_id: registered?.category || null, tool_name: action.tool, status, risk: registered?.risk || null, input: action.args || {}, output: output ?? null, sources: extractSources(output), error: error || null, current_route: currentRoute || null, updated_at: new Date().toISOString() }); }

async function normalizeToolArgs(toolName: string, args: Record<string, any>, userId: string) {
  if (toolName !== "connect_two_concepts") return args;
  const supabase = await createClient();
  const conceptA = String(args.concept_a_id || args.concept_a || "").trim();
  const conceptB = String(args.concept_b_id || args.concept_b || "").trim();
  if (!conceptA || !conceptB) return args;
  const looksLikeUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
  const [a, b] = await Promise.all([
    looksLikeUuid(conceptA) ? Promise.resolve({ data: { id: conceptA } }) : supabase.from("knowledge_nodes").select("id,title").eq("user_id", userId).ilike("title", conceptA).limit(1).maybeSingle(),
    looksLikeUuid(conceptB) ? Promise.resolve({ data: { id: conceptB } }) : supabase.from("knowledge_nodes").select("id,title").eq("user_id", userId).ilike("title", conceptB).limit(1).maybeSingle(),
  ]);
  if (!a.data?.id || !b.data?.id) throw new Error("No encontré ambos conceptos en tu grafo de conocimiento. No crearé una relación inventada.");
  return { ...args, concept_a_id: a.data.id, concept_b_id: b.data.id };
}

async function executeTool(action: ToolAction, options: WorkflowRunOptions, step: number) {
  await audit(options.userId, options.sessionId, step, action, "running", undefined, undefined, options.currentRoute);
  try {
    const registered = aiRegistry.getTool(action.tool);
    const effectiveArgs = await normalizeToolArgs(action.tool, { ...(action.args || {}) }, options.userId);
    if (!effectiveArgs.image_url && options.mediaUrl && ["analyze_image", "describe_math_image", "extract_colors_from_image", "extract_text_from_image"].includes(action.tool)) effectiveArgs.image_url = options.mediaUrl;
    if (!effectiveArgs.audio_url && options.mediaUrl && action.tool === "transcribe_audio") effectiveArgs.audio_url = options.mediaUrl;
    if (!effectiveArgs.video_url && options.mediaUrl && action.tool === "search_youtube_transcripts" && /youtube\.com|youtu\.be/i.test(options.mediaUrl)) effectiveArgs.video_url = options.mediaUrl;
    let result: any;
    if (registered?.execute) {
      const parsed = registered.schema?.safeParse ? registered.schema.safeParse(effectiveArgs) : { success: true, data: effectiveArgs };
      if (!parsed.success) throw new Error(`Argumentos inválidos para ${action.tool}.`);
      result = await registered.execute(parsed.data, { userId: options.userId, sessionId: options.sessionId || undefined, currentRoute: options.currentRoute, mediaUrl: options.mediaUrl, mediaType: options.mediaType } as any);
    } else result = await executeToolAction(action.tool, effectiveArgs);
    result = await materializeToolResult(result, action.tool, effectiveArgs);
    const normalized = { action: { ...action, args: effectiveArgs }, success: Boolean(result?.success), message: String(result?.message || (result?.success ? "Completado" : result?.error || "La herramienta falló")), data: result?.data ?? null };
    await audit(options.userId, options.sessionId, step, normalized.action, normalized.success ? "success" : "error", normalized.data, normalized.success ? undefined : normalized.message, options.currentRoute);
    return normalized;
  } catch (error: any) { const message = error?.message || "Error desconocido de herramienta"; await audit(options.userId, options.sessionId, step, action, "error", null, message, options.currentRoute); return { action, success: false, message, data: null }; }
}

async function executeParallel(actions: ToolAction[], options: WorkflowRunOptions, step: number) { const limit = Math.max(1, Math.min(options.maxParallelTools ?? MAX_PARALLEL, MAX_PARALLEL)); const out: any[] = []; for (let i = 0; i < actions.length; i += limit) out.push(...await Promise.all(actions.slice(i, i + limit).map((action) => executeTool(action, options, step)))); return out; }

async function runCore(currentMessages: any[], model: string, options: WorkflowRunOptions, workflowId: string | null = null, startStep = 0): Promise<WorkflowRunResult> {
  const executedActions: ToolAction[] = []; const usedSources: Array<{ title?: string; url: string; provider?: string }> = []; let lastText = ""; let lastProviderNotice = ""; const maxSteps = Math.max(1, Math.min(options.maxSteps ?? MAX_STEPS, MAX_STEPS));
  for (let step = startStep; step < maxSteps; step += 1) {
    const response = await getAICompletion(currentMessages, model); lastProviderNotice = providerNotice(response);
    const raw = response.choices[0]?.message?.content || ""; const parsed = await parseToolCall(raw); const text = cleanText(parsed.cleanText); const actions = (parsed.actions || []).map(normalizeAction); lastText = text;
    if (!actions.length) { const finalText = appendUsedSources([lastProviderNotice, lastText].filter(Boolean).join("\n\n"), usedSources); if (workflowId) await finishWorkflow(workflowId, "completed", { messages: currentMessages, pending_actions: [], executed_results: executedActions, sources: usedSources }); return { response: finalText, executedActions: executedActions.length ? executedActions : undefined }; }
    const executable: ToolAction[] = []; const pending: ToolAction[] = []; const denied: ToolAction[] = [];
    for (const action of actions) { const decision = shouldExecuteTool(action.tool, options.mode, true); if (decision === "execute") executable.push(action); else if (decision === "pending_confirmation") pending.push(action); else denied.push(action); }
    let results: any[] = [];
    if (executable.length) { results = await executeParallel(executable, options, step); executedActions.push(...results.filter((r) => r.success).map((r) => r.action)); for (const result of results) usedSources.push(...extractSources(result.data)); currentMessages.push({ role: "assistant", content: text || "Continuaré con la tarea." }); currentMessages.push({ role: "user", content: `Resultados reales de herramientas:\n${results.map((r) => `[${r.action.tool}] ${r.success ? "OK" : "ERROR"}\n${r.message}\nDatos: ${serialize(r.data)}`).join("\n\n")}\n\nContinúa la tarea con las herramientas necesarias. No repitas herramientas exitosas salvo que necesites un dato nuevo. No inventes fuentes ni resultados.` }); }
    if (pending.length) { const actionsWithWorkflow = pending.map((action) => ({ ...action, workflowId: workflowId || undefined } as any)); if (workflowId) { await Promise.all(pending.map((action) => audit(options.userId, options.sessionId, step, action, "waiting_for_user", undefined, undefined, options.currentRoute))); await updateWorkflow(workflowId, { messages: currentMessages, pending_actions: actionsWithWorkflow, executed_results: results, step, status: "waiting_for_user" }); return { response: appendUsedSources([lastProviderNotice, text].filter(Boolean).join("\n\n"), usedSources), actions: actionsWithWorkflow, executedActions: executedActions.length ? executedActions : undefined }; } const created = await createPendingWorkflow({ userId: options.userId, sessionId: options.sessionId, aiType: options.aiType, mode: options.mode, model, step, messages: currentMessages, pendingActions: pending, executedResults: results }); await Promise.all(pending.map((action) => audit(options.userId, options.sessionId, step, action, "waiting_for_user", undefined, undefined, options.currentRoute))); const withWorkflow = pending.map((action) => ({ ...action, workflowId: created.id } as any)); return { response: appendUsedSources([lastProviderNotice, text].filter(Boolean).join("\n\n"), usedSources), actions: withWorkflow, executedActions: executedActions.length ? executedActions : undefined }; }
    if (denied.length && !executable.length) { const error = `No se pudieron ejecutar: ${denied.map((x) => x.tool).join(", ")}`; if (workflowId) await finishWorkflow(workflowId, "error", { messages: currentMessages, pending_actions: [], error }); return { response: appendUsedSources(text || "No puedo ejecutar esa acción.", usedSources), error, executedActions: executedActions.length ? executedActions : undefined }; }
    if (!executable.length) { if (workflowId) await finishWorkflow(workflowId, "completed", { messages: currentMessages, pending_actions: [], sources: usedSources }); return { response: appendUsedSources(text, usedSources), executedActions: executedActions.length ? executedActions : undefined }; }
  }
  const limited = appendUsedSources(lastText || "La tarea alcanzó el límite seguro de pasos.", usedSources); if (workflowId) await finishWorkflow(workflowId, "error", { messages: currentMessages, pending_actions: [], error: "Límite de pasos alcanzado", sources: usedSources }); return { response: limited, executedActions: executedActions.length ? executedActions : undefined };
}

export async function runWorkflowAgent(systemPrompt: string, history: any[], userMessage: string | any[], model: string, options: WorkflowRunOptions) { const currentMessages = Array.isArray(options.workflowMessages) ? [...options.workflowMessages, { role: "user", content: userMessage }] : [{ role: "system", content: systemPrompt }, ...history.slice(-10), { role: "user", content: userMessage }]; return runCore(currentMessages, model, options, options.workflowId || null); }

export async function resumeWorkflow(workflowId: string, tool: string, args: Record<string, any>) { const workflow = await getWorkflow(workflowId); const pending = workflow.pending_actions || []; const normalizedTool = normalizeToolName(tool); const match = pending.find((action: any) => normalizeToolName(action.tool) === normalizedTool && serialize(action.args || {}) === serialize(args || {})); if (!match) throw new Error("La acción pendiente no coincide con el workflow."); const options: WorkflowRunOptions = { mode: workflow.mode, userId: workflow.user_id, sessionId: workflow.session_id, aiType: workflow.ai_type, maxSteps: MAX_STEPS, maxParallelTools: MAX_PARALLEL, workflowId, workflowMessages: Array.isArray(workflow.messages) ? workflow.messages : [] }; await updateWorkflow(workflowId, { status: "running", pending_actions: [] }); const approved = await executeTool(match, options, Number(workflow.step || 0)); if (!approved.success) { await finishWorkflow(workflowId, "error", { pending_actions: [], error: approved.message }); return { response: "", error: approved.message }; } const originalMessages = Array.isArray(workflow.messages) ? workflow.messages : []; const systemPrompt = String(originalMessages[0]?.content || ""); const history = originalMessages.slice(1, -1); const originalRequest = originalMessages[originalMessages.length - 1]?.content || ""; const continuation = `Solicitud original del estudiante:\n${typeof originalRequest === "string" ? originalRequest : serialize(originalRequest)}\n\nLa herramienta ${normalizedTool} fue autorizada y ya se ejecutó correctamente. Resultado real:\n${serialize(approved.data)}\n\nContinúa exactamente desde aquí. No vuelvas a ejecutar ${normalizedTool} con los mismos argumentos. Usa cualquier otra herramienta necesaria y termina la tarea. No inventes resultados ni fuentes.`; return runWorkflowAgent(systemPrompt, history, continuation, workflow.model, options); }
export async function cancelWorkflow(workflowId: string) { await finishWorkflow(workflowId, "cancelled", { pending_actions: [] }); return { success: true }; }
