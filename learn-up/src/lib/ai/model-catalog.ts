export type AIProvider = "groq" | "openrouter" | "gemini" | "nvidia" | "cloudflare";
export type AIModality = "text" | "multimodal" | "reasoning" | "image" | "video" | "audio" | "embedding";

export interface AIModelDefinition {
  id: string;
  provider: AIProvider;
  label: string;
  shortLabel: string;
  modality: AIModality;
  contextTokens: number;
  maxOutputTokens: number;
  preview?: boolean;
  defaultFor?: string[];
}

export const AI_MODELS = {
  groqReasoning: { id: "groq/openai/gpt-oss-120b", provider: "groq", label: "GPT OSS 120B", shortLabel: "Groq · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["chat", "profesor", "consejero", "jarvis", "reasoning"] },
  groqFast: { id: "groq/openai/gpt-oss-20b", provider: "groq", label: "GPT OSS 20B", shortLabel: "Groq · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["fast", "tools"] },
  groqGeneral: { id: "groq/qwen/qwen3.8-27b", provider: "groq", label: "Qwen 3.8 27B", shortLabel: "Groq · Qwen 3.8 27B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 16_384, defaultFor: ["balanced", "coding"] },
  groqWhisper: { id: "groq/whisper-large-v3-turbo", provider: "groq", label: "Whisper Large V3 Turbo", shortLabel: "Groq · Whisper", modality: "audio", contextTokens: 0, maxOutputTokens: 0 },

  openRouterFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768, defaultFor: ["fallback", "auto"] },
  openRouterFreeLarge: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768, defaultFor: ["free-fallback"] },
  openRouterFreeFast: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  openRouterResearch: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768, defaultFor: ["research", "agents"] },
  openRouterPlanning: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },

  geminiFast: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["multimodal", "files", "images", "pdf", "video"] },
  geminiAgentic: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["agents"] },
  geminiBalanced: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  geminiLegacy: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },

  nvidiaSuper: { id: "nvidia/nemotron-3-super-120b-a12b", provider: "nvidia", label: "Nemotron 3 Super 120B", shortLabel: "NVIDIA · Nemotron 3 Super", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 16_384, defaultFor: ["reasoning"] },

  cloudflareGlmFlash: { id: "cloudflare/@cf/zai-org/glm-4.7-flash", provider: "cloudflare", label: "GLM-4.7 Flash", shortLabel: "Cloudflare · GLM-4.7 Flash", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768, defaultFor: ["fallback", "free-fallback", "long-form"] },
  cloudflareGptOss120b: { id: "cloudflare/@cf/openai/gpt-oss-120b", provider: "cloudflare", label: "GPT OSS 120B", shortLabel: "Cloudflare · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536 },
  cloudflareGemma4: { id: "cloudflare/@cf/google/gemma-4-26b-a4b-it", provider: "cloudflare", label: "Gemma 4 26B", shortLabel: "Cloudflare · Gemma 4 26B", modality: "multimodal", contextTokens: 256_000, maxOutputTokens: 16_384 },
  cloudflareMoondream: { id: "cloudflare/@cf/moondream/moondream3.1-9B-A2B", provider: "cloudflare", label: "Moondream 3.1", shortLabel: "Cloudflare · Moondream 3.1", modality: "multimodal", contextTokens: 32_768, maxOutputTokens: 8_192 },
  cloudflareFluxKlein4b: { id: "cloudflare/@cf/black-forest-labs/flux-2-klein-4b", provider: "cloudflare", label: "FLUX.2 Klein 4B", shortLabel: "Cloudflare · FLUX.2 Klein 4B", modality: "image", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareFluxKlein9b: { id: "cloudflare/@cf/black-forest-labs/flux-2-klein-9b", provider: "cloudflare", label: "FLUX.2 Klein 9B", shortLabel: "Cloudflare · FLUX.2 Klein 9B", modality: "image", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareFluxSchnell: { id: "cloudflare/@cf/black-forest-labs/flux-1-schnell", provider: "cloudflare", label: "FLUX.1 Schnell", shortLabel: "Cloudflare · FLUX.1 Schnell", modality: "image", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareHappyHorseT2V: { id: "cloudflare/alibaba/hh1.1-t2v", provider: "cloudflare", label: "HappyHorse 1.1 T2V", shortLabel: "Cloudflare · HappyHorse 1.1", modality: "video", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareHappyHorseI2V: { id: "cloudflare/alibaba/hh1.1-i2v", provider: "cloudflare", label: "HappyHorse I2V", shortLabel: "Cloudflare · HappyHorse I2V", modality: "video", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareMeloTts: { id: "cloudflare/@cf/myshell-ai/melotts", provider: "cloudflare", label: "MeloTTS", shortLabel: "Cloudflare · MeloTTS", modality: "audio", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareAura1: { id: "cloudflare/@cf/deepgram/aura-1", provider: "cloudflare", label: "Deepgram Aura 1", shortLabel: "Cloudflare · Aura 1", modality: "audio", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareWhisper: { id: "cloudflare/@cf/openai/whisper", provider: "cloudflare", label: "Whisper", shortLabel: "Cloudflare · Whisper", modality: "audio", contextTokens: 0, maxOutputTokens: 0 },
  cloudflareBgeM3: { id: "cloudflare/@cf/baai/bge-m3", provider: "cloudflare", label: "BGE-M3", shortLabel: "Cloudflare · BGE-M3", modality: "embedding", contextTokens: 8192, maxOutputTokens: 0 },
  cloudflareQwenEmbedding: { id: "cloudflare/@cf/qwen/qwen3-embedding-0.6b", provider: "cloudflare", label: "Qwen3 Embedding 0.6B", shortLabel: "Cloudflare · Qwen Embedding", modality: "embedding", contextTokens: 8192, maxOutputTokens: 0 },
  cloudflareEmbeddingGemma300m: { id: "cloudflare/@cf/google/embeddinggemma-300m", provider: "cloudflare", label: "EmbeddingGemma 300M", shortLabel: "Cloudflare · EmbeddingGemma 300M", modality: "embedding", contextTokens: 512, maxOutputTokens: 0 },

  minimaxM3Free: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  glmFlashFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  nexMiniFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  nexProFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  inklingFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  inklingSmallFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  nemotronNanoFree: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
} as const satisfies Record<string, AIModelDefinition>;

export const AI_MODEL_OPTIONS = Object.values(AI_MODELS).filter((model, index, all) => all.findIndex((item) => item.id === model.id) === index);

export const AI_FALLBACK_CHAIN = [
  AI_MODELS.cloudflareGlmFlash.id,
  AI_MODELS.groqFast.id,
  AI_MODELS.groqReasoning.id,
  AI_MODELS.geminiFast.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.openRouterFree.id,
] as const;

export const AI_REASONING_CHAIN = [
  AI_MODELS.groqReasoning.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.cloudflareGptOss120b.id,
  AI_MODELS.geminiAgentic.id,
  AI_MODELS.cloudflareGlmFlash.id,
  AI_MODELS.openRouterResearch.id,
] as const;

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  nvidia: "NVIDIA NIM",
  cloudflare: "Cloudflare Workers AI",
};

export function findAIModel(id: string | undefined | null) { return id ? AI_MODEL_OPTIONS.find((model) => model.id === id) : undefined; }
export function modelDisplayName(id: string | undefined | null) { return findAIModel(id)?.shortLabel || id || "IA"; }
export function providerOfModel(id: string): AIProvider {
  const model = findAIModel(id);
  if (model) return model.provider;
  if (id.startsWith("groq/")) return "groq";
  if (id.startsWith("gemini/")) return "gemini";
  if (id.startsWith("nvidia/")) return "nvidia";
  if (id.startsWith("cloudflare/")) return "cloudflare";
  return "openrouter";
}
