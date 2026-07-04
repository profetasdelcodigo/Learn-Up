import * as fal from "@fal-ai/serverless-client";

// Lazy init — only configure when first used, avoiding crashes if FAL_KEY is absent
let configured = false;
function ensureFalConfig() {
  if (configured) return;
  try {
    if (typeof fal.config === "function") {
      fal.config({
        credentials: process.env.FAL_KEY || "",
      });
    }
  } catch (e) {
    console.warn("[fal] Could not configure fal client:", e);
  }
  configured = true;
}

export const generateFalImage = async (prompt: string): Promise<string | null> => {
  if (!process.env.FAL_KEY) {
    console.warn("[fal] FAL_KEY not set, skipping image generation");
    return null;
  }
  try {
    ensureFalConfig();
    const result: any = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: prompt,
        image_size: "landscape_4_3",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });
    
    if (result && result.images && result.images.length > 0) {
      return result.images[0].url;
    }
    return null;
  } catch (error) {
    console.error("Error generating Fal image:", error);
    return null;
  }
};

export const generateFalVideo = async (prompt: string): Promise<string | null> => {
  if (!process.env.FAL_KEY) {
    console.warn("[fal] FAL_KEY not set, skipping video generation");
    return null;
  }
  try {
    ensureFalConfig();
    const result: any = await fal.subscribe("fal-ai/minimax/video-01", {
      input: {
        prompt: prompt,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });
    
    if (result && result.video && result.video.url) {
      return result.video.url;
    }
    return null;
  } catch (error) {
    console.error("Error generating Fal video:", error);
    return null;
  }
};
