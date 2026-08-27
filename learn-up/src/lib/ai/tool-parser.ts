import { ToolSchemas } from "@/lib/ai-tools";
import { AI_AGENT_REGISTRY } from "./agent-registry";

export interface ParsedToolAction { tool: string; args: Record<string, any>; description: string; requiresConfirm: boolean; }

const READ_ONLY_TOOLS = new Set([
  "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia", "search_academic_paper", "deep_research",
  "search_library", "search_documents", "query_repositories", "view_own_library_items", "list_indexed_documents", "summarize_document",
  "extract_questions_from_doc", "cite_source", "analyze_source_credibility", "search_knowledge_graph", "view_related_concepts",
  "view_progress_by_subject", "calculate_mastery_score", "read_calendar_events", "search_calendar_events", "read_habit_tracker",
  "view_habit_stats", "read_shared_events", "read_shared_chat", "view_shared_members", "read_unread_messages", "read_full_conversation",
  "view_group_members", "search_user_by_name", "search_chat_history", "view_study_stats", "generate_weekly_report", "view_exam_history",
  "analyze_strengths_weaknesses", "view_habit_streaks", "detect_procrastination", "generate_academic_dashboard", "view_friends_list",
  "view_friend_profile", "view_recent_activity", "view_ai_sessions", "view_ai_personalities", "view_ai_memory", "view_ai_token_usage",
  "view_daily_quests", "view_leaderboard", "view_global_ranking", "view_friends_ranking", "view_achievements", "view_inventory",
  "view_shop", "view_shop_specials", "view_duel_history", "view_guild_stats", "view_pomodoro_stats", "view_mood_history",
  "view_screen_time", "view_water_stats", "view_sleep_stats", "get_ergonomic_advice", "view_report_status", "view_blocked_users",
  "view_appeal_status", "view_feature_roadmap", "view_bug_reports", "read_system_announcements", "search_image", "analyze_image",
  "describe_math_image", "generate_summary", "generate_presentation_outline", "generate_glossary", "generate_comparison_table",
  "generate_code", "generate_practice_questions", "generate_mind_map", "generate_bibliography", "generate_project_template",
  "generate_timeline", "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus",
  "generate_mermaid_diagram", "generate_podcast_script", "solve_math_problem", "analyze_literary_text", "conjugate_verb",
  "translate_with_explanation", "explain_with_analogy", "socratic_debate",
]);

const DESCRIPTION_OVERRIDES: Record<string, (args: Record<string, any>) => string> = {
  open_url: a => `Abrir ${a.title || a.url || "la URL indicada"}`,
  add_calendar_event: a => `Crear el evento "${a.title || "Sin título"}" en tu calendario.`,
  delete_calendar_event: () => "Eliminar un evento de tu calendario.",
  add_habit: a => `Crear el hábito "${a.title || "Sin título"}".`,
  complete_habit_entry: a => `Marcar el hábito como completado${a.date ? ` el ${a.date}` : ""}.`,
  send_message: a => `Enviar un mensaje a ${a.recipient_name || "un contacto"}.`,
  generate_image: () => "Generar una imagen con IA.",
  generate_video: () => "Generar un vídeo con IA.",
  create_exam: a => `Crear un examen sobre "${a.topic || "el tema solicitado"}".`,
};

function allRegisteredTools() { return Object.values(AI_AGENT_REGISTRY).flatMap(agent => agent.tools); }
function isKnownTool(name: string) { return Boolean(ToolSchemas[name]); }
function getRequiresConfirmation(name: string) {
  const registered = allRegisteredTools().find(tool => tool.name === name);
  return registered ? registered.requiresConfirmation : !READ_ONLY_TOOLS.has(name);
}
function describeTool(name: string, args: Record<string, any>) { return DESCRIPTION_OVERRIDES[name]?.(args) || `Ejecutar ${name.replace(/_/g, " ")}.`; }

function extractBalancedObject(source: string, start: number): string | null {
  const firstBrace = source.indexOf("{", start); if (firstBrace < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = firstBrace; i < source.length; i++) {
    const ch = source[i];
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(firstBrace, i + 1);
  }
  return null;
}

function candidateObjects(response: string): string[] {
  const candidates: string[] = [];
  const markerRegex = /(?:tool_call|function_call|tool|function)\s*[:=]?/gi;
  let marker: RegExpExecArray | null;
  while ((marker = markerRegex.exec(response)) !== null) {
    const object = extractBalancedObject(response, marker.index + marker[0].length); if (object) candidates.push(object);
  }
  const standalone = /(^|\n)\s*(\{\s*"(?:tool|name|function|function_call)"\s*:\s*"[^"]+"[\s\S]*?\})/g;
  let match: RegExpExecArray | null;
  while ((match = standalone.exec(response)) !== null) candidates.push(match[2]);
  return [...new Set(candidates)];
}

function normalizeArguments(json: any): Record<string, any> {
  const args = json?.args ?? json?.arguments ?? json?.parameters ?? {};
  if (typeof args === "string") { try { const parsed = JSON.parse(args); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } }
  return args && typeof args === "object" ? args : {};
}
function toolNameFromJson(json: any): string | null {
  const value = json?.tool ?? json?.name ?? json?.function ?? json?.function_call?.name;
  return typeof value === "string" ? value : null;
}

function stripToolSyntax(text: string): string {
  return text
    .replace(/```(?:tool|json|javascript|js|typescript)?\s*\n?[\s\S]*?```/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*tool\s*\(\s*\{[\s\S]*?\}\s*\)\s*$/gim, "")
    .replace(/^\s*\{\s*"(?:tool|name|function|function_call)"\s*:\s*"[^"]+"[\s\S]*?\}\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function parseToolCalls(response: string): { cleanText: string; actions: ParsedToolAction[] } {
  const actions: ParsedToolAction[] = [];
  for (const candidate of candidateObjects(response)) {
    try {
      const parsed = JSON.parse(candidate), toolName = toolNameFromJson(parsed);
      if (!toolName || !isKnownTool(toolName)) continue;
      const schema = ToolSchemas[toolName];
      const validation = schema.safeParse(normalizeArguments(parsed));
      if (!validation.success) { console.warn(`[TOOLS] Argumentos inválidos para ${toolName}`); continue; }
      const args = validation.data as Record<string, any>;
      if (!actions.some(a => a.tool === toolName && JSON.stringify(a.args) === JSON.stringify(args))) {
        actions.push({ tool: toolName, args, description: describeTool(toolName, args), requiresConfirm: getRequiresConfirmation(toolName) });
      }
    } catch { /* ignore malformed candidates */ }
  }
  return { cleanText: stripToolSyntax(response), actions };
}
