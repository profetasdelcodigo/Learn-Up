import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";
import { searchTavily } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

const source = (item: any, extra: Record<string, unknown> = {}) => ({
  title: item?.title || item?.name || "Fuente",
  url: item?.url || item?.link || "",
  snippet: item?.snippet || item?.content || "",
  ...extra,
});

async function search(query: string, maxResults = 5) {
  const results = await searchTavily(query, maxResults);
  return (results || []).filter((r: any) => r?.url).map((r: any) => source(r, { provider: "tavily" }));
}

async function openMany(urls: string[]) {
  const unique = [...new Set(urls)].slice(0, 10);
  const settled = await Promise.allSettled(unique.map((url) => browseWebPage(url)));
  return settled.map((item, index) => {
    const url = unique[index];
    if (item.status === "fulfilled" && item.value?.success) {
      return { ok: true, url, title: item.value.title || url, content: item.value.content || "" };
    }
    return { ok: false, url, error: item.status === "rejected" ? String(item.reason) : String(item.value?.content || "No se pudo extraer") };
  });
}

async function deepResearch(topic: string, depth: "basic" | "moderate" | "deep") {
  const queryCount = depth === "basic" ? 2 : depth === "deep" ? 6 : 4;
  const queries = [
    topic,
    `${topic} evidencia fuentes oficiales`,
    `${topic} investigación académica`,
    `${topic} estadísticas datos`,
    `${topic} perspectivas críticas`,
    `${topic} actualidad`,
  ].slice(0, queryCount);
  const batches = await Promise.all(queries.map((q) => search(q, 4)));
  const results = batches.flat();
  const urls = [...new Set(results.map((r: any) => r.url).filter(Boolean))].slice(0, depth === "deep" ? 10 : depth === "moderate" ? 7 : 4);
  const pages = await openMany(urls);
  const successfulPages = pages.filter((p: any) => p.ok);
  return {
    queries,
    sources: results,
    pages: successfulPages.map(({ url, title, content }: any) => ({ url, title, excerpt: content.slice(0, 6000) })),
    failedPages: pages.filter((p: any) => !p.ok),
  };
}

export const searchWebTool: ToolDefinition = {
  id: "search_web", category: "research", description: "Búsqueda web real con fuentes trazables.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(10).default(5) }),
  execute: async ({ query, limit }) => {
    const results = await search(query, limit);
    return { success: results.length > 0, message: results.length ? `Encontré ${results.length} resultados reales.` : "No encontré resultados.", data: { results, sources: results } };
  },
};

export const advancedWebSearchTool: ToolDefinition = {
  id: "advanced_web_search", category: "research", description: "Búsqueda web avanzada con operadores reales.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), site: z.string().optional(), filetype: z.string().optional(), intitle: z.string().optional() }),
  execute: async ({ query, site, filetype, intitle }) => {
    const parts = [query, site ? `site:${site}` : "", filetype ? `filetype:${filetype}` : "", intitle ? `intitle:${intitle}` : ""].filter(Boolean);
    const finalQuery = parts.join(" "); const results = await search(finalQuery, 5);
    return { success: results.length > 0, message: `Búsqueda avanzada ejecutada: ${finalQuery}`, data: { query: finalQuery, results, sources: results } };
  },
};

export const browseWebPageTool: ToolDefinition = {
  id: "browse_web_page", category: "research", description: "Extraer contenido real de una URL.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ url: z.string().url() }), execute: async ({ url }) => { const result = await browseWebPage(url); return result.success ? { success:true, message:`Página extraída: ${url}`, data:{url,title:result.title,content:result.content,sources:[{url,title:result.title}]}} : {success:false,error:String(result.content)}; },
};

export const factCheckTool: ToolDefinition = {
  id: "fact_check", category: "research", description: "Fact-check multi-fuente con evidencia recuperada.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ claim: z.string().min(1) }), execute: async ({ claim }) => {
    const results = await search(`"${claim}" evidencia`, 6); const urls = results.map((r:any)=>r.url); const pages = await openMany(urls);
    const evidence = pages.filter((p:any)=>p.ok).map((p:any)=>({url:p.url,title:p.title,excerpt:p.content.slice(0,4000)}));
    return {success:true,message:`Verifiqué ${evidence.length} fuentes accesibles.`,data:{claim,results,evidence,sources:[...results,...evidence]}};
  },
};

export const searchAcademicPaperTool: ToolDefinition = {
  id: "search_academic_paper", category: "research", description: "Buscar papers reales en Crossref, Semantic Scholar y arXiv.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(10).default(5) }), execute: async ({query,limit}) => {
    const [crossref, semantic, arxiv] = await Promise.allSettled([
      fetch(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`).then(r=>r.json()),
      fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,url,abstract`).then(r=>r.json()),
      fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}`).then(r=>r.text()),
    ]);
    const crossrefItems = crossref.status === "fulfilled" ? (crossref.value?.message?.items || []).map((x:any)=>({title:x.title?.[0],year:x.published?.["date-parts"]?.[0]?.[0],doi:x.DOI,url:x.URL,provider:"Crossref"})) : [];
    const semanticItems = semantic.status === "fulfilled" ? (semantic.value?.data || []).map((x:any)=>({title:x.title,year:x.year,url:x.url,abstract:x.abstract,provider:"Semantic Scholar"})) : [];
    const results = [...crossrefItems,...semanticItems].filter((x:any)=>x.url||x.doi);
    return {success:true,message:`Encontré ${results.length} registros académicos reales.`,data:{results,sources:results.map((r:any)=>({title:r.title,url:r.url || (r.doi ? `https://doi.org/${r.doi}` : "")}))}};
  },
};

export const searchWikipediaTool: ToolDefinition = {
  id: "search_wikipedia", category: "research", description: "Consulta real de Wikipedia.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ topic:z.string().min(1), language:z.string().regex(/^[a-z]{2,3}$/).default("es") }), execute: async ({topic,language}) => {
    const res = await fetch(`https://${language}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topic)}&gsrnamespace=0&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`); const data=await res.json(); const pages=Object.values(data.query?.pages||{}).map((p:any)=>({title:p.title,extract:p.extract,url:`https://${language}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g,"_"))}`,provider:"Wikipedia"})); return {success:pages.length>0,message:`Wikipedia devolvió ${pages.length} resultados.`,data:{results:pages,sources:pages}};
  },
};

export const monitorTopicRealtimeTool: ToolDefinition = {
  id:"monitor_topic_realtime",category:"research",description:"Monitoreo de actualidad mediante búsquedas fechadas.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({topic:z.string().min(1),days:z.number().int().min(1).max(30).default(7)}),execute:async({topic,days})=>{const results=await search(`${topic} noticias últimos ${days} días`,10);return{success:true,message:`Encontré ${results.length} resultados recientes.`,data:{topic,days,results,sources:results}};},
};

export const searchStatisticsDataTool: ToolDefinition = {
  id:"search_statistics_data",category:"research",description:"Localizar estadísticas y datos numéricos en fuentes reales.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({topic:z.string().min(1)}),execute:async({topic})=>{const results=await search(`${topic} estadísticas datos oficiales tabla`,8);return{success:true,message:`Encontré ${results.length} fuentes de datos.`,data:{results,sources:results}};},
};

export const compareSourcesMultipleTool: ToolDefinition = {
  id:"compare_sources_multiple",category:"research",description:"Abrir y comparar múltiples URLs reales en paralelo.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,
  schema:z.object({urls:z.array(z.string().url()).min(2).max(10)}),execute:async({urls})=>{const pages=await openMany(urls);const ok=pages.filter((p:any)=>p.ok);return{success:ok.length>0,message:`Analicé ${ok.length} de ${urls.length} fuentes.`,data:{pages:ok.map((p:any)=>({url:p.url,title:p.title,content:p.content.slice(0,8000)})),failed:pages.filter((p:any)=>!p.ok),sources:ok.map((p:any)=>({url:p.url,title:p.title}))}};},
};

export const searchGithubCodeTool: ToolDefinition = { id:"search_github_code",category:"research",description:"Buscar repositorios y código público en GitHub.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({query:z.string().min(1)}),execute:async({query})=>{const res=await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=8`,{headers:{Accept:"application/vnd.github+json"}});if(!res.ok)return{success:false,error:`GitHub API ${res.status}`};const data=await res.json();const results=(data.items||[]).map((r:any)=>({name:r.full_name,url:r.html_url,description:r.description,stars:r.stargazers_count,language:r.language}));return{success:true,message:`GitHub devolvió ${results.length} repositorios.`,data:{results,sources:results.map((r:any)=>({title:r.name,url:r.url}))}};}};

export const searchOpenEducationTool: ToolDefinition = { id:"search_open_education",category:"research",description:"Localizar recursos educativos abiertos mediante búsqueda web.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({query:z.string().min(1)}),execute:async({query})=>{const results=await search(`${query} site:ocw.mit.edu OR site:openstax.org OR site:khanacademy.org OR site:oercommons.org`,8);return{success:true,message:`Encontré ${results.length} recursos educativos.`,data:{results,sources:results}};}};

export const analyzeSeoTool: ToolDefinition = { id:"analyze_seo",category:"research",description:"Analizar una URL real para señales SEO básicas.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({url:z.string().url()}),execute:async({url})=>{const page=await browseWebPage(url);if(!page.success)return{success:false,error:String(page.content)};const htmlText=page.content||"";return{success:true,message:"Análisis SEO básico realizado sobre el contenido recuperado.",data:{url,title:page.title,contentLength:htmlText.length,wordCount:htmlText.trim().split(/\s+/).filter(Boolean).length,hasHeadings:/^#{1,6}\s/m.test(htmlText),hasLinks:/https?:\/\//i.test(htmlText),source:{url,title:page.title}}};}};

export const searchDoiIsbnTool: ToolDefinition = { id:"search_doi_isbn",category:"research",description:"Recuperar metadatos reales por DOI o ISBN.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({identifier:z.string().min(1)}),execute:async({identifier})=>{const cr=await fetch(`https://api.crossref.org/works/${encodeURIComponent(identifier)}`).catch(()=>null);if(cr?.ok){const d=await cr.json();const m=d.message||{};return{success:true,message:"Metadatos recuperados desde Crossref.",data:{title:m.title?.[0],authors:m.author,published:m.published,container:m["container-title"]?.[0],DOI:m.DOI,url:m.URL,sources:[{title:m.title?.[0],url:m.URL||`https://doi.org/${m.DOI}`}]}}}const ol=await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(identifier)}.json`).catch(()=>null);if(ol?.ok){const d=await ol.json();return{success:true,message:"Metadatos recuperados desde OpenLibrary.",data:{title:d.title,authors:d.authors,publish_date:d.publish_date,isbn:identifier,sources:[{title:d.title,url:`https://openlibrary.org/isbn/${identifier}`}]}}}return{success:false,error:"No se encontraron metadatos verificables para el identificador."};}};

export const deepResearchMultiSourceTool: ToolDefinition = { id:"deep_research_multi_source",category:"research",description:"Investigación profunda real con múltiples consultas y páginas.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({topic:z.string().min(1),depth:z.enum(["basic","moderate","deep"]).default("moderate")}),execute:async({topic,depth})=>{const data=await deepResearch(topic,depth);return{success:data.sources.length>0,message:`Investigación multi-fuente: ${data.queries.length} consultas, ${data.pages.length} páginas extraídas.`,data:{...data,sources:[...data.sources,...data.pages.map((p:any)=>({title:p.title,url:p.url}))]}};}};

export const searchScientificImagesTool: ToolDefinition = { id:"search_scientific_images",category:"research",description:"Buscar imágenes científicas educativas con fuentes reales.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({query:z.string().min(1)}),execute:async({query})=>{const results=await search(`${query} scientific diagram infographic Wikimedia Commons Unsplash`,8);return{success:true,message:`Encontré ${results.length} recursos visuales.`,data:{results,sources:results}};}};

export const analyzeSearchTrendsTool: ToolDefinition = { id:"analyze_search_trends",category:"research",description:"Analizar señales de tendencia mediante resultados web actuales.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({topic:z.string().min(1)}),execute:async({topic})=>{const [a,b,c]=await Promise.all([search(`${topic} 2026`,5),search(`${topic} tendencias`,5),search(`${topic} actualidad`,5)]);return{success:true,message:"Señales de tendencia recopiladas desde búsquedas actuales.",data:{topic,queries:["año actual","tendencias","actualidad"],results:[...a,...b,...c],sources:[...a,...b,...c]}};}};

export const searchLegislationTool: ToolDefinition = { id:"search_legislation",category:"research",description:"Buscar legislación y normas en fuentes oficiales mediante búsqueda web.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({query:z.string().min(1),country:z.string().optional()}),execute:async({query,country})=>{const results=await search(`${query} ${country||""} ley decreto norma sitio oficial`,8);return{success:true,message:`Encontré ${results.length} posibles fuentes normativas.`,data:{results,sources:results}};}};

export const createBibliographyFromSearchTool: ToolDefinition = { id:"create_bibliography_from_search",category:"research",description:"Buscar fuentes reales y devolver bibliografía con URLs recuperadas.",risk:"read",requiresConfirmation:false,supportsAutopilot:true,schema:z.object({topic:z.string().min(1),count:z.number().int().min(1).max(10).default(5)}),execute:async({topic,count})=>{const results=await search(topic,count);const bibliography=results.map((r:any,i:number)=>({index:i+1,title:r.title,url:r.url,publisher:new URL(r.url).hostname}));return{success:true,message:`Bibliografía construida con ${bibliography.length} fuentes reales.`,data:{bibliography,sources:results}};}};

export const researchSkill: Skill = { id:"research",name:"Investigación",category:"research",description:"Investigación multi-fuente, búsqueda web, papers, legislación y fuentes trazables.",tools:[searchWebTool,advancedWebSearchTool,browseWebPageTool,factCheckTool,searchAcademicPaperTool,searchWikipediaTool,monitorTopicRealtimeTool,searchStatisticsDataTool,compareSourcesMultipleTool,searchGithubCodeTool,searchOpenEducationTool,analyzeSeoTool,searchDoiIsbnTool,deepResearchMultiSourceTool,searchScientificImagesTool,analyzeSearchTrendsTool,searchLegislationTool,createBibliographyFromSearchTool]};
