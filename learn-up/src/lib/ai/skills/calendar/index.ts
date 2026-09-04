import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import {
  readCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
  searchCalendarEvents,
  readHabitTracker,
  addHabitToTracker,
  updateHabit,
  completeHabitInTracker,
  undoHabitInTracker,
  deleteHabitFromTracker,
} from "@/actions/calendar";
import {
  createSharedCalendar,
  addCalendarMember,
  addSharedEvent,
  readSharedEvents,
  deleteSharedEvent,
  sendSharedMessage,
  readSharedChat,
  deleteSharedMessage,
  leaveSharedCalendar,
  getSharedCalendarMembers,
  notifySharedHabitProgress,
} from "@/actions/shared-calendars";

// ═══════════════════════════════════════════════════════════════════════════
// 1. AGREGAR EVENTO PERSONAL (write)
// ═══════════════════════════════════════════════════════════════════════════
export const addCalendarEventTool: ToolDefinition = {
  id: "add_calendar_event",
  category: "calendar",
  description:
    "Crea un evento en el calendario personal. Solicita título, fecha/hora de inicio y fin. Detecta conflictos con eventos existentes.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    title: z.string().min(1).describe("Título del evento"),
    description: z.string().optional().describe("Descripción opcional del evento"),
    date: z.string().describe("Fecha en formato YYYY-MM-DD"),
    start_time: z.string().optional().describe("Hora de inicio en formato HH:MM"),
    end_time: z.string().optional().describe("Hora de fin en formato HH:MM"),
    recurrence_rule: z
      .string()
      .optional()
      .describe("Regla de recurrencia: daily, weekly:mon,wed, monthly, yearly"),
    reminder_minutes: z
      .number()
      .optional()
      .describe("Minutos antes del evento para recordatorio (10, 30, 60, 1440, 10080)"),
  }),
  execute: async (args) => {
    try {
      const { createClient } = await import("@/utils/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "No autenticado" };

      const startISO = args.start_time
        ? `${args.date}T${args.start_time}:00`
        : `${args.date}T08:00:00`;
      const endISO = args.end_time
        ? `${args.date}T${args.end_time}:00`
        : `${args.date}T09:00:00`;

      // Check for conflicts
      const existing = await readCalendarEvents(args.date, args.date);
      const conflicts = existing.filter((e: any) => {
        const eStart = new Date(e.start_time).getTime();
        const eEnd = new Date(e.end_time).getTime();
        const nStart = new Date(startISO).getTime();
        const nEnd = new Date(endISO).getTime();
        return nStart < eEnd && nEnd > eStart;
      });

      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          user_id: user.id,
          title: args.title,
          description: args.description || null,
          start_time: startISO,
          end_time: endISO,
        })
        .select()
        .single();

      if (error) throw error;

      let message = `Evento "${args.title}" creado para el ${args.date}.`;
      if (conflicts.length > 0) {
        message += ` ⚠️ Nota: hay ${conflicts.length} evento(s) en el mismo horario.`;
      }

      return { success: true, message, data };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al crear evento" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. LEER CALENDARIO (RANGO) (read)
// ═══════════════════════════════════════════════════════════════════════════
export const readCalendarTool: ToolDefinition = {
  id: "read_calendar",
  category: "calendar",
  description:
    "Lee los eventos del calendario en un rango de fechas (hoy, esta semana, este mes, o fechas específicas).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    startDate: z.string().describe("Fecha de inicio en formato YYYY-MM-DD"),
    endDate: z.string().describe("Fecha de fin en formato YYYY-MM-DD"),
  }),
  execute: async (args) => {
    try {
      const events = await readCalendarEvents(args.startDate, args.endDate);
      if (events.length === 0) {
        return {
          success: true,
          message: `No hay eventos entre ${args.startDate} y ${args.endDate}.`,
          data: [],
        };
      }
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

// ═══════════════════════════════════════════════════════════════════════════
// 3. EDITAR EVENTO PERSONAL (write)
// ═══════════════════════════════════════════════════════════════════════════
export const updateCalendarEventTool: ToolDefinition = {
  id: "update_calendar_event",
  category: "calendar",
  description: "Edita un evento existente del calendario. Puede cambiar título, descripción o fecha/hora.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    eventId: z.string().describe("ID del evento a editar"),
    title: z.string().optional().describe("Nuevo título"),
    description: z.string().optional().describe("Nueva descripción"),
    start_time: z.string().optional().describe("Nueva fecha/hora de inicio ISO"),
    end_time: z.string().optional().describe("Nueva fecha/hora de fin ISO"),
  }),
  execute: async (args) => {
    try {
      const updates: any = {};
      if (args.title) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.start_time) updates.start_time = args.start_time;
      if (args.end_time) updates.end_time = args.end_time;

      await updateCalendarEvent(args.eventId, updates);
      return { success: true, message: `Evento actualizado correctamente.` };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al actualizar evento" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. ELIMINAR EVENTO PERSONAL (destructive)
// ═══════════════════════════════════════════════════════════════════════════
export const deleteCalendarEventTool: ToolDefinition = {
  id: "delete_calendar_event",
  category: "calendar",
  description: "Elimina un evento del calendario personal permanentemente. Pide confirmación.",
  risk: "destructive",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    eventId: z.string().describe("ID del evento a eliminar"),
  }),
  execute: async (args) => {
    try {
      await deleteCalendarEvent(args.eventId);
      return { success: true, message: `Evento eliminado correctamente.` };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al eliminar evento" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. BUSCAR EVENTOS (read)
// ═══════════════════════════════════════════════════════════════════════════
export const searchCalendarEventsTool: ToolDefinition = {
  id: "search_calendar_events",
  category: "calendar",
  description: "Busca eventos por palabra clave en título o descripción.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    query: z.string().min(1).describe("Término de búsqueda"),
  }),
  execute: async (args) => {
    try {
      const events = await searchCalendarEvents(args.query);
      return {
        success: true,
        message: `Se encontraron ${events.length} eventos con "${args.query}".`,
        data: events,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al buscar eventos" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. SUGERIR PLAN SEMANAL (read — LLM directive)
// ═══════════════════════════════════════════════════════════════════════════
export const suggestWeeklyPlanTool: ToolDefinition = {
  id: "suggest_weekly_plan",
  category: "calendar",
  description:
    "Analiza hábitos y eventos de la semana y sugiere un horario optimizado para estudio, descanso y actividades.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const events = await readCalendarEvents(fmt(startOfWeek), fmt(endOfWeek));
      const habits = await readHabitTracker(fmt(startOfWeek));

      return {
        success: true,
        message: "Datos obtenidos para planificación semanal.",
        data: {
          events,
          habits,
          instruction:
            "Genera un plan semanal optimizado basado en los eventos y hábitos del usuario. Incluye bloques de estudio, descanso y actividades. Formato: tabla Markdown con días y horarios.",
        },
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al generar plan" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. AGREGAR HÁBITO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const addHabitTool: ToolDefinition = {
  id: "add_habit",
  category: "calendar",
  description:
    "Crea un nuevo hábito con nombre, frecuencia (daily/weekly/days) y hora objetivo.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    title: z.string().min(1).describe("Nombre del hábito"),
    frequency: z
      .string()
      .optional()
      .describe("Frecuencia: 'daily', 'weekly:lun,mie,vie', etc."),
    target_time: z.string().optional().describe("Hora objetivo en formato HH:MM"),
  }),
  execute: async (args) => {
    try {
      const data = await addHabitToTracker(args.title, args.frequency, args.target_time);
      return {
        success: true,
        message: `Hábito "${args.title}" creado exitosamente. ¡A mantener la racha! 🔥`,
        data,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al crear hábito" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. LEER HABIT TRACKER (read)
// ═══════════════════════════════════════════════════════════════════════════
export const readHabitsTool: ToolDefinition = {
  id: "read_habits",
  category: "calendar",
  description:
    "Muestra todos los hábitos activos, su racha actual, completados esta semana y porcentaje de cumplimiento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    weekStart: z
      .string()
      .optional()
      .describe("Inicio de la semana YYYY-MM-DD, si no se provee usa la actual"),
  }),
  execute: async (args) => {
    try {
      const habits = await readHabitTracker(args.weekStart);
      return {
        success: true,
        message: `Se encontraron ${habits.length} hábitos activos.`,
        data: habits,
      };
    } catch (error: any) {
      return { success: false, error: error.message || "Error al leer hábitos" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. COMPLETAR HÁBITO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const completeHabitTool: ToolDefinition = {
  id: "complete_habit",
  category: "calendar",
  description: "Marca un hábito como completado para hoy o una fecha específica.",
  risk: "write",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    habitId: z.string().describe("ID del hábito a completar"),
    date: z.string().optional().describe("Fecha YYYY-MM-DD (si no se indica, usa hoy)"),
  }),
  execute: async (args) => {
    try {
      const date = args.date || new Date().toISOString().split("T")[0];
      await completeHabitInTracker(args.habitId, date);
      return {
        success: true,
        message: `¡Hábito completado para ${date}! 🎉 ¡Sigue así!`,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al completar hábito" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 10. DESMARCAR COMPLETADO DE HÁBITO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const uncompleteHabitTool: ToolDefinition = {
  id: "undo_habit",
  category: "calendar",
  description: "Deshace el completado de un hábito (si se marcó por error).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    habitId: z.string().describe("ID del hábito"),
    date: z.string().optional().describe("Fecha YYYY-MM-DD"),
  }),
  execute: async (args) => {
    try {
      const date = args.date || new Date().toISOString().split("T")[0];
      await undoHabitInTracker(args.habitId, date);
      return { success: true, message: `Completado deshecho para ${date}.` };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al deshacer" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 11. EDITAR HÁBITO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const updateHabitTool: ToolDefinition = {
  id: "update_habit",
  category: "calendar",
  description: "Cambia nombre, frecuencia u hora objetivo de un hábito sin perder historial.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    habitId: z.string().describe("ID del hábito"),
    title: z.string().optional().describe("Nuevo nombre"),
    frequency: z.string().optional().describe("Nueva frecuencia"),
    target_time: z.string().optional().describe("Nueva hora objetivo HH:MM"),
  }),
  execute: async (args) => {
    try {
      const updates: any = {};
      if (args.title) updates.name = args.title;
      if (args.frequency) updates.frequency = args.frequency;
      if (args.target_time) updates.target_time = args.target_time;
      await updateHabit(args.habitId, updates);
      return { success: true, message: "Hábito actualizado correctamente." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al actualizar hábito" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 12. ELIMINAR HÁBITO (destructive)
// ═══════════════════════════════════════════════════════════════════════════
export const deleteHabitTool: ToolDefinition = {
  id: "delete_habit",
  category: "calendar",
  description: "Elimina un hábito permanentemente. Pide confirmación.",
  risk: "destructive",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    habitId: z.string().describe("ID del hábito"),
  }),
  execute: async (args) => {
    try {
      await deleteHabitFromTracker(args.habitId, false);
      return { success: true, message: "Hábito eliminado permanentemente." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al eliminar hábito" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 13. ARCHIVAR HÁBITO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const archiveHabitTool: ToolDefinition = {
  id: "archive_habit",
  category: "calendar",
  description: "Archiva un hábito en vez de eliminarlo. Conserva el historial.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    habitId: z.string().describe("ID del hábito"),
  }),
  execute: async (args) => {
    try {
      await deleteHabitFromTracker(args.habitId, true);
      return { success: true, message: "Hábito archivado. Su historial se conserva." };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al archivar hábito" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 14. VER RACHA Y ESTADÍSTICAS DE HÁBITO (read — LLM directive)
// ═══════════════════════════════════════════════════════════════════════════
export const viewHabitStatsTool: ToolDefinition = {
  id: "view_habit_stats",
  category: "calendar",
  description:
    "Muestra racha actual, racha máxima, días completados y gráfica de consistencia de un hábito.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    habitId: z.string().optional().describe("ID del hábito (si no se indica, todos)"),
  }),
  execute: async (args) => {
    try {
      const habits = await readHabitTracker();
      const target = args.habitId
        ? habits.filter((h: any) => h.id === args.habitId)
        : habits;

      return {
        success: true,
        message: `Estadísticas de ${target.length} hábito(s).`,
        data: {
          habits: target,
          instruction:
            "Presenta las estadísticas de cada hábito: racha actual, completados en últimos 30 días, porcentaje de cumplimiento. Usa emojis de fuego 🔥 para rachas activas.",
        },
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Error al obtener estadísticas" };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 15. CREAR CALENDARIO COMPARTIDO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const createSharedCalendarTool: ToolDefinition = {
  id: "create_shared_calendar",
  category: "calendar",
  description: "Crea un calendario compartido e invita a miembros (deben ser amigos aceptados).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    name: z.string().min(1).describe("Nombre del calendario compartido"),
    members: z.array(z.string()).describe("Array de user IDs de los miembros a invitar"),
  }),
  execute: async (args) => {
    try {
      const result = await createSharedCalendar(args.name, args.members);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        message: `Calendario "${args.name}" creado con ${args.members.length} miembro(s).`,
        data: result.data,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 16. AGREGAR MIEMBRO A CALENDARIO COMPARTIDO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const addCalendarMemberTool: ToolDefinition = {
  id: "add_shared_calendar_member",
  category: "calendar",
  description: "Agrega un amigo a un calendario compartido existente. Solo el creador puede hacerlo.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario compartido"),
    memberId: z.string().describe("ID del usuario a agregar"),
  }),
  execute: async (args) => {
    try {
      const result = await addCalendarMember(args.calendarId, args.memberId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Miembro agregado al calendario." };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 17. AGREGAR EVENTO A CALENDARIO COMPARTIDO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const addSharedEventTool: ToolDefinition = {
  id: "add_shared_event",
  category: "calendar",
  description: "Crea un evento visible para todos los miembros del calendario compartido.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario compartido"),
    title: z.string().describe("Título del evento"),
    description: z.string().optional().describe("Descripción"),
    startTime: z.string().describe("Fecha/hora de inicio ISO"),
    endTime: z.string().describe("Fecha/hora de fin ISO"),
  }),
  execute: async (args) => {
    try {
      const result = await addSharedEvent(
        args.calendarId,
        args.title,
        args.description || "",
        args.startTime,
        args.endTime
      );
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: `Evento compartido "${args.title}" creado.`, data: result.data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 18. LEER EVENTOS COMPARTIDOS (read)
// ═══════════════════════════════════════════════════════════════════════════
export const readSharedEventsTool: ToolDefinition = {
  id: "read_shared_events",
  category: "calendar",
  description: "Muestra los eventos de un calendario compartido.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario compartido"),
  }),
  execute: async (args) => {
    try {
      const result = await readSharedEvents(args.calendarId);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        message: `${result.data?.length || 0} eventos compartidos encontrados.`,
        data: result.data,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 19. ELIMINAR EVENTO COMPARTIDO (destructive)
// ═══════════════════════════════════════════════════════════════════════════
export const deleteSharedEventTool: ToolDefinition = {
  id: "delete_shared_event",
  category: "calendar",
  description: "Elimina un evento de un calendario compartido. Solo el creador del evento puede hacerlo.",
  risk: "destructive",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    eventId: z.string().describe("ID del evento compartido a eliminar"),
  }),
  execute: async (args) => {
    try {
      const result = await deleteSharedEvent(args.eventId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Evento compartido eliminado." };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 20. ENVIAR MENSAJE AL CHAT DE CALENDARIO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const sendSharedMessageTool: ToolDefinition = {
  id: "send_shared_message",
  category: "calendar",
  description: "Envía un mensaje al chat de un calendario compartido.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario"),
    content: z.string().describe("Contenido del mensaje"),
    type: z.enum(["text", "audio", "system"]).default("text").describe("Tipo de mensaje"),
  }),
  execute: async (args) => {
    try {
      const result = await sendSharedMessage(args.calendarId, args.content, args.type);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Mensaje enviado al chat del calendario." };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 21. LEER CHAT DE CALENDARIO COMPARTIDO (read)
// ═══════════════════════════════════════════════════════════════════════════
export const readSharedChatTool: ToolDefinition = {
  id: "read_shared_chat",
  category: "calendar",
  description: "Lee los últimos N mensajes del chat de un calendario compartido.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario"),
    limit: z.number().optional().describe("Número máximo de mensajes (default 50)"),
  }),
  execute: async (args) => {
    try {
      const result = await readSharedChat(args.calendarId, args.limit);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        message: `${result.data?.length || 0} mensajes del chat.`,
        data: result.data,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 22. ELIMINAR MENSAJE DE CHAT GRUPAL (destructive)
// ═══════════════════════════════════════════════════════════════════════════
export const deleteSharedMessageTool: ToolDefinition = {
  id: "delete_shared_message",
  category: "calendar",
  description: "Elimina un mensaje propio del chat de un calendario compartido.",
  risk: "destructive",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    messageId: z.string().describe("ID del mensaje a eliminar"),
  }),
  execute: async (args) => {
    try {
      const result = await deleteSharedMessage(args.messageId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Mensaje eliminado del chat." };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 23. SALIR DE CALENDARIO GRUPAL (write)
// ═══════════════════════════════════════════════════════════════════════════
export const leaveSharedCalendarTool: ToolDefinition = {
  id: "leave_shared_calendar",
  category: "calendar",
  description: "Abandona un calendario compartido. El creador no puede salir (debe eliminarlo).",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario"),
  }),
  execute: async (args) => {
    try {
      const result = await leaveSharedCalendar(args.calendarId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Has salido del calendario compartido." };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 24. VER MIEMBROS DE CALENDARIO COMPARTIDO (read)
// ═══════════════════════════════════════════════════════════════════════════
export const viewSharedMembersTool: ToolDefinition = {
  id: "view_shared_members",
  category: "calendar",
  description: "Lista todos los miembros de un calendario compartido con su rol.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario"),
  }),
  execute: async (args) => {
    try {
      const result = await getSharedCalendarMembers(args.calendarId);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        message: `${result.data?.members?.length || 0} miembros en el calendario.`,
        data: result.data,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 25. NOTIFICAR PROGRESO DE HÁBITO AL GRUPO (write)
// ═══════════════════════════════════════════════════════════════════════════
export const notifyHabitProgressTool: ToolDefinition = {
  id: "notify_habit_progress",
  category: "calendar",
  description: "Comparte el progreso de hábitos con un calendario compartido para motivación colectiva.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: z.object({
    calendarId: z.string().describe("ID del calendario compartido"),
  }),
  execute: async (args) => {
    try {
      const result = await notifySharedHabitProgress(args.calendarId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: "Progreso de hábitos compartido con el grupo. 🔥" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 26. EXPORTAR CALENDARIO A ICS (read — future)
// ═══════════════════════════════════════════════════════════════════════════
export const exportCalendarIcsTool: ToolDefinition = {
  id: "export_calendar_ics",
  category: "calendar",
  description: "Genera un archivo .ics con todos los eventos del usuario (descargable).",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message:
        "Para exportar tu calendario, visita /api/calendar/export. Se descargará un archivo .ics compatible con Google Calendar, Apple Calendar y Outlook.",
      data: { downloadUrl: "/api/calendar/export" },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SKILL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
export const calendarSkill: Skill = {
  id: "calendar",
  name: "Calendario y Habit Tracker",
  category: "calendar",
  description:
    "Gestión completa de eventos personales, hábitos, calendarios compartidos, chat grupal y planificación semanal.",
  tools: [
    // Eventos personales (1-5)
    addCalendarEventTool,
    readCalendarTool,
    updateCalendarEventTool,
    deleteCalendarEventTool,
    searchCalendarEventsTool,
    // Planificación (6)
    suggestWeeklyPlanTool,
    // Hábitos (7-14)
    addHabitTool,
    readHabitsTool,
    completeHabitTool,
    uncompleteHabitTool,
    updateHabitTool,
    deleteHabitTool,
    archiveHabitTool,
    viewHabitStatsTool,
    // Calendarios compartidos (15-25)
    createSharedCalendarTool,
    addCalendarMemberTool,
    addSharedEventTool,
    readSharedEventsTool,
    deleteSharedEventTool,
    sendSharedMessageTool,
    readSharedChatTool,
    deleteSharedMessageTool,
    leaveSharedCalendarTool,
    viewSharedMembersTool,
    notifyHabitProgressTool,
    // Export (26)
    exportCalendarIcsTool,
  ],
};
