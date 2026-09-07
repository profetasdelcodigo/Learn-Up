import * as fal from "@fal-ai/serverless-client";

// Lazy init — only configure when first used, avoiding crashes if FAL_KEY is absent.
let configured = false;
function ensureFalConfig() {
  if (configured) return;
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY no configurada.");
  try {
    if (typeof fal.config === "function") {
      fal.config({ credentials: process.env.FAL_KEY });
    }
  } finally {
    configured = true;
  }
}

export const generateFalImage = async (prompt: string): Promise<string | null> => {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY no configurada.");
  ensureFalConfig();
  try {
    const result: any = await fal.subscribe("fal-ai/flux-pro/v1.1", {
      input: { prompt, aspect_ratio: "16:9" },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") update.logs.map((log) => log.message).forEach(console.log);
      },
    });
    const url = result?.images?.[0]?.url;
    if (typeof url !== "string" || !url.trim()) throw new Error("Fal no devolvió una URL de imagen.");
    return url;
  } catch (error) {
    console.error("Error generating Fal image:", error);
    throw error instanceof Error ? error : new Error("Error desconocido generando imagen con Fal.");
  }
};

export const generateFalVideo = async (prompt: string): Promise<string | null> => {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY no configurada.");
  ensureFalConfig();
  try {
    const result: any = await fal.subscribe("fal-ai/kling-video/v1/standard/text-to-video", {
      input: { prompt },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") update.logs.map((log) => log.message).forEach(console.log);
      },
    });
    const url = result?.video?.url;
    if (typeof url !== "string" || !url.trim()) throw new Error("Fal no devolvió una URL de video.");
    return url;
  } catch (error) {
    console.error("Error generating Fal video:", error);
    throw error instanceof Error ? error : new Error("Error desconocido generando video con Fal.");
  }
};