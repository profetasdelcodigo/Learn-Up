import axios from "axios";

// ── Unsplash (Búsqueda de Imágenes) ──────────────────────────────────────────
export async function searchImagesUnsplash(query: string, count: number = 3) {
  const apiKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!apiKey) throw new Error("Falta NEXT_PUBLIC_UNSPLASH_ACCESS_KEY");

  try {
    const res = await axios.get(`https://api.unsplash.com/search/photos`, {
      params: { query, per_page: count, orientation: "landscape" },
      headers: { Authorization: `Client-ID ${apiKey}` }
    });

    const results = res.data.results || [];
    return results.map((img: any) => ({
      title: img.alt_description || "Imagen de Unsplash",
      url: img.urls.regular,
      credit: `Foto por ${img.user.name} en Unsplash`,
      link: img.links.html
    }));
  } catch (error) {
    console.error("Error Unsplash:", error);
    return [];
  }
}

// ── Tavily (Búsqueda Web Optimizada para IA) ───────────────────────────────
export async function searchWebTavily(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Falta TAVILY_API_KEY");

  try {
    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_images: false,
        max_results: 5
      }
    );
    
    return res.data.results.map((r: any) => ({
      title: r.title,
      content: r.content,
      url: r.url
    }));
  } catch (error) {
    console.error("Error Tavily:", error);
    return [];
  }
}

// ── Serper (Búsqueda Clásica de Google) ──────────────────────────────────────
export async function searchGoogleSerper(query: string) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("Falta SERPER_API_KEY");

  try {
    const res = await axios.post(
      "https://google.serper.dev/search",
      JSON.stringify({ q: query, num: 5 }),
      {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        }
      }
    );
    
    return res.data.organic.map((r: any) => ({
      title: r.title,
      content: r.snippet,
      url: r.link
    }));
  } catch (error) {
    console.error("Error Serper:", error);
    return [];
  }
}
