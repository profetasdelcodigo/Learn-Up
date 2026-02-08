"use server";

interface DailyRoomParams {
  name?: string;
  privacy?: "public" | "private";
}

export async function createDailyRoom(roomName: string) {
  const apiKey =
    process.env.DAILY_API_KEY || process.env.NEXT_PUBLIC_DAILY_API_KEY;

  if (!apiKey) {
    throw new Error("Daily API Key not configured");
  }

  if (!roomName || roomName === "undefined") {
    console.error("Nombre de sala inválido:", roomName);
    throw new Error("Nombre de sala inválido");
  }

  // 1. Check if room exists
  const getResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (getResponse.ok) {
    const data = await getResponse.json();
    return { url: data.url, name: data.name };
  }

  // 2. Create if not exists
  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: "public",
      properties: {
        enable_chat: true,
        enable_screenshare: true,
        exp: Math.round(Date.now() / 1000) + 3600, // 1 hour expiry
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Daily API Error:", error);
    throw new Error(`Failed to create room: ${response.statusText}`);
  }

  const room = await response.json();
  return { url: room.url, name: room.name };
}
