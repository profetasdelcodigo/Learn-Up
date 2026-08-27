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

// -- HABITS CRUD (Nuevas Tablas) --

export async function readHabitTracker(weekStart?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Fetch all active habits
  const { data: habits, error: hError } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at");

  if (hError) throw hError;

  const targetWeek = weekStart ? new Date(weekStart) : new Date();
  // Get completions for the last 30 days to calculate stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: completions, error: cError } = await supabase
    .from("habit_completions")
    .select("habit_id, completed_date")
    .eq("user_id", user.id)
    .gte("completed_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (cError) throw cError;

  // Transform to the expected UI format (for retrocompatibility with the current UI)
  // The UI expects an array of HabitActivity: { id, name, days: { "Lun": true, ... } }
  const d = new Date(targetWeek);
  d.setDate(d.getDate() - d.getDay()); // Go to Sunday of target week
  
  const formattedHabits: HabitActivity[] = habits.map((h: any) => {
    const days: Record<string, boolean> = {};
    // Calculate completions for the specific week
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(d);
      currentDay.setDate(d.getDate() + i);
      const dateStr = currentDay.toISOString().split("T")[0];
      
      const isCompleted = completions.some((c: any) => c.habit_id === h.id && c.completed_date === dateStr);
      days[DAY_KEYS[i]] = isCompleted;
    }
    
    // Add simple stats
    const totalCompletions = completions.filter((c: any) => c.habit_id === h.id).length;
    
    return {
      id: h.id,
      name: h.name,
      frequency: h.frequency,
      target_time: h.target_time,
      stats: { totalCompletions30d: totalCompletions },
      days
    };
  });

  return formattedHabits;
}

export async function addHabitToTracker(title: string, frequency: string = 'daily', targetTime?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: title,
      frequency: frequency,
      target_time: targetTime || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHabit(habitId: string, updates: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", habitId)
    .eq("user_id", user.id);

  if (error) throw error;
  return true;
}

export async function completeHabitInTracker(habitId: string, dateIsoString: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const dateOnly = dateIsoString.split("T")[0];

  const { error } = await supabase
    .from("habit_completions")
    .upsert({
      habit_id: habitId,
      user_id: user.id,
      completed_date: dateOnly
    }, { onConflict: "habit_id, completed_date" });

  if (error) throw error;
  return true;
}

export async function undoHabitInTracker(habitId: string, dateIsoString: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const dateOnly = dateIsoString.split("T")[0];

  const { error } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", user.id)
    .eq("completed_date", dateOnly);

  if (error) throw error;
  return true;
}

export async function deleteHabitFromTracker(habitId: string, archive: boolean = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (archive) {
    const { error } = await supabase
      .from("habits")
      .update({ archived: true })
      .eq("id", habitId)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitId)
      .eq("user_id", user.id);
    if (error) throw error;
  }
  return true;
}

export async function searchCalendarEvents(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, title, description, start_time, end_time")
    .eq("user_id", user.id)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order("start_time");

  if (error) throw error;
  return data || [];
}
