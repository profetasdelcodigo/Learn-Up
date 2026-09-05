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
  uiType:
    | "search"
    | "navigation"
    | "calendar"
    | "chat"
    | "document"
    | "learning"
    | "content"
    | "media"
    | "research"
    | "data"
    | "profile"
    | "education"
    | "generic";
}

const TOOL_ALIASES: Record<string, string> = {
  create_calendar_event: "add_calendar_event",
  create_event: "add_calendar_event",
  create_group: "create_study_group",
  compare_multiple_sources: "compare_multiple_sources",
  deep_multi_source_research: "deep_research",
  auto_fact_check: "fact_check",
};

const HIGH_RISK = new Set([
  "delete_calendar_event",
  "delete_habit",
  "delete_own_library_item",
  "delete_indexed_document",
  "delete_sent_message",
  "delete_shared_event",
  "delete_shared_message",
  "leave_shared_calendar",
  "leave_group",
  "remove_friend",
  "block_user",
  "unblock_user",
  "delete_account",
  "pause_account",
]);

const EXTERNAL = new Set([
  "generate_image",
  "generate_video",
  "text_to_speech",
  "send_message",
  "broadcast_message",
  "trigger_webhook",
  "sync_google_drive",
  "export_to_google_drive",
  "sync_notion",
  "export_to_notion",
  "sync_github",
  "create_github_repo",
  "connect_zoom",
  "create_zoom_meeting",
  "connect_slack",
  "send_slack_message",
  "send_discord_webhook",
]);

function normalize(rawName: string): string {
  const name = String(rawName || "").trim();
  return TOOL_ALIASES[name] || name;
}

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

function isParallelCandidate(name: string): boolean {
  return [
    "browse_web_page",
    "search_web",
    "advanced_web_search",
    "search_image",
    "search_news",
    "search_academic_paper",
    "compare_multiple_sources",
    "deep_research",
  ].includes(name);
}

export function normalizeToolName(rawName: string): string {
  return normalize(rawName);
}

export function getToolDefinition(rawName: string): ToolDefinition {
  const name = normalize(rawName);
  const registered = aiRegistry.getTool(name);
  const highRisk = HIGH_RISK.has(name);

  if (registered) {
    const readOnly = registered.risk === "read" && !highRisk;
    const externalEffect = registered.risk !== "read" || EXTERNAL.has(name) || highRisk;
    return {
      id: registered.id,
      name: registered.id,
      category: registered.category,
      schema: registered.schema,
      requiresConfirmation: highRisk || registered.requiresConfirmation || (registered.risk !== "read"),
      externalEffect,
      readOnly,
      supportsAutopilot: !highRisk && registered.supportsAutopilot === true,
      supportsParallel: readOnly && isParallelCandidate(name),
      uiType: categoryFor(name),
    };
  }

  const readOnly = !highRisk && !EXTERNAL.has(name) && (
    name.startsWith("read_") ||
    name.startsWith("view_") ||
    name.startsWith("search_") ||
    name.startsWith("analyze_") ||
    name.startsWith("find_") ||
    name.startsWith("get_") ||
    name.startsWith("list_") ||
    name.startsWith("calculate_") ||
    name.startsWith("detect_")
  );

  return {
    id: name,
    name,
    category: categoryFor(name),
    requiresConfirmation: highRisk || !readOnly || EXTERNAL.has(name),
    externalEffect: highRisk || EXTERNAL.has(name),
    readOnly,
    supportsAutopilot: readOnly && !highRisk,
    supportsParallel: readOnly && isParallelCandidate(name),
    uiType: categoryFor(name),
  };
}

export function shouldExecuteTool(
  rawName: string,
  mode: ToolMode,
  permissions = true,
): ToolDecision {
  if (!permissions) return "deny";

  const name = normalize(rawName);
  const definition = getToolDefinition(name);

  if (HIGH_RISK.has(name)) return "pending_confirmation";

  if (mode === "autopilot") {
    return definition.supportsAutopilot ? "execute" : "pending_confirmation";
  }

  return definition.requiresConfirmation ? "pending_confirmation" : "execute";
}

export function isReadOnlyTool(rawName: string): boolean {
  return getToolDefinition(rawName).readOnly;
}
