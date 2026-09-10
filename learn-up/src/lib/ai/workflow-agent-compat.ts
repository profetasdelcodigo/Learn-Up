"use server";

import { createClient } from "@/utils/supabase/server";
import { aiRegistry } from "@/lib/ai/skills";
import type { ToolAction } from "@/lib/ai-tools";
import { materializeToolResult } from "@/lib/ai/core/materialize-result";
import { getWorkflow, updateWorkflow } from "@/lib/ai/core/workflow-store";
import { runWorkflowAgent as runWorkflowAgentCore, type WorkflowRunResult, type WorkflowRunOptions } from "@/lib/ai/workflow-agent";

export async function runWorkflowAgent(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string | any[] }[],
  content: string | any[],
  model: string,
  options: WorkflowRunOptions,
): Promise<WorkflowRunResult> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content },
  ];
  return runWorkflowAgentCore(messages, model, options);
}

function stableArgs(value: unknown) {
  const normalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    return input;
  };
  return JSON.stringify(normalize(value || {}));
}

export async function resumeWorkflow(workflowId: string, toolName: string, args: Record<string, any>) {
  const workflow = await getWorkflow(workflowId);
  const pending = Array.isArray(workflow.pending_actions) ? workflow.pending_actions : [];
  const index = pending.findIndex((action: any) => action.tool === toolName && stableArgs(action.args || {}) === stableArgs(args));
  if (index < 0) return { success: false, error: "La acción pendiente ya no existe o no coincide con la confirmación." };

  const tool = aiRegistry.getTool(toolName);
  if (!tool?.execute) return { success: false, error: `La herramienta ${toolName} no está disponible.` };
  const parsed = tool.schema?.safeParse ? tool.schema.safeParse(args) : { success: true, data: args };
  if (!parsed.success) return { success: false, error: `Argumentos inválidos para ${toolName}.` };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== workflow.user_id) return { success: false, error: "No autorizado." };

  try {
    const result = await tool.execute(parsed.data, { userId: user.id, sessionId: workflow.session_id || undefined, currentRoute: undefined } as any);
    const materialized = await materializeToolResult(result, toolName, parsed.data);
    const remaining = pending.filter((_: any, i: number) => i !== index);
    const executed = [...(workflow.executed_results || []), { tool: toolName, args: parsed.data, result: materialized }];
    await updateWorkflow(workflowId, {
      pending_actions: remaining,
      executed_results: executed,
      status: remaining.length ? "waiting_for_user" : "completed",
    });

    if (!materialized?.success) return { success: false, error: String(materialized?.error || materialized?.message || "La herramienta no pudo completar la acción.") };

    if (!remaining.length) {
      return { success: true, response: String(materialized?.message || "Acción confirmada y ejecutada."), executedActions: [({ tool: toolName, args: parsed.data } as ToolAction)] };
    }

    const continuation = await runWorkflowAgentCore(
      workflow.messages || [],
      workflow.model,
      {
        mode: workflow.mode,
        userId: user.id,
        sessionId: workflow.session_id,
        aiType: workflow.ai_type,
        workflowId,
        workflowMessages: workflow.messages || [],
      },
    );
    return continuation;
  } catch (error: any) {
    return { success: false, error: error?.message || "No se pudo ejecutar la acción confirmada." };
  }
}

export async function cancelWorkflowAction(workflowId: string, toolName: string, args: Record<string, any>) {
  const workflow = await getWorkflow(workflowId);
  const pending = Array.isArray(workflow.pending_actions) ? workflow.pending_actions : [];
  const remaining = pending.filter((action: any) => !(action.tool === toolName && stableArgs(action.args || {}) === stableArgs(args)));
  if (remaining.length === pending.length) return { success: true, status: "not_found" };
  await updateWorkflow(workflowId, { pending_actions: remaining, status: remaining.length ? "waiting_for_user" : "cancelled" });
  return { success: true, status: "cancelled", message: `Acción "${toolName}" cancelada.` };
}
