import { canUseService, incrementUsage } from './api-usage';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  image?: string;
  provider?: string;
}

const SKIP_PATTERNS = [
  /^(hola|hey|buenas|buenos|qué tal|cómo estás|gracias|adiós|chao|bye)/i,
  /\b( cuánto| cuanto|calcula|resuelve|suma|resta|multiplica|divide)\s+(es|son)?\s*\d/i,
  /^\d+\s*[\+\-\*\/\^]\s*\d+/,
  /^(quién eres|cómo te llamas|qué eres|eres una ia|eres humano)/i,
  /^(ayúdame|ayudame|necesito ayuda|explícame|explicame)\s*$/i,
  /^(qué opinas|qué piensas|te gusta|prefieres)/i,
];

const SEARCH_PATTERNS = [
  /\b(qué es|quién es|quién fue|qué significa|definición de|define)\b/i,
  /\b(cuándo (fue|ocurrió|pasó|nació|murió)|en qué año|historia de)\b/i,
  /\b(actualmente|hoy en día|en la actualidad|últimas noticias|reciente)\b/i,
  /\b(investiga|búscame|busca sobre|información sobre|datos sobre|dime sobre)\b/i,
  /\b(fórmula de|teoría de|ley de|proceso de|cómo funciona)\b/i,
  /\b(capital de|presidente de|país|ciudad|planeta|elemento)\b/i,
];

export function shouldSearchWeb(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.split(/\s+/).length <= 2) return false;
  if (SKIP_PATTERNS.some((p) => p.test(trimmed))) return false;
  if (SEARCH_PATTERNS.some((p) => p.test(trimmed))) return true;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 6 && /\?/.test(trimmed)) return true;
  if (wordCount >= 8) return true;
  return false;
}

export async function searchTavily(query: string, maxResults: number = 3): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_images: true,
      }),
    });

    if (!response.ok) {
      console.error('Tavily API error:', await response.text());
      return [];
    }

    const data = await response.json();
    await incrementUsage('tavily');
    const images = Array.isArray(data.images) ? data.images : [];

    return (data.results || []).map((r: any, i: number) => ({
      title: r.title || 'Sin título',
      url: r.url || '',
      snippet: r.content || 'Sin descripción',
      image: typeof images[i] === 'string' ? images[i] : images[i]?.url,
      provider: 'tavily',
    }));
  } catch (error) {
    console.error('Error fetching Tavily:', error);
    return [];
  }
}

export async function searchSerper(query: string, maxResults: number = 3): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });

    if (!response.ok) {
      console.error('Serper API error:', await response.text());
      return [];
    }

    const data = await response.json();
    await incrementUsage('serper');
    return (data.organic || []).map((r: any) => ({
      title: r.title || 'Sin título',
      url: r.link || '',
      snippet: r.snippet || 'Sin descripción',
      provider: 'serper',
    }));
  } catch (error) {
    console.error('Error fetching Serper:', error);
    return [];
  }
}

export async function searchWebStructured(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const canTavily = await canUseService('tavily');
  const canSerper = await canUseService('serper');
  if (!canTavily && !canSerper) return [];

  const tavilyMax = canSerper ? Math.max(1, Math.floor(maxResults / 2)) : maxResults;
  const serperMax = canTavily ? Math.max(1, maxResults - tavilyMax) : maxResults;
  const tasks: Promise<SearchResult[]>[] = [];
  if (canTavily) tasks.push(searchTavily(query, tavilyMax));
  if (canSerper) tasks.push(searchSerper(query, serperMax));
  const settled = await Promise.allSettled(tasks);
  const results = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  const unique = new Map<string, SearchResult>();
  for (const result of results) if (result.url && !unique.has(result.url)) unique.set(result.url, result);
  return [...unique.values()].slice(0, maxResults);
}

export async function performWebSearch(query: string, totalResults: number = 5): Promise<string> {
  if (!shouldSearchWeb(query)) return '';
  const results = await searchWebStructured(query, totalResults);
  if (results.length === 0) {
    return '\n\n--- AVISO WEB ---\n[Sistema]: La búsqueda web (Tavily/Serper) falló o demoró demasiado. Por favor, responde sin usar fuentes externas.\n--- FIN AVISO ---\n';
  }

  let contextString = `\n\n--- CONTEXTO WEB ---\n`;
  contextString += `INSTRUCCIONES OBLIGATORIAS:\n`;
  contextString += `1. Si usas información de estas fuentes, DEBES proporcionar el enlace clickable en formato Markdown: [Texto del enlace](URL).\n`;
  contextString += `2. Si hay imágenes relevantes disponibles en el contexto, DEBES incluirlas en tu respuesta usando el formato Markdown: ![Descripción](URL).\n\n`;
  results.forEach((r, i) => {
    contextString += `[Fuente ${i + 1}]: ${r.title}\n${r.snippet}\nEnlace: ${r.url}\n`;
    if (r.image) contextString += `Imagen disponible: ${r.image}\n`;
    contextString += `\n`;
  });
  contextString += `--- FIN DEL CONTEXTO WEB ---\n`;
  return contextString;
}
