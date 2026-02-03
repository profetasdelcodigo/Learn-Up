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

  // Check if already exists to prevent 500 error
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${user.id})`,
    )
    .single();

  if (existing) {
    return { success: true, message: "Friendship already exists or pending" };
  }

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

// Safe robust version of getFriends
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
      .select("id, requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (fError) {
      console.error("Error fetching friendships:", fError);
      return [];
    }

    if (!friendships || friendships.length === 0) return [];

    // 2. Extract Friend IDs
    const friendIds = friendships.map((f) =>
      f.requester_id === user.id ? f.receiver_id : f.requester_id,
    );
    const uniqueFriendIds = Array.from(new Set(friendIds));

    if (uniqueFriendIds.length === 0) return [];

    // 3. Fetch Profiles manually
    const { data: profiles, error: pError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", uniqueFriendIds);

    if (pError) {
      console.error("Error fetching friend profiles:", pError);
      return [];
    }

    // 4. Map back to result structure
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return friendships.map((f) => {
      const friendId =
        f.requester_id === user.id ? f.receiver_id : f.requester_id;
      const profile = profileMap.get(friendId);

      // Return even if profile missing (robustness), though ideal to have it
      return {
        friendshipId: f.id,
        id: friendId,
        username: profile?.username || "Usuario",
        full_name: profile?.full_name || "Desconocido",
        avatar_url: profile?.avatar_url,
      };
    });
  } catch (error) {
    console.error("Unexpected error in getFriends:", error);
    return [];
  }
}

// Safe robust version of getPendingRequests
export async function getPendingRequests() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Get Pending Requests (where I am receiver)
    const { data: requests, error: rError } = await supabase
      .from("friendships")
      .select("id, created_at, requester_id")
      .eq("status", "pending")
      .eq("receiver_id", user.id);

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
      .select("id, username, full_name, avatar_url")
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
        },
      };
    });
  } catch (error) {
    console.error("Unexpected error in getPendingRequests:", error);
    return [];
  }
}
