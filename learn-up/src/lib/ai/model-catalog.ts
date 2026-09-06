export type AIProvider = "groq" | "openrouter" | "gemini" | "nvidia";
export type AIModality = "text" | "multimodal" | "reasoning";

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

/**
 * Single source of truth for every user-selectable model in Learn Up.
 * Keep this file client-safe: never put API keys or provider credentials here.
 */
export const AI_MODELS = {
  groqFast: {
    id: "groq/openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT OSS 120B",
    shortLabel: "Groq · OSS 120B",
    modality: "reasoning",
    contextTokens: 131_072,
    maxOutputTokens: 65_536,
    defaultFor: ["chat", "profesor", "consejero", "jarvis", "nutrirecetas"],
  },
  groqUltraFast: {
    id: "groq/openai/gpt-oss-20b",
    provider: "groq",
    label: "GPT OSS 20B",
    shortLabel: "Groq · OSS 20B",
    modality: "reasoning",
    contextTokens: 131_072,
    maxOutputTokens: 65_536,
  },
  openRouterFast: {
    id: "openrouter/deepseek/deepseek-v4-flash-0731",
    provider: "openrouter",
    label: "DeepSeek V4 Flash 0731",
    shortLabel: "OpenRouter · DeepSeek V4 Flash",
    modality: "reasoning",
    contextTokens: 1_310_720,
    maxOutputTokens: 131_072,
    defaultFor: ["fallback"],
  },
  openRouterReasoning: {
    id: "openrouter/deepseek/deepseek-v4-pro-0813",
    provider: "openrouter",
    label: "DeepSeek V4 Pro 0813",
    shortLabel: "OpenRouter · DeepSeek V4 Pro",
    modality: "reasoning",
    contextTokens: 1_048_576,
    maxOutputTokens: 384_000,
  },
  geminiFast: {
    id: "gemini/gemini-3.7-flash",
    provider: "gemini",
    label: "Gemini 3.7 Flash",
    shortLabel: "Gemini · 3.7 Flash",
    modality: "multimodal",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    defaultFor: ["multimodal", "files", "images", "pdf"],
  },
  geminiReasoning: {
    id: "gemini/gemini-3.1-pro-preview",
    provider: "gemini",
    label: "Gemini 3.1 Pro",
    shortLabel: "Gemini · 3.1 Pro",
    modality: "multimodal",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    preview: true,
  },
  nvidiaFast: {
    id: "nvidia/nemotron-3-super-120b-a12b",
    provider: "nvidia",
    label: "Nemotron 3 Super 120B",
    shortLabel: "NVIDIA · Nemotron Super",
    modality: "reasoning",
    contextTokens: 1_048_576,
    maxOutputTokens: 16_384,
  },
  nvidiaReasoning: {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    provider: "nvidia",
    label: "Nemotron 3 Ultra 550B",
    shortLabel: "NVIDIA · Nemotron Ultra",
    modality: "reasoning",
    contextTokens: 1_048_576,
    maxOutputTokens: 16_384,
  },
} as const satisfies Record<string, AIModelDefinition>;

export const AI_MODEL_OPTIONS = [
  AI_MODELS.groqFast,
  AI_MODELS.groqUltraFast,
  AI_MODELS.openRouterFast,
  AI_MODELS.openRouterReasoning,
  AI_MODELS.geminiFast,
  AI_MODELS.geminiReasoning,
  AI_MODELS.nvidiaFast,
  AI_MODELS.nvidiaReasoning,
] as const;

export const AI_FALLBACK_CHAIN = [
  AI_MODELS.groqFast.id,
  AI_MODELS.openRouterFast.id,
  AI_MODELS.geminiFast.id,
  AI_MODELS.nvidiaFast.id,
] as const;

export const AI_REASONING_CHAIN = [
  AI_MODELS.groqFast.id,
  AI_MODELS.openRouterReasoning.id,
  AI_MODELS.geminiReasoning.id,
  AI_MODELS.nvidiaReasoning.id,
] as const;

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  nvidia: "NVIDIA NIM",
};

export function findAIModel(id: string | undefined | null) {
  if (!id) return undefined;
  return AI_MODEL_OPTIONS.find((model) => model.id === id);
}

export function modelDisplayName(id: string | undefined | null) {
  return findAIModel(id)?.shortLabel || id || "IA";
}

export function providerOfModel(id: string): AIProvider {
  if (id.startsWith("groq/")) return "groq";
  if (id.startsWith("gemini/")) return "gemini";
  if (id.startsWith("nvidia/")) return "nvidia";
  return "openrouter";
}
