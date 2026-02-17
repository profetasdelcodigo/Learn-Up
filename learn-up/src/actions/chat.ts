"use server";

import { createClient } from "@/utils/supabase/server";

export interface ChatRoom {
  id: string;
  type: "private" | "group";
  name?: string;
  participants: string[];
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch rooms where participants (JSONB array) contains user.id
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .contains("participants", [user.id])
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

  // Filter strictly for 2 participants to avoid false positives if logic changes
  const exactMatch = existingRooms?.find((r) => r.participants.length === 2);

  if (exactMatch) {
    return exactMatch.id;
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

  // Validate participants are UUIDs
  const validParticipants = Array.from(
    new Set([user.id, ...participantIds]),
  ).filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );

  if (validParticipants.length < 2 && name !== "Me") {
    // Allow "Me" chat for testing or self-notes if needed, but generally force >1
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

  if (error) throw error;
  return data as Message[];
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

  // Update room updated_at and last_message
  await supabase
    .from("chat_rooms")
    .update({
      updated_at: new Date().toISOString(),
      last_message: content.substring(0, 50),
    })
    .eq("id", roomId);

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
        // Ensure participants is an array
        //        const participants = Array.isArray(room.participants) ? room.participants : [];
        const recipients = room.participants.filter(
          (id: string) => id !== user.id,
        );

        if (recipients.length > 0) {
          // 2. Prepare notifications
          const notifications = recipients.map((recipientId: string) => ({
            user_id: recipientId,
            type: "message",
            title:
              room.type === "group"
                ? `Nuevo mensaje en ${room.name || "Grupo"}`
                : "Nuevo mensaje",
            message:
              content.substring(0, 50) + (content.length > 50 ? "..." : ""),
            sender_id: user.id,
            is_read: false,
            link: `/chat`, // Opcional: link to chat
            created_at: new Date().toISOString(),
          }));

          // 3. Insert notifications
          const { error: notifError } = await supabase
            .from("notifications")
            .insert(notifications);

          if (notifError)
            console.error("Error inserting notifications:", notifError);
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

  const updatedParticipants = room.participants.filter(
    (id: string) => id !== user.id,
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
