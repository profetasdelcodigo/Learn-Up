import { getAICompletion, AI_MODELS } from "@/lib/ai";
import { searchTavily } from "@/lib/web-search";
import { browseWebPage } from "@/lib/browser-act";

const RESEARCH_TOOLS = new Set([
  "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_wikipedia",
  "compare_multiple_sources", "deep_research", "search_academic_paper", "find_similar_papers",
  "extract_paper_abstract", "generate_literature_review", "search_youtube_transcripts", "search_news",
  "translate_web_page", "find_statistics", "search_github_code", "search_open_education",
  "analyze_seo", "search_doi_isbn", "deep_research_multi_source", "search_scientific_images",
  "analyze_search_trends", "search_legislation", "create_bibliography_from_search",
]);

const NON_MATERIALIZABLE_EFFECT_TOOLS = new Set([
  "add_calendar_event", "update_calendar_event", "delete_calendar_event", "add_habit", "update_habit",
  "complete_habit_entry", "undo_habit_entry", "delete_habit", "archive_habit", "create_shared_calendar",
  "add_shared_calendar_member", "add_shared_event", "delete_shared_event", "send_shared_message",
  "delete_shared_message", "leave_shared_calendar", "send_message", "create_study_group", "add_group_member",
  "leave_group", "delete_sent_message", "broadcast_message", "update_profile", "send_friend_request",
  "accept_pending_requests", "cancel_friend_request", "remove_friend", "block_user", "unblock_user",
  "delete_account", "pause_account", "add_advisor_goal", "complete_advisor_goal", "log_advisor_mood",
  "add_advisor_journal_entry", "save_nutrition_recipe", "add_nutrition_shopping_item", "set_nutrition_week_plan",
  "generate_image", "generate_video", "text_to_speech", "sync_google_drive", "export_to_google_drive",
  "sync_notion", "export_to_notion", "create_github_repo", "create_zoom_meeting", "send_slack_message",
  "send_discord_webhook", "submit_canvas_assignment", "create_trello_card", "play_study_music",
]);

function looksDelegatedOrFake(result: any): boolean {
  const message = String(result?.message || "").toLowerCase();
  const data = result?.data;
  return Boolean(
    result?.success &&
      (data?.instruction ||
        message.includes("delegad") ||
        message.includes("simulad") ||
        message.includes("próxima actualización") ||
        message.includes("proxima actualizacion") ||
        message.includes("directiva")),
  );
}

function mergeSources(original: any, generated: any) {
  const candidates = [original?.sources, original?.results, original?.pages, generated?.sources]
    .filter(Array.isArray)
    .flat()
    .filter((item: any) => item && typeof item.url === "string" && /^https?:\/\//i.test(item.url));
  return [...new Map(candidates.map((item: any) => [item.url, { title: item.title || item.name || item.url, url: item.url, provider: item.provider }])).values()];
}

async function materializeInstructionResult(result: any, toolName: string, args: Record<string, unknown>) {
  const data = result?.data || {};
  const instruction = String(data.instruction || "").trim();
  if (!instruction) return null;

  const context = [
    `Herramienta: ${toolName}`,
    `Solicitud/argumentos: ${JSON.stringify(args || {})}`,
    `Instrucción operativa de la skill: ${instruction}`,
    data.content ? `Contenido recuperado para trabajar:\n${String(data.content).slice(0, 16000)}` : "",
    data.chatLog ? `Historial recuperado:\n${String(data.chatLog).slice(0, 16000)}` : "",
    data.habits ? `Hábitos reales:\n${JSON.stringify(data.habits).slice(0, 12000)}` : "",
    data.events ? `Eventos reales:\n${JSON.stringify(data.events).slice(0, 12000)}` : "",
    "Ejecuta la instrucción como tarea final. Usa únicamente los datos proporcionados. No inventes información ausente. Devuelve el resultado útil para el estudiante, sin mencionar esta instrucción interna ni herramientas.",
  ].filter(Boolean).join("\n\n");

  const completion = await getAICompletion([{ role: "user", content: context }], AI_MODELS.geminiFast);
  const generated = completion?.choices?.[0]?.message?.content;
  if (typeof generated !== "string" || !generated.trim()) {
    return { success: false, error: `La skill ${toolName} devolvió una instrucción, pero no pudo materializarse en un resultado.` };
  }

  const sources = mergeSources(data, { sources: data.sources });
  return {
    success: true,
    message: result.message && !/delegad|directiva|simulad/i.test(String(result.message))
      ? String(result.message)
      : `Resultado de ${toolName} generado a partir de datos reales.`,
    data: {
      content: generated.trim(),
      ...(sources.length ? { sources } : {}),
      provider: "gemini",
      materializedFromSkill: toolName,
    },
  };
}

async function materializeResearchReport(args: Record<string, unknown>) {
  const topic = String(args.topic || "").trim();
  if (!topic) return { success: false, error: "Falta el tema del reporte de investigación." };

  try {
    const results = await searchTavily(topic, 8);
    const sources = (results || [])
      .filter((result: any) => result?.url)
      .slice(0, 8)
      .map((result: any) => ({ title: result.title || result.url, url: result.url, snippet: result.content || result.snippet || "", provider: "tavily" }));
    if (!sources.length) return { success: false, error: "No se encontraron fuentes web verificables para generar el reporte." };

    const pages = await Promise.allSettled(sources.map((source: any) => browseWebPage(source.url)));
    const evidence = pages
      .map((page: any, index: number) => page.status === "fulfilled" && page.value?.success ? {
        title: page.value.title || sources[index].title,
        url: sources[index].url,
        content: String(page.value.content || "").slice(0, 7000),
      } : null)
      .filter(Boolean);
    if (!evidence.length) return { success: false, error: "Se encontraron resultados, pero ninguna fuente pudo ser extraída de forma verificable.", data: { sources } };

    const prompt = `Redacta un reporte de investigación sobre "${topic}" usando exclusivamente la evidencia proporcionada. No inventes fuentes, autores, cifras ni afirmaciones. Cuando algo no esté respaldado, indícalo.\n\nEVIDENCIA:\n${JSON.stringify(evidence)}`;
    const completion = await getAICompletion([{ role: "user", content: prompt }], AI_MODELS.geminiFast);
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { success: false, error: "No se pudo generar el reporte a partir de la evidencia recuperada." };

    return { success: true, message: `Reporte generado con ${evidence.length} fuentes extraídas.`, data: { content, sources: evidence.map((item: any) => ({ title: item.title, url: item.url })), evidenceCount: evidence.length } };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error en la investigación del reporte." };
  }
}

export async function materializeToolResult(result: any, toolName?: string, args: Record<string, unknown> = {}) {
  if (!result?.success) return result;
  if (toolName === "generate_research_report") return materializeResearchReport(args);

  if (looksDelegatedOrFake(result)) {
    if (toolName && !NON_MATERIALIZABLE_EFFECT_TOOLS.has(toolName) && result?.data?.instruction) {
      try {
        const materialized = await materializeInstructionResult(result, toolName, args);
        if (materialized) return materialized;
      } catch (error: any) {
        return { success: false, error: error?.message || `No se pudo materializar ${toolName}.` };
      }
    }

    const isResearchTool = Boolean(toolName && RESEARCH_TOOLS.has(toolName));
    return {
      success: false,
      error: isResearchTool
        ? `La herramienta ${toolName} no devolvió evidencia de investigación real.`
        : `La herramienta ${toolName || "solicitada"} no devolvió un resultado ejecutado.`,
    };
  }
  return result;
}
