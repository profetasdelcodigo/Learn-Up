// ── Unsplash (Búsqueda de Imágenes) ──────────────────────────────────────────
// Se ejecuta en servidor: la clave nunca debe exponerse al navegador.
export async function searchImagesUnsplash(query: string, count: number = 3) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) throw new Error("Falta UNSPLASH_ACCESS_KEY");

  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(Math.min(Math.max(count, 1), 8)));
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${apiKey}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Unsplash ${res.status}`);

    const data = await res.json();
    const results = data.results || [];
    return results.map((img: any) => ({
      title: img.alt_description || "Imagen de Unsplash",
      url: img.urls?.regular,
      thumb: img.urls?.small,
      credit: `Foto por ${img.user?.name || "Desconocido"} en Unsplash`,
      link: img.links?.html,
      author: img.user?.name || "Desconocido",
    })).filter((img: any) => Boolean(img.url));
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
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 3,
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

    const data = await res.json();
    return {
      answer: data.answer || "",
      results: (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  } catch (error) {
    console.error("Error Tavily:", error);
    return { answer: "", results: [] };
  }
}

// ── Serper (Búsqueda en Google vía Serper API) ──────────────────────────────
export async function searchWebSerper(query: string) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("Falta SERPER_API_KEY");

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 3 }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Serper error: ${res.status}`);

    const data = await res.json();
    return (data.organic || []).map((r: any) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    }));
  } catch (error) {
    console.error("Error Serper:", error);
    return [];
  }
}
