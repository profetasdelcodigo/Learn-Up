import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

// Remove unnecessary elements that clutter the markdown
turndownService.remove(["script", "style", "noscript", "iframe", "nav", "footer", "header", "aside"]);

export async function browseWebPage(url: string): Promise<{ success: boolean; content: string; title: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LearnUpBot/1.0",
      },
    });

    if (!response.ok) {
      return { success: false, content: `Error HTTP: ${response.status} ${response.statusText}`, title: "" };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("title").text().trim() || url;

    // Try to find the main content block
    let mainContent = $("article, main, [role='main'], .post, .content, #content, .article").first();
    
    // Fallback to body if no main semantic tag is found
    if (mainContent.length === 0) {
      mainContent = $("body");
    }

    const markdown = turndownService.turndown(mainContent.html() || "");

    return {
      success: true,
      title,
      content: markdown.slice(0, 15000), // Limit length to avoid blowing up context window
    };
  } catch (error: any) {
    console.error("BrowserAct Error:", error);
    return { success: false, content: error.message || "Unknown error", title: "" };
  }
}
