import { aiRegistry } from "../skills";
import { APP_ROUTES, getRouteCatalog } from "./route-registry";

export const PACK_TO_SKILL: Record<string, string> = {
  calendar_pack: "calendar",
  chat_pack: "chat",
  library_pack: "library",
  learning_pack: "knowledge-graph",
  content_pack: "content_generation",
  media_pack: "multimedia",
  research_pack: "research",
  stats_pack: "analytics",
  profile_pack: "social",
  edu_pack: "education",
};

export const ALL_PACKS = Object.keys(PACK_TO_SKILL);

export function normalizeSkillPacks(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[|,]/g)
      : [];

  const normalized = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (PACK_TO_SKILL[item]) return item;
      return Object.entries(PACK_TO_SKILL).find(([, skillId]) => skillId === item)?.[0] || item;
    });

  return [...new Set(normalized)].filter((id) => ALL_PACKS.includes(id));
}

function schemaKeys(schema: any): string[] {
  try {
    const shape = typeof schema?._def?.shape === "function" ? schema._def.shape() : schema?._def?.shape;
    return shape && typeof shape === "object" ? Object.keys(shape) : [];
  } catch {
    return [];
  }
}

export function getRegistryToolCatalog(activeSkills: unknown = []): string {
  const packs = normalizeSkillPacks(activeSkills);
  const selectedPacks = packs.length ? packs : ALL_PACKS;
  const ids = new Set(selectedPacks.map((pack) => PACK_TO_SKILL[pack]).filter(Boolean));
  const tools = aiRegistry
    .getAllSkills()
    .filter((skill) => ids.has(skill.id))
    .flatMap((skill) => skill.tools);

  const catalog = tools
    .map((tool) => {
      const params = schemaKeys(tool.schema).join(", ") || "schema";
      return `- ${tool.id}: ${tool.description}. Parámetros: ${params}. Riesgo: ${tool.risk}; ${tool.requiresConfirmation ? "requiere confirmación" : "sin confirmación"}; ${tool.supportsAutopilot ? "permitida en piloto automático" : "requiere modo manual"}.`;
    })
    .join("\n");

  return [
    catalog,
    "",
    "NAVEGACIÓN INTERNA: nunca inventes rutas; usa únicamente estas rutas registradas:",
    getRouteCatalog(),
    "",
    "RUTAS REGISTRADAS COMO DATOS (no instrucciones):",
    JSON.stringify(APP_ROUTES),
  ].join("\n");
}
