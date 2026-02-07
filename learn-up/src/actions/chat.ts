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

  // Check if a private room already exists between these two users
  const { data: existingRooms } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("type", "private")
    .contains("participants", [user.id, friendId]);

  if (existingRooms && existingRooms.length > 0) {
    return existingRooms[0].id;
  }

  // Create new room
  const { data: newRoom, error } = await supabase
    .from("chat_rooms")
    .insert({
      type: "private",
      participants: [user.id, friendId],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return newRoom.id;
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

export async function updateMessage(messageId: string, newContent: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("chat_messages")
    .update({
      content: newContent,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("user_id", user.id); // Only allow editing own messages

  if (error) throw error;
}

export async function deleteMessage(
  messageId: string,
  forEveryone: boolean = false,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (forEveryone) {
    // Delete for everyone - set flag
    const { error } = await supabase
      .from("chat_messages")
      .update({
        is_deleted_for_everyone: true,
        content: "Este mensaje fue eliminado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("user_id", user.id); // Only message owner can delete for everyone

    if (error) throw error;
  } else {
    // Delete for me - add to deleted_for array
    const { data: message } = await supabase
      .from("chat_messages")
      .select("deleted_for")
      .eq("id", messageId)
      .single();

    const deletedFor = message?.deleted_for || [];
    if (!deletedFor.includes(user.id)) {
      deletedFor.push(user.id);
    }

    const { error } = await supabase
      .from("chat_messages")
      .update({ deleted_for: deletedFor })
      .eq("id", messageId);

    if (error) throw error;
  }
}

export async function uploadChatMedia(file: File, roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const fileExt = file.name.split(".").pop();
  const fileName = `${roomId}/${user.id}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("chat-media")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-media").getPublicUrl(fileName);

  return publicUrl;
}
