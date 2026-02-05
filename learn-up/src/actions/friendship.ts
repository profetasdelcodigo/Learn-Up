"use server";

import { createClient } from "@/utils/supabase/server";

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  if (!query || query.length < 3) return [];

  // Search by username or full name with robust ilike
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, school, grade, role")
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .neq("id", user.id)
    .limit(20);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  // Check friendship status for each result
  const resultsWithStatus = await Promise.all(
    data.map(async (profile) => {
      // Check if there is a friendship record using new columns
      const { data: friendship } = await supabase
        .from("friendships")
        .select("status, requester_id, addressee_id")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`,
        )
        .maybeSingle();

      return {
        ...profile,
        friendshipStatus: friendship ? friendship.status : null,
        isRequester: friendship ? friendship.requester_id === user.id : false,
      };
    }),
  );

  return resultsWithStatus;
}

export async function sendFriendRequest(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Check if already exists
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (existing) {
    return { success: true, message: "Friendship already exists or pending" };
  }

  // Insert using requester_id/addressee_id
  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: targetUserId,
    status: "pending",
  });

  if (error) throw error;

  // Notification for addressee
  await supabase.from("notifications").insert({
    user_id: targetUserId,
    sender_id: user.id, // Explicitly sending sender_id
    type: "friend_request",
    title: "Nueva Solicitud de Amistad",
    message: `${user.user_metadata.full_name || "Un usuario"} quiere conectar contigo`,
    link: "/dashboard/notifications",
  });

  return { success: true };
}

export async function acceptFriendRequest(senderId: string) {
  // Note: senderId here refers to the person who SENT the request (requester_id),
  // and the current user is the addressee_id.
  // Sometimes this might be passed as friendship_id, but the user prompt implies "accept request".
  // Let's assume the argument is the ID of the USER we are accepting, OR the friendship ID.
  // Given the context of "list of notifications" usually we have the friendship ID or the user ID.
  // Let's make it robust: accept by finding the pending request from this user.

  // HOWEVER, standard practice is to pass the User ID of the requester.
  // Let's assume senderId is the User ID of the friend.

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Update status to accepted where I am the addressee and they are the requester
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", senderId)
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) throw error;

  // Also create a notification back to the requester saying "Request Accepted"
  await supabase.from("notifications").insert({
    user_id: senderId,
    type: "system",
    title: "Solicitud Aceptada",
    message: `${user.user_metadata?.full_name || "Alguien"} aceptó tu solicitud de amistad.`,
    link: "/chat",
  });

  return { success: true };
}

export async function getFriends() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get Friendships
    const { data: friendships, error: fError } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (fError) {
      console.error("Error fetching friendships:", fError);
      return [];
    }

    if (!friendships || friendships.length === 0) return [];

    // 2. Extract Friend IDs
    const friendIds = friendships.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id,
    );
    const uniqueFriendIds = Array.from(new Set(friendIds));

    if (uniqueFriendIds.length === 0) return [];

    // 3. Fetch Profiles manually
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, school, grade, role")
      .in("id", uniqueFriendIds);

    if (pError) {
      console.error("Error fetching friend profiles:", pError);
      return [];
    }

    // 4. Map back to result structure
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return friendships.map((f) => {
      const friendId =
        f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const profile = profileMap.get(friendId);

      return {
        friendshipId: f.id,
        id: friendId,
        username: profile?.username || "Usuario",
        full_name: profile?.full_name || "Desconocido",
        avatar_url: profile?.avatar_url,
        school: profile?.school,
        grade: profile?.grade,
        role: profile?.role,
      };
    });
  } catch (error) {
    console.error("Unexpected error in getFriends:", error);
    return [];
  }
}

export async function getPendingRequests() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get Pending Requests (where I am addressee)
    const { data: requests, error: rError } = await supabase
      .from("friendships")
      .select("id, created_at, requester_id")
      .eq("status", "pending")
      .eq("addressee_id", user.id);

    if (rError) {
      console.error("Error fetching pending requests:", rError);
      return [];
    }

    if (!requests || requests.length === 0) return [];

    // 2. Extract Requester IDs
    const requesterIds = requests.map((r) => r.requester_id);
    const uniqueIds = Array.from(new Set(requesterIds));

    // 3. Fetch Profiles
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, school, grade, role")
      .in("id", uniqueIds);

    if (pError) {
      console.error("Error fetching requester profiles:", pError);
      return [];
    }

    // 4. Map Result
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return requests.map((r) => {
      const profile = profileMap.get(r.requester_id);
      return {
        id: r.id,
        created_at: r.created_at,
        requester: {
          id: r.requester_id,
          username: profile?.username || "Usuario",
          full_name: profile?.full_name || "Desconocido",
          avatar_url: profile?.avatar_url,
          school: profile?.school,
          grade: profile?.grade,
          role: profile?.role,
        },
      };
    });
  } catch (error) {
    console.error("Unexpected error in getPendingRequests:", error);
    return [];
  }
}
