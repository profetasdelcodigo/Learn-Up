import { aiRegistry } from "../skills";

const PACK_TO_SKILL: Record<string, string> = {
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

const ALL_PACKS = Object.keys(PACK_TO_SKILL);
const VALID_ROUTES = ["/chat", "/ai/profesor", "/ai/practica", "/ai/consejero", "/ai/recetas"];

function schemaKeys(schema: any): string[] { try { const shape = typeof schema?._def?.shape === "function" ? schema._def.shape() : schema?._def?.shape; return shape && typeof shape === "object" ? Object.keys(shape) : []; } catch { return []; } }

export function getRegistryToolCatalog(activeSkills:string[]=[]):string{
  const packs=activeSkills.length?activeSkills:ALL_PACKS;const ids=new Set(packs.map(p=>PACK_TO_SKILL[p]||p));
  const tools=aiRegistry.getAllSkills().filter(skill=>ids.has(skill.id)).flatMap(skill=>skill.tools);
  const catalog=tools.map(t=>`- ${t.id}: ${t.description}. Parámetros: ${schemaKeys(t.schema).join(", ")||"schema"}. Riesgo: ${t.risk}; ${t.requiresConfirmation?"requiere confirmación":"sin confirmación"}; ${t.supportsAutopilot?"permitida en piloto automático":"no automática"}.`).join("\n");
  return `${catalog}\n- open_url: navegación interna o enlace externo validado. Parámetros: url, title. Solo usa rutas internas válidas o URLs https reales.\nRUTAS INTERNAS VÁLIDAS:\n${VALID_ROUTES.map(r=>`- ${r}`).join("\n")}`;
}

export function normalizeSkillPacks(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((x):x is string=>typeof x==="string"&&x.trim()).map(x=>x.trim()))]:typeof value==="string"?[...new Set(value.split(",").map(x=>x.trim()).filter(Boolean))]:[];}
