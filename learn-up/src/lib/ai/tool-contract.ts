import { z } from "zod";
import { ToolSchemas } from "@/lib/ai-tools";

export type ToolCategory = "web" | "library" | "calendar" | "chat" | "learning" | "content" | "media" | "research" | "stats" | "profile" | "education" | "nutrition";
export type ToolRisk = "low" | "medium" | "high";
export type ToolActionState = "pending" | "approved" | "rejected" | "running" | "success" | "error" | "cancelled";
export type ToolExecutionDecision = "execute" | "pending_confirmation" | "deny";
export type ToolMode = "manual" | "autopilot";

export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  schema: T;
  requiresConfirmation: boolean;
  externalEffect: boolean;
  readOnly: boolean;
  supportsAutopilot: boolean;
  supportsParallel: boolean;
  uiType: "approval" | "running" | "success" | "error" | "result";
  risk: ToolRisk;
}

const READ_ONLY = new Set([
  "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia", "search_academic_paper", "deep_research",
  "search_library", "search_documents", "query_repositories", "search_knowledge_graph", "view_related_concepts", "read_calendar_events",
  "search_calendar_events", "read_habit_tracker", "view_habit_stats", "read_shared_events", "read_shared_chat", "view_shared_members",
  "read_unread_messages", "read_full_conversation", "view_group_members", "search_chat_history", "view_study_stats", "generate_weekly_report",
  "view_exam_history", "analyze_strengths_weaknesses", "view_habit_streaks", "detect_procrastination", "generate_academic_dashboard",
  "view_friends_list", "view_friend_profile", "view_recent_activity", "view_ai_sessions", "view_ai_personalities", "view_ai_memory",
  "view_ai_token_usage", "view_daily_quests", "view_leaderboard", "view_global_ranking", "view_friends_ranking", "view_achievements",
  "view_inventory", "view_shop", "view_shop_specials", "view_duel_history", "view_guild_stats", "view_pomodoro_stats", "view_mood_history",
  "view_screen_time", "view_water_stats", "view_sleep_stats", "get_ergonomic_advice", "view_report_status", "view_blocked_users",
  "view_appeal_status", "view_feature_roadmap", "view_bug_reports", "read_system_announcements", "search_image", "analyze_image",
  "describe_math_image", "generate_summary", "generate_presentation_outline", "generate_glossary", "generate_comparison_table", "generate_code",
  "generate_practice_questions", "generate_mind_map", "generate_bibliography", "generate_project_template", "generate_timeline",
  "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus", "generate_mermaid_diagram",
  "generate_podcast_script", "solve_math_problem", "analyze_literary_text", "conjugate_verb", "translate_with_explanation",
  "explain_with_analogy", "socratic_debate",
]);

const HIGH_RISK = new Set(["delete_calendar_event", "delete_habit", "delete_shared_event", "delete_shared_message", "leave_shared_calendar", "trigger_webhook", "update_profile"]);
const LOW_RISK_WRITES = new Set(["add_habit", "complete_habit_entry", "undo_habit_entry", "save_learned_concept"]);
const PARALLEL_SAFE = new Set(["search_web", "advanced_web_search", "browse_web_page", "search_news", "search_academic_paper", "search_library", "search_documents", "search_image", "fact_check"]);

function categoryFor(name: string): ToolCategory {
  if (name.includes("web") || name === "browse_web_page" || name === "open_url") return "web";
  if (name.includes("library") || name.includes("document")) return "library";
  if (name.includes("calendar") || name.includes("event")) return "calendar";
  if (name.includes("message") || name.includes("chat") || name.includes("group")) return "chat";
  if (name.includes("habit") || name.includes("concept") || name.includes("learning")) return "learning";
  if (name.includes("image") || name.includes("video")) return "media";
  if (name.includes("research") || name.includes("search") || name === "fact_check") return "research";
  if (name.includes("stats") || name.includes("progress") || name.includes("report")) return "stats";
  if (name.includes("profile") || name.includes("user")) return "profile";
  if (name.includes("exam") || name.includes("math") || name.includes("academic")) return "education";
  if (name.includes("recipe") || name.includes("nutrition") || name.includes("macro") || name.includes("shopping")) return "nutrition";
  return "content";
}

function riskFor(name: string): ToolRisk {
  if (HIGH_RISK.has(name)) return "high";
  if (READ_ONLY.has(name) || LOW_RISK_WRITES.has(name)) return "low";
  return "medium";
}

export function getToolDefinition(name: string): ToolDefinition | null {
  const schema = ToolSchemas[name];
  if (!schema) return null;
  const readOnly = READ_ONLY.has(name);
  const risk = riskFor(name);
  return {
    id: name,
    name,
    description: name.replace(/_/g, " "),
    category: categoryFor(name),
    schema,
    requiresConfirmation: !readOnly,
    externalEffect: !readOnly,
    readOnly,
    supportsAutopilot: readOnly || LOW_RISK_WRITES.has(name),
    supportsParallel: PARALLEL_SAFE.has(name),
    uiType: readOnly ? "result" : "approval",
    risk,
  };
}

export function getToolDefinitions(names?: string[]): ToolDefinition[] {
  return (names ?? Object.keys(ToolSchemas)).map(getToolDefinition).filter((v): v is ToolDefinition => Boolean(v));
}

export function shouldExecuteTool(tool: ToolDefinition, mode: ToolMode, risk: ToolRisk = tool.risk, permissions: string[] = []): ToolExecutionDecision {
  if (!permissions.includes("ai.tools.execute")) return "deny";
  if (risk === "high") return "pending_confirmation";
  if (mode === "manual") return tool.requiresConfirmation ? "pending_confirmation" : "execute";
  return tool.supportsAutopilot ? "execute" : "pending_confirmation";
}
