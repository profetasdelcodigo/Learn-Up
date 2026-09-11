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

export const AI_MODELS = {
  groqReasoning: { id: "groq/openai/gpt-oss-120b", provider: "groq", label: "GPT OSS 120B", shortLabel: "Groq · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["chat", "profesor", "consejero", "jarvis", "reasoning"] },
  groqFast: { id: "groq/openai/gpt-oss-20b", provider: "groq", label: "GPT OSS 20B", shortLabel: "Groq · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["fast", "tools"] },
  groqGeneral: { id: "groq/qwen/qwen3.8-27b", provider: "groq", label: "Qwen 3.8 27B", shortLabel: "Groq · Qwen 3.8 27B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 16_384, defaultFor: ["balanced", "coding"] },

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
  AI_MODELS.groqFast.id,
  AI_MODELS.groqReasoning.id,
  AI_MODELS.geminiFast.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.openRouterFree.id,
] as const;

export const AI_REASONING_CHAIN = [
  AI_MODELS.groqReasoning.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.geminiAgentic.id,
  AI_MODELS.groqFast.id,
  AI_MODELS.openRouterResearch.id,
] as const;

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  nvidia: "NVIDIA NIM",
};

export function findAIModel(id: string | undefined | null) { return id ? AI_MODEL_OPTIONS.find((model) => model.id === id) : undefined; }
export function modelDisplayName(id: string | undefined | null) { return findAIModel(id)?.shortLabel || id || "IA"; }
export function providerOfModel(id: string): AIProvider {
  const model = findAIModel(id);
  if (model) return model.provider;
  if (id.startsWith("groq/")) return "groq";
  if (id.startsWith("gemini/")) return "gemini";
  if (id.startsWith("nvidia/")) return "nvidia";
  return "openrouter";
}
