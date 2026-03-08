"use server";

import { createClient } from "@/utils/supabase/server";

export async function createSharedCalendar(name: string, members: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Usuario no autenticado." };
  }

  // Ensure creator is in the members list uniquely
  const uniqueMembers = Array.from(new Set([...members, user.id]));

  try {
    const { data, error } = await supabase
      .from("shared_calendars")
      .insert({
        name,
        created_by: user.id,
        members: uniqueMembers,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Error creating shared calendar:", err);
    return { success: false, error: err.message };
  }
}

export async function addSharedEvent(
  calendarId: string,
  title: string,
  description: string,
  start: string,
  end: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  try {
    const { data, error } = await supabase
      .from("shared_calendar_events")
      .insert({
        calendar_id: calendarId,
        title,
        start_time: start,
        end_time: end,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Send a system message to the chat
    await supabase.from("shared_calendar_messages").insert({
      calendar_id: calendarId,
      user_id: user.id,
      content: `agregó el evento "${title}" para el ${new Date(start).toLocaleDateString("es-ES")}`,
      type: "system",
    });

    return { success: true, data };
  } catch (err: any) {
    console.error("Error adding shared event:", err);
    return { success: false, error: err.message };
  }
}

export async function sendSharedMessage(
  calendarId: string,
  content: string,
  type: "text" | "audio" | "system",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  try {
    const { data, error } = await supabase
      .from("shared_calendar_messages")
      .insert({
        calendar_id: calendarId,
        user_id: user.id,
        content,
        type,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Error sending shared message:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteSharedEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  try {
    const { error } = await supabase
      .from("shared_calendar_events")
      .delete()
      .eq("id", eventId)
      // Extra safety: only the creator of the event or the creator of the calendar could delete it,
      // but let's just use normal delete for now based on UI rules (RLS handles it ideally).
      .eq("created_by", user.id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting shared event:", err);
    return { success: false, error: err.message };
  }
}
