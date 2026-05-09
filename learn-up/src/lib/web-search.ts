import { canUseService, incrementUsage } from './api-usage';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  image?: string;
}

// ── Clasificador: ¿La pregunta necesita búsqueda web? ────────────────────────
// Evita buscar en internet para saludos, matemáticas, opiniones, etc.
const SKIP_PATTERNS = [
  // Saludos y conversación casual
  /^(hola|hey|buenas|buenos|qué tal|cómo estás|gracias|adiós|chao|bye)/i,
  // Matemáticas puras
  /^(cuánto|cuanto|calcula|resuelve|suma|resta|multiplica|divide)\s+(es|son)?\s*\d/i,
  /^\d+\s*[\+\-\*\/\^]\s*\d+/,
  // Preguntas sobre la IA misma
  /^(quién eres|cómo te llamas|qué eres|eres una ia|eres humano)/i,
  // Peticiones de ayuda genérica
  /^(ayúdame|ayudame|necesito ayuda|explícame|explicame)\s*$/i,
  // Opiniones personales
  /^(qué opinas|qué piensas|te gusta|prefieres)/i,
];

const SEARCH_PATTERNS = [
  // Hechos, datos, definiciones
  /\b(qué es|quién es|quién fue|qué significa|definición de|define)\b/i,
  // Historia y eventos
  /\b(cuándo (fue|ocurrió|pasó|nació|murió)|en qué año|historia de)\b/i,
  // Datos actuales
  /\b(actualmente|hoy en día|en la actualidad|últimas noticias|reciente)\b/i,
  // Investigación
  /\b(investiga|búscame|busca sobre|información sobre|datos sobre|dime sobre)\b/i,
  // Ciencia y educación específica
  /\b(fórmula de|teoría de|ley de|proceso de|cómo funciona)\b/i,
  // Personas, lugares, cosas específicas
  /\b(capital de|presidente de|país|ciudad|planeta|elemento)\b/i,
];

export function shouldSearchWeb(message: string): boolean {
  const trimmed = message.trim();

  // Mensajes muy cortos casi nunca necesitan búsqueda
  if (trimmed.split(/\s+/).length <= 2) return false;

  // Si coincide con un patrón de SKIP, no buscar
  if (SKIP_PATTERNS.some(p => p.test(trimmed))) return false;

  // Si coincide con un patrón de SEARCH, sí buscar
  if (SEARCH_PATTERNS.some(p => p.test(trimmed))) return true;

  // Para el resto, buscar solo si la pregunta parece informativa (>6 palabras y tiene signos de pregunta o palabras clave)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 6 && /\?/.test(trimmed)) return true;
  if (wordCount >= 8) return true; // Preguntas largas probablemente necesitan contexto

  return false;
}

// ── Tavily ────────────────────────────────────────────────────────────────────
export async function searchTavily(query: string, maxResults: number = 3): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
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

    const images = data.images || [];

    return (data.results || []).map((r: any, i: number) => ({
      title: r.title || 'Sin título',
      url: r.url || '',
      snippet: r.content || 'Sin descripción',
      image: images[i] || undefined,
    }));
  } catch (error) {
    console.error('Error fetching Tavily:', error);
    return [];
  }
}

// ── Serper ─────────────────────────────────────────────────────────────────────
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
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
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
    }));
  } catch (error) {
    console.error('Error fetching Serper:', error);
    return [];
  }
}

/**
 * Realiza una búsqueda web inteligente usando Tavily y Serper.
 * Retorna un string formateado para inyectarlo en el LLM.
 * Ahora verifica primero si la pregunta realmente necesita búsqueda.
 */
export async function performWebSearch(query: string, totalResults: number = 5): Promise<string> {
  // Paso 0: ¿Realmente necesitamos buscar?
  if (!shouldSearchWeb(query)) {
    return '';
  }

  const canTavily = await canUseService('tavily');
  const canSerper = await canUseService('serper');

  if (!canTavily && !canSerper) {
    console.warn('Límite de búsqueda web alcanzado en ambos servicios.');
    return '';
  }

  const results: SearchResult[] = [];
  
  const tavilyMax = canSerper ? Math.floor(totalResults / 2) : totalResults;
  const serperMax = canTavily ? totalResults - tavilyMax : totalResults;

  const searchPromises: Promise<SearchResult[]>[] = [];

  if (canTavily && tavilyMax > 0) searchPromises.push(searchTavily(query, tavilyMax));
  if (canSerper && serperMax > 0) searchPromises.push(searchSerper(query, serperMax));

  const allResponses = await Promise.all(searchPromises);
  
  allResponses.forEach(res => results.push(...res));

  if (results.length === 0) return '';

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
