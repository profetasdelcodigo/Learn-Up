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

/** Single source of truth for the 10 selectable models exposed by Learn Up. */
export const AI_MODELS = {
  groqReasoning: { id: "groq/openai/gpt-oss-120b", provider: "groq", label: "GPT OSS 120B", shortLabel: "Groq · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["chat", "profesor", "consejero", "jarvis"] },
  groqFast: { id: "groq/openai/gpt-oss-20b", provider: "groq", label: "GPT OSS 20B", shortLabel: "Groq · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["fast"] },
  groqGeneral: { id: "groq/llama-3.3-70b-versatile", provider: "groq", label: "Llama 3.3 70B", shortLabel: "Groq · Llama 3.3 70B", modality: "text", contextTokens: 131_072, maxOutputTokens: 32_768 },
  openRouterFreeLarge: { id: "openrouter/openai/gpt-oss-120b:free", provider: "openrouter", label: "GPT OSS 120B · Gratis", shortLabel: "OpenRouter · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768, defaultFor: ["free-fallback"] },
  openRouterFreeFast: { id: "openrouter/openai/gpt-oss-20b:free", provider: "openrouter", label: "GPT OSS 20B · Gratis", shortLabel: "OpenRouter · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 32_768 },
  openRouterResearch: { id: "openrouter/deepseek/deepseek-v4-flash-0731", provider: "openrouter", label: "DeepSeek V4 Flash", shortLabel: "OpenRouter · DeepSeek V4 Flash", modality: "reasoning", contextTokens: 1_310_720, maxOutputTokens: 131_072 },
  geminiFast: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["multimodal", "files", "images", "pdf"] },
  geminiAgentic: { id: "gemini/gemini-3.7-flash", provider: "gemini", label: "Gemini 3.7 Flash", shortLabel: "Gemini · 3.7 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["agents"] },
  geminiBalanced: { id: "gemini/gemini-3.6-flash", provider: "gemini", label: "Gemini 3.6 Flash", shortLabel: "Gemini · 3.6 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  nvidiaSuper: { id: "nvidia/nemotron-3-super-120b-a12b", provider: "nvidia", label: "Nemotron 3 Super 120B", shortLabel: "NVIDIA · Nemotron 3 Super", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 16_384, defaultFor: ["reasoning"] },
} as const satisfies Record<string, AIModelDefinition>;

export const AI_MODEL_OPTIONS = Object.values(AI_MODELS);
export const AI_FALLBACK_CHAIN = [AI_MODELS.groqFast.id, AI_MODELS.groqReasoning.id, AI_MODELS.openRouterFreeLarge.id, AI_MODELS.openRouterFreeFast.id, AI_MODELS.geminiAgentic.id, AI_MODELS.nvidiaSuper.id] as const;
export const AI_REASONING_CHAIN = [AI_MODELS.groqReasoning.id, AI_MODELS.nvidiaSuper.id, AI_MODELS.openRouterResearch.id, AI_MODELS.geminiAgentic.id, AI_MODELS.groqFast.id] as const;
export const PROVIDER_LABELS: Record<AIProvider, string> = { groq: "Groq", openrouter: "OpenRouter", gemini: "Gemini", nvidia: "NVIDIA NIM" };

export function findAIModel(id: string | undefined | null) {
  return id ? AI_MODEL_OPTIONS.find((model) => model.id === id) : undefined;
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
