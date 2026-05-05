import { canUseService, incrementUsage } from './api-usage';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

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
      }),
    });

    if (!response.ok) {
      console.error('Tavily API error:', await response.text());
      return [];
    }

    const data = await response.json();
    await incrementUsage('tavily');

    return (data.results || []).map((r: any) => ({
      title: r.title || 'Sin título',
      url: r.url || '',
      snippet: r.content || 'Sin descripción',
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
 */
export async function performWebSearch(query: string, totalResults: number = 5): Promise<string> {
  const canTavily = await canUseService('tavily');
  const canSerper = await canUseService('serper');

  if (!canTavily && !canSerper) {
    console.warn('Límite de búsqueda web alcanzado en ambos servicios.');
    return ''; // No bloquea la IA, simplemente no aporta contexto web.
  }

  const results: SearchResult[] = [];
  
  // Dividir los resultados si ambos están disponibles
  const tavilyMax = canSerper ? Math.floor(totalResults / 2) : totalResults;
  const serperMax = canTavily ? totalResults - tavilyMax : totalResults;

  const searchPromises: Promise<SearchResult[]>[] = [];

  if (canTavily && tavilyMax > 0) searchPromises.push(searchTavily(query, tavilyMax));
  if (canSerper && serperMax > 0) searchPromises.push(searchSerper(query, serperMax));

  const allResponses = await Promise.all(searchPromises);
  
  allResponses.forEach(res => results.push(...res));

  if (results.length === 0) return '';

  let contextString = `\n\n--- RESULTADOS DE BÚSQUEDA WEB PARA: "${query}" ---\n`;
  results.forEach((r, i) => {
    contextString += `[${i + 1}] ${r.title}\n${r.snippet}\nFuente: ${r.url}\n\n`;
  });
  contextString += `--------------------------------------------------\n`;

  return contextString;
}
