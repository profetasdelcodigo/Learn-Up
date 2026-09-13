import { AI_MODELS, type AIModelDefinition } from "./model-catalog";

export type AICapability =
  | "text"
  | "reasoning"
  | "vision"
  | "image_generation"
  | "video_generation"
  | "text_to_speech"
  | "speech_to_text"
  | "embeddings";

export interface CapabilityRoute {
  capability: AICapability;
  primary: string[];
  fallbacks: string[];
  expensive?: string[];
}

export const AI_CAPABILITY_ROUTES: Record<AICapability, CapabilityRoute> = {
  text: {
    capability: "text",
    primary: [AI_MODELS.cloudflareGlmFlash.id, AI_MODELS.groqFast.id],
    fallbacks: [AI_MODELS.geminiFast.id, AI_MODELS.groqReasoning.id, AI_MODELS.openRouterFree.id],
  },
  reasoning: {
    capability: "reasoning",
    primary: [AI_MODELS.groqReasoning.id, AI_MODELS.cloudflareGptOss120b.id],
    fallbacks: [AI_MODELS.nvidiaSuper.id, AI_MODELS.geminiAgentic.id, AI_MODELS.cloudflareGlmFlash.id, AI_MODELS.openRouterResearch.id],
  },
  vision: {
    capability: "vision",
    primary: [AI_MODELS.cloudflareMoondream.id, AI_MODELS.geminiFast.id],
    fallbacks: [AI_MODELS.cloudflareGemma4.id, AI_MODELS.openRouterFree.id],
  },
  image_generation: {
    capability: "image_generation",
    primary: [AI_MODELS.cloudflareFluxKlein4b.id],
    fallbacks: [AI_MODELS.cloudflareFluxSchnell.id, "fal/fal-ai/flux-pro/v1.1"],
    expensive: [AI_MODELS.cloudflareFluxKlein9b.id],
  },
  video_generation: {
    capability: "video_generation",
    primary: [AI_MODELS.cloudflareHappyHorseT2V.id],
    fallbacks: [AI_MODELS.cloudflareHappyHorseI2V.id, "fal/fal-ai/kling-video/v1/standard/text-to-video"],
  },
  text_to_speech: {
    capability: "text_to_speech",
    primary: [AI_MODELS.cloudflareMeloTts.id],
    fallbacks: [AI_MODELS.cloudflareAura1.id, "elevenlabs/tts"],
  },
  speech_to_text: {
    capability: "speech_to_text",
    primary: [AI_MODELS.cloudflareWhisper.id],
    fallbacks: [AI_MODELS.groqWhisper.id],
  },
  embeddings: {
    capability: "embeddings",
    primary: [AI_MODELS.cloudflareEmbeddingGemma300m.id],
    fallbacks: [],
  },
};

export function routeForCapability(capability: AICapability) {
  return AI_CAPABILITY_ROUTES[capability];
}

export function modelForCapability(capability: AICapability, index = 0): AIModelDefinition | string | undefined {
  const route = AI_CAPABILITY_ROUTES[capability];
  return route ? [...route.primary, ...route.fallbacks, ...(route.expensive || [])][index] : undefined;
}
