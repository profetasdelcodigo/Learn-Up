import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_TIMEZONE = process.env.LEARN_UP_TIMEZONE || process.env.NEXT_PUBLIC_TIMEZONE || "America/Lima";

function hasExplicitTimezone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function toUtcIsoFromLocal(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || hasExplicitTimezone(trimmed)) return trimmed;

  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return trimmed;

  const [, date, hh, mm, ss = "00"] = match;
  const localAsUtc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(hh), Number(mm), Number(ss));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const zonePart = formatter.formatToParts(new Date(localAsUtc)).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const offsetMatch = /^GMT([+-])(\d{2}):?(\d{2})$/.exec(zonePart);
  if (!offsetMatch) return new Date(localAsUtc).toISOString();

  const sign = offsetMatch[1] === "+" ? 1 : -1;
  const offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  return new Date(localAsUtc - offsetMinutes * 60_000).toISOString();
}

function normalizeCalendarArgs(toolId: string, args: any) {
  const next = { ...args };
  if (toolId === "add_calendar_event") {
    if (next.start_time) next.start_time = next.start_time.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, "");
    if (next.end_time) next.end_time = next.end_time.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, "");
  }
  if (toolId === "update_calendar_event" || toolId === "create_recurring_event") {
    if (next.start_time) next.start_time = toUtcIsoFromLocal(next.start_time);
    if (next.end_time) next.end_time = toUtcIsoFromLocal(next.end_time);
  }
  return next;
}

function wrapTool(tool: ToolDefinition): ToolDefinition {
  if (!tool.execute) return tool;
  if (!["add_calendar_event", "update_calendar_event", "create_recurring_event"].includes(tool.id)) return tool;
  return {
    ...tool,
    execute: async (args: any, context: any) => tool.execute!(normalizeCalendarArgs(tool.id, args), context),
  };
}

const readCalendarLocalTool: ToolDefinition = {
  id: "read_calendar",
  category: "calendar",
  name: "Leer calendario",
  description: "Lee eventos usando los límites del día en la zona horaria local del usuario.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: { parse: (value: unknown) => value } as any,
  execute: async (args: any) => {
    const startLocal = `${args.startDate}T00:00:00`;
    const endDate = new Date(`${args.endDate}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endLocal = endDate.toISOString().slice(0, 10) + "T00:00:00";
    const startUtc = toUtcIsoFromLocal(startLocal)!;
    const endUtc = toUtcIsoFromLocal(endLocal)!;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };
    const { data, error } = await supabase.from("calendar_events")
      .select("id,title,description,start_time,end_time,recurrence_rule,recurrence_end,reminder_minutes,color,created_at")
      .eq("user_id", user.id)
      .lt("start_time", endUtc)
      .gt("end_time", startUtc)
      .order("start_time");
    if (error) return { success: false, error: error.message };
    return { success: true, message: `${(data || []).length} evento(s) encontrados.`, data: { events: data || [], timezone: DEFAULT_TIMEZONE } };
  },
};

export function withCalendarTimezoneFix(skill: Skill): Skill {
  if (skill.id !== "calendar") return skill;
  const tools = skill.tools.map(wrapTool).filter((tool) => tool.id !== "read_calendar");
  tools.push(readCalendarLocalTool);
  return { ...skill, tools };
}
