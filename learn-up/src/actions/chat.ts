"use server";

import { createClient } from "@/utils/supabase/server";

// ─── SAFETY HELPER ───────────────────────────────────────────────────────────
// Supabase can return JSONB arrays as strings in some edge cases.
// This helper always returns a clean string[].
function safeParseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed.filter((v) => typeof v === "string");
    } catch {}
  }
  return [];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  type: "private" | "group";
  name?: string;
  participants: string[];
  participants_profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    role?: string;
    username?: string;
  }[];
  last_message?: string;
  updated_at: string; // ISO string
  avatar_url?: string | null;
  description?: string | null;
  admins?: string[];
}

export interface Message {
  id: string;
  content: string;
  user_id: string; // CORRECT: user_id
  room_id: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  is_deleted_for_everyone?: boolean;
  deleted_for?: string[];
  profiles?: {
    full_name: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    role?: string;
  };
}

export async function getUserRooms() {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch rooms where participants (JSONB array) contains user.id
    const { data: rooms, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .contains("participants", [user.id])
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(
        "[getUserRooms] Error fetching rooms:",
        JSON.stringify(error),
      );
      return [];
    }

    if (!rooms || rooms.length === 0) return [];

    // Normalise participants for every room — safeParseArray handles null/string/array
    const normalizedRooms = rooms.map((room) => ({
      ...room,
      participants: safeParseArray(room.participants),
    }));

    // Collect all unique participant IDs across all rooms
    const allParticipantIds = Array.from(
      new Set(normalizedRooms.flatMap((r) => r.participants)),
    ).filter(isValidUUID); // extra safety — only real UUIDs

    // Fetch profiles for all participants to ensure Header has info even if not friends
    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, school, grade, role, username")
      .in(
        "id",
        allParticipantIds.length > 0
          ? allParticipantIds
          : ["00000000-0000-0000-0000-000000000000"],
      );

    if (profError) {
      console.error(
        "[getUserRooms] Error fetching profiles:",
        JSON.stringify(profError),
      );
    }

    // Attach profiles to rooms (safe with fallback empty array)
    const roomsWithProfiles = normalizedRooms.map((room) => ({
      ...room,
      participants_profiles: (profiles || []).filter((p) =>
        room.participants.includes(p.id),
      ),
    }));

    return roomsWithProfiles as (ChatRoom & { participants_profiles: any[] })[];
  } catch (err) {
    console.error("[getUserRooms] Unexpected error:", err);
    return [];
  }
}

export async function ensurePrivateRoom(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Validate friendId is a UUID
  if (!isValidUUID(friendId)) {
    throw new Error(
      `Invalid friendId - not a UUID: "${friendId}". Check caller.`,
    );
  }

  // Step 1: Find rooms where current user is a participant
  const { data: myRooms, error: fetchError } = await supabase
    .from("chat_rooms")
    .select("id, participants, type")
    .eq("type", "private")
    .contains("participants", [user.id]);

  if (fetchError) {
    console.error("[ensurePrivateRoom] Error fetching rooms:", fetchError);
    throw fetchError;
  }

  // Step 2: In JS, find one where friendId is also a participant (exact 2-person room)
  const exactMatch = (myRooms || []).find((r) => {
    const parts = safeParseArray(r.participants);
    return parts.length === 2 && parts.includes(friendId);
  });

  if (exactMatch) {
    return exactMatch.id;
  }

  // Step 3: Create new private room with strictly validated array
  const participants: string[] = [user.id, friendId]; // both already UUID-validated
  const { data: newRoom, error: createError } = await supabase
    .from("chat_rooms")
    .insert({
      type: "private",
      participants,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError) {
    console.error(
      "[ensurePrivateRoom] Error creating room:",
      JSON.stringify(createError),
      "| participants attempted:",
      JSON.stringify(participants),
    );
    throw createError;
  }

  return newRoom.id;
}

export async function createGroup(
  name: string,
  participantIds: string[],
  avatar_url?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Validate participants are UUIDs — filter out ANY non-UUID value to prevent 22P02
  const rawIds: unknown[] = [user.id, ...participantIds];
  const validParticipants = Array.from(new Set(rawIds)).filter(
    isValidUUID,
  ) as string[];

  if (validParticipants.length < 2) {
    throw new Error(
      `Invalid participants: need at least 2 valid UUIDs, got ${validParticipants.length}`,
    );
  }

  const { data, error } = await supabase
    .from("chat_rooms")
    .insert({
      type: "group",
      name,
      participants: validParticipants,
      admins: [user.id],
      avatar_url: avatar_url || null, // Add avatar_url
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateGroup(
  roomId: string,
  name: string,
  avatar_url?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify admin status (optional but recommended)
  const { data: room } = await supabase
    .from("chat_rooms")
    .select("admins")
    .eq("id", roomId)
    .single();

  if (!room?.admins?.includes(user.id)) {
    throw new Error("Only admins can update group info");
  }

  const updates: any = {
    name,
    updated_at: new Date().toISOString(),
  };
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { error } = await supabase
    .from("chat_rooms")
    .update(updates)
    .eq("id", roomId);

  if (error) throw error;
}

export async function getChatMessages(roomId: string) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(
        `
      *,
      profiles:user_id (full_name, avatar_url, role, school, grade)
    `,
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[getChatMessages] Error:", JSON.stringify(error));
      return [];
    }
    return (data || []) as Message[];
  } catch (err) {
    console.error("[getChatMessages] Unexpected error:", err);
    return [];
  }
}

export async function sendMessage(
  roomId: string,
  content: string,
  id?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const messageData: any = {
    room_id: roomId,
    user_id: user.id,
    content,
  };
  if (id) messageData.id = id;

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(messageData)
    .select()
    .single();

  if (error) throw error;

  // Update room updated_at and last_message (both columns confirmed in schema)
  const now = new Date().toISOString();
  const { error: roomUpdateError } = await supabase
    .from("chat_rooms")
    .update({
      updated_at: now,
      last_message_at: now,
      last_message: content.substring(0, 100),
    })
    .eq("id", roomId);

  if (roomUpdateError) {
    console.error(
      "[sendMessage] Room update error:",
      JSON.stringify(roomUpdateError),
    );
    // Non-fatal: message was sent, just log the error
  }

  // Send Notifications (Fire and Forget but with error logging)
  (async () => {
    try {
      // 1. Get room participants
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("participants, type, name")
        .eq("id", roomId)
        .single();

      if (room && room.participants) {
        const recipients = room.participants.filter(
          (id: string) => id !== user.id,
        );

        // Explicitly insert for each recipient as requested
        for (const recipientId of recipients) {
          await supabase.from("notifications").insert({
            user_id: recipientId, // Para quién
            sender_id: user.id, // De quién
            title:
              room.type === "group"
                ? `Nuevo Mensaje en ${room.name}`
                : "Nuevo Mensaje",
            message: content.substring(0, 50),
            type: "message",
            link: `/chat`,
            is_read: false, // Ensure default
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error("Error sending notifications logic:", e);
    }
  })();

  return data;
}

export async function markMessagesAsRead(roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Since chat_messages doesn't have an is_read column in the schema provided in PLANES,
  // we will update the NOTIFICATIONS table to mark relevant notifications as read.

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id) // My notifications
    .like("title", `%${roomId}%`); // Heuristic or add metadata to notifications

  // If we truly want read receipts, we need to alter the schema or add a separate table.
  // For now, this stub is sufficient to prevent errors.
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

export async function leaveGroup(roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: room, error: fetchError } = await supabase
    .from("chat_rooms")
    .select("participants")
    .eq("id", roomId)
    .single();

  if (fetchError || !room) throw fetchError || new Error("Room not found");

  // safeParseArray prevents 22P02 if participants arrives as a JSON string
  const currentParticipants = safeParseArray(room.participants);
  const updatedParticipants = currentParticipants.filter(
    (id) => id !== user.id,
  );

  const { error } = await supabase
    .from("chat_rooms")
    .update({
      participants: updatedParticipants,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (error) throw error;
}
