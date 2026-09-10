"use server";

import { createClient } from "@/utils/supabase/server";

export async function listPendingAiWorkflows() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_workflows")
    .select("id,session_id,ai_type,mode,pending_actions,updated_at,status")
    .eq("user_id", user.id)
    .eq("status", "waiting_for_user")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("[ai-workflows] No se pudieron recuperar acciones pendientes:", error.message);
    return [];
  }

  return (data || []).flatMap((workflow: any) =>
    (Array.isArray(workflow.pending_actions) ? workflow.pending_actions : []).map((action: any) => ({
      ...action,
      workflowId: action.workflowId || workflow.id,
      sessionId: workflow.session_id,
      aiType: workflow.ai_type,
      mode: workflow.mode,
      updatedAt: workflow.updated_at,
    })),
  );
}
