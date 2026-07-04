import { fal } from "@fal-ai/serverless-client";

// FAL_KEY is automatically loaded from process.env.FAL_KEY by the serverless-client.
fal.config({
  credentials: process.env.FAL_KEY,
});

export const generateFalImage = async (prompt: string): Promise<string | null> => {
  try {
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
  try {
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
