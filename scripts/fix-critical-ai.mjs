import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const P = (p) => path.join(root, p);
const files = {
  chat: P("learn-up/src/components/AIChatComponent.tsx"),
  tutor: P("learn-up/src/actions/ai-tutor.ts"),
  registry: P("learn-up/src/lib/ai/agent-registry.ts"),
  runner: P("learn-up/src/lib/ai/agent-runner.ts"),
  parser: P("learn-up/src/lib/ai/tool-parser.ts"),
  jarvis: P("learn-up/src/actions/jarvis.ts"),
  jarvisWidget: P("learn-up/src/components/JarvisGlobalWidget.tsx"),
};

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceFirst(s, regex, replacement, label) {
  if (!regex.test(s)) return s;
  return s.replace(regex, replacement);
}
function insertOnce(s, marker, insertion, label) {
  if (!s.includes(marker) || s.includes(insertion.trim())) return s;
  return s.replace(marker, insertion + "\n" + marker);
}

// ------------------------------------------------------------
// 1) Chat session hydration: never erase an optimistic message
// ------------------------------------------------------------
let chat = read(files.chat);

chat = replaceFirst(chat,
  /  useEffect\(\(\) => \{\n    if \(currentSessionId\) \{[\s\S]*?\n  \}, \[currentSessionId\]\);/m,
`  useEffect(() => {
    if (!currentSessionId) {
      if (!submitInFlight.current) setMessages([]);
      return;
    }
    if (isCreatingSession.current) {
      isCreatingSession.current = false;
      return;
    }
    if (submitInFlight.current) return;
    void loadSessionMessages(currentSessionId);
  }, [currentSessionId]);`,
  "session effect");

chat = replaceFirst(chat,
  /  const loadSessionMessages = async \(sessionId: string\) => \{[\s\S]*?\n  \};/m,
`  const loadSessionMessages = async (sessionId: string) => {
    setLoading(true);
    try {
      const durable = await getAiMessages(sessionId);
      setMessages((prev) => {
        const pending = prev.filter((m) =>
          m.clientMessageId &&
          (m.status === "sending" || m.status === "streaming" || m.status === "tool_pending" || m.status === "tool_running")
        );
        const durableIds = new Set(durable.map((m: any) => m.id).filter(Boolean));
        const durableClientIds = new Set(durable.map((m: any) => m.clientMessageId).filter(Boolean));
        const merged = durable.filter((m: any) => !pending.some((p) => p.id === m.id || (p.clientMessageId && p.clientMessageId === m.clientMessageId)));
        return [...merged, ...pending.filter((p) => !durableIds.has(p.id) && !durableClientIds.has(p.clientMessageId))];
      });
    } catch (error) {
      console.error("[CHAT] Error cargando historial:", error);
    } finally {
      setLoading(false);
    }
  };`,
  "history loader");

// Keep the user's optimistic attachment visible and durable before any slow indexing work.
if (!chat.includes("const mediaMessageSaved = await addAiMessage")) {
  const anchor = `    let mediaUrl: string | undefined;`;
  if (chat.includes(anchor)) {
    chat = chat.replace(anchor, `${anchor}\n    let mediaMessageSaved = false;`);
  }

  const uploadUrlMarker = `        mediaUrl = data.publicUrl;`;
  if (chat.includes(uploadUrlMarker)) {
    chat = chat.replace(uploadUrlMarker, `${uploadUrlMarker}\n\n        // CRITICAL: persist the user's attachment immediately.\n        // Indexing/OCR/embeddings are secondary and must never make the chat message disappear.\n        const mediaMessage = await addAiMessage(\n          sessionId,\n          "user",\n          userMessage,\n          mediaUrl,\n          mediaType,\n          undefined,\n          clientMessageId,\n        );\n        if (mediaMessage?.error) throw new Error(mediaMessage.error);\n        mediaMessageSaved = true;\n        setMessages((prev) => prev.map((m) =>\n          m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl, status: "sending" } : m\n        ));`);
  }

  // Make the later normal save idempotent and avoid treating it as the first persistence point.
  const normalSave = `      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n      messagePersisted = true;`;
  if (chat.includes(normalSave)) {
    chat = chat.replace(normalSave,
`      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);
      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);
      mediaMessageSaved = true;
      messagePersisted = true;`);
  }
}

// If the old index block still sits before the message persistence, make failures non-destructive.
chat = chat.replace(
  /        const indexResult = await indexAiDocumentFromUrl\([\s\S]*?\n        if \(!indexResult\.success\) \{[\s\S]*?\n        \}\n\n        setMessages\(\(prev\) =>\s*prev\.map\(m => m\.clientMessageId === clientMessageId \? \{ \.\.\.m, media_url: mediaUrl \} : m\)\);/m,
  `        try {
          const indexResult = await indexAiDocumentFromUrl({
            title: backupFile.name,
            url: mediaUrl,
            mimeType: backupFile.type,
            sessionId,
          });
          if (!indexResult.success) console.warn("[MEDIA] Indexación omitida:", indexResult.error);
        } catch (indexError) {
          console.warn("[MEDIA] Indexación falló después de persistir el mensaje:", indexError);
        }

        setMessages((prev) => prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl, status: "sending" } : m
        ));`,
);

// Ensure file/indexing failure never removes a message that has already been persisted.
if (!chat.includes('if (!messagePersisted) {')) {
  chat = chat.replace(
    `      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));`,
`      if (!messagePersisted) {
        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      } else {
        setMessages((prev) => prev.map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m));
      }`,
  );
}

// Pass autopilot state into server action.
if (!chat.includes("        isAutonomous\n      );")) {
  chat = chat.replace(
    /        selectedModel,\n        sessionId\n      \);/m,
    `        selectedModel,
        sessionId,
        isAutonomous
      );`,
  );
}

write(files.chat, chat);

// ------------------------------------------------------------
// 2) Skills: resolve /calendar_pack etc. to actual tool names
// ------------------------------------------------------------
const skillMapFile = P("learn-up/src/lib/ai/skill-pack-tools.ts");
if (!fs.existsSync(skillMapFile)) {
  write(skillMapFile, `export const SKILL_PACK_TOOLS: Record<string, string[]> = {
  calendar_pack: ["add_calendar_event","read_calendar_events","update_calendar_event","delete_calendar_event","search_calendar_events","add_habit","update_habit","complete_habit_entry","undo_habit_entry","delete_habit","archive_habit","read_habit_tracker","view_habit_stats","suggest_weekly_plan","export_calendar_ics","create_shared_calendar","add_shared_calendar_member","add_shared_event","read_shared_events","delete_shared_event","send_shared_message","read_shared_chat","delete_shared_message","leave_shared_calendar","view_shared_members","notify_habit_progress","remind_shared_event"],
  chat_pack: ["send_message","read_unread_messages","read_full_conversation","create_study_group","add_group_member","view_group_members","edit_group_info","leave_group","search_user_by_name","edit_sent_message","delete_sent_message","broadcast_message","pin_important_message","react_with_emoji","mute_chat_notifications","report_chat_message","upload_chat_media","schedule_message","create_chat_poll","mention_user","search_chat_history","start_video_call","share_library_material","check_read_receipts","clear_chat_history"],
  library_pack: ["search_library","search_documents","query_repositories","view_own_library_items","delete_own_library_item","list_indexed_documents","delete_indexed_document","summarize_document","extract_questions_from_doc","cite_source","index_url_as_document","analyze_source_credibility","compare_two_documents","generate_table_of_contents","extract_text_from_image","generate_study_guide_from_docs","search_material_by_subject","share_document_with_friend","download_document_as_pdf","create_thematic_collection","translate_document","highlight_important_sections"],
  learning_pack: ["save_learned_concept","search_knowledge_graph","view_related_concepts","create_learning_path","detect_knowledge_gaps","spaced_repetition_review","generate_concept_map","view_progress_by_subject","connect_two_concepts","import_concepts_from_document","calculate_mastery_score","suggest_next_topic","generate_analogy","simplify_concept","generate_learning_insights"],
  content_pack: ["generate_document","generate_summary","create_study_plan","generate_presentation_outline","generate_essay","generate_glossary","generate_comparison_table","generate_code","generate_practice_questions","generate_mind_map","generate_bibliography","generate_project_template","generate_timeline","generate_formal_letter","generate_reading_sheet","generate_rubric","generate_research_report","generate_syllabus","generate_flashcards","create_exam","generate_creative_story","generate_debate_arguments"],
  media_pack: ["generate_image","search_image","generate_video","analyze_image","generate_mermaid_diagram","generate_podcast_script","describe_math_image","text_to_speech","transcribe_audio","generate_infographic_layout","generate_color_palette","extract_colors_from_image","resize_image","compress_image","generate_qr_code"],
  research_pack: ["search_web","browse_web_page","advanced_web_search","fact_check","search_wikipedia","compare_multiple_sources","deep_research","search_academic_paper","find_similar_papers","extract_paper_abstract","generate_literature_review","search_youtube_transcripts","search_news","translate_web_page","find_statistics","search_patents","get_stock_data","get_weather"],
  stats_pack: ["view_study_stats","generate_weekly_report","view_exam_history","analyze_strengths_weaknesses","view_habit_streaks","detect_procrastination","generate_academic_dashboard","view_activity_heatmap","analyze_time_distribution","predict_exam_score","calculate_gpa","export_stats_csv","generate_custom_chart","view_learning_velocity"],
  profile_pack: ["update_profile","update_avatar","send_friend_request","accept_friend_request","decline_friend_request","remove_friend","view_friends_list","search_users","view_user_profile","block_user","unblock_user","set_status_message","toggle_privacy_mode","generate_shareable_profile_card","view_badges_and_achievements","pin_achievement_to_profile","link_social_account"],
  edu_pack: ["graph_math_function","verify_calculus_solution","balance_chemical_equation","practice_language_vocabulary","solve_physics_problem","analyze_statistical_data","prepare_standardized_test","solve_programming_challenge","analyze_artwork","explain_scientific_phenomenon","language_speaking_practice","solve_multivariable_equation","review_essay_grammar","generate_historical_context","simulate_socratic_dialogue","explain_code_snippet","translate_ancient_text","identify_rhetorical_devices","generate_music_theory_exercise","simulate_business_case"],
};

export function resolveSkillPackTools(packs: string[]): string[] {
  return [...new Set(packs.flatMap((pack) => SKILL_PACK_TOOLS[pack] || []))];
}
`);
}

let tutor = read(files.tutor);
if (!tutor.includes('resolveSkillPackTools')) {
  tutor = tutor.replace(
    `import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";`,
    `import { buildAgentSystemPrompt } from "@/lib/ai/agent-registry";\nimport { resolveSkillPackTools } from "@/lib/ai/skill-pack-tools";`,
  );
}
tutor = tutor.replace(
  /const toolDefs = `\\n\$\{getToolDefinitions\(activeSkills\)\}`;/,
  `const selectedToolNames = resolveSkillPackTools(activeSkills);\n    const toolDefs = ` + "`\\n\\${getToolDefinitions(selectedToolNames)}`" + `;`,
);
write(files.tutor, tutor);

// ------------------------------------------------------------
// 3) Registry: eliminate textual tool protocol and expose panels
// ------------------------------------------------------------
let registry = read(files.registry);
registry = registry.replace(
  /Si necesitas usar una herramienta \(tool\), DEBES responder EXCLUSIVAMENTE con un bloque tool \{\.\.\.\} tal como espera el sistema\./g,
  "Usa llamadas de herramientas estructuradas cuando una acción requiera una tool; nunca expongas el protocolo interno al usuario.",
);
registry = registry.replace(
  /ANTES de generar tu respuesta, DEBES incluir un bloque <thinking>[\s\S]*?NUNCA omitas el bloque <thinking>\./g,
  "Evalúa internamente seguridad y contexto, pero nunca expongas razonamiento interno ni bloques <thinking> al usuario.",
);
write(files.registry, registry);

// ------------------------------------------------------------
// 4) Legacy parser: accept panel tools as first-class tools
// ------------------------------------------------------------
let parser = read(files.parser);
if (!parser.includes('PANEL_TOOL_NAMES')) {
  parser = parser.replace(
    `import { AI_AGENT_REGISTRY } from "./agent-registry";`,
    `import { AI_AGENT_REGISTRY } from "./agent-registry";\nimport { PANEL_TOOL_NAMES } from "./tool-definitions";`,
  );
}
parser = parser.replace(
  `function isKnownTool(toolName: string): boolean {\n  return Boolean(ToolSchemas[toolName]);\n}`,
`function isKnownTool(toolName: string): boolean {
  return Boolean(ToolSchemas[toolName]) || PANEL_TOOL_NAMES.has(toolName);
}`,
);
parser = parser.replace(
  `      const schema = ToolSchemas[toolName];\n      const validation = schema.safeParse(args);\n      if (!validation.success) {\n        console.warn(\`[TOOLS] Argumentos inválidos para \${toolName}\`, validation.error.flatten());\n        continue;\n      }\n      args = validation.data as Record<string, any>;`,
`      const schema = ToolSchemas[toolName];
      if (schema) {
        const validation = schema.safeParse(args);
        if (!validation.success) {
          console.warn(\`[TOOLS] Argumentos inválidos para \${toolName}\`, validation.error.flatten());
          continue;
        }
        args = validation.data as Record<string, any>;
      }`,
);
write(files.parser, parser);

// ------------------------------------------------------------
// 5) Jarvis: use a durable session and the same autopilot policy
// ------------------------------------------------------------
let jarvis = read(files.jarvis);
if (!jarvis.includes('isAutonomous?: boolean')) {
  jarvis = replaceFirst(jarvis,
    /  modelId\?: string,\n\): Promise<\{ response: string; error\?: string; actions\?: ToolAction\[\]; executedActions\?: ToolAction\[\] \}> \{/m,
`  modelId?: string,
  sessionId?: string | null,
  isAutonomous?: boolean,
): Promise<{ response: string; error?: string; actions?: ToolAction[]; executedActions?: ToolAction[] }> {`,
    "jarvis signature");
}
jarvis = jarvis.replace(
  /onFormulaExtracted:[\s\S]*?\n      \}\n    \);/m,
  (m) => m,
);
// Pass runner options if the known block exists.
jarvis = jarvis.replace(
  /\{\n        userId: user\.id,\n      \}/g,
  `{\n        userId: user.id,\n        sessionId,\n        isAutonomous: Boolean(isAutonomous),\n      }`,
);
write(files.jarvis, jarvis);

let widget = read(files.jarvisWidget);
if (!widget.includes('confirmAndExecuteTool')) {
  widget = widget.replace(
    `import { askJarvis } from "@/actions/jarvis";`,
    `import { askJarvis } from "@/actions/jarvis";\nimport { addAiMessage, createAiSession } from "@/actions/ai-history";\nimport { confirmAndExecuteTool } from "@/actions/ai-tutor";`,
  );
}
if (!widget.includes('const [sessionId')) {
  widget = insertOnce(widget,
    `const [messages, setMessages] = useState<JarvisMessage[]>([]);`,
    `const [sessionId, setSessionId] = useState<string | null>(null);\n  const [executingTool, setExecutingTool] = useState(false);`,
    "jarvis session state");
}
write(files.jarvisWidget, widget);

console.log("[fix-critical-ai] idempotent finalization applied");
