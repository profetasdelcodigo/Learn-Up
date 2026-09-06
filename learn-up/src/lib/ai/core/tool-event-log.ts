import { createClient } from "@/utils/supabase/server";

function safeArguments(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const blocked = new Set(["apiKey", "api_key", "authorization", "token", "password", "secret"]);
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, blocked.has(key) ? "[redacted]" : value]));
}

export async function startToolEvent(input: {
  userId: string;
  sessionId?: string | null;
  invocationId: string;
  toolName: string;
  skillPack?: string | null;
  aiType?: string | null;
  mode: "manual" | "autopilot";
  risk?: string | null;
  arguments?: unknown;
  currentRoute?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_tool_events").insert({
    user_id: input.userId,
    session_id: input.sessionId || null,
    invocation_id: input.invocationId,
    tool_name: input.toolName,
    skill_pack: input.skillPack || null,
    ai_type: input.aiType || null,
    mode: input.mode,
    status: "running",
    risk: input.risk || null,
    arguments: safeArguments(input.arguments),
    current_route: input.currentRoute || null,
  });
  if (error) console.error("[TOOL_EVENT] start failed", error.message);
}

export async function finishToolEvent(input: {
  userId: string;
  invocationId: string;
  success: boolean;
  result?: unknown;
  error?: string | null;
  sources?: unknown;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_tool_events")
    .update({
      status: input.success ? "success" : "error",
      result: input.result ?? null,
      sources: Array.isArray(input.sources) ? input.sources : [],
      error: input.error || null,
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)
    .eq("invocation_id", input.invocationId);
  if (error) console.error("[TOOL_EVENT] finish failed", error.message);
}

export function extractSources(result: any): Array<Record<string, unknown>> {
  const candidates = [result?.data?.sources, result?.sources, result?.data?.source];
  const found = candidates.find((value) => Array.isArray(value));
  if (!found) return [];
  return found
    .filter((source: any) => source && typeof source === "object" && typeof source.url === "string" && source.url)
    .map((source: any) => ({ title: source.title || source.name || source.url, url: source.url, provider: source.provider || null }));
}
