import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { browseWebPage } from "@/lib/browser-act";
import { searchTavily } from "@/lib/web-search";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

async function generateFromEvidence(prompt: string) {
  const completion = await getAICompletion([{ role: "user", content: prompt }], AI_MODELS.geminiFast.id);
  const content = completion?.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("El modelo no devolvió una respuesta.");
  return content.trim();
}

async function browseMany(urls: string[], limit = 8) {
  const unique = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))].slice(0, limit);
  const settled = await Promise.allSettled(unique.map((url) => browseWebPage(url)));
  return settled.map((entry, index) => entry.status !== "fulfilled" || !entry.value?.success ? null : { url: unique[index], title: entry.value.title || unique[index], content: String(entry.value.content || "").slice(0, 9000) }).filter(Boolean) as Array<{ url: string; title: string; content: string }>;
}

export const factCheckReal: ToolDefinition = { id: "fact_check", category: "research", description: "Verifica una afirmación usando búsquedas y páginas web reales; devuelve fuentes utilizadas.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ claim: z.string().min(1) }), execute: async ({ claim }) => { const results = await searchTavily(`fact check ${claim}`, 6); const evidence = await browseMany((results || []).map((item: any) => item?.url).filter(Boolean), 5); if (!evidence.length) return { success: false, error: "No se pudo recuperar evidencia web verificable para comprobar la afirmación." }; const verdict = await generateFromEvidence(`Verifica la afirmación siguiente exclusivamente usando la evidencia proporcionada. Da veredicto Verdadero, Falso o Parcial, explica por qué, separa hechos de incertidumbre y no inventes datos. Incluye referencias internas por URL.\n\nAFIRMACIÓN: ${claim}\n\nEVIDENCIA:\n${JSON.stringify(evidence)}`); return { success: true, message: `Afirmación verificada con ${evidence.length} fuentes reales.`, data: { verdict, claim, sources: evidence.map((x) => ({ title: x.title, url: x.url })) } }; } };

export const compareMultipleSourcesReal: ToolDefinition = { id: "compare_multiple_sources", category: "research", description: "Abre varias URLs reales, extrae su contenido y compara sus posiciones con trazabilidad.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ urls: z.array(z.string().url()).min(2).max(12), topic: z.string().optional() }), execute: async ({ urls, topic }) => { const evidence = await browseMany(urls, 12); if (evidence.length < 2) return { success: false, error: `Solo se pudo extraer ${evidence.length} fuente(s); se necesitan al menos 2 para comparar.`, data: { requested: urls } }; const comparison = await generateFromEvidence(`Compara estas fuentes exclusivamente con el contenido recuperado. Tema: ${topic || "no especificado"}. Identifica acuerdos, diferencias, evidencia, limitaciones y posibles sesgos. Nunca cites una URL que no esté en la evidencia.\n\n${JSON.stringify(evidence)}`); return { success: true, message: `Comparación realizada con ${evidence.length} fuentes extraídas.`, data: { comparison, sources: evidence.map((x) => ({ title: x.title, url: x.url })), evidenceCount: evidence.length } }; } };

export const deepResearchReal: ToolDefinition = { id: "deep_research", category: "research", description: "Realiza investigación profunda con 3, 5 u 8 búsquedas web diferenciadas, extracción de fuentes y síntesis trazable.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ topic: z.string().min(1), depth: z.enum(["basic", "moderate", "deep"]).default("moderate") }), execute: async ({ topic, depth }) => {
  const queryCount = depth === "deep" ? 8 : depth === "moderate" ? 5 : 3;
  const focus = [
    "panorama general conceptos clave",
    "evidencia y datos verificables fuentes primarias",
    "investigación académica estudios y resultados",
    "perspectivas alternativas críticas limitaciones",
    "desarrollos recientes actualidad y cambios",
    "casos reales aplicaciones y ejemplos",
    "contraargumentos controversias y riesgos",
    "fuentes institucionales y conclusiones comparadas",
  ];
  const gathered: Array<{ title: string; url: string; content: string; query: string }> = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < queryCount; i += 1) {
    const query = `${topic} ${focus[i]}`.trim();
    const results = await searchTavily(query, 6);
    const urls = (results || []).map((item: any) => item?.url).filter(Boolean);
    const evidence = await browseMany(urls, 5);
    for (const item of evidence) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        gathered.push({ ...item, query });
      }
    }
  }

  if (!gathered.length) return { success: false, error: "La investigación no obtuvo evidencia web verificable." };

  const unique = gathered.slice(0, 40);
  const report = await generateFromEvidence(
    `Realiza una investigación rigurosa sobre "${topic}" usando exclusivamente las fuentes web recuperadas. Se hicieron ${queryCount} búsquedas diferenciadas. Estructura la respuesta en: 1) hallazgos principales, 2) evidencia convergente, 3) discrepancias, 4) perspectivas alternativas, 5) limitaciones de las fuentes, 6) conclusión. Prioriza fuentes primarias e institucionales. No inventes cifras, autores, fechas ni URLs. Señala explícitamente qué afirmaciones no pudieron verificarse.\n\nEVIDENCIA:\n${JSON.stringify(unique)}`,
  );

  return {
    success: true,
    message: `Investigación profunda completada con ${queryCount} búsquedas y ${unique.length} fuentes web únicas.`,
    data: {
      report,
      sources: unique.map((x) => ({ title: x.title, url: x.url, query: x.query })),
      evidenceCount: unique.length,
      searches: queryCount,
      depth,
    },
  };
} };

export const searchAcademicPaperReal: ToolDefinition = { id: "search_academic_paper", category: "research", description: "Busca papers reales en Semantic Scholar y devuelve metadatos verificables.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ query: z.string().min(1), source: z.enum(["semantic_scholar", "crossref", "arxiv"]).default("semantic_scholar") }), execute: async ({ query, source }) => { if (source !== "semantic_scholar") return { success: false, error: `La fuente ${source} no está implementada en este backend; no se simulará.` }; const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=8&fields=title,authors,year,url,abstract,externalIds`; const response = await fetch(apiUrl, { headers: { accept: "application/json" } }); if (!response.ok) throw new Error(`Semantic Scholar ${response.status}: ${await response.text()}`); const payload = await response.json(); const papers = Array.isArray(payload.data) ? payload.data : []; return { success: true, message: `Se encontraron ${papers.length} papers reales.`, data: { papers, sources: [{ title: "Semantic Scholar API", url: apiUrl }] } }; } };

export const findSimilarPapersReal: ToolDefinition = { id: "find_similar_papers", category: "research", description: "Busca papers relacionados mediante la API real de Semantic Scholar.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ paper_id: z.string().min(1), limit: z.number().int().min(1).max(10).default(5) }), execute: async ({ paper_id, limit }) => { const recommendationUrl = `https://api.semanticscholar.org/recommendations/v1/papers/for/${encodeURIComponent(paper_id)}?limit=${limit}&fields=title,authors,year,url,abstract`; const recommendation = await fetch(recommendationUrl, { headers: { accept: "application/json" } }); if (recommendation.ok) { const payload = await recommendation.json(); const papers = Array.isArray(payload?.recommendedPapers) ? payload.recommendedPapers : []; return { success: true, message: `Semantic Scholar devolvió ${papers.length} papers relacionados.`, data: { papers, sources: [{ title: "Semantic Scholar Recommendations API", url: recommendationUrl }] } }; } const fallback = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paper_id)}&limit=${limit}&fields=title,authors,year,url,abstract`, { headers: { accept: "application/json" } }); if (!fallback.ok) throw new Error(`Semantic Scholar ${fallback.status}: ${await fallback.text()}`); const payload = await fallback.json(); const papers = Array.isArray(payload.data) ? payload.data : []; const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(paper_id)}&limit=${limit}`; return { success: true, message: `Se encontraron ${papers.length} resultados relacionados.`, data: { papers, sources: [{ title: "Semantic Scholar Search API", url: searchUrl }] } }; } };

export const literatureReviewReal: ToolDefinition = { id: "generate_literature_review", category: "research", description: "Genera revisión bibliográfica desde papers y evidencia realmente recuperados.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ topic: z.string().min(1), limit: z.number().int().min(3).max(12).default(8) }), execute: async ({ topic, limit }) => { const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=${limit}&fields=title,authors,year,url,abstract,externalIds`; const response = await fetch(apiUrl, { headers: { accept: "application/json" } }); if (!response.ok) throw new Error(`Semantic Scholar ${response.status}: ${await response.text()}`); const payload = await response.json(); const papers = (Array.isArray(payload.data) ? payload.data : []).filter((paper: any) => paper?.title); if (!papers.length) return { success: false, error: "No se encontraron papers verificables para generar la revisión." }; const pages = await browseMany(papers.map((paper: any) => paper.url).filter(Boolean), limit); const evidence = pages.length ? pages : papers.map((paper: any) => ({ title: paper.title, url: paper.url || apiUrl, content: paper.abstract || "" })); const review = await generateFromEvidence(`Escribe una revisión bibliográfica sobre "${topic}" exclusivamente a partir de estos papers/abstracts. Usa solo autores y datos presentes en la evidencia. No inventes referencias. Indica qué fuentes respaldan las ideas principales.\n\n${JSON.stringify(evidence)}`); return { success: true, message: `Revisión bibliográfica generada con ${papers.length} papers recuperados.`, data: { review, paperCount: papers.length, sources: evidence.map((x: any) => ({ title: x.title, url: x.url })), searchSource: { title: "Semantic Scholar API", url: apiUrl } } }; } };

export const youtubeTranscriptReal: ToolDefinition = { id: "search_youtube_transcripts", category: "research", description: "Extrae la transcripción real disponible de un video de YouTube.", risk: "read", requiresConfirmation: false, supportsAutopilot: true, schema: z.object({ video_url: z.string().url() }), execute: async ({ video_url }) => { if (!/youtube\.com|youtu\.be/i.test(video_url)) return { success: false, error: "La URL no pertenece a YouTube." }; const { YoutubeTranscript } = await import("youtube-transcript"); try { const transcript = await YoutubeTranscript.fetchTranscript(video_url); const text = transcript.map((part: any) => part.text).join(" ").trim(); if (!text) return { success: false, error: "El video no tiene una transcripción accesible mediante este proveedor." }; return { success: true, message: "Transcripción real recuperada desde YouTube.", data: { transcript: text, sources: [{ title: "YouTube", url: video_url }], provider: "youtube-transcript" } }; } catch (error: any) { return { success: false, error: error?.message || "No se pudo recuperar la transcripción de YouTube." }; } } };

const overrides: Record<string, ToolDefinition> = { fact_check: factCheckReal, compare_multiple_sources: compareMultipleSourcesReal, deep_research: deepResearchReal, search_academic_paper: searchAcademicPaperReal, find_similar_papers: findSimilarPapersReal, generate_literature_review: literatureReviewReal, search_youtube_transcripts: youtubeTranscriptReal };

export function withRealResearchOverrides(skill: Skill): Skill { return { ...skill, tools: skill.tools.map((tool) => overrides[tool.id] || tool) }; }
