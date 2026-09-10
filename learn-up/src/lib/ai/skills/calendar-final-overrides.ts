import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import {
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  readCalendarEvents,
  searchCalendarEvents,
  addHabitToTracker,
  readHabitTracker,
  updateHabit,
  completeHabitInTracker,
  undoHabitInTracker,
  deleteHabitFromTracker,
  getHabitStats,
  suggestWeeklyPlanData,
} from "@/actions/calendar";

function resultUi(tool: string, status: "preview" | "completed" = "completed") {
  return { component: "UniversalToolCard", tool, status };
}

function wrap(skill: Skill, id: string, patch: Partial<ToolDefinition>): Skill {
  return {
    ...skill,
    tools: skill.tools.map((tool) => (tool.id === id ? { ...tool, ...patch } : tool)),
  };
}

function icsEscape(value: unknown) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function formatIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function withFinalCalendarOverrides(skill: Skill): Skill {
  let next = skill;

  next = wrap(next, "add_calendar_event", {
    description: "Crea un evento personal. Valida que sea futuro, detecta conflictos y persiste recurrencia y recordatorio. Siempre muestra una vista previa antes de confirmar.",
    execute: async (args: any) => {
      const startTime = args.start_time ? `${args.date}T${args.start_time}:00` : `${args.date}T08:00:00`;
      const endTime = args.end_time ? `${args.date}T${args.end_time}:00` : `${args.date}T09:00:00`;
      const result = await addCalendarEvent({
        title: args.title,
        description: args.description,
        startTime,
        endTime,
        recurrenceRule: args.recurrence_rule,
        recurrenceEnd: args.recurrence_end,
        reminderMinutes: args.reminder_minutes,
      });
      return {
        success: true,
        message: result.conflicts.length
          ? `Evento listo con ${result.conflicts.length} conflicto(s). Revisa la vista previa antes de confirmar.`
          : `Evento "${args.title}" creado correctamente.`,
        data: { ...result.event, conflicts: result.conflicts, reminder: result.reminder, ui: resultUi("add_calendar_event", result.conflicts.length ? "preview" : "completed") },
      };
    },
  });

  next = wrap(next, "read_calendar", {
    execute: async (args: any) => {
      const events = await readCalendarEvents(args.startDate, args.endDate);
      const grouped = events.reduce((acc: Record<string, any[]>, event: any) => {
        const day = new Date(event.start_time).toISOString().slice(0, 10);
        (acc[day] ||= []).push(event);
        return acc;
      }, {});
      return { success: true, message: `${events.length} evento(s) encontrados.`, data: { events, grouped, ui: resultUi("read_calendar") } };
    },
  });

  next = wrap(next, "update_calendar_event", {
    execute: async (args: any) => {
      const result = await updateCalendarEvent(args.eventId, {
        title: args.title,
        description: args.description,
        start_time: args.start_time,
        end_time: args.end_time,
        recurrence_rule: args.recurrence_rule,
        recurrence_end: args.recurrence_end,
        reminder_minutes: args.reminder_minutes,
      });
      return { success: true, message: result.conflicts.length ? `Evento actualizado con ${result.conflicts.length} conflicto(s).` : "Evento actualizado correctamente.", data: { ...result.event, conflicts: result.conflicts, reminder: result.reminder, ui: resultUi("update_calendar_event") } };
    },
  });

  next = wrap(next, "delete_calendar_event", {
    execute: async (args: any) => {
      const deleted = await deleteCalendarEvent(args.eventId);
      return { success: true, message: `Evento "${deleted.title}" eliminado.`, data: { deleted, ui: resultUi("delete_calendar_event") } };
    },
  });

  next = wrap(next, "search_calendar_events", {
    execute: async (args: any) => {
      const events = await searchCalendarEvents(args.query);
      return { success: true, message: `${events.length} evento(s) encontrados.`, data: { events, ui: resultUi("search_calendar_events") } };
    },
  });

  next = wrap(next, "suggest_weekly_plan", {
    execute: async () => {
      const data = await suggestWeeklyPlanData();
      return { success: true, message: "Datos de calendario y hábitos listos para generar el plan semanal.", data: { ...data, ui: resultUi("suggest_weekly_plan") } };
    },
  });

  next = wrap(next, "add_habit", {
    schema: z.object({
      title: z.string().min(1),
      frequency: z.string().default("daily"),
      target_time: z.string().optional(),
      start_date: z.string().optional(),
    }),
    execute: async (args: any) => {
      const data = await addHabitToTracker(args.title, args.frequency, args.target_time, args.start_date);
      return { success: true, message: `Hábito "${args.title}" creado.`, data: { habit: data, ui: resultUi("add_habit") } };
    },
  });

  next = wrap(next, "read_habits", {
    execute: async (args: any) => {
      const habits = await readHabitTracker(args.weekStart);
      return { success: true, message: `${habits.length} hábito(s) activos.`, data: { habits, ui: resultUi("read_habits") } };
    },
  });

  next = wrap(next, "complete_habit", {
    execute: async (args: any) => {
      const result = await completeHabitInTracker(args.habitId, args.date);
      return { success: true, message: `Hábito completado. Racha actual: ${result.streak} día(s). 🔥`, data: { ...result, ui: resultUi("complete_habit") } };
    },
  });

  next = wrap(next, "undo_habit", {
    execute: async (args: any) => {
      const result = await undoHabitInTracker(args.habitId, args.date);
      return { success: true, message: `Completado desmarcado. Racha actual: ${result.streak} día(s).`, data: { ...result, ui: resultUi("undo_habit") } };
    },
  });

  next = wrap(next, "update_habit", {
    execute: async (args: any) => {
      const data = await updateHabit(args.habitId, {
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.frequency !== undefined ? { frequency: args.frequency } : {}),
        ...(args.target_time !== undefined ? { target_time: args.target_time } : {}),
        ...(args.start_date !== undefined ? { start_date: args.start_date } : {}),
      });
      return { success: true, message: "Hábito actualizado sin modificar su historial.", data: { habit: data, ui: resultUi("update_habit") } };
    },
  });

  next = wrap(next, "delete_habit", {
    execute: async (args: any) => {
      const data = await deleteHabitFromTracker(args.habitId, false);
      return { success: true, message: "Hábito eliminado permanentemente.", data: { deleted: data, ui: resultUi("delete_habit") } };
    },
  });

  next = wrap(next, "archive_habit", {
    execute: async (args: any) => {
      const data = await deleteHabitFromTracker(args.habitId, true);
      return { success: true, message: "Hábito archivado; su historial se conserva.", data: { habit: data, ui: resultUi("archive_habit") } };
    },
  });

  next = wrap(next, "view_habit_stats", {
    execute: async (args: any) => {
      const stats = await getHabitStats(args.habitId);
      return { success: true, message: `Estadísticas calculadas para ${stats.length} hábito(s).`, data: { stats, ui: resultUi("view_habit_stats") } };
    },
  });

  next = wrap(next, "export_calendar_ics", {
    execute: async () => {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const end = new Date(today); end.setFullYear(end.getFullYear() + 1);
      const events = await readCalendarEvents(from, end.toISOString().slice(0, 10));
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Learn Up//Calendar//ES", ...events.flatMap((event: any) => [
        "BEGIN:VEVENT",
        `UID:${event.id}@learn-up`,
        `DTSTAMP:${formatIcsDate(event.created_at || event.start_time)}`,
        `DTSTART:${formatIcsDate(event.start_time)}`,
        `DTEND:${formatIcsDate(event.end_time)}`,
        `SUMMARY:${icsEscape(event.title)}`,
        ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
        "END:VEVENT",
      ]), "END:VCALENDAR"].join("\r\n");
      return {
        success: true,
        message: `Calendario exportado con ${events.length} evento(s).`,
        data: { filename: "learn-up-calendar.ics", content: body, mimeType: "text/calendar", ui: resultUi("export_calendar_ics") },
      };
    },
  });

  if (!next.tools.some((tool) => tool.id === "create_recurring_event")) {
    next = {
      ...next,
      tools: [...next.tools, {
        id: "create_recurring_event",
        category: "calendar",
        name: "Crear evento recurrente",
        description: "Crea un evento futuro con regla diaria, semanal, quincenal, mensual o anual y fecha final opcional.",
        schema: z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          start_time: z.string(),
          end_time: z.string(),
          recurrence_rule: z.enum(["daily", "biweekly", "weekly", "monthly", "yearly"]),
          recurrence_end: z.string().optional(),
          reminder_minutes: z.number().optional(),
        }),
        risk: "write",
        requiresConfirmation: true,
        supportsAutopilot: false,
        execute: async (args: any) => {
          const start = new Date(args.start_time);
          const end = new Date(args.end_time);
          const result = await addCalendarEvent({
            title: args.title,
            description: args.description,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            recurrenceRule: args.recurrence_rule,
            recurrenceEnd: args.recurrence_end,
            reminderMinutes: args.reminder_minutes,
          });
          return { success: true, message: `Evento recurrente "${args.title}" creado.`, data: { ...result, ui: resultUi("create_recurring_event") } };
        },
      } as ToolDefinition],
    };
  }

  return next;
}
