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

/** Single source of truth for the selectable models exposed by Learn Up. */
export const AI_MODELS = {
  // Groq: modelos de producción vigentes, sustitutos oficiales de los Llama retirados.
  groqReasoning: { id: "groq/openai/gpt-oss-120b", provider: "groq", label: "GPT OSS 120B", shortLabel: "Groq · GPT OSS 120B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["chat", "profesor", "consejero", "jarvis"] },
  groqFast: { id: "groq/openai/gpt-oss-20b", provider: "groq", label: "GPT OSS 20B", shortLabel: "Groq · GPT OSS 20B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 65_536, defaultFor: ["fast"] },
  groqGeneral: { id: "groq/qwen/qwen3.6-27b", provider: "groq", label: "Qwen 3.6 27B", shortLabel: "Groq · Qwen 3.6 27B", modality: "reasoning", contextTokens: 131_072, maxOutputTokens: 16_384 },

  // OpenRouter: modelos estables con múltiples proveedores, evitando endpoints free
  // como dependencia principal. El enrutamiento del proveedor aporta redundancia.
  openRouterFreeLarge: { id: "openrouter/free", provider: "openrouter", label: "Router gratuito", shortLabel: "OpenRouter · Free Router", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 32_768, defaultFor: ["free-fallback"] },
  openRouterResearch: { id: "openrouter/deepseek/deepseek-v4-flash-0731", provider: "openrouter", label: "DeepSeek V4 Flash 0731", shortLabel: "OpenRouter · DeepSeek V4 Flash", modality: "reasoning", contextTokens: 1_310_720, maxOutputTokens: 393_216, defaultFor: ["research", "long-context"] },
  openRouterPlanning: { id: "openrouter/z-ai/glm-5.2", provider: "openrouter", label: "GLM 5.2", shortLabel: "OpenRouter · GLM 5.2", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 163_840, defaultFor: ["planning", "coding"] },

  // Gemini: modelos estables actuales; no se usan modelos con fecha de cierre anunciada.
  geminiFast: { id: "gemini/gemini-3.8-flash", provider: "gemini", label: "Gemini 3.8 Flash", shortLabel: "Gemini · 3.8 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["multimodal", "files", "images", "pdf"] },
  geminiAgentic: { id: "gemini/gemini-3.7-flash", provider: "gemini", label: "Gemini 3.7 Flash", shortLabel: "Gemini · 3.7 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["agents"] },
  geminiBalanced: { id: "gemini/gemini-3.6-flash", provider: "gemini", label: "Gemini 3.6 Flash", shortLabel: "Gemini · 3.6 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  geminiLegacy: { id: "gemini/gemini-3.5-flash", provider: "gemini", label: "Gemini 3.5 Flash", shortLabel: "Gemini · 3.5 Flash", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },

  // NVIDIA: endpoint directo actual con 1M de contexto y razonamiento.
  nvidiaSuper: { id: "nvidia/nemotron-3-super-120b-a12b", provider: "nvidia", label: "Nemotron 3 Super 120B", shortLabel: "NVIDIA · Nemotron 3 Super", modality: "reasoning", contextTokens: 1_048_576, maxOutputTokens: 16_384, defaultFor: ["reasoning"] },
} as const satisfies Record<string, AIModelDefinition>;

export const AI_MODEL_OPTIONS = Object.values(AI_MODELS);

// Orden deliberado: proveedores directos primero; OpenRouter después como
// capa de redundancia multi-host. El free router queda como último recurso.
export const AI_FALLBACK_CHAIN = [
  AI_MODELS.groqFast.id,
  AI_MODELS.groqReasoning.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.geminiFast.id,
  AI_MODELS.geminiBalanced.id,
  AI_MODELS.geminiAgentic.id,
  AI_MODELS.openRouterResearch.id,
  AI_MODELS.openRouterPlanning.id,
  AI_MODELS.openRouterFreeLarge.id,
] as const;

export const AI_REASONING_CHAIN = [
  AI_MODELS.groqReasoning.id,
  AI_MODELS.groqFast.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.openRouterResearch.id,
  AI_MODELS.openRouterPlanning.id,
  AI_MODELS.geminiFast.id,
  AI_MODELS.geminiBalanced.id,
  AI_MODELS.geminiAgentic.id,
  AI_MODELS.openRouterFreeLarge.id,
] as const;

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
