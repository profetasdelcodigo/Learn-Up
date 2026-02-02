"use server";

import { createClient } from "@/utils/supabase/server";

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  if (!query || query.length < 3) return [];

  // Search by username or full name
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .neq("id", user.id) // Don't show self
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  // Check friendship status for each result
  // This is a bit N+1 but okay for search limit 10
  const resultsWithStatus = await Promise.all(
    data.map(async (profile) => {
      // Check if there is a friendship record
      const { data: friendship } = await supabase
        .from("friendships")
        .select("status, requester_id, receiver_id")
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${profile.id}),and(requester_id.eq.${profile.id},receiver_id.eq.${user.id})`,
        )
        .single();

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

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    receiver_id: targetUserId,
    status: "pending",
  });

  if (error) throw error;
  return { success: true };
}

export async function acceptFriendRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", requestId)
    // Ensure user is the receiver
    .eq("receiver_id", user.id);

  if (error) throw error;
  return { success: true };
}

export async function getFriends() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch accepted friendships
  // Complicated because user could be requester or receiver
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `
        id,
        requester_id,
        receiver_id,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url),
        receiver:profiles!friendships_receiver_id_fkey(id, username, full_name, avatar_url)
      `,
    )
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

  if (error) {
    console.error("Error fetching friends:", error);
    return [];
  }

  // Map to a clean list of "other user" profiles
  return data.map((f) => {
    const isRequester = f.requester_id === user.id;
    const profile = isRequester ? f.receiver : f.requester;
    // Cast types from joined query
    // Supabase returns generic types, we know it's profile
    return {
      friendshipId: f.id,
      ...(Array.isArray(profile) ? profile[0] : profile),
    };
  });
}

export async function getPendingRequests() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Incoming requests
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `
        id,
        created_at,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url)
      `,
    )
    .eq("status", "pending")
    .eq("receiver_id", user.id);

  if (error) return [];

  return data.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    requester: Array.isArray(r.requester) ? r.requester[0] : r.requester,
  }));
}
