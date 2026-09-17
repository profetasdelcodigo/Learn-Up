import type { ToolDefinition } from "../core/types";

export type TaskDomain = "calendar" | "research" | "multimedia" | "library" | "education" | "analytics" | "social" | "knowledge" | "content" | "general";

const DOMAIN_PATTERNS: Record<Exclude<TaskDomain, "general">, RegExp[]> = {
  calendar: [/\b(calendario|agenda|agendar|evento|eventos|cita|citas|reuni[oó]n|reuniones|recordatorio|recordatorios|horario|hoy tengo|ma[nñ]ana tengo|esta semana)\b/i],
  research: [/\b(investiga|investigaci[oó]n|investigar|busca informaci[oó]n|buscar informaci[oó]n|fuentes|art[ií]culos?|papers?|noticias?|actualidad|web|internet|estad[ií]sticas externas?|bibliograf[ií]a|compara fuentes|fact.?check)\b/i],
  multimedia: [/\b(imagen|im[aá]genes|foto|fotos|fotograf[ií]a|v[ií]deo|video|audio|voz|transcribe|transcripci[oó]n|genera(?:r)? una imagen|crea(?:r)? una imagen|analiza esta imagen|analizar imagen|mu[eé]strame una imagen|muestra una foto|busca una imagen|buscar una imagen|encuentra una imagen)\b/i],
  library: [/\b(documento|documentos|archivo|archivos|pdf|apuntes|biblioteca|mis archivos|mi biblioteca|sub[ií] un archivo)\b/i],
  education: [/\b(examen|ex[aá]menes|cuestionario|ejercicio|ejercicios|tarea|problema matem[aá]tico|profesor|profesor ia|exp[lí]came|explica|estudiar|repasar|practicar)\b/i],
  analytics: [/\b(progreso|rendimiento|estad[ií]sticas? de mi|analiza mi progreso|analiza mi rendimiento|m[eé]tricas|resumen de actividad|desempe[nñ]o)\b/i],
  social: [/\b(env[ií]a(?:r)? (un )?mensaje|mand[aá](?:r)? (un )?mensaje|escribe(?:le)?|amigo|amigos|grupo|grupos|chat con|solicitud de amistad|notifica(?:r)?)\b/i],
  knowledge: [/\b(concepto|conceptos|guarda esto|memoriza|aprende esto|grafo de conocimiento|conecta conceptos|relaciona conceptos|nodos)\b/i],
  content: [/\b(genera(?:r)? contenido|redacta|escribe(?:me)?|crea(?:r)? un resumen|resumen|guion|presentaci[oó]n|infograf[ií]a|publicaci[oó]n|texto para)\b/i],
};

const TOOL_DOMAIN_PATTERNS: Record<Exclude<TaskDomain, "general">, RegExp[]> = {
  calendar: [/calendar|event|habit|reminder|schedule/i],
  research: [/search_|web|research|paper|news|wikipedia|doi|statistic|legislation|seo/i],
  multimedia: [/image|video|audio|tts|transcrib|mermaid|podcast|thumbnail|avatar|qr_/i],
  library: [/library|document|file|drive|notion|knowledge_repository/i],
  education: [/exam|education|exercise|study|quiz|lesson|practice/i],
  analytics: [/analytic|stat|progress|metric|performance|dashboard/i],
  social: [/message|chat|group|friend|social|notify|shared/i],
  knowledge: [/concept|knowledge|graph|learned/i],
  content: [/content|generate_document|infographic|script|palette/i],
};

function matchesDomain(value: string, domain: TaskDomain): boolean {
  if (domain === "general") return true;
  return TOOL_DOMAIN_PATTERNS[domain].some((pattern) => pattern.test(value));
}

export function inferTaskDomains(text: string): TaskDomain[] {
  const value = String(text || "").trim();
  if (!value) return ["general"];
  const domains = (Object.entries(DOMAIN_PATTERNS) as Array<[Exclude<TaskDomain, "general">, RegExp[]]>)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(value)))
    .map(([domain]) => domain);

  if (!domains.length) return ["general"];

  // An explicit request for a photo/image must be treated as a multimedia
  // task even when the wording also contains research verbs such as
  // "investiga". Otherwise the generic web-search skill can win and the
  // model may hallucinate an image URL instead of using Unsplash.
  const explicitImageIntent = /\b(?:imagen(?:es)?|foto(?:s)?|fotograf[ií]a(?:s)?)\b.*\b(?:de|del|sobre)\b/i.test(value)
    || /\b(?:busca(?:r)?|encuentra|mu[eé]strame|muestra|dame|consigue)\b.*\b(?:imagen(?:es)?|foto(?:s)?|fotograf[ií]a(?:s)?)\b/i.test(value);

  if (explicitImageIntent && domains.includes("multimedia")) {
    return ["multimedia", ...domains.filter((domain) => domain !== "multimedia")];
  }

  return [...new Set(domains)];
}

export function toolMatchesDomains(tool: ToolDefinition, domains: TaskDomain[]): boolean {
  if (domains.includes("general")) return true;

  // First classify from stable identifiers/category. This prevents a tool from
  // being pulled into an unrelated domain merely because its prose description
  // mentions another capability (for example, a calendar tool mentioning a web
  // link or a research tool mentioning a document).
  const identity = `${tool.id} ${tool.category}`;
  const identityMatches = domains.filter((domain) => matchesDomain(identity, domain));
  if (identityMatches.length) return true;

  // Only use the description as a fallback when the identity has no known
  // domain. This keeps discovery useful for legacy tools without allowing prose
  // to override the primary classification.
  const description = String(tool.description || "");
  if (!identity.trim() || !domains.length) return false;
  return domains.some((domain) => matchesDomain(description, domain));
}

export function taskRoutingSummary(text: string): string {
  const domains = inferTaskDomains(text);
  if (domains.includes("general")) return "general (sin una skill especializada obligatoria)";
  return domains.join(", ");
}
