import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { readCalendarEvents, updateCalendarEvent, deleteCalendarEvent, readHabitTracker } from "@/actions/calendar";

export const readCalendarTool: ToolDefinition = {
  id: "read_calendar",
  category: "calendar",
  description: "Lee los eventos del calendario en un rango de fechas. Formato de fecha esperado YYYY-MM-DD.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    startDate: z.string().describe("Fecha de inicio en formato YYYY-MM-DD (ej: 2026-09-04)"),
    endDate: z.string().describe("Fecha de fin en formato YYYY-MM-DD"),
  }),
  execute: async (args) => {
    try {
      const events = await readCalendarEvents(args.startDate, args.endDate);
      return {
        success: true,
        message: `Se encontraron ${events.length} eventos entre ${args.startDate} y ${args.endDate}.`,
        data: events,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al leer el calendario" };
    }
  },
};

export const updateCalendarEventTool: ToolDefinition = {
  id: "update_calendar_event",
  category: "calendar",
  description: "Actualiza un evento existente en el calendario.",
  risk: "write",
  requiresConfirmation: true, // Needs confirmation because it's a write
  supportsAutopilot: false,
  schema: z.object({
    eventId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
  }),
  execute: async (args) => {
    try {
      await updateCalendarEvent(args.eventId, args);
      return { success: true, message: `Evento ${args.eventId} actualizado con éxito.` };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al actualizar evento" };
    }
  },
};

export const deleteCalendarEventTool: ToolDefinition = {
  id: "delete_calendar_event",
  category: "calendar",
  description: "Elimina un evento del calendario permanentemente.",
  risk: "destructive",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    eventId: z.string(),
  }),
  execute: async (args) => {
    try {
      await deleteCalendarEvent(args.eventId);
      return { success: true, message: `Evento ${args.eventId} eliminado con éxito.` };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al eliminar evento" };
    }
  },
};

export const readHabitsTool: ToolDefinition = {
  id: "read_habits",
  category: "calendar",
  description: "Lee los hábitos activos y sus estadísticas de cumplimiento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    weekStart: z.string().optional().describe("Inicio de la semana (ej: YYYY-MM-DD). Si no se provee, usa la actual."),
  }),
  execute: async (args) => {
    try {
      const habits = await readHabitTracker(args.weekStart);
      return {
        success: true,
        message: "Hábitos leídos correctamente.",
        data: habits,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al leer los hábitos" };
    }
  },
};

export const calendarSkill: Skill = {
  id: "calendar",
  name: "Gestión de Tiempo",
  category: "calendar",
  description: "Gestiona eventos, hábitos y agenda.",
  tools: [readCalendarTool, updateCalendarEventTool, deleteCalendarEventTool, readHabitsTool],
};
