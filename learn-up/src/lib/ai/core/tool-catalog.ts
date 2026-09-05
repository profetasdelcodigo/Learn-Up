import { aiRegistry } from "../skills";

const PACK_TO_SKILL: Record<string, string> = {
  calendar_pack: "calendar",
  chat_pack: "chat",
  library_pack: "library",
  learning_pack: "knowledge-graph",
  content_pack: "content",
  media_pack: "multimedia",
  research_pack: "research",
  stats_pack: "analytics",
  profile_pack: "social",
  edu_pack: "education",
};

const ALL_PACKS = Object.keys(PACK_TO_SKILL);
const VALID_ROUTES = [
  "/chat",
  "/ai/profesor",
  "/ai/practica",
  "/ai/consejero",
  "/ai/recetas",
];

function schemaKeys(schema: any): string[] {
  try {
    const shape = typeof schema?._def?.shape === "function" ? schema._def.shape() : schema?._def?.shape;
    return shape && typeof shape === "object" ? Object.keys(shape) : [];
  } catch {
    return [];
  }
}

export function getRegistryToolCatalog(activeSkills: string[] = []): string {
  const packs = activeSkills.length ? activeSkills : ALL_PACKS;
  const skillIds = new Set(packs.map((p) => PACK_TO_SKILL[p] || p));
  const tools = aiRegistry.getAllSkills()
    .filter((skill) => skillIds.has(skill.id))
    .flatMap((skill) => skill.tools);

  const skillCatalog = tools.map((tool) => {
    const keys = schemaKeys(tool.schema);
    const risk = tool.risk;
    const confirmation = tool.requiresConfirmation ? "requiere confirmación del usuario" : "no requiere confirmación";
    const autopilot = tool.supportsAutopilot ? "permitida en piloto automático" : "no permitida automáticamente";
    return `- ${tool.id}: ${tool.description}. Parámetros: ${keys.length ? keys.join(", ") : "objeto según schema"}. Riesgo: ${risk}; ${confirmation}; ${autopilot}.`;
  }).join("\n");

  return `${skillCatalog}\n- open_url: navegación interna o enlace externo validado. Parámetros: url, title. Solo usa rutas internas pertenecientes a la lista válida o URLs https reales.\nRUTAS INTERNAS VÁLIDAS:\n${VALID_ROUTES.map((route) => `- ${route}`).join("\n")}`;
}

export function normalizeSkillPacks(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((x): x is string => typeof x === "string" && x.trim().length > 0))];
  if (typeof value === "string") return [...new Set(value.split(",").map((x) => x.trim()).filter(Boolean))];
  return [];
}
