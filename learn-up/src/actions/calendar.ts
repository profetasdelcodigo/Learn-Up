"use server";

import { createClient } from "@/utils/supabase/server";

export interface HabitActivity {
  id: string;
  name: string;
  days: Record<string, boolean>; // "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"
  isShared?: boolean;
  calendar_id?: string;
  group_name?: string;
}

const DAY_KEYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getWeekStartString(date: Date = new Date()): string {
  // Return YYYY-MM-DD for the most recent Sunday (weekStartsOn: 0)
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // go back to Sunday
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function readCalendarEvents(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Query personal events
  const { data: personalEvents, error: personalError } = await supabase
    .from("calendar_events")
    .select("id, title, description, start_time, end_time")
    .eq("user_id", user.id)
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time");
    
  if (personalError) throw personalError;

  return personalEvents || [];
}

export async function updateCalendarEvent(eventId: string, data: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("calendar_events")
    .update(data)
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

export async function deleteCalendarEvent(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

// -- HABITS CRUD --

export async function readHabitTracker(weekStart?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const targetWeek = weekStart || getWeekStartString();

  const { data: personalData, error } = await supabase
    .from("personal_habit_tracker")
    .select("habits")
    .eq("user_id", user.id)
    .eq("week_start", targetWeek)
    .maybeSingle();
    
  if (error) throw error;

  return (personalData?.habits as HabitActivity[]) || [];
}

export async function addHabitToTracker(title: string, weekStart?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const targetWeek = weekStart || getWeekStartString();
  const currentHabits = await readHabitTracker(targetWeek);

  const newHabit: HabitActivity = {
    id: `habit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: title,
    days: {},
  };

  const updatedHabits = [...currentHabits, newHabit];

  const { error } = await supabase
    .from("personal_habit_tracker")
    .upsert(
      {
        user_id: user.id,
        week_start: targetWeek,
        habits: updatedHabits,
      },
      { onConflict: "user_id, week_start" }
    );

  if (error) throw error;
  return newHabit;
}

export async function completeHabitInTracker(habitId: string, dateIsoString: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const d = new Date(dateIsoString);
  const dayKey = DAY_KEYS[d.getDay()]; // "Dom", "Lun", ...
  const targetWeek = getWeekStartString(d);

  const currentHabits = await readHabitTracker(targetWeek);
  const habitIndex = currentHabits.findIndex(h => h.id === habitId || h.name.toLowerCase() === habitId.toLowerCase());
  
  if (habitIndex === -1) {
    throw new Error(`Hábito no encontrado en la semana de ${targetWeek}`);
  }

  currentHabits[habitIndex].days[dayKey] = true;

  const { error } = await supabase
    .from("personal_habit_tracker")
    .upsert(
      {
        user_id: user.id,
        week_start: targetWeek,
        habits: currentHabits,
      },
      { onConflict: "user_id, week_start" }
    );

  if (error) throw error;
  return true;
}

export async function undoHabitInTracker(habitId: string, dateIsoString: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const d = new Date(dateIsoString);
  const dayKey = DAY_KEYS[d.getDay()]; 
  const targetWeek = getWeekStartString(d);

  const currentHabits = await readHabitTracker(targetWeek);
  const habitIndex = currentHabits.findIndex(h => h.id === habitId || h.name.toLowerCase() === habitId.toLowerCase());
  
  if (habitIndex === -1) return false;

  currentHabits[habitIndex].days[dayKey] = false;

  const { error } = await supabase
    .from("personal_habit_tracker")
    .upsert(
      {
        user_id: user.id,
        week_start: targetWeek,
        habits: currentHabits,
      },
      { onConflict: "user_id, week_start" }
    );

  if (error) throw error;
  return true;
}

export async function deleteHabitFromTracker(habitId: string, weekStart?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const targetWeek = weekStart || getWeekStartString();
  const currentHabits = await readHabitTracker(targetWeek);
  
  const updatedHabits = currentHabits.filter(h => h.id !== habitId && h.name.toLowerCase() !== habitId.toLowerCase());

  const { error } = await supabase
    .from("personal_habit_tracker")
    .upsert(
      {
        user_id: user.id,
        week_start: targetWeek,
        habits: updatedHabits,
      },
      { onConflict: "user_id, week_start" }
    );

  if (error) throw error;
  return true;
}
