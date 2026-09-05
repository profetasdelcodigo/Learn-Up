import { createClient } from "@/utils/supabase/server";

export interface PersistedWorkflow {
  id: string;
  user_id: string;
  session_id: string | null;
  ai_type: string | null;
  mode: "manual" | "autopilot";
  model: string;
  step: number;
  messages: any[];
  pending_actions: any[];
  executed_results: any[];
  status: string;
}

export async function createPendingWorkflow(input: {
  userId: string;
  sessionId?: string | null;
  aiType?: string | null;
  mode: "manual" | "autopilot";
  model: string;
  step: number;
  messages: any[];
  pendingActions: any[];
  executedResults?: any[];
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_workflows").insert({
    user_id: input.userId,
    session_id: input.sessionId || null,
    ai_type: input.aiType || null,
    mode: input.mode,
    model: input.model,
    step: input.step,
    messages: input.messages,
    pending_actions: input.pendingActions,
    executed_results: input.executedResults || [],
    status: "waiting_for_user",
  }).select("*").single();
  if (error) throw error;
  return data as PersistedWorkflow;
}

export async function getWorkflow(workflowId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { data, error } = await supabase.from("ai_workflows").select("*").eq("id", workflowId).eq("user_id", user.id).single();
  if (error) throw error;
  return data as PersistedWorkflow;
}

export async function updateWorkflow(workflowId: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { data, error } = await supabase.from("ai_workflows").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", workflowId).eq("user_id", user.id).select("*").single();
  if (error) throw error;
  return data as PersistedWorkflow;
}

export async function finishWorkflow(workflowId: string, status: "completed" | "cancelled" | "error", patch: Record<string, unknown> = {}) {
  return updateWorkflow(workflowId, { ...patch, status });
}
