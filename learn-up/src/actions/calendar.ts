"use server";

import { createClient } from "@/utils/supabase/server";

export interface HabitActivity {
  id: string;
  name: string;
  days: Record<string, boolean>;
  isShared?: boolean;
  calendar_id?: string;
  group_name?: string;
  frequency?: string;
  target_time?: string | null;
  stats?: {
    currentStreak: number;
    longestStreak: number;
    totalCompletions30d: number;
    completionRate30d: number;
  };
}

const DAY_KEYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const REMINDER_MINUTES = new Set([10, 30, 60, 1440, 10080]);

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${value}`);
  return date;
}

function validateFutureRange(start: Date, end: Date) {
  const now = new Date();
  if (start <= now) throw new Error("El evento debe comenzar en una fecha y hora futuras.");
  if (end <= start) throw new Error("La hora de fin debe ser posterior a la hora de inicio.");
}

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, user };
}

export async function readCalendarEvents(startDate: string, endDate: string) {
  const { supabase, user } = await currentUser();
  const from = parseDateOnly(startDate);
  const toExclusive = parseDateOnly(endDate);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id,title,description,start_time,end_time,recurrence_rule,recurrence_end,reminder_minutes,color,created_at")
    .eq("user_id", user.id)
    .lt("start_time", toExclusive.toISOString())
    .gt("end_time", from.toISOString())
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addCalendarEvent(input: {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  reminderMinutes?: number | null;
}) {
  const { supabase, user } = await currentUser();
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  validateFutureRange(start, end);
  if (input.reminderMinutes != null && !REMINDER_MINUTES.has(input.reminderMinutes)) {
    throw new Error("Recordatorio inválido. Usa 10, 30, 60, 1440 o 10080 minutos.");
  }

  const { data: conflicts, error: conflictError } = await supabase
    .from("calendar_events")
    .select("id,title,start_time,end_time")
    .eq("user_id", user.id)
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .order("start_time");
  if (conflictError) throw conflictError;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      recurrence_rule: input.recurrenceRule || null,
      recurrence_end: input.recurrenceEnd || null,
      reminder_minutes: input.reminderMinutes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  return { event: data, conflicts: conflicts || [] };
}

export async function updateCalendarEvent(eventId: string, updates: Record<string, any>) {
  const { supabase, user } = await currentUser();
  const { data: existing, error: existingError } = await supabase
    .from("calendar_events")
    .select("id,title,description,start_time,end_time,recurrence_rule,recurrence_end,reminder_minutes")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .single();
  if (existingError) throw existingError;

  const start = new Date(updates.start_time || existing.start_time);
  const end = new Date(updates.end_time || existing.end_time);
  validateFutureRange(start, end);

  if (updates.reminder_minutes != null && !REMINDER_MINUTES.has(updates.reminder_minutes)) {
    throw new Error("Recordatorio inválido. Usa 10, 30, 60, 1440 o 10080 minutos.");
  }

  const { data: conflicts, error: conflictError } = await supabase
    .from("calendar_events")
    .select("id,title,start_time,end_time")
    .eq("user_id", user.id)
    .neq("id", eventId)
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());
  if (conflictError) throw conflictError;

  const next = {
    ...updates,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
  const { data, error } = await supabase
    .from("calendar_events")
    .update(next)
    .eq("id", eventId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;

  return { event: data, conflicts: conflicts || [] };
}

export async function deleteCalendarEvent(eventId: string) {
  const { supabase, user } = await currentUser();
  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function searchCalendarEvents(query: string) {
  const { supabase, user } = await currentUser();
  const safe = query.trim();
  if (!safe) return [];
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id,title,description,start_time,end_time,recurrence_rule,recurrence_end,reminder_minutes")
    .eq("user_id", user.id)
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data || [];
}

function calculateStreak(dates: Set<string>) {
  const sorted = [...dates].sort();
  if (!sorted.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = parseDateOnly(sorted[i - 1]);
    const current = parseDateOnly(sorted[i]);
    const diff = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (diff === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }

  const today = new Date();
  const todayKey = toDateOnly(today);
  let current = dates.has(todayKey) ? 1 : 0;
  const cursor = parseDateOnly(todayKey);
  cursor.setDate(cursor.getDate() - 1);
  while (dates.has(toDateOnly(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}

export async function readHabitTracker(weekStart?: string) {
  const { supabase, user } = await currentUser();
  const { data: habits, error: hError } = await supabase
    .from("habits")
    .select("id,title,frequency,target_time,start_date,is_active,created_at,streak")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at");
  if (hError) throw hError;

  const targetWeek = weekStart ? parseDateOnly(weekStart) : new Date();
  targetWeek.setDate(targetWeek.getDate() - targetWeek.getDay());
  const from = new Date(targetWeek);
  from.setDate(from.getDate() - 30);
  const { data: completions, error: cError } = await supabase
    .from("habit_completions")
    .select("habit_id,completed_date")
    .eq("user_id", user.id)
    .gte("completed_date", toDateOnly(from))
    .order("completed_date");
  if (cError) throw cError;

  return (habits || []).map((habit: any): HabitActivity => {
    const dates = new Set(
      (completions || [])
        .filter((row: any) => row.habit_id === habit.id)
        .map((row: any) => String(row.completed_date)),
    );
    const days: Record<string, boolean> = {};
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(targetWeek);
      day.setDate(day.getDate() + i);
      days[DAY_KEYS[i]] = dates.has(toDateOnly(day));
    }
    const streak = calculateStreak(dates);
    const total = dates.size;
    return {
      id: habit.id,
      name: habit.title,
      frequency: habit.frequency,
      target_time: habit.target_time,
      days,
      stats: {
        currentStreak: streak.current,
        longestStreak: streak.longest,
        totalCompletions30d: total,
        completionRate30d: Math.round((total / 30) * 100),
      },
    };
  });
}

export async function addHabitToTracker(title: string, frequency: string = "daily", targetTime?: string, startDate?: string) {
  const { supabase, user } = await currentUser();
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      title,
      frequency,
      target_time: targetTime || null,
      start_date: startDate || toDateOnly(new Date()),
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHabit(habitId: string, updates: Record<string, any>) {
  const { supabase, user } = await currentUser();
  const { data, error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", habitId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeHabitInTracker(habitId: string, dateIsoString: string = new Date().toISOString()) {
  const { supabase, user } = await currentUser();
  const dateOnly = dateIsoString.split("T")[0];
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id,is_active")
    .eq("id", habitId)
    .eq("user_id", user.id)
    .single();
  if (habitError) throw habitError;
  if (!habit.is_active) throw new Error("El hábito está archivado o inactivo.");

  const { error } = await supabase
    .from("habit_completions")
    .upsert({ habit_id: habitId, user_id: user.id, completed_date: dateOnly }, { onConflict: "habit_id,completed_date" });
  if (error) throw error;

  const stats = await readHabitTracker();
  const current = stats.find((item) => item.id === habitId)?.stats?.currentStreak || 0;
  await supabase.from("habits").update({ streak: current, updated_at: new Date().toISOString() }).eq("id", habitId).eq("user_id", user.id);
  return { date: dateOnly, streak: current };
}

export async function undoHabitInTracker(habitId: string, dateIsoString: string = new Date().toISOString()) {
  const { supabase, user } = await currentUser();
  const dateOnly = dateIsoString.split("T")[0];
  const { error } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .eq("completed_date", dateOnly);
  if (error) throw error;

  const stats = await readHabitTracker();
  const current = stats.find((item) => item.id === habitId)?.stats?.currentStreak || 0;
  await supabase.from("habits").update({ streak: current, updated_at: new Date().toISOString() }).eq("id", habitId).eq("user_id", user.id);
  return { date: dateOnly, streak: current };
}

export async function deleteHabitFromTracker(habitId: string, archive: boolean = false) {
  const { supabase, user } = await currentUser();
  if (archive) {
    const { data, error } = await supabase
      .from("habits")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", habitId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getHabitStats(habitId?: string) {
  const { supabase, user } = await currentUser();
  let query = supabase.from("habit_completions").select("habit_id,completed_date").eq("user_id", user.id);
  if (habitId) query = query.eq("habit_id", habitId);
  const { data: completions, error } = await query.order("completed_date");
  if (error) throw error;

  const grouped = new Map<string, Set<string>>();
  for (const row of completions || []) {
    if (!grouped.has(row.habit_id)) grouped.set(row.habit_id, new Set());
    grouped.get(row.habit_id)!.add(String(row.completed_date));
  }
  const results = [...grouped.entries()].map(([id, dates]) => {
    const streak = calculateStreak(dates);
    const last30 = [...dates].filter((date) => {
      const d = parseDateOnly(date);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff;
    });
    return {
      habitId: id,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      completedLast30Days: last30.length,
      completionRate30d: Math.round((last30.length / 30) * 100),
      weeklyConsistency: Array.from({ length: 5 }, (_, index) => {
        const end = new Date(); end.setDate(end.getDate() - index * 7);
        const start = new Date(end); start.setDate(start.getDate() - 6);
        return last30.filter((value) => { const d = parseDateOnly(value); return d >= start && d <= end; }).length;
      }).reverse(),
    };
  });
  return results;
}

export async function suggestWeeklyPlanData() {
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - start.getDay());
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (date: Date) => toDateOnly(date);
  const [events, habits] = await Promise.all([
    readCalendarEvents(fmt(start), fmt(end)),
    readHabitTracker(fmt(start)),
  ]);
  return { events, habits };
}
