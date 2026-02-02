"use server";

import { createClient } from "@/utils/supabase/server";

export interface ChatRoom {
  id: string;
  type: "private" | "group";
  name?: string;
  participants: string[];
  last_message?: string;
  updated_at: string; // ISO string
}

export async function getUserRooms() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch rooms where participants (JSONB array) contains user.id
  // This requires a specific query syntax for JSONB containment
  // Supabase/Postgrest syntax: participants.cs.['userid']?
  // Or text search.
  // Let's use the policy-filtered select if RLS is set up properly.
  // "Users can view rooms they are in" policy exists.
  // So a simple select should work IF they are participants.
  // However, we stored participants as JSONB array.
  // We need to filter manually or rely on RLS.
  // RLS logic: `auth.uid()::text = ANY(select jsonb_array_elements_text(participants))`
  // So:
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
  return data as ChatRoom[];
}

export async function ensurePrivateRoom(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Deterministic ID for 1v1
  const sortedIds = [user.id, friendId].sort();
  const roomId = `${sortedIds[0]}_${sortedIds[1]}`;

  // Check if exists
  const { data } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!data) {
    // Create it
    const { error } = await supabase.from("chat_rooms").insert({
      id: roomId,
      type: "private",
      participants: [user.id, friendId],
    });
    if (error) throw error;
  }

  return roomId;
}

export async function createGroup(name: string, participantIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const allParticipants = Array.from(new Set([user.id, ...participantIds]));
  const roomId = crypto.randomUUID();

  const { error } = await supabase.from("chat_rooms").insert({
    id: roomId,
    type: "group",
    name,
    participants: allParticipants,
  });

  if (error) throw error;
  return roomId;
}
