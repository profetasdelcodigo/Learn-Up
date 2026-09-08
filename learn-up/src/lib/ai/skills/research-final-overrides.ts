import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { searchWebStructured } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";
import { AI_MODELS, getAICompletion } from "@/lib/ai";

async function synthesize(prompt: string) {
  const completion = await getAICompletion([{ role: "user", content: prompt }], AI_MODELS.geminiFast.id);
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("El proveedor de IA no devolvió una síntesis válida.");
  return content.trim();
}

async function browseMany(urls: string[], limit = 8) {
  const unique = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))].slice(0, limit);
  const settled = await Promise.allSettled(unique.map((url) => browseWebPage(url)));
  return settled.flatMap((entry, index) => {
    if (entry.status !== "fulfilled" || !entry.value?.success) return [];
    return [{ url: unique[index], title: entry.value.title || unique[index], content: String(entry.value.content || "").slice(0, 9000) }];
  });
}

const searchWebFinal: ToolDefinition = {
  id: "search_web",
  category: "research",
  description: "Búsqueda web real usando los proveedores configurados y devolviendo fuentes trazables.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(10).default(5) }),
  execute: async ({ query, limit }) => {
    const results = await searchWebStructured(query, limit);
    return {
      success: results.length > 0,
      message: results.length ? `Encontré ${results.length} resultados web reales.` : "No encontré resultados web verificables.",
      data: { results, sources: results },
    };
  },
};

const advancedWebSearchFinal: ToolDefinition = {
  id: "advanced_web_search",
  category: "research",
  description: "Búsqueda web avanzada real con operadores de sitio, tipo de archivo y título.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), site: z.string().optional(), filetype: z.string().optional(), intitle: z.string().optional() }),
  execute: async ({ query, site, filetype, intitle }) => {
    const finalQuery = [query, site && `site:${site}`, filetype && `filetype:${filetype}`, intitle && `intitle:${intitle}`].filter(Boolean).join(" ");
    const results = await searchWebStructured(finalQuery, 8);
    return {
      success: results.length > 0,
      message: results.length ? `Búsqueda avanzada realizada: ${finalQuery}` : "No encontré resultados verificables.",
      data: { query: finalQuery, results, sources: results },
    };
  },
};

const deepResearchFinal: ToolDefinition = {
  id: "deep_research",
  category: "research",
  description: "Investigación profunda real con 3, 5 u 8 búsquedas diferenciadas, múltiples fuentes y síntesis trazable.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string().min(1), depth: z.enum(["basic", "moderate", "deep"]).default("moderate") }),
  execute: async ({ topic, depth }) => {
    const searches = depth === "basic" ? 3 : depth === "moderate" ? 5 : 8;
    const focus = [
      "panorama general y conceptos clave",
      "evidencia y datos de fuentes primarias",
      "investigación académica y resultados",
      "perspectivas alternativas y limitaciones",
      "actualidad y desarrollos recientes",
      "casos reales y aplicaciones",
      "contraargumentos, controversias y riesgos",
      "fuentes institucionales y conclusiones comparadas",
    ];
    const gathered: Array<{ query: string; title: string; url: string; content: string; provider: string }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < searches; i += 1) {
      const query = `${topic} ${focus[i]}`.trim();
      const results = await searchWebStructured(query, 6);
      const pages = await browseMany(results.map((result) => result.url), 5);
      const providerByUrl = new Map(results.map((result) => [result.url, result.provider || "web"]));
      for (const page of pages) {
        if (!seen.has(page.url)) {
          seen.add(page.url);
          gathered.push({ ...page, query, provider: providerByUrl.get(page.url) || "web" });
        }
      }
    }
    if (!gathered.length) return { success: false, error: "La investigación no obtuvo evidencia web verificable." };
    const evidence = gathered.slice(0, 40);
    const report = await synthesize(
      [
        `Investiga rigurosamente el tema "${topic}" usando exclusivamente la evidencia web recuperada.`,
        `Se realizaron ${searches} búsquedas diferenciadas.`,
        "Estructura: hallazgos principales; evidencia convergente; discrepancias; perspectivas alternativas; limitaciones; conclusión.",
        "No inventes cifras, autores, fechas, fuentes ni URLs. Señala explícitamente cualquier punto no verificable.",
        "EVIDENCIA:",
        JSON.stringify(evidence),
      ].join("\n\n"),
    );
    return {
      success: true,
      message: `Investigación profunda completada con ${searches} búsquedas y ${evidence.length} fuentes únicas.`,
      data: {
        report,
        searches,
        depth,
        evidenceCount: evidence.length,
        providers: [...new Set(evidence.map((item) => item.provider))],
        sources: evidence.map(({ title, url, query, provider }) => ({ title, url, query, provider })),
      },
    };
  },
};

export function withFinalResearchOverrides(skill: Skill): Skill {
  if (skill.id !== "research") return skill;
  const overrides: Record<string, ToolDefinition> = {
    search_web: searchWebFinal,
    advanced_web_search: advancedWebSearchFinal,
    deep_research: deepResearchFinal,
  };
  return { ...skill, tools: skill.tools.map((tool) => overrides[tool.id] || tool) };
}
