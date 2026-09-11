import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { createClient } from "@/utils/supabase/server";

const VALID_REMINDERS = new Set([10, 30, 60, 1440, 10080]);

const setEventReminderTool: ToolDefinition = {
  id: "set_event_reminder",
  category: "calendar",
  name: "Recordatorio de evento",
  description: "Configura o actualiza un recordatorio real para un evento personal y persiste la notificación programada.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({ event_id: z.string().uuid(), reminder_minutes: z.number().int().nonnegative() }),
  execute: async ({ event_id, reminder_minutes }) => {
    if (!VALID_REMINDERS.has(reminder_minutes)) throw new Error("El recordatorio debe ser 10 min, 30 min, 1 h, 1 día o 1 semana antes.");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autorizado.");
    const { data: event, error } = await supabase.from("calendar_events").select("id,title,start_time,user_id").eq("id", event_id).eq("user_id", user.id).single();
    if (error || !event) throw new Error("No se encontró el evento o no te pertenece.");
    const { error: updateError } = await supabase.from("calendar_events").update({ reminder_minutes, reminder_sent_at: null }).eq("id", event_id).eq("user_id", user.id);
    if (updateError) throw updateError;
    const sendAt = new Date(new Date(event.start_time).getTime() - reminder_minutes * 60000);
    if (sendAt <= new Date()) throw new Error("El recordatorio quedaría en el pasado; elige un intervalo menor o un evento futuro.");

    const { error: deletePendingError } = await supabase
      .from("scheduled_notifications")
      .delete()
      .eq("user_id", user.id)
      .is("sent_at", null)
      .contains("metadata", { kind: "calendar_reminder", event_id });
    if (deletePendingError) throw deletePendingError;

    const { error: notificationError } = await supabase.from("scheduled_notifications").insert({
      user_id: user.id,
      title: "Recordatorio de calendario",
      message: `Recordatorio: ${event.title}`,
      link: "/calendar",
      send_at: sendAt.toISOString(),
      metadata: { kind: "calendar_reminder", event_id, reminder_minutes },
    });
    if (notificationError) throw notificationError;
    return {
      success: true,
      message: `Recordatorio configurado ${reminder_minutes} minutos antes.`,
      data: { eventId: event_id, title: event.title, reminderMinutes: reminder_minutes, sendAt: sendAt.toISOString() },
    };
  },
};

export function withFinalCalendarReminderOverrides(skill: Skill): Skill {
  if (skill.id !== "calendar") return skill;
  const tools = skill.tools.filter((tool) => tool.id !== setEventReminderTool.id);
  tools.push(setEventReminderTool);
  return { ...skill, tools };
}
