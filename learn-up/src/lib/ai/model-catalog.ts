export type AIProvider = "openrouter";
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

/** Única fuente de verdad. TODOS los IDs apuntan a variantes :free de OpenRouter. */
export const AI_MODELS = {
  groqReasoning: { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", label: "Nemotron 3 Ultra (Free)", shortLabel: "NVIDIA · Nemotron 3 Ultra · Free", modality: "reasoning", contextTokens: 1_000_000, maxOutputTokens: 65_536, defaultFor: ["chat", "profesor", "consejero", "jarvis", "reasoning"] },
  groqFast: { id: "openrouter/nex-agi/nex-n2.5-mini:free", provider: "openrouter", label: "Nex-N2.5 Mini (Free)", shortLabel: "Nex AGI · N2.5 Mini · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536, defaultFor: ["fast", "tools"] },
  groqGeneral: { id: "openrouter/z-ai/glm-5.3-flash:free", provider: "openrouter", label: "GLM 5.3 Flash (Free)", shortLabel: "Z.ai · GLM 5.3 Flash · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["balanced", "coding"] },

  // Compatibilidad interna: este alias ya no usa openrouter/free porque el cliente OpenRouter espera el slug sin el prefijo interno.
  openRouterFree: { id: "openrouter/nex-agi/nex-n2.5-mini:free", provider: "openrouter", label: "Nex-N2.5 Mini (Free)", shortLabel: "OpenRouter · Nex-N2.5 Mini · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536, defaultFor: ["fallback", "auto"] },
  openRouterFreeLarge: { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", label: "Nemotron 3 Ultra (Free)", shortLabel: "OpenRouter · Nemotron 3 Ultra · Free", modality: "reasoning", contextTokens: 1_000_000, maxOutputTokens: 65_536, defaultFor: ["free-fallback", "research", "long-context"] },
  openRouterFreeFast: { id: "openrouter/nex-agi/nex-n2.5-mini:free", provider: "openrouter", label: "Nex-N2.5 Mini (Free)", shortLabel: "OpenRouter · Nex-N2.5 Mini · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536, defaultFor: ["free-fallback-fast"] },
  openRouterResearch: { id: "openrouter/nex-agi/nex-n2.5-pro:free", provider: "openrouter", label: "Nex-N2.5 Pro (Free)", shortLabel: "OpenRouter · Nex-N2.5 Pro · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536, defaultFor: ["research", "agents"] },
  openRouterPlanning: { id: "openrouter/z-ai/glm-5.3-flash:free", provider: "openrouter", label: "GLM 5.3 Flash (Free)", shortLabel: "OpenRouter · GLM 5.3 Flash · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["planning", "coding"] },

  geminiFast: { id: "openrouter/minimax/minimax-m3:free", provider: "openrouter", label: "MiniMax M3 (Free)", shortLabel: "MiniMax · M3 · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536, defaultFor: ["multimodal", "files", "images", "pdf", "video"] },
  geminiAgentic: { id: "openrouter/nex-agi/nex-n2.5-pro:free", provider: "openrouter", label: "Nex-N2.5 Pro (Free)", shortLabel: "Nex AGI · N2.5 Pro · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536, defaultFor: ["agents"] },
  geminiBalanced: { id: "openrouter/z-ai/glm-5.3-flash:free", provider: "openrouter", label: "GLM 5.3 Flash (Free)", shortLabel: "Z.ai · GLM 5.3 Flash · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  geminiLegacy: { id: "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", provider: "openrouter", label: "Nemotron 3 Nano Omni (Free)", shortLabel: "NVIDIA · Nemotron Nano Omni · Free", modality: "multimodal", contextTokens: 256_000, maxOutputTokens: 65_536 },

  nvidiaSuper: { id: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", label: "Nemotron 3 Ultra (Free)", shortLabel: "NVIDIA · Nemotron 3 Ultra · Free", modality: "reasoning", contextTokens: 1_000_000, maxOutputTokens: 65_536, defaultFor: ["reasoning"] },
  minimaxM3Free: { id: "openrouter/minimax/minimax-m3:free", provider: "openrouter", label: "MiniMax M3 (Free)", shortLabel: "MiniMax · M3 · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  glmFlashFree: { id: "openrouter/z-ai/glm-5.3-flash:free", provider: "openrouter", label: "GLM 5.3 Flash (Free)", shortLabel: "Z.ai · GLM 5.3 Flash · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 65_536 },
  nexMiniFree: { id: "openrouter/nex-agi/nex-n2.5-mini:free", provider: "openrouter", label: "Nex-N2.5 Mini (Free)", shortLabel: "Nex AGI · N2.5 Mini · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536 },
  nexProFree: { id: "openrouter/nex-agi/nex-n2.5-pro:free", provider: "openrouter", label: "Nex-N2.5 Pro (Free)", shortLabel: "Nex AGI · N2.5 Pro · Free", modality: "reasoning", contextTokens: 262_144, maxOutputTokens: 65_536 },
  inklingFree: { id: "openrouter/thinkingmachines/inkling:free", provider: "openrouter", label: "Inkling (Free)", shortLabel: "Thinking Machines · Inkling · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 262_144 },
  inklingSmallFree: { id: "openrouter/thinkingmachines/inkling-small:free", provider: "openrouter", label: "Inkling Small (Free)", shortLabel: "Thinking Machines · Inkling Small · Free", modality: "multimodal", contextTokens: 1_048_576, maxOutputTokens: 262_144 },
  nemotronNanoFree: { id: "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", provider: "openrouter", label: "Nemotron 3 Nano Omni (Free)", shortLabel: "NVIDIA · Nemotron Nano Omni · Free", modality: "multimodal", contextTokens: 256_000, maxOutputTokens: 65_536 },
} as const satisfies Record<string, AIModelDefinition>;

export const AI_MODEL_OPTIONS = Object.values(AI_MODELS).filter((model, index, all) => all.findIndex((item) => item.id === model.id) === index);

export const AI_FALLBACK_CHAIN = [
  AI_MODELS.openRouterFree.id,
  AI_MODELS.nexProFree.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.nexMiniFree.id,
  AI_MODELS.glmFlashFree.id,
  AI_MODELS.minimaxM3Free.id,
  AI_MODELS.nemotronNanoFree.id,
  AI_MODELS.inklingSmallFree.id,
] as const;

export const AI_REASONING_CHAIN = [
  AI_MODELS.nexProFree.id,
  AI_MODELS.nvidiaSuper.id,
  AI_MODELS.nexMiniFree.id,
  AI_MODELS.openRouterFree.id,
  AI_MODELS.glmFlashFree.id,
] as const;

export const PROVIDER_LABELS: Record<AIProvider, string> = { openrouter: "OpenRouter · Gratis" };

export function findAIModel(id: string | undefined | null) { return id ? AI_MODEL_OPTIONS.find((model) => model.id === id) : undefined; }
export function modelDisplayName(id: string | undefined | null) { return findAIModel(id)?.shortLabel || id || "IA"; }
export function providerOfModel(_id: string): AIProvider { return "openrouter"; }
