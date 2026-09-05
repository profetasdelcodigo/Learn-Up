import { aiRegistry } from "./skills";

export type ToolMode = "manual" | "autopilot";
export type ToolRisk = "read" | "write" | "external" | "high";
export type ToolDecision = "execute" | "pending_confirmation" | "deny";

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  schema?: unknown;
  requiresConfirmation: boolean;
  externalEffect: boolean;
  readOnly: boolean;
  supportsAutopilot: boolean;
  supportsParallel: boolean;
  uiType: "search" | "navigation" | "calendar" | "chat" | "document" | "learning" | "content" | "media" | "research" | "data" | "profile" | "education" | "generic";
}

const TOOL_ALIASES: Record<string, string> = {
  create_calendar_event: "add_calendar_event",
  create_group: "create_study_group",
  create_event: "add_calendar_event",
  read_calendar: "read_calendar",
  compare_multiple_sources: "compare_sources_multiple",
  deep_research: "deep_research_multi_source",
  find_statistics: "search_statistics_data",
  search_github_repos: "search_github_code",
  search_oer_resources: "search_open_education",
  analyze_seo_url: "analyze_seo",
  fetch_citation_metadata: "search_doi_isbn",
  deep_multi_source_research: "deep_research_multi_source",
  search_creative_commons_images: "search_scientific_images",
  auto_fact_check: "fact_check",
};

export function normalizeToolName(name: string): string {
  return TOOL_ALIASES[name] || name;
}

const READ_ONLY = new Set([
  "open_url", "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia", "compare_sources_multiple", "deep_research_multi_source", "search_academic_paper",
  "search_library", "search_documents", "query_repositories", "view_own_library_items", "list_indexed_documents", "summarize_document", "extract_questions_from_doc", "cite_source", "analyze_source_credibility",
  "search_knowledge_graph", "view_related_concepts", "view_progress_by_subject", "calculate_mastery_score", "read_calendar", "read_calendar_events", "search_calendar_events", "read_habit_tracker", "view_habit_stats",
  "read_shared_events", "read_shared_chat", "view_shared_members", "read_unread_messages", "read_full_conversation", "view_group_members", "search_user_by_name", "search_chat_history",
  "view_study_stats", "generate_weekly_report", "view_exam_history", "analyze_strengths_weaknesses", "view_habit_streaks", "detect_procrastination", "generate_academic_dashboard", "view_friends_list",
  "view_friend_profile", "view_recent_activity", "view_ai_sessions", "view_ai_personalities", "view_ai_memory", "view_ai_token_usage", "view_daily_quests", "view_leaderboard", "view_global_ranking",
  "view_friends_ranking", "view_achievements", "view_inventory", "view_shop", "view_shop_specials", "view_duel_history", "view_guild_stats", "view_pomodoro_stats", "view_mood_history",
  "view_screen_time", "get_screen_time_warning", "get_ergonomic_advice", "view_report_status", "view_blocked_users", "view_appeal_status", "view_feature_roadmap", "view_bug_reports",
  "read_system_announcements", "search_image", "search_youtube_video", "search_scientific_image", "search_creative_commons_images", "search_statistics", "analyze_image", "describe_math_image",
  "generate_summary", "generate_presentation_outline", "generate_glossary", "generate_comparison_table", "generate_code", "generate_practice_questions", "generate_mind_map", "generate_bibliography",
  "generate_project_template", "generate_timeline", "generate_formal_letter", "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus", "generate_mermaid_diagram",
  "generate_podcast_script", "generate_concept_map", "solve_math_problem", "analyze_literary_text", "conjugate_verb", "translate_with_explanation", "explain_with_analogy", "socratic_debate",
  "practice_language_vocabulary", "analyze_statistical_data", "prepare_standardized_test", "analyze_artwork", "explain_scientific_phenomenon", "language_speaking_practice"
]);

const EXTERNAL = new Set([
  "generate_image", "generate_video", "send_message", "broadcast_message", "trigger_webhook", "sync_google_drive", "export_to_google_drive", "sync_notion", "export_to_notion",
  "sync_github", "create_github_repo", "connect_zoom", "create_zoom_meeting", "connect_slack", "send_slack_message", "send_discord_webhook"
]);

const HIGH_RISK = new Set([
  "delete_calendar_event", "delete_habit", "delete_own_library_item", "delete_indexed_document", "delete_sent_message", "delete_shared_event", "delete_shared_message", "leave_shared_calendar",
  "leave_group", "remove_friend", "block_user", "unblock_user", "delete_account", "pause_account"
]);

function categoryFor(name: string): ToolDefinition["uiType"] {
  if (name === "open_url") return "navigation";
  if (name.includes("calendar") || name.includes("habit")) return "calendar";
  if (name.includes("message") || name.includes("chat") || name.includes("group")) return "chat";
  if (name.includes("document") || name.includes("library") || name.includes("source")) return "document";
  if (name.includes("knowledge") || name.includes("concept") || name.includes("learning")) return "learning";
  if (name.includes("image") || name.includes("video") || name.includes("audio") || name.includes("media")) return "media";
  if (name.includes("search") || name.includes("research") || name.includes("fact")) return "research";
  if (name.includes("profile") || name.includes("friend") || name.includes("avatar")) return "profile";
  if (name.includes("exam") || name.includes("math") || name.includes("physics") || name.includes("essay")) return "education";
  return "generic";
}

export function getToolDefinition(rawName: string): ToolDefinition {
  const name = normalizeToolName(rawName);
  const registered = aiRegistry.getTool(name);
  if (registered) {
    const readOnly = registered.risk === "read";
    return {
      id: registered.id,
      name: registered.id,
      category: registered.category,
      schema: registered.schema,
      requiresConfirmation: registered.requiresConfirmation,
      externalEffect: registered.risk !== "read",
      readOnly,
      supportsAutopilot: registered.supportsAutopilot,
      supportsParallel: readOnly && ["browse_web_page", "search_web", "advanced_web_search", "search_image", "search_news", "search_academic_paper", "compare_sources_multiple", "deep_research_multi_source"].includes(name),
      uiType: categoryFor(name),
    };
  }
  const readOnly = READ_ONLY.has(name);
  const externalEffect = EXTERNAL.has(name);
  const highRisk = HIGH_RISK.has(name);
  return {
    id: name,
    name,
    category: categoryFor(name),
    requiresConfirmation: !readOnly || highRisk || externalEffect,
    externalEffect,
    readOnly,
    supportsAutopilot: readOnly && !highRisk,
    supportsParallel: readOnly && ["browse_web_page", "search_web", "advanced_web_search", "search_image", "search_news", "search_academic_paper"].includes(name),
    uiType: categoryFor(name),
  };
}

export function shouldExecuteTool(rawName: string, mode: ToolMode, permissions = true): ToolDecision {
  if (!permissions) return "deny";
  const tool = getToolDefinition(rawName);
  if (mode === "autopilot" && tool.supportsAutopilot) return "execute";
  return tool.requiresConfirmation ? "pending_confirmation" : "execute";
}

export function isReadOnlyTool(rawName: string): boolean {
  return getToolDefinition(rawName).readOnly;
}
