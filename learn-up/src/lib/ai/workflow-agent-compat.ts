"use server";

import { createClient } from "@/utils/supabase/server";
import { aiRegistry } from "@/lib/ai/skills";
import type { ToolAction } from "@/lib/ai-tools";
import { materializeToolResult } from "@/lib/ai/core/materialize-result";
import { getWorkflow, updateWorkflow } from "@/lib/ai/core/workflow-store";
import { runWorkflowAgent as runWorkflowAgentCore, type WorkflowRunResult, type WorkflowRunOptions } from "@/lib/ai/workflow-agent";

export async function runWorkflowAgent(systemPrompt: string, history: { role: "user" | "assistant"; content: string | any[] }[], content: string | any[], model: string, options: WorkflowRunOptions): Promise<WorkflowRunResult> {
  return runWorkflowAgentCore([{ role: "system", content: systemPrompt }, ...(history || []), { role: "user", content }], model, options);
}

function stableArgs(value: unknown) {
  const normalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    return input;
  };
  return JSON.stringify(normalize(value || {}));
}

function addMinutes(clock: string, minutes: number) {
  const [hour, minute] = clock.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function normalizeConfirmedCalendarArgs(toolName: string, args: Record<string, any>, workflow: any) {
  if (toolName !== "add_calendar_event") return args;
  const originalText = String((workflow?.messages || []).findLast?.((message: any) => message?.role === "user")?.content || "");
  if (!originalText) return args;

  const meridiem = originalText.match(/\b(p\.?\s*m\.?|a\.?\s*m\.?)\b/i)?.[1]?.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  const startMatch = originalText.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:p\.?\s*m\.?|a\.?\s*m\.?)\b/i);
  if (!startMatch || !meridiem) return args;

  let hour = Number(startMatch[1]);
  const minute = Number(startMatch[2] || 0);
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return args;

  const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const durationMinutes = args.start_time && args.end_time
    ? (() => {
        const [sh, sm] = String(args.start_time).split(":").map(Number);
        const [eh, em] = String(args.end_time).split(":").map(Number);
        return Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
      })()
    : 60;
  return { ...args, start_time: start, end_time: addMinutes(start, durationMinutes) };
}

export async function resumeWorkflow(workflowId: string, toolName: string, args: Record<string, any>): Promise<WorkflowRunResult> {
  try {
    const workflow = await getWorkflow(workflowId);
    const pending = Array.isArray(workflow.pending_actions) ? workflow.pending_actions : [];
    const index = pending.findIndex((action: any) => action.tool === toolName && stableArgs(action.args || {}) === stableArgs(args));
    if (index < 0) return { response: "La acción pendiente ya no existe o no coincide con la confirmación.", error: "confirmación no disponible" };

    const tool = aiRegistry.getTool(toolName);
    if (!tool?.execute) return { response: `La herramienta ${toolName} no está disponible.`, error: "tool_unavailable" };

    const normalizedArgs = normalizeConfirmedCalendarArgs(toolName, args, workflow);
    const parsed = tool.schema?.safeParse ? tool.schema.safeParse(normalizedArgs) : { success: true, data: normalizedArgs };
    if (!parsed.success) {
      const details = "error" in parsed ? parsed.error?.issues?.map((issue: any) => issue.message).join("; ") : "";
      return { response: `Los argumentos para ${toolName} ya no son válidos.${details ? ` ${details}` : ""}`, error: "invalid_arguments" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== workflow.user_id) return { response: "No autorizado.", error: "unauthorized" };

    const result = await tool.execute(parsed.data, { userId: user.id, sessionId: workflow.session_id || undefined } as any);
    const materialized = await materializeToolResult(result, toolName, parsed.data);
    if (!materialized?.success) {
      return {
        response: String(materialized?.error || materialized?.message || "La herramienta no pudo completar la acción."),
        error: String(materialized?.error || "tool_failed"),
      };
    }

    const remaining = pending.filter((_: any, i: number) => i !== index);
    const executed = [...(workflow.executed_results || []), { tool: toolName, args: parsed.data, result: materialized }];

    try {
      await updateWorkflow(workflowId, {
        pending_actions: remaining,
        executed_results: executed,
        status: remaining.length ? "waiting_for_user" : "completed",
      });
    } catch (workflowError: any) {
      console.error("[resumeWorkflow] Tool succeeded but workflow persistence failed:", workflowError);
      return {
        response: `${String(materialized?.message || "Acción confirmada y ejecutada.")} (La acción se realizó, pero no pude actualizar el estado interno del flujo.)`,
        error: workflowError?.message || "workflow_persistence_failed",
        executedActions: [{ tool: toolName, args: parsed.data } as ToolAction],
      };
    }

    if (!remaining.length) {
      return { response: String(materialized?.message || "Acción confirmada y ejecutada."), executedActions: [{ tool: toolName, args: parsed.data } as ToolAction] };
    }

    return runWorkflowAgentCore(workflow.messages || [], workflow.model, {
      mode: workflow.mode,
      userId: user.id,
      sessionId: workflow.session_id,
      aiType: workflow.ai_type,
      workflowId,
      workflowMessages: workflow.messages || [],
    });
  } catch (error: any) {
    console.error("[resumeWorkflow] Confirmation execution failed:", error);
    return {
      response: `No se pudo ejecutar la acción confirmada: ${error?.message || "error desconocido"}`,
      error: error?.message || "confirmation_execution_failed",
    };
  }
}

export async function cancelWorkflowAction(workflowId: string, toolName: string, args: Record<string, any>): Promise<{ success: boolean; status: string; response: string; actions?: ToolAction[]; error?: string }> {
  try {
    const workflow = await getWorkflow(workflowId);
    const pending = Array.isArray(workflow.pending_actions) ? workflow.pending_actions : [];
    const remaining = pending.filter((action: any) => !(action.tool === toolName && stableArgs(action.args || {}) === stableArgs(args)));
    if (remaining.length === pending.length) return { success: true, status: "not_found", response: "La acción ya no estaba pendiente." };
    await updateWorkflow(workflowId, { pending_actions: remaining, status: remaining.length ? "waiting_for_user" : "cancelled" });
    return { success: true, status: "cancelled", response: `Acción "${toolName}" cancelada.` };
  } catch (error: any) {
    console.error("[cancelWorkflowAction] Cancel failed:", error);
    return { success: false, status: "error", response: `No se pudo cancelar la acción: ${error?.message || "error desconocido"}`, error: error?.message || "cancel_failed" };
  }
}
