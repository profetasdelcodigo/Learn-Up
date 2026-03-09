"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon,
  Plus,
  X,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Trash2,
  Printer,
  Users,
  MessageCircle,
  Target,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import BackButton from "@/components/BackButton";
import SharedCalendarDetail from "@/components/SharedCalendarDetail";
import { createSharedCalendar } from "@/actions/shared-calendars";
import {
  StaggerContainer,
  FadeUpItem,
} from "@/components/animations/StaggerReveal";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  user_id: string;
  isShared?: boolean;
  group_name?: string;
  members_count?: number;
}

interface HabitActivity {
  id: string;
  name: string;
  days: Record<string, boolean>; // "Mon", "Tue", etc.
  isShared?: boolean;
  calendar_id?: string;
  group_name?: string;
}

const DAY_KEYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState<"personal" | "shared">("personal");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    day: new Date().getDate(),
  });

  // Event form
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start: "",
    end: "",
  });

  // Selected day events
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>(
    [],
  );

  // Habit Tracker
  const [currentHabitWeek, setCurrentHabitWeek] = useState(new Date());
  const [habits, setHabits] = useState<HabitActivity[]>([]);
  const [newHabitName, setNewHabitName] = useState("");
  const [habitLoading, setHabitLoading] = useState(false);
  const [sharedCalendars, setSharedCalendars] = useState<any[]>([]);
  const [selectedSharedCalendar, setSelectedSharedCalendar] = useState<
    any | null
  >(null);
  const [showCreateSharedModal, setShowCreateSharedModal] = useState(false);
  const [newSharedName, setNewSharedName] = useState("");
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        loadFriends(user.id);
      }
      await loadEvents();
      await loadHabits();
    };
    init();
  }, []);

  const loadFriends = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("friends_with_profiles")
        .select("friend_id, friend_name")
        .eq("user_id", userId);

      if (data && data.length > 0) {
        setFriends(
          data.map((f: any) => ({ id: f.friend_id, name: f.friend_name })),
        );
      } else {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .neq("id", userId);
        setFriends(
          pData?.map((p: any) => ({ id: p.id, name: p.full_name })) || [],
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentMonth]);

  const loadEvents = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: personalEvents } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_time");

      const { data: sCalendars } = await supabase
        .from("shared_calendars")
        .select("*")
        .contains("members", [user.id]);

      let formattedSharedEvents: any[] = [];
      if (sCalendars) {
        setSharedCalendars(sCalendars);
        const cIds = sCalendars.map((c: any) => c.id);
        if (cIds.length > 0) {
          const { data: sEvents } = await supabase
            .from("shared_calendar_events")
            .select("*")
            .in("calendar_id", cIds);
          if (sEvents) {
            formattedSharedEvents = sEvents.map((se: any) => {
              const cal = sCalendars.find((c: any) => c.id === se.calendar_id);
              return {
                id: se.id,
                title: se.title,
                description: se.description,
                start_time: se.start_time,
                end_time: se.end_time,
                user_id: se.created_by,
                isShared: true,
                group_name: cal ? cal.name : "Grupo",
                members_count: cal ? cal.members?.length || 0 : 0,
              };
            });
          }
        }
      }
      setEvents(
        [...(personalEvents || []), ...formattedSharedEvents].sort(
          (a: any, b: any) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        ),
      );
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShared = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSharedName.trim()) return;
    const res = await createSharedCalendar(newSharedName, selectedFriends);
    if (res.success) {
      setShowCreateSharedModal(false);
      setNewSharedName("");
      setSelectedFriends([]);
      loadEvents(); // Reload everything
    } else {
      alert("Error al crear calendario compartido.");
    }
  };

  // ── Habit Tracker ─────────────────────────────────────────────────────────────
  const getWeekStart = (date: Date) => {
    return format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
  };

  const loadHabits = async () => {
    try {
      let uid = currentUserId;
      if (!uid) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        uid = user.id;
      }

      const weekStart = getWeekStart(currentHabitWeek);

      // 1. Personal habits — from personal_habit_tracker (JSON-based, same as shared)
      const { data: personalData, error: personalError } = await supabase
        .from("personal_habit_tracker")
        .select("habits")
        .eq("user_id", uid)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (personalError)
        console.error("Error cargando habitos personales:", personalError);

      let formattedHabits: HabitActivity[] = [];
      if (personalData?.habits && Array.isArray(personalData.habits)) {
        formattedHabits = personalData.habits as HabitActivity[];
      }

      // 2. Shared habits
      const { data: sCalendars, error: scError } = await supabase
        .from("shared_calendars")
        .select("id, name")
        .contains("members", [uid]);

      if (scError)
        console.error("Error cargando shared calendars for habits:", scError);

      if (sCalendars && sCalendars.length > 0) {
        const cIds = sCalendars.map((c: any) => c.id);
        const { data: sharedHabitsData, error: shError } = await supabase
          .from("shared_habit_tracker")
          .select("calendar_id, habits")
          .in("calendar_id", cIds)
          .eq("week_start", weekStart);

        if (shError)
          console.error("Error cargando habitos compartidos:", shError);

        if (sharedHabitsData) {
          sharedHabitsData.forEach((row: any) => {
            const cal = sCalendars.find((c: any) => c.id === row.calendar_id);
            if (row.habits && Array.isArray(row.habits)) {
              row.habits.forEach((sh: HabitActivity) => {
                formattedHabits.push({
                  ...sh,
                  isShared: true,
                  calendar_id: row.calendar_id,
                  group_name: cal ? cal.name : "Grupo",
                });
              });
            }
          });
        }
      }

      setHabits(formattedHabits);
    } catch (err) {
      console.error("Critical error in loadHabits:", err);
    }
  };

  useEffect(() => {
    loadHabits();
  }, [currentHabitWeek, currentUserId]);

  // Guarda TODOS los hábitos personales de la semana actual de una vez (igual que shared)
  const savePersonalHabitsToDb = async (allPersonalHabits: HabitActivity[]) => {
    if (!currentUserId) return;
    const weekStart = getWeekStart(currentHabitWeek);
    const payload = allPersonalHabits.map((h) => ({
      id: h.id,
      name: h.name,
      days: h.days,
    }));
    const { error } = await supabase
      .from("personal_habit_tracker")
      .upsert(
        { user_id: currentUserId, week_start: weekStart, habits: payload },
        { onConflict: "user_id,week_start" },
      );
    if (error) console.error("Error saving personal habits:", error);
  };

  const saveHabitToDb = async (habit: HabitActivity) => {
    if (!currentUserId) return;
    const weekStart = getWeekStart(currentHabitWeek);

    if (habit.isShared && habit.calendar_id) {
      const calHabits = habits.filter(
        (h) => h.calendar_id === habit.calendar_id,
      );
      const updatedCalHabits = calHabits.map((h) =>
        h.id === habit.id ? habit : h,
      );
      const dbHabits = updatedCalHabits.map((h) => ({
        id: h.id,
        name: h.name,
        days: h.days,
      }));

      const { error } = await supabase.from("shared_habit_tracker").upsert(
        {
          calendar_id: habit.calendar_id,
          week_start: weekStart,
          habits: dbHabits,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "calendar_id,week_start" },
      );
      if (error) console.error("Error saving shared habit:", error);
    } else {
      // Personal — actualizar JSON completo via personal_habit_tracker
      const updated = habits
        .map((h) => (h.id === habit.id ? habit : h))
        .filter((h) => !h.isShared);
      await savePersonalHabitsToDb(updated);
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim()) return;
    const newHabit: HabitActivity = {
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      days: {},
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    setNewHabitName("");

    // Guardar todos los hábitos personales en personal_habit_tracker
    if (!currentUserId) return;
    const personalOnly = updated.filter((h) => !h.isShared);
    await savePersonalHabitsToDb(personalOnly);
  };

  const toggleHabitDay = async (habitId: string, dayKey: string) => {
    let habitToUpdate: HabitActivity | undefined;

    const updated = habits.map((h) => {
      if (h.id === habitId) {
        const toggledHabit = {
          ...h,
          days: { ...h.days, [dayKey]: !h.days[dayKey] },
        };
        habitToUpdate = toggledHabit;
        return toggledHabit;
      }
      return h;
    });

    setHabits(updated);
    if (habitToUpdate) {
      await saveHabitToDb(habitToUpdate);
    }
  };

  const deleteHabit = async (habitId: string) => {
    const habitToDel = habits.find((h) => h.id === habitId);
    if (!habitToDel) return;

    if (habitToDel.isShared) {
      alert(
        "No puedes eliminar un hábito grupal desde tu vista personal. Hazlo directamente desde el calendario compartido.",
      );
      return;
    }

    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);

    if (currentUserId) {
      // Guardar la lista actualizada en personal_habit_tracker (sin el hábito eliminado)
      const personalOnly = updated.filter((h) => !h.isShared);
      await savePersonalHabitsToDb(personalOnly);
    }
  };

  const clearHabits = async () => {
    if (
      !confirm(
        "¿Borrar todos los hábitos personales de esta semana? (Los hábitos grupales se mantendrán)",
      )
    )
      return;

    // Solo borramos los personales localmente
    const shared = habits.filter((h) => h.isShared);
    setHabits(shared);

    if (currentUserId) {
      // Guardamos una lista vacía para la semana en personal_habit_tracker
      await savePersonalHabitsToDb([]);
    }
  };

  const printHabits = () => {
    const weekStart = getWeekStart(currentHabitWeek);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = habits
      .map(
        (h) => `
      <tr>
        <td style="padding:8px;border:1px solid #ccc;font-weight:600">${h.name}</td>
        ${DAY_KEYS.map((d) => `<td style="padding:8px;border:1px solid #ccc;text-align:center">${h.days[d] ? "✓" : ""}</td>`).join("")}
      </tr>
    `,
      )
      .join("");
    printWindow.document.write(`
      <html><head><title>Habit Tracker – Semana del ${weekStart}</title></head>
      <body style="font-family:sans-serif;padding:24px">
        <h2>Habit Tracker — Semana del ${weekStart}</h2>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="padding:8px;border:1px solid #ccc;text-align:left">Actividad</th>
            ${DAY_KEYS.map((d) => `<th style="padding:8px;border:1px solid #ccc">${d}</th>`).join("")}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>
    `);
    printWindow.print();
  };

  const printCalendar = () => window.print();

  // ── Event creation ────────────────────────────────────────────────────────────
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.start || !formData.end) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("calendar_events").insert({
        title: formData.title,
        description: formData.description || null,
        start_time: formData.start,
        end_time: formData.end,
        user_id: user.id,
      });
      if (error) throw error;
      await loadEvents();
      setShowModal(false);
      setFormData({ title: "", description: "", start: "", end: "" });
    } catch (err) {
      console.error("Error creating event:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((event) => isSameDay(new Date(event.start_time), day));

  const handleDayClick = (day: Date) => {
    const dayEvts = getEventsForDay(day);
    if (dayEvts.length > 0) {
      setSelectedDay(day);
      setSelectedDayEvents(dayEvts);
      setShowDayModal(true);
    } else {
      setFormData({
        ...formData,
        start: format(day, "yyyy-MM-dd'T'12:00"),
        end: format(day, "yyyy-MM-dd'T'13:00"),
      });
      setShowModal(true);
    }
  };

  const applyDatePicker = () => {
    const newDate = new Date(pickerDate.year, pickerDate.month, pickerDate.day);
    setCurrentMonth(newDate);
    setSelectedDay(newDate);
    setShowDatePicker(false);
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="w-full min-h-screen bg-brand-black">
      <div className="w-full max-w-none">
        <StaggerContainer delayOffset={0.1}>
          <FadeUpItem>
            <BackButton className="mb-6" />

            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6 text-brand-gold" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-white">
                      Hora de Actuar
                    </h1>
                    <p className="text-gray-400 text-sm">
                      Organiza tu tiempo y planifica tus actividades
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUpItem>

          <FadeUpItem>
            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-gray-900 rounded-2xl mb-8 w-fit">
              <button
                onClick={() => setActiveTab("personal")}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === "personal" ? "bg-brand-gold text-brand-black shadow-lg" : "text-gray-400 hover:text-white"}`}
              >
                <CalendarIcon className="w-4 h-4 inline mr-2" />
                Calendario Personal
              </button>
              <button
                onClick={() => setActiveTab("shared")}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === "shared" ? "bg-brand-gold text-brand-black shadow-lg" : "text-gray-400 hover:text-white"}`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Calendarios Compartidos
              </button>
            </div>
          </FadeUpItem>

          {activeTab === "personal" && (
            <div className="space-y-8">
              {/* Calendar */}
              <FadeUpItem>
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() =>
                        setCurrentMonth(subMonths(currentMonth, 1))
                      }
                      className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                      <h2
                        onClick={() => {
                          setPickerDate({
                            year: currentMonth.getFullYear(),
                            month: currentMonth.getMonth(),
                            day: currentMonth.getDate(),
                          });
                          setShowDatePicker(true);
                        }}
                        className="text-2xl font-bold text-white capitalize cursor-pointer hover:text-brand-gold transition-colors"
                      >
                        {format(currentMonth, "MMMM yyyy", { locale: es })}
                      </h2>
                      <button
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-3 py-1 text-xs bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-full hover:bg-brand-gold hover:text-brand-black transition-all"
                      >
                        Hoy
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={printCalendar}
                        className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                        title="Imprimir calendario"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-brand-gold text-brand-black font-semibold rounded-full hover:bg-brand-gold/90 transition-all flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Nuevo Evento
                      </button>
                      <button
                        onClick={() =>
                          setCurrentMonth(addMonths(currentMonth, 1))
                        }
                        className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-bold text-brand-gold py-2 uppercase tracking-wide"
                        >
                          {day}
                        </div>
                      ),
                    )}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {daysInMonth.map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const isDayToday = isToday(day);
                      const isSelected =
                        selectedDay && isSameDay(selectedDay, day);
                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => handleDayClick(day)}
                          className={`aspect-square border rounded-xl p-1 transition-all cursor-pointer ${
                            isDayToday
                              ? "bg-brand-gold/20 border-brand-gold"
                              : isSelected
                                ? "bg-brand-gold/10 border-brand-gold/60"
                                : "bg-brand-black/40 border-gray-800 hover:border-brand-gold/40"
                          }`}
                        >
                          <div
                            className={`text-xs font-bold mb-1 ${isDayToday ? "text-brand-gold" : "text-gray-300"}`}
                          >
                            {format(day, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map((event: any) => (
                              <div
                                key={event.id}
                                className={`text-[9px] px-1 rounded truncate font-medium ${
                                  event.isShared
                                    ? "bg-blue-600/30 text-blue-400 border border-blue-500/20"
                                    : "bg-brand-gold text-brand-black"
                                }`}
                              >
                                {event.isShared && "👥 "}
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[9px] text-gray-500">
                                +{dayEvents.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </FadeUpItem>

              {/* ── Habit Tracker ──────────────────────────────────────────────── */}
              <FadeUpItem>
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-blue-glow/30 rounded-3xl p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-blue-glow/10 border border-brand-blue-glow/30 flex items-center justify-center">
                        <Target className="w-5 h-5 text-brand-blue-glow" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          Habit Tracker
                        </h2>
                        <p className="text-gray-400 text-sm">
                          Semana del{" "}
                          {format(startOfWeek(currentHabitWeek), "d MMM", {
                            locale: es,
                          })}{" "}
                          al{" "}
                          {format(endOfWeek(currentHabitWeek), "d MMM yyyy", {
                            locale: es,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentHabitWeek(subWeeks(currentHabitWeek, 1))
                        }
                        className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentHabitWeek(new Date())}
                        className="px-3 py-1 text-xs bg-brand-blue-glow/10 text-brand-blue-glow border border-brand-blue-glow/30 rounded-full hover:bg-brand-blue-glow hover:text-white transition-all"
                      >
                        Esta semana
                      </button>
                      <button
                        onClick={() =>
                          setCurrentHabitWeek(addWeeks(currentHabitWeek, 1))
                        }
                        className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={printHabits}
                        className="p-2 rounded-full border border-gray-700 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                        title="Imprimir Habit Tracker"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={clearHabits}
                        className="p-2 rounded-full border border-red-500/30 text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-all"
                        title="Borrar todos los hábitos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add habit */}
                  <div className="flex gap-2 mb-5">
                    <input
                      type="text"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addHabit()}
                      placeholder="Nueva actividad/hábito (Enter para agregar)"
                      className="flex-1 px-4 py-2.5 bg-black/40 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue-glow transition-colors text-sm"
                    />
                    <button
                      onClick={addHabit}
                      className="px-4 py-2.5 bg-brand-blue-glow text-white font-semibold rounded-xl hover:bg-brand-blue-glow transition-all flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" /> Agregar
                    </button>
                  </div>

                  {habits.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        Agrega actividades para hacer seguimiento esta semana
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-3 text-gray-400 text-xs font-bold uppercase tracking-wide w-1/3">
                              Actividad
                            </th>
                            {DAY_KEYS.map((d) => (
                              <th
                                key={d}
                                className="py-2 px-2 text-gray-400 text-xs font-bold uppercase tracking-wide text-center"
                              >
                                {d}
                              </th>
                            ))}
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="space-y-1">
                          {habits.map((habit) => {
                            const completed = DAY_KEYS.filter(
                              (d) => habit.days[d],
                            ).length;
                            return (
                              <tr
                                key={habit.id}
                                className="border-t border-gray-800/50 hover:bg-white/2 transition-colors"
                              >
                                <td className="py-3 px-3">
                                  <span className="text-white text-sm font-medium flex items-center gap-1.5">
                                    {habit.isShared && (
                                      <span
                                        title={`Grupo: ${habit.group_name}`}
                                      >
                                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      </span>
                                    )}
                                    {habit.name}
                                  </span>
                                  <span className="ml-[22px] text-xs text-gray-500">
                                    {completed}/{DAY_KEYS.length}
                                  </span>
                                </td>
                                {DAY_KEYS.map((dayKey) => (
                                  <td
                                    key={dayKey}
                                    className="py-3 px-2 text-center"
                                  >
                                    <button
                                      onClick={() =>
                                        toggleHabitDay(habit.id, dayKey)
                                      }
                                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-all ${
                                        habit.days[dayKey]
                                          ? "bg-brand-blue-glow border-brand-blue-glow text-white"
                                          : "border-gray-600 text-transparent hover:border-brand-blue-glow"
                                      }`}
                                    >
                                      {habit.days[dayKey] ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-gray-600" />
                                      )}
                                    </button>
                                  </td>
                                ))}
                                <td className="py-3 pr-2">
                                  <button
                                    onClick={() => deleteHabit(habit.id)}
                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </FadeUpItem>
            </div>
          )}

          {activeTab === "shared" && (
            <div className="space-y-6">
              <FadeUpItem>
                {selectedSharedCalendar ? (
                  <SharedCalendarDetail
                    calendar={selectedSharedCalendar}
                    currentUserId={currentUserId!}
                    onBack={() => {
                      setSelectedSharedCalendar(null);
                      loadEvents();
                    }}
                  />
                ) : (
                  <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          Tus Calendarios Compartidos
                        </h2>
                        <p className="text-gray-400">
                          Gestiona eventos, hábitos y comunícate.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCreateSharedModal(true)}
                        className="px-6 py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" /> Nuevo Grupo
                      </button>
                    </div>
                    {sharedCalendars.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-300">
                          Sin calendarios grupales
                        </h3>
                        <p className="text-gray-500">
                          Crea un calendario para empezar a compartir eventos.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sharedCalendars.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedSharedCalendar(c)}
                            className="bg-black/40 border border-gray-800 p-6 rounded-2xl hover:border-brand-gold/50 cursor-pointer transition-all flex items-start gap-4"
                          >
                            <div className="p-3 bg-brand-gold/10 rounded-full min-w-[48px] flex justify-center">
                              <Users className="w-6 h-6 text-brand-gold" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg">
                                {c.name}
                              </h3>
                              <p className="text-sm text-gray-400">
                                {c.members.length} Miembros
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </FadeUpItem>
            </div>
          )}
        </StaggerContainer>

        {/* Date Picker Modal */}
        <AnimatePresence>
          {showDatePicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDatePicker(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-brand-gold rounded-2xl p-6 max-w-sm w-full"
              >
                <h3 className="text-lg font-bold text-white mb-4">
                  Ir a fecha
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Año
                    </label>
                    <input
                      type="number"
                      value={pickerDate.year}
                      onChange={(e) =>
                        setPickerDate({ ...pickerDate, year: +e.target.value })
                      }
                      className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Mes (1-12)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={pickerDate.month + 1}
                      onChange={(e) =>
                        setPickerDate({
                          ...pickerDate,
                          month: +e.target.value - 1,
                        })
                      }
                      className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Día
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={pickerDate.day}
                      onChange={(e) =>
                        setPickerDate({ ...pickerDate, day: +e.target.value })
                      }
                      className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-gold"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPickerDate({
                        year: new Date().getFullYear(),
                        month: new Date().getMonth(),
                        day: new Date().getDate(),
                      });
                      applyDatePicker();
                    }}
                    className="flex-1 py-2 border border-gray-700 rounded-xl text-gray-300 text-sm hover:bg-white/5 transition-colors"
                  >
                    Volver a hoy
                  </button>
                  <button
                    onClick={applyDatePicker}
                    className="flex-1 py-2 bg-brand-gold text-brand-black font-bold rounded-xl text-sm hover:bg-white transition-colors"
                  >
                    Ir a fecha
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Event Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Crear Evento</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-brand-gold"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Inicio
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.start}
                        onChange={(e) =>
                          setFormData({ ...formData, start: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Fin
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.end}
                        onChange={(e) =>
                          setFormData({ ...formData, end: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-brand-gold outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-xl mt-4 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Creando...
                      </>
                    ) : (
                      "Guardar Evento"
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Day Detail Modal */}
        <AnimatePresence>
          {showDayModal && selectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDayModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-brand-gold/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[80vh] flex flex-col"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {format(selectedDay, "d 'de' MMMM, yyyy", { locale: es })}
                    </h2>
                    <p className="text-brand-gold font-medium mt-1">
                      {selectedDayEvents.length}{" "}
                      {selectedDayEvents.length === 1
                        ? "evento programado"
                        : "eventos programados"}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors self-start"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto pr-2 space-y-4 flex-1 custom-scrollbar">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`${ev.isShared ? "bg-blue-900/10 border-blue-500/20" : "bg-brand-black border-gray-800"} border p-5 rounded-2xl flex flex-col`}
                    >
                      <div className="flex justify-between items-start mb-3 gap-4">
                        <h3 className="font-bold text-lg text-white leading-tight">
                          {ev.title}
                        </h3>
                        {ev.isShared && (
                          <span className="text-[10px] px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                            <Users className="w-3 h-3 shrink-0" />
                            {ev.group_name} ({ev.members_count})
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      <div className="flex items-center text-sm font-semibold text-brand-black gap-2 mt-auto">
                        <div
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${ev.isShared ? "bg-blue-400 text-blue-950" : "bg-brand-gold"}`}
                        >
                          <Clock className="w-4 h-4" />
                          {new Date(ev.start_time).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" - "}
                          {new Date(ev.end_time).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showCreateSharedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateSharedModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Nuevo Calendario
                </h2>
                <button
                  onClick={() => setShowCreateSharedModal(false)}
                  className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateShared} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre del Grupo/Calendario *
                  </label>
                  <input
                    type="text"
                    value={newSharedName}
                    onChange={(e) => setNewSharedName(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold"
                    placeholder="Ej: Grupo de Estudio"
                    required
                  />
                </div>

                {friends.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 mt-4">
                      Seleccionar Miembros (Opcional)
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-800 rounded-xl p-3 bg-black/40 custom-scrollbar">
                      {friends.map((f) => (
                        <label
                          key={f.id}
                          className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(f.id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedFriends([...selectedFriends, f.id]);
                              else
                                setSelectedFriends(
                                  selectedFriends.filter((id) => id !== f.id),
                                );
                            }}
                            className="w-4 h-4 rounded border-gray-700 text-brand-gold focus:ring-brand-gold focus:ring-offset-0 bg-transparent accent-brand-gold"
                          />
                          <span className="text-sm text-gray-300 font-medium">
                            {f.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all"
                >
                  Crear Calendario
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
