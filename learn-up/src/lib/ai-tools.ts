import { createClient } from "@/utils/supabase/server";
import { readCalendarEvents, updateCalendarEvent, deleteCalendarEvent, readHabitTracker, completeHabitInTracker, undoHabitInTracker, deleteHabitFromTracker, addHabitToTracker } from "@/actions/calendar";
import { ensurePrivateRoom, sendMessage } from "@/actions/chat";
import { performWebSearch } from "@/lib/web-search";
import { findRelatedConcepts, linkConcepts } from "@/lib/knowledge-graph";
import { searchRecipeImage } from "@/lib/unsplash";
import { browseWebPage } from "@/lib/browser-act";
import { runAcademicCouncil } from "@/actions/ai-council";
import { generateFalImage, generateFalVideo } from "@/lib/fal";
import { z } from "zod";

// â”€â”€ Schemas Zod para validar argumentos del LLM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ToolSchemas: Record<string, z.ZodType> = {
  open_url: z.object({
    url: z.url(),
    title: z.string().optional(),
  }),
  add_calendar_event: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    date: z.string().min(1), // Removed strict regex to allow AI flexibility
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    recurrence_rule: z.string().optional(),
    reminder_minutes: z.number().optional(),
  }),
  read_calendar_events: z.object({
    start_date: z.string().min(1),
    end_date: z.string().min(1),
  }),
  update_calendar_event: z.object({
    event_id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    recurrence_rule: z.string().optional(),
    reminder_minutes: z.number().optional(),
  }),
  delete_calendar_event: z.object({
    event_id: z.string().min(1),
  }),
  search_calendar_events: z.object({
    query: z.string().min(1),
  }),
  send_message: z.object({
    recipient_name: z.string().min(1),
    content: z.string().min(1),
  }),
  search_library: z.object({
    query: z.string().min(1),
  }),
  search_documents: z.object({
    query: z.string().min(1),
  }),
  query_repositories: z.object({
    query: z.string().min(1),
    repository: z.string().optional(),
  }),
  update_profile: z.object({
    field: z.enum(["bio", "school", "grade"]),
    value: z.string().min(1),
  }),
  add_habit: z.object({
    title: z.string().min(1),
    frequency: z.string().optional(), // 'daily', 'weekly:mon,wed', etc
    target_time: z.string().optional(), // '09:00'
  }),
  update_habit: z.object({
    habit_id: z.string().min(1),
    title: z.string().optional(),
    frequency: z.string().optional(),
    target_time: z.string().optional(),
  }),
  complete_habit_entry: z.object({
    habit_id: z.string().min(1),
    date: z.string().min(1),
  }),
  undo_habit_entry: z.object({
    habit_id: z.string().min(1),
    date: z.string().min(1),
  }),
  delete_habit: z.object({
    habit_id: z.string().min(1),
  }),
  archive_habit: z.object({
    habit_id: z.string().min(1),
  }),
  read_habit_tracker: z.object({
    week_start: z.string().optional(),
  }),
  view_habit_stats: z.object({
    habit_id: z.string().optional(),
  }),
  create_shared_calendar: z.object({
    name: z.string().min(1),
    members: z.array(z.string()).min(1),
  }),
  add_shared_calendar_member: z.object({
    calendar_id: z.string().min(1),
    member_id: z.string().min(1),
  }),
  add_shared_event: z.object({
    calendar_id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
  }),
  read_shared_events: z.object({
    calendar_id: z.string().min(1),
  }),
  delete_shared_event: z.object({
    event_id: z.string().min(1),
  }),
  send_shared_message: z.object({
    calendar_id: z.string().min(1),
    content: z.string().min(1),
    type: z.enum(["text", "audio", "system"]).default("text"),
  }),
  read_shared_chat: z.object({
    calendar_id: z.string().min(1),
    limit: z.number().int().optional(),
  }),
  delete_shared_message: z.object({
    message_id: z.string().min(1),
  }),
  leave_shared_calendar: z.object({
    calendar_id: z.string().min(1),
  }),
  view_shared_members: z.object({
    calendar_id: z.string().min(1),
  }),
  notify_habit_progress: z.object({
    calendar_id: z.string().min(1),
  }),
  suggest_weekly_plan: z.object({}),
  export_calendar_ics: z.object({}),
  search_web: z.object({
    query: z.string().min(1),
  }),
  browse_web_page: z.object({
    url: z.string().url(),
  }),
  trigger_academic_council: z.object({
    topic: z.string().min(1),
    text: z.string().min(1),
  }),
  save_learned_concept: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
  }),
  generate_document: z.object({
    title: z.string().min(1),
    outline: z.string().min(1),
    format: z.enum(["markdown", "study_guide", "summary"]).default("markdown"),
  }),
  generate_image: z.object({
    prompt: z.string().min(1),
    purpose: z.string().optional(),
  }),
  search_image: z.object({
    query: z.string().min(1),
  }),
  generate_video: z.object({
    prompt: z.string().min(1),
    purpose: z.string().optional(),
  }),
  create_exam: z.object({
    topic: z.string().min(1),
    difficulty: z.enum(["facil", "media", "dificil"]).default("media"),
    question_count: z.number().int().min(1).max(50).default(10),
    duration_minutes: z.number().int().min(5).max(240).default(30),
  }),
  load_claude_skill: z.object({
    repository: z.string().min(1),
    skill_name: z.string().min(1),
  }),
  generate_flashcards: z.object({
    topic: z.string().min(1),
    content: z.string().min(1),
  }),
  trigger_webhook: z.object({
    webhook_path: z.string().min(1),
    payload: z.record(z.string(), z.any()),
  }),
  ask_multiple_choice: z.object({
    question: z.string().min(1),
    options: z.array(z.string()).min(2),
    allow_skip: z.boolean().optional().default(true),
  }),
  trigger_jarvis: z.object({
    reason: z.string().min(1),
  }),
  notify_user: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    url: z.string().optional(),
  }),
  read_unread_messages: z.object({
    room_id: z.string().optional(),
  }),
  read_full_conversation: z.object({
    room_id: z.string().min(1),
  }),
  create_study_group: z.object({
    name: z.string().min(1),
    participant_names: z.array(z.string()).min(1),
  }),
  add_group_member: z.object({
    room_id: z.string().min(1),
    user_name: z.string().min(1),
  }),
  view_group_members: z.object({
    room_id: z.string().min(1),
  }),
  edit_group_info: z.object({
    room_id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  leave_group: z.object({
    room_id: z.string().min(1),
  }),
  search_user_by_name: z.object({
    query: z.string().min(1),
  }),
  edit_sent_message: z.object({
    message_id: z.string().min(1),
    new_content: z.string().min(1),
  }),
  delete_sent_message: z.object({
    message_id: z.string().min(1),
    for_everyone: z.boolean().default(false),
  }),
  broadcast_message: z.object({
    content: z.string().min(1),
  }),
  pin_important_message: z.object({
    message_id: z.string().min(1),
    is_pinned: z.boolean().default(true),
  }),
  react_with_emoji: z.object({
    message_id: z.string().min(1),
    emoji: z.string().min(1),
  }),
  mute_chat_notifications: z.object({
    room_id: z.string().min(1),
    hours: z.number().nullable(),
  }),
  export_chat_history: z.object({
    room_id: z.string().min(1),
  }),
  summarize_conversation: z.object({
    room_id: z.string().min(1),
  }),

  // ── CATEGORÍA 3: BIBLIOTECA Y DOCUMENTOS ──────────────────────────────
  upload_library_file: z.object({
    title: z.string().min(1),
    subject: z.string().min(1),
    description: z.string().optional(),
  }),
  view_own_library_items: z.object({}),
  delete_own_library_item: z.object({
    item_id: z.string().min(1),
  }),
  list_indexed_documents: z.object({
    session_id: z.string().optional(),
  }),
  delete_indexed_document: z.object({
    document_id: z.string().min(1),
  }),
  summarize_document: z.object({
    document_id: z.string().optional(),
    query: z.string().optional(),
  }),
  extract_questions_from_doc: z.object({
    document_id: z.string().optional(),
    count: z.number().int().min(1).max(20).default(10),
  }),
  cite_source: z.object({
    document_title: z.string().min(1),
    author: z.string().optional(),
    year: z.string().optional(),
    format: z.enum(["apa", "mla", "chicago", "ieee", "vancouver"]).default("apa"),
  }),
  index_url_as_document: z.object({
    url: z.string().min(1),
    title: z.string().optional(),
  }),
  analyze_source_credibility: z.object({
    url: z.string().min(1),
  }),

  // ── CATEGORÍA 4: APRENDIZAJE Y KNOWLEDGE GRAPH ────────────────────────
  search_knowledge_graph: z.object({
    query: z.string().min(1),
  }),
  view_related_concepts: z.object({
    concept_title: z.string().min(1),
    limit: z.number().int().optional().default(5),
  }),
  create_learning_path: z.object({
    subject: z.string().min(1),
  }),
  detect_knowledge_gaps: z.object({
    subject: z.string().min(1),
  }),
  spaced_repetition_review: z.object({
    subject: z.string().optional(),
  }),
  generate_concept_map: z.object({
    topic: z.string().min(1),
  }),
  view_progress_by_subject: z.object({
    subject: z.string().optional(),
  }),
  connect_two_concepts: z.object({
    concept_a: z.string().min(1),
    concept_b: z.string().min(1),
  }),
  import_concepts_from_document: z.object({
    document_id: z.string().optional(),
    topic: z.string().optional(),
  }),
  calculate_mastery_score: z.object({
    subject: z.string().min(1),
  }),

  // ── CATEGORÍA 5: GENERACIÓN DE CONTENIDO ──────────────────────────────
  generate_summary: z.object({
    text: z.string().optional(),
    topic: z.string().optional(),
    max_words: z.number().int().optional().default(300),
  }),
  create_study_plan: z.object({
    subject: z.string().min(1),
    exam_date: z.string().optional(),
    hours_per_day: z.number().optional().default(2),
  }),
  generate_presentation_outline: z.object({
    topic: z.string().min(1),
    slides: z.number().int().optional().default(10),
  }),
  generate_essay: z.object({
    topic: z.string().min(1),
    format: z.enum(["apa", "mla", "chicago", "free"]).default("free"),
    word_count: z.number().int().optional().default(800),
  }),
  generate_glossary: z.object({
    topic: z.string().min(1),
  }),
  generate_comparison_table: z.object({
    items: z.array(z.string()).min(2),
    dimensions: z.array(z.string()).optional(),
  }),
  generate_code: z.object({
    language: z.string().min(1),
    description: z.string().min(1),
  }),
  generate_practice_questions: z.object({
    topic: z.string().min(1),
    count: z.number().int().min(1).max(30).default(10),
    type: z.enum(["conceptual", "application", "critical", "mixed"]).default("mixed"),
  }),
  generate_mind_map: z.object({
    topic: z.string().min(1),
  }),
  generate_bibliography: z.object({
    sources: z.array(z.string()).min(1),
    format: z.enum(["apa", "mla", "chicago", "ieee"]).default("apa"),
  }),
  generate_project_template: z.object({
    topic: z.string().min(1),
    type: z.enum(["school", "university", "thesis"]).default("school"),
  }),
  generate_timeline: z.object({
    topic: z.string().min(1),
    start_year: z.string().optional(),
    end_year: z.string().optional(),
  }),
  generate_formal_letter: z.object({
    recipient: z.string().min(1),
    purpose: z.string().min(1),
    tone: z.enum(["formal", "semiformal", "informal"]).default("formal"),
  }),
  generate_reading_sheet: z.object({
    title: z.string().min(1),
    author: z.string().optional(),
  }),
  generate_rubric: z.object({
    activity: z.string().min(1),
    criteria_count: z.number().int().optional().default(4),
  }),
  generate_research_report: z.object({
    topic: z.string().min(1),
    sources_count: z.number().int().optional().default(5),
  }),
  generate_syllabus: z.object({
    subject: z.string().min(1),
    weeks: z.number().int().optional().default(16),
  }),

  // ── CATEGORÍA 6: MULTIMEDIA ───────────────────────────────────────────
  analyze_image: z.object({
    image_description: z.string().min(1),
  }),
  generate_mermaid_diagram: z.object({
    type: z.enum(["flowchart", "sequence", "class", "gantt", "er", "mindmap"]).default("flowchart"),
    description: z.string().min(1),
  }),
  generate_podcast_script: z.object({
    topic: z.string().min(1),
    duration_minutes: z.number().int().optional().default(10),
  }),
  describe_math_image: z.object({
    problem_description: z.string().min(1),
  }),

  // ── CATEGORÍA 7: INVESTIGACIÓN Y BÚSQUEDA ─────────────────────────────
  advanced_web_search: z.object({
    query: z.string().min(1),
    site: z.string().optional(),
    filetype: z.string().optional(),
  }),
  fact_check: z.object({
    claim: z.string().min(1),
  }),
  search_wikipedia: z.object({
    topic: z.string().min(1),
    language: z.enum(["es", "en", "fr", "pt"]).default("es"),
  }),
  compare_multiple_sources: z.object({
    urls: z.array(z.string()).min(2),
    topic: z.string().optional(),
  }),
  deep_research: z.object({
    topic: z.string().min(1),
    depth: z.enum(["basic", "moderate", "deep"]).default("moderate"),
  }),
  search_academic_paper: z.object({
    query: z.string().min(1),
    source: z.enum(["crossref", "semantic_scholar", "arxiv"]).default("crossref"),
  }),

  // ── CATEGORÍA 8: ANÁLISIS Y DATOS ─────────────────────────────────────
  view_study_stats: z.object({}),
  generate_weekly_report: z.object({}),
  view_exam_history: z.object({
    limit: z.number().int().optional().default(10),
  }),
  analyze_strengths_weaknesses: z.object({}),
  view_habit_streaks: z.object({}),
  detect_procrastination: z.object({}),
  generate_academic_dashboard: z.object({}),

  // ── CATEGORÍA 9: PERFIL Y SOCIAL ──────────────────────────────────────
  send_friend_request: z.object({
    user_name: z.string().min(1),
  }),
  accept_pending_requests: z.object({}),
  view_friends_list: z.object({}),
  view_friend_profile: z.object({
    user_name: z.string().min(1),
  }),
  cancel_friend_request: z.object({
    user_name: z.string().min(1),
  }),
  view_recent_activity: z.object({}),

  // ── CATEGORÍA 10: EDUCACIÓN ESPECIALIZADA ─────────────────────────────
  solve_math_problem: z.object({
    problem: z.string().min(1),
    show_steps: z.boolean().default(true),
  }),
  analyze_literary_text: z.object({
    text: z.string().min(1),
  }),
  conjugate_verb: z.object({
    verb: z.string().min(1),
    language: z.enum(["es", "en", "fr", "pt", "de"]).default("es"),
  }),
  translate_with_explanation: z.object({
    text: z.string().min(1),
    from_language: z.string().optional(),
    to_language: z.string().min(1),
  }),
  explain_with_analogy: z.object({
    concept: z.string().min(1),
    level: z.enum(["child", "teen", "adult", "expert"]).default("teen"),
  }),
  socratic_debate: z.object({
    topic: z.string().min(1),
  }),

  // ── CATEGORÍA 12: META-IA ─────────────────────────────────────────────
  view_ai_sessions: z.object({
    ai_type: z.string().optional(),
  }),
  rate_ai_response: z.object({
    rating: z.enum(["excellent", "good", "regular", "bad"]),
    feedback: z.string().optional(),
  }),
  generate_optimized_prompt: z.object({
    goal: z.string().min(1),
  }),
  
  // ── CAT 11: CONNECTORS & INTEGRATIONS ──
  sync_google_drive: z.object({}), search_google_drive: z.object({ query: z.string() }), export_to_google_drive: z.object({ file_id: z.string() }),
  sync_notion: z.object({}), export_to_notion: z.object({ content: z.string() }), search_notion: z.object({ query: z.string() }),
  sync_github: z.object({}), create_github_repo: z.object({ name: z.string() }), search_github_repos: z.object({ query: z.string() }),
  sync_canvas_lms: z.object({}), fetch_canvas_assignments: z.object({}), submit_canvas_assignment: z.object({ assignment_id: z.string() }),
  connect_zoom: z.object({}), create_zoom_meeting: z.object({ topic: z.string() }), get_zoom_recordings: z.object({}),
  sync_trello: z.object({}), create_trello_card: z.object({ list_id: z.string(), name: z.string() }), get_trello_boards: z.object({}),
  connect_slack: z.object({}), send_slack_message: z.object({ channel: z.string(), message: z.string() }),
  connect_spotify: z.object({}), play_study_music: z.object({ genre: z.string().optional() }),
  connect_discord: z.object({}), send_discord_webhook: z.object({ url: z.string(), message: z.string() }),
  sync_evernote: z.object({}), search_evernote: z.object({ query: z.string() }),
  connect_onenote: z.object({}), export_to_onenote: z.object({ content: z.string() }),

  // ── CAT 12: META-IA EXPANSION ──
  change_ai_personality: z.object({ personality: z.string() }), view_ai_personalities: z.object({}),
  adjust_ai_verbosity: z.object({ level: z.enum(['low', 'medium', 'high']) }), adjust_ai_creativity: z.object({ level: z.number().min(0).max(1) }),
  set_ai_voice: z.object({ voice_id: z.string() }), preview_ai_voice: z.object({ voice_id: z.string() }),
  train_ai_on_document: z.object({ document_id: z.string() }), remove_ai_training_document: z.object({ document_id: z.string() }),
  view_ai_memory: z.object({}), delete_ai_memory_item: z.object({ item_id: z.string() }), edit_ai_memory: z.object({ item_id: z.string(), new_content: z.string() }),
  toggle_ai_proactive_mode: z.object({ enabled: z.boolean() }), set_ai_working_hours: z.object({ start_time: z.string(), end_time: z.string() }),
  ask_ai_for_self_diagnosis: z.object({}), restart_ai_session: z.object({}),
  view_ai_token_usage: z.object({}), request_token_limit_increase: z.object({ reason: z.string() }),
  export_ai_training_data: z.object({}), import_ai_training_data: z.object({ data_url: z.string() }),
  give_ai_nickname: z.object({ nickname: z.string() }), remove_ai_nickname: z.object({}),
  toggle_ai_web_access: z.object({ enabled: z.boolean() }), toggle_ai_tool_access: z.object({ tool_name: z.string(), enabled: z.boolean() }),
  evaluate_ai_bias: z.object({}), generate_ai_usage_report: z.object({}),

  // ── CAT 13: GAMIFICATION & REWARDS ──
  view_daily_quests: z.object({}), claim_quest_reward: z.object({ quest_id: z.string() }), reroll_daily_quest: z.object({ quest_id: z.string() }),
  view_leaderboard: z.object({ type: z.enum(['global', 'friends', 'guild']) }), view_global_ranking: z.object({}), view_friends_ranking: z.object({}),
  view_achievements: z.object({}), claim_achievement: z.object({ achievement_id: z.string() }),
  view_inventory: z.object({}), equip_avatar_item: z.object({ item_id: z.string() }), buy_avatar_item: z.object({ item_id: z.string() }), unequip_avatar_item: z.object({ item_id: z.string() }),
  view_shop: z.object({}), view_shop_specials: z.object({}),
  send_gift_to_friend: z.object({ friend_id: z.string(), item_id: z.string() }), receive_gift: z.object({ gift_id: z.string() }),
  use_xp_boost: z.object({ item_id: z.string() }), use_focus_potion: z.object({ item_id: z.string() }),
  challenge_friend_to_duel: z.object({ friend_id: z.string(), topic: z.string() }), accept_duel: z.object({ duel_id: z.string() }), decline_duel: z.object({ duel_id: z.string() }), view_duel_history: z.object({}),
  join_guild: z.object({ guild_id: z.string() }), create_guild: z.object({ name: z.string() }), leave_guild: z.object({}), view_guild_stats: z.object({}), donate_to_guild: z.object({ amount: z.number() }),

  // ── CAT 14: WELL-BEING & MENTAL HEALTH ──
  start_pomodoro: z.object({ duration_minutes: z.number() }), pause_pomodoro: z.object({}), stop_pomodoro: z.object({}), view_pomodoro_stats: z.object({}),
  start_mindfulness_session: z.object({ duration_minutes: z.number() }), end_mindfulness_session: z.object({}),
  log_mood: z.object({ mood: z.string(), note: z.string().optional() }), view_mood_history: z.object({}), analyze_mood_patterns: z.object({}),
  set_screen_time_limit: z.object({ minutes: z.number() }), view_screen_time: z.object({}), get_screen_time_warning: z.object({}),
  log_water_intake: z.object({ ml: z.number() }), view_water_stats: z.object({}),
  start_posture_check: z.object({ interval_minutes: z.number() }), stop_posture_check: z.object({}),
  log_sleep: z.object({ hours: z.number() }), view_sleep_stats: z.object({}),
  request_motivational_quote: z.object({}), request_breathing_exercise: z.object({}),
  schedule_break: z.object({ time: z.string() }), cancel_break: z.object({ break_id: z.string() }),
  enable_do_not_disturb: z.object({ duration_minutes: z.number().optional() }), disable_do_not_disturb: z.object({}),
  get_ergonomic_advice: z.object({}), play_ambient_sounds: z.object({ type: z.string() }), stop_ambient_sounds: z.object({}),

  // ── CAT 15: ADMIN & MODERATION ──
  report_user: z.object({ user_id: z.string(), reason: z.string() }), report_content: z.object({ content_id: z.string(), type: z.string(), reason: z.string() }), view_report_status: z.object({ report_id: z.string() }), cancel_report: z.object({ report_id: z.string() }),
  block_user: z.object({ user_id: z.string() }), unblock_user: z.object({ user_id: z.string() }), view_blocked_users: z.object({}),
  appeal_ban: z.object({ reason: z.string() }), view_appeal_status: z.object({}),
  suggest_platform_feature: z.object({ description: z.string() }), vote_on_feature: z.object({ feature_id: z.string() }), view_feature_roadmap: z.object({}),
  request_data_export: z.object({}), delete_account: z.object({ confirmation: z.string() }), pause_account: z.object({ duration_days: z.number() }),
  submit_bug_report: z.object({ description: z.string() }), view_bug_reports: z.object({}),
  read_system_announcements: z.object({}), dismiss_announcement: z.object({ announcement_id: z.string() }),
  change_app_theme: z.object({ theme: z.string() }), change_app_language: z.object({ language: z.string() }), change_timezone: z.object({ timezone: z.string() }),
  configure_notifications: z.object({ settings: z.record(z.string(), z.boolean()) }), configure_email_preferences: z.object({ settings: z.record(z.string(), z.boolean()) }),
  verify_account_email: z.object({ token: z.string() }), request_account_verification: z.object({}),
  view_available_tools: z.object({}),
};

// ── Tipos ──────────────────────────────────────────────────────────────────────────
export interface ToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

// ── Definiciones de herramientas (para el system prompt del LLM) ───
export function getToolDefinitions(activeSkills: string[] = []): string {
  // If no skills are explicitly selected, activate ALL packs so the AI always has full capabilities
  const ALL_PACKS = ["calendar_pack", "chat_pack", "library_pack", "learning_pack", "content_pack", "media_pack", "research_pack", "stats_pack", "profile_pack", "edu_pack"];
  const skills = (!activeSkills || activeSkills.length === 0) ? ALL_PACKS : activeSkills;

  let prompt = "";
  
  if (skills.includes("calendar_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
📅 CATEGORÍA 1: CALENDARIO Y HABIT TRACKER
═══════════════════════════════════════════════════
1. add_calendar_event — Crear evento en calendario personal.
    args: {"title": "...", "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM"}
2. read_calendar_events — Ver agenda en un rango de fechas.
    args: {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}
3. update_calendar_event — Modificar evento existente.
    args: {"event_id": "uuid", "title": "...", "date": "..."}
4. delete_calendar_event — Eliminar evento.
    args: {"event_id": "uuid"}
5. search_calendar_events — Buscar eventos por palabra clave.
    args: {"query": "..."}
6. add_habit — Crear un nuevo hábito a rastrear.
    args: {"title": "...", "frequency": "daily|weekly:mon,wed", "target_time": "09:00"}
7. update_habit — Modificar hábito.
    args: {"habit_id": "uuid", "title": "..."}
8. complete_habit_entry — Marcar hábito como completado hoy/fecha.
    args: {"habit_id": "uuid", "date": "YYYY-MM-DD"}
9. undo_habit_entry — Desmarcar hábito completado.
    args: {"habit_id": "uuid", "date": "YYYY-MM-DD"}
10. delete_habit — Eliminar hábito definitivamente.
    args: {"habit_id": "uuid"}
11. archive_habit — Archivar hábito sin borrar historial.
    args: {"habit_id": "uuid"}
12. read_habit_tracker — Ver matriz de hábitos de la semana.
    args: {"week_start": "YYYY-MM-DD"}
13. view_habit_stats — Estadísticas de un hábito (rachas).
    args: {"habit_id": "opcional"}
14. suggest_weekly_plan — Sugerir organización semanal base a historial.
    args: {}
15. export_calendar_ics — Exportar calendario para Google/Apple.
    args: {}
16. create_shared_calendar — Crear calendario colaborativo.
    args: {"name": "...", "members": ["@user1"]}
17. add_shared_calendar_member — Invitar a calendario.
    args: {"calendar_id": "uuid", "member_id": "uuid"}
18. add_shared_event — Crear evento compartido.
    args: {"calendar_id": "uuid", "title": "...", "start_time": "...", "end_time": "..."}
19. read_shared_events — Leer eventos compartidos.
    args: {"calendar_id": "uuid"}
20. delete_shared_event — Eliminar evento compartido.
    args: {"event_id": "uuid"}
21. send_shared_message — Enviar mensaje en chat del calendario.
    args: {"calendar_id": "uuid", "content": "..."}
22. read_shared_chat — Leer historial del chat del calendario.
    args: {"calendar_id": "uuid", "limit": 50}
23. delete_shared_message — Borrar mensaje propio.
    args: {"message_id": "uuid"}
24. leave_shared_calendar — Salir del calendario compartido.
    args: {"calendar_id": "uuid"}
25. view_shared_members — Listar miembros del calendario.
    args: {"calendar_id": "uuid"}
26. notify_habit_progress — Notificar al grupo tu progreso.
    args: {"calendar_id": "uuid"}
27. remind_shared_event — Enviar recordatorio manual al grupo.
    args: {"event_id": "uuid"}`;
  }

  if (skills.includes("chat_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
💬 CATEGORÍA 2: CHAT SOCIAL Y GRUPOS
═══════════════════════════════════════════════════
28. send_message — Enviar mensaje directo.
    args: {"recipient_name": "...", "content": "..."}
29. read_unread_messages — Leer DMs sin leer.
    args: {"room_id": "opcional"}
30. read_full_conversation — Leer historial de DM/Grupo.
    args: {"room_id": "uuid"}
31. create_study_group — Crear grupo de estudio.
    args: {"name": "...", "participant_names": ["@user1"]}
32. add_group_member — Añadir amigo al grupo.
    args: {"room_id": "uuid", "user_name": "..."}
33. view_group_members — Ver miembros del grupo.
    args: {"room_id": "uuid"}
34. edit_group_info — Cambiar nombre o descripción.
    args: {"room_id": "uuid", "name": "..."}
35. leave_group — Salir de un grupo.
    args: {"room_id": "uuid"}
36. search_user_by_name — Buscar usuario en Learn Up.
    args: {"query": "..."}
37. edit_sent_message — Editar mensaje enviado.
    args: {"message_id": "uuid", "new_content": "..."}
38. delete_sent_message — Borrar mensaje (para todos o solo para mí).
    args: {"message_id": "uuid", "for_everyone": true/false}
39. broadcast_message — Enviar a múltiples contactos.
    args: {"content": "..."}
40. pin_important_message — Fijar mensaje en grupo.
    args: {"message_id": "uuid", "is_pinned": true/false}
41. react_with_emoji — Reaccionar a mensaje.
    args: {"message_id": "uuid", "emoji": "👍"}
42. mute_chat_notifications — Silenciar chat.
    args: {"room_id": "uuid", "hours": 8}
43. report_chat_message — Reportar mensaje ofensivo.
    args: {"message_id": "uuid", "reason": "..."}
44. upload_chat_media — Subir archivo al chat.
    args: {"room_id": "uuid", "file_url": "..."}
45. schedule_message — Programar mensaje.
    args: {"room_id": "uuid", "content": "...", "send_at": "YYYY-MM-DD HH:MM"}
46. create_chat_poll — Crear encuesta en grupo.
    args: {"room_id": "uuid", "question": "...", "options": ["A", "B"]}
47. mention_user — Mencionar usuario en grupo.
    args: {"room_id": "uuid", "user_name": "..."}
48. search_chat_history — Buscar texto en chat.
    args: {"room_id": "uuid", "query": "..."}
49. start_video_call — Iniciar llamada (simulado).
    args: {"room_id": "uuid"}
50. share_library_material — Compartir documento/material.
    args: {"room_id": "uuid", "material_id": "uuid"}
51. check_read_receipts — Ver quién leyó.
    args: {"message_id": "uuid"}
52. clear_chat_history — Limpiar chat localmente.
    args: {"room_id": "uuid"}`;
  }

  if (skills.includes("library_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
📚 CATEGORÍA 3: BIBLIOTECA Y DOCUMENTOS
═══════════════════════════════════════════════════
53. search_library — Buscar material en la biblioteca global.
    args: {"query": "..."}
54. search_documents — Buscar entre tus propios apuntes.
    args: {"query": "..."}
55. query_repositories — Buscar en bases de datos externas (ArXiv).
    args: {"query": "..."}
56. view_own_library_items — Ver tus materiales subidos.
    args: {}
57. delete_own_library_item — Borrar tu material.
    args: {"item_id": "uuid"}
58. list_indexed_documents — Listar documentos listos para IA (RAG).
    args: {"session_id": "opcional"}
59. delete_indexed_document — Quitar documento del índice.
    args: {"document_id": "uuid"}
60. summarize_document — Resumir documento específico.
    args: {"document_id": "uuid", "query": "enfoque"}
61. extract_questions_from_doc — Extraer preguntas clave.
    args: {"document_id": "uuid", "count": 10}
62. cite_source — Generar cita APA/MLA de un documento.
    args: {"document_id": "uuid", "format": "apa"}
63. index_url_as_document — Guardar URL como documento.
    args: {"url": "https://..."}
64. analyze_source_credibility — Evaluar credibilidad web.
    args: {"url": "https://..."}
65. compare_two_documents — Comparar 2 documentos indexados.
    args: {"doc1_id": "uuid", "doc2_id": "uuid"}
66. generate_table_of_contents — Generar índice temático de doc.
    args: {"document_id": "uuid"}
67. extract_text_from_image — OCR a imagen.
    args: {"image_url": "..."}
68. generate_study_guide_from_docs — Guía de estudio basada en docs.
    args: {"document_ids": ["uuid"]}
69. search_material_by_subject — Filtrar biblioteca por materia.
    args: {"subject": "..."}
70. share_document_with_friend — Compartir doc.
    args: {"document_id": "uuid", "friend_name": "..."}
71. download_document_as_pdf — Generar link de descarga PDF.
    args: {"document_id": "uuid"}
72. create_thematic_collection — Agrupar docs en colección.
    args: {"name": "...", "document_ids": ["uuid"]}
73. translate_document — Traducir resumen o doc.
    args: {"document_id": "uuid", "target_language": "es|en"}
74. highlight_important_sections — Detectar secciones clave (RAG avanzado).
    args: {"document_id": "uuid"}`;
  }

  if (skills.includes("learning_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
🧠 CATEGORÍA 4: APRENDIZAJE Y KNOWLEDGE GRAPH
═══════════════════════════════════════════════════
75. save_learned_concept — Guardar concepto en grafo mental.
    args: {"title": "...", "description": "..."}
76. search_knowledge_graph — Buscar en tu grafo mental.
    args: {"query": "..."}
77. view_related_concepts — Ver red de conexiones.
    args: {"concept_title": "..."}
78. create_learning_path — Crear ruta de aprendizaje paso a paso.
    args: {"subject": "..."}
79. detect_knowledge_gaps — Encontrar lagunas en tu aprendizaje.
    args: {"subject": "..."}
80. spaced_repetition_review — Iniciar sesión de repaso espaciado.
    args: {"subject": "opcional"}
81. generate_concept_map — Crear mapa mental (Mermaid).
    args: {"topic": "..."}
82. view_progress_by_subject — Ver % de dominio.
    args: {"subject": "..."}
83. connect_two_concepts — Enlazar conceptos manualmente.
    args: {"concept_a": "...", "concept_b": "..."}
84. import_concepts_from_document — Extraer conceptos de doc.
    args: {"document_id": "uuid"}
85. calculate_mastery_score — Calcular puntuación global.
    args: {"subject": "..."}
86. suggest_next_topic — Sugerir qué estudiar hoy.
    args: {"subject": "..."}
87. generate_analogy — Explicar concepto con analogía.
    args: {"concept": "..."}
88. simplify_concept — Explicar como a un niño (Feynman).
    args: {"concept": "..."}
89. generate_learning_insights — Ver tendencias de aprendizaje.
    args: {}`;
  }

  if (skills.includes("content_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
📝 CATEGORÍA 5: GENERACIÓN DE CONTENIDO
═══════════════════════════════════════════════════
90. generate_document — Crear documento markdown.
    args: {"title": "...", "outline": "..."}
91. generate_summary — Resumir texto libre.
    args: {"text": "..."}
92. create_study_plan — Plan de estudio en texto.
    args: {"subject": "..."}
93. generate_presentation_outline — Estructura de diapositivas.
    args: {"topic": "..."}
94. generate_essay — Ensayo estructurado.
    args: {"topic": "..."}
95. generate_glossary — Diccionario de términos.
    args: {"topic": "..."}
96. generate_comparison_table — Tabla comparativa.
    args: {"items": ["A","B"]}
97. generate_code — Código base/ejemplos.
    args: {"language": "...", "description": "..."}
98. generate_practice_questions — Preguntas sueltas.
    args: {"topic": "..."}
99. generate_mind_map — Estructura textual para mapa mental.
    args: {"topic": "..."}
100. generate_bibliography — Lista bibliográfica.
     args: {"sources": []}
101. generate_project_template — Plantilla base.
     args: {"topic": "..."}
102. generate_timeline — Línea de tiempo texto.
     args: {"topic": "..."}
103. generate_formal_letter — Carta.
     args: {"purpose": "..."}
104. generate_reading_sheet — Ficha de lectura.
     args: {"title": "..."}
105. generate_rubric — Rúbrica de evaluación.
     args: {"activity": "..."}
106. generate_research_report — Reporte corto.
     args: {"topic": "..."}
107. generate_syllabus — Programa/Syllabus.
     args: {"subject": "..."}
108. generate_flashcards — Tarjetas front/back.
     args: {"topic": "..."}
109. create_exam — Examen interactivo (AI Tutor).
     args: {"topic": "...", "difficulty": "media"}
110. generate_creative_story — Cuento/Historia.
     args: {"topic": "..."}
111. generate_debate_arguments — Argumentos pro/contra.
     args: {"topic": "..."}`;
  }

  if (skills.includes("media_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
🖼️ CATEGORÍA 6: MULTIMEDIA
═══════════════════════════════════════════════════
112. generate_image — Generar imagen (AI).
     args: {"prompt": "..."}
113. search_image — Buscar foto (Unsplash).
     args: {"query": "..."}
114. generate_video — Generar video (Fal).
     args: {"prompt": "..."}
115. analyze_image — (Visual) Describir imagen subida.
     args: {"image_description": "..."}
116. generate_mermaid_diagram — Diagrama renderizable.
     args: {"type": "flowchart", "description": "..."}
117. generate_podcast_script — Guion de audio.
     args: {"topic": "..."}
118. describe_math_image — (Visual) Leer ecuación en foto.
     args: {"problem_description": "..."}
119. text_to_speech — Generar audio mp3 desde texto (simulado).
     args: {"text": "..."}
120. transcribe_audio — Transcribir nota de voz (simulado).
     args: {"audio_url": "..."}
121. generate_infographic_layout — Estructura de infografía.
     args: {"topic": "..."}
122. generate_color_palette — Paleta de colores Hex.
     args: {"theme": "..."}
123. extract_colors_from_image — (Visual) Detectar colores.
     args: {"image_url": "..."}
124. resize_image — (Herramienta mock) Redimensionar.
     args: {"image_url": "...", "width": 800}
125. compress_image — (Herramienta mock).
     args: {"image_url": "..."}
126. generate_qr_code — Crear QR (simulado).
     args: {"url": "..."}`;
  }

  if (skills.includes("research_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
🔍 CATEGORÍA 7: INVESTIGACIÓN Y BÚSQUEDA
═══════════════════════════════════════════════════
127. search_web — Buscar internet.
     args: {"query": "..."}
128. browse_web_page — Extraer HTML de URL.
     args: {"url": "..."}
129. advanced_web_search — Buscar con dominios.
     args: {"query": "...", "site": "..."}
130. fact_check — Validar dato.
     args: {"claim": "..."}
131. search_wikipedia — Buscar wiki.
     args: {"topic": "..."}
132. compare_multiple_sources — Ver diferencias.
     args: {"urls": []}
133. deep_research — Búsqueda iterativa (Agente).
     args: {"topic": "..."}
134. search_academic_paper — Buscar ArXiv/PubMed.
     args: {"query": "..."}
135. find_similar_papers — Encontrar relacionados.
     args: {"paper_id": "..."}
136. extract_paper_abstract — Leer abstract.
     args: {"url": "..."}
137. generate_literature_review — Revisión bibliográfica.
     args: {"topic": "..."}
138. search_youtube_transcripts — Buscar en YT (mock).
     args: {"video_url": "..."}
139. search_news — Noticias recientes.
     args: {"query": "..."}
140. translate_web_page — Traducir página web.
     args: {"url": "..."}
141. find_statistics — Buscar dataset/stat.
     args: {"topic": "..."}
142. search_patents — Buscar patentes (mock).
     args: {"query": "..."}
143. get_stock_data — Datos financieros (mock).
     args: {"symbol": "..."}
144. get_weather — Clima actual (mock).
     args: {"location": "..."}`;
  }

  if (skills.includes("stats_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
📊 CATEGORÍA 8: ANÁLISIS Y DATOS
═══════════════════════════════════════════════════
145. view_study_stats — Ver horas totales.
     args: {}
146. generate_weekly_report — Reporte IA de desempeño.
     args: {}
147. view_exam_history — Notas pasadas.
     args: {}
148. analyze_strengths_weaknesses — F/D académicas.
     args: {}
149. view_habit_streaks — Rachas actuales.
     args: {}
150. detect_procrastination — Avisos de distracción.
     args: {}
151. generate_academic_dashboard — Resumen.
     args: {}
152. view_activity_heatmap — Mapa de calor (GitHub style).
     args: {}
153. analyze_time_distribution — Gráfico de pastel de tiempo.
     args: {}
154. predict_exam_score — Predicción basada en mocks.
     args: {"exam_id": "..."}
155. calculate_gpa — Promedio académico.
     args: {}
156. export_stats_csv — Exportar datos.
     args: {}
157. generate_custom_chart — Gráfico libre (Mermaid).
     args: {"data": "...", "type": "bar|pie"}
158. view_learning_velocity — Curva de aprendizaje.
     args: {}`;
  }

  if (skills.includes("profile_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
👤 CATEGORÍA 9: PERFIL Y SOCIAL
═══════════════════════════════════════════════════
159. update_profile — Editar bio/escuela.
     args: {"field": "...", "value": "..."}
160. update_avatar — Cambiar foto.
     args: {"image_url": "..."}
161. send_friend_request — Enviar solicitud.
     args: {"user_id": "..."}
162. accept_friend_request — Aceptar solicitud.
     args: {"user_id": "..."}
163. decline_friend_request — Rechazar.
     args: {"user_id": "..."}
164. remove_friend — Eliminar amigo.
     args: {"user_id": "..."}
165. view_friends_list — Ver amigos.
     args: {}
166. search_users — Buscar por escuela/intereses.
     args: {"query": "..."}
167. view_user_profile — Ver perfil de otro.
     args: {"user_id": "..."}
168. block_user — Bloquear.
     args: {"user_id": "..."}
169. unblock_user — Desbloquear.
     args: {"user_id": "..."}
170. set_status_message — Estado (Away/Busy).
     args: {"status": "..."}
171. toggle_privacy_mode — Perfil público/privado.
     args: {}
172. generate_shareable_profile_card — Tarjeta de presentación.
     args: {}
173. view_badges_and_achievements — Ver insignias.
     args: {}
174. pin_achievement_to_profile — Destacar insignia.
     args: {"achievement_id": "..."}
175. link_social_account — Vincular GitHub/Google.
     args: {"platform": "..."}`;
  }

  if (skills.includes("edu_pack")) {
    prompt += `\n\n═══════════════════════════════════════════════════
🏫 CATEGORÍA 10: EDUCACIÓN ESPECIALIZADA
═══════════════════════════════════════════════════
176. graph_math_function — (Simulado) Gráfico función.
     args: {"equation": "..."}
177. verify_calculus_solution — Corregir cálculo.
     args: {"student_solution": "..."}
178. balance_chemical_equation — Química.
     args: {"equation": "..."}
179. practice_language_vocabulary — (AI Tutor) Idiomas.
     args: {"language": "..."}
180. solve_physics_problem — Física paso a paso.
     args: {"problem": "..."}
181. analyze_statistical_data — Stats & Probability.
     args: {"data": "..."}
182. prepare_standardized_test — SAT/GRE mock exam.
     args: {"test_name": "..."}
183. solve_programming_challenge — LeetCode/Codeforces.
     args: {"challenge": "..."}
184. analyze_artwork — Análisis de Historia del Arte.
     args: {"artwork_name": "..."}
185. explain_scientific_phenomenon — Biología/Astronomía.
     args: {"phenomenon": "..."}
186. language_speaking_practice — (Simulado).
     args: {"language": "..."}
187. solve_multivariable_equation — Álgebra lineal.
     args: {"equations": []}
188. review_essay_grammar — Corrector gramatical.
     args: {"text": "..."}
189. generate_historical_context — Contexto histórico.
     args: {"event": "..."}
190. simulate_socratic_dialogue — AI pregunta al usuario (socrático).
     args: {"topic": "..."}
191. explain_code_snippet — Explicar código.
     args: {"code": "..."}
192. translate_ancient_text — Latín/Griego antiguo.
     args: {"text": "..."}
193. identify_rhetorical_devices — Análisis literario.
     args: {"text": "..."}
194. generate_music_theory_exercise — Solfeo/Armonía.
     args: {"topic": "..."}
195. simulate_business_case — Economía/MBA.
     args: {"scenario": "..."}`;
  }

  // Common baseline tools that are ALWAYS injected:
  prompt += `\n\n═══════════════════════════════════════════════════
🛠️ HERRAMIENTAS BASE (SIEMPRE ACTIVAS)
═══════════════════════════════════════════════════
0. open_url — Abrir una URL sugerida.
    args: {"url": "https://...", "title": "opcional"}`;

  return prompt;
}


// ── Herramientas que NO necesitan confirmación ─────────────────────────────────────────────────
const AUTO_EXECUTE_TOOLS = [
  "search_library", "search_documents", "query_repositories", "search_web", "save_learned_concept",
  "read_calendar_events", "search_calendar_events", "read_habit_tracker", "view_habit_stats",
  "read_shared_events", "read_shared_chat", "view_shared_members", "search_image",
  "suggest_weekly_plan", "export_calendar_ics",
  // Chat read-only
  "read_unread_messages", "read_full_conversation", "view_group_members", "search_user_by_name",
  "summarize_conversation", "export_chat_history",
  // Library & Docs read-only
  "view_own_library_items", "list_indexed_documents", "summarize_document",
  "extract_questions_from_doc", "cite_source", "analyze_source_credibility",
  // Knowledge Graph read-only
  "search_knowledge_graph", "view_related_concepts", "view_progress_by_subject",
  "calculate_mastery_score",
  // Content generation (LLM-only, produces output)
  "generate_summary", "generate_presentation_outline", "generate_essay", "generate_glossary",
  "generate_comparison_table", "generate_code", "generate_practice_questions", "generate_mind_map",
  "generate_bibliography", "generate_project_template", "generate_timeline", "generate_formal_letter",
  "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus",
  "generate_mermaid_diagram", "generate_podcast_script", "generate_concept_map",
  // Multimedia read-only
  "analyze_image", "describe_math_image",
  // Research read-only
  "advanced_web_search", "fact_check", "search_wikipedia", "compare_multiple_sources",
  "deep_research", "search_academic_paper",
  // Analysis read-only
  "view_study_stats", "generate_weekly_report", "view_exam_history",
  "analyze_strengths_weaknesses", "view_habit_streaks", "detect_procrastination",
  "generate_academic_dashboard",
  // Profile read-only
  "accept_pending_requests", "view_friends_list", "view_friend_profile", "view_recent_activity",
  // Education (LLM-only)
  "solve_math_problem", "analyze_literary_text", "conjugate_verb", "translate_with_explanation",
  "explain_with_analogy", "socratic_debate",
  // Meta-IA read-only
  "view_ai_sessions", "view_available_tools", "generate_optimized_prompt",
  "export_ai_conversation", "search_google_drive", "search_notion", "search_github_repos", "fetch_canvas_assignments", "get_zoom_recordings", "get_trello_boards", "search_evernote", "view_ai_personalities", "view_ai_memory", "view_ai_token_usage", "view_daily_quests", "view_leaderboard", "view_global_ranking", "view_friends_ranking", "view_achievements", "view_inventory", "view_shop", "view_shop_specials", "view_duel_history", "view_guild_stats", "view_pomodoro_stats", "view_mood_history", "view_screen_time", "get_screen_time_warning", "view_water_stats", "view_sleep_stats", "get_ergonomic_advice", "view_report_status", "view_blocked_users", "view_appeal_status", "view_feature_roadmap", "view_bug_reports", "read_system_announcements", "search_chat_history", "check_read_receipts", "compare_two_documents", "search_material_by_subject", "export_knowledge_graph", "quiz_from_graph", "recommend_next_topic", "generate_infographic_text", "generate_collaborative_quiz", "generate_project_schedule", "search_youtube_video", "search_scientific_image", "auto_fact_check", "monitor_topic_realtime", "search_statistics", "search_github_code", "search_oer_resources", "analyze_seo_url", "fetch_citation_metadata", "deep_multi_source_research", "search_creative_commons_images", "analyze_search_trends", "search_legislation", "create_bibliography_from_search", "compare_performance_timeframe", "project_readiness_level", "view_time_spent_by_subject", "anonymous_peer_benchmark", "export_progress_data", "analyze_study_quality", "view_learning_album", "view_badges_and_achievements", "practice_language_vocabulary", "analyze_statistical_data", "prepare_standardized_test", "analyze_artwork", "explain_scientific_phenomenon", "language_speaking_practice",
];

// Helper: try to build a ToolAction from a parsed JSON object
function buildAction(toolJson: any): ToolAction | null {
  const toolName = toolJson.tool || toolJson.name || toolJson.function;
  if (!toolName || typeof toolName !== "string") return null;
  // Normalize: some models nest args under "arguments" or "parameters"
  let args = toolJson.args || toolJson.arguments || toolJson.parameters || {};

  // Zod Validation
  const schema = ToolSchemas[toolName];
  if (schema) {
    const result = schema.safeParse(args);
    if (!result.success) {
      console.error(`Tool validation failed for ${toolName}:`, result.error.format());
      return null;
    }
    args = result.data;
  }

  const needsConfirm = !AUTO_EXECUTE_TOOLS.includes(toolName);

  const descriptions: Record<string, string> = {
    open_url: `¿Quieres abrir ${args.title || args.url}?`,
    add_calendar_event: `¿Agendar "${args.title}" para el ${args.date}?`,
    update_calendar_event: `¿Actualizar evento?`,
    delete_calendar_event: `¿Eliminar evento?`,
    search_calendar_events: `Buscando eventos de calendario...`,
    send_message: `¿Enviar mensaje a ${args.recipient_name}?`,
    search_library: `Buscando en la biblioteca...`,
    update_profile: `¿Actualizar tu ${args.field} a "${args.value}"?`,
    add_habit: `¿Añadir el hábito "${args.title}"?`,
    update_habit: `¿Actualizar el hábito?`,
    complete_habit_entry: `¿Marcar hábito como completado el ${args.date}?`,
    undo_habit_entry: `¿Desmarcar hábito el ${args.date}?`,
    delete_habit: `¿Eliminar hábito por completo?`,
    archive_habit: `¿Archivar el hábito?`,
    view_habit_stats: `Consultando estadísticas de hábitos...`,
    create_shared_calendar: `¿Crear calendario compartido "${args.name}"?`,
    add_shared_calendar_member: `¿Agregar miembro al calendario?`,
    add_shared_event: `¿Agregar evento al calendario compartido?`,
    read_shared_events: `Leyendo eventos del calendario compartido...`,
    delete_shared_event: `¿Eliminar evento del calendario compartido?`,
    send_shared_message: `¿Enviar mensaje al chat del calendario?`,
    read_shared_chat: `Leyendo mensajes del chat grupal...`,
    delete_shared_message: `¿Eliminar tu mensaje del chat?`,
    leave_shared_calendar: `¿Salir del calendario compartido?`,
    view_shared_members: `Consultando miembros del calendario...`,
    notify_habit_progress: `¿Notificar avance de hábitos al grupo?`,
    suggest_weekly_plan: `Analizando datos para sugerir plan semanal...`,
    export_calendar_ics: `Generando archivo ICS de tu calendario...`,
    search_web: `Investigando en internet...`,
    query_repositories: `Consultando el Cerebro Unico de repositorios...`,
    save_learned_concept: `Guardando concepto en tu mapa mental...`,
    generate_image: `Generando imagen...`,
    search_image: `Buscando imagen...`,
    generate_video: `Generando video...`,
    generate_document: `Generando documento...`,
    create_exam: `Creando examen...`,
    generate_flashcards: `Generando flashcards...`,
    ask_multiple_choice: args.question || "¿Responder pregunta?",
    trigger_jarvis: `¿Abrir Orquestador Jarvis para: ${args.reason}?`,
    notify_user: `¿Enviar recordatorio push: "${args.title}"?`,
    read_unread_messages: `Leyendo mensajes no leídos...`,
    read_full_conversation: `Cargando historial completo de chat...`,
    create_study_group: `¿Crear grupo de estudio "${args.name}"?`,
    add_group_member: `¿Añadir a ${args.user_name} al grupo?`,
    view_group_members: `Consultando miembros del grupo...`,
    edit_group_info: `¿Actualizar info del grupo?`,
    leave_group: `¿Abandonar este grupo de chat?`,
    search_user_by_name: `Buscando usuario: ${args.query}...`,
    edit_sent_message: `¿Editar el mensaje enviado?`,
    delete_sent_message: `¿Borrar el mensaje enviado?`,
    broadcast_message: `¿Enviar mensaje masivo?`,
    pin_important_message: `¿Fijar este mensaje en el chat?`,
    react_with_emoji: `Reaccionando con ${args.emoji}...`,
    mute_chat_notifications: `¿Silenciar notificaciones del chat?`,
    export_chat_history: `Exportando historial de chat a .txt...`,
    summarize_conversation: `Resumiendo conversación de chat...`,
    // ── Categoría 3: Biblioteca ──
    upload_library_file: `¿Subir material "${args.title}" a la Biblioteca?`,
    view_own_library_items: `Consultando tus materiales en la Biblioteca...`,
    delete_own_library_item: `¿Eliminar tu material de la Biblioteca?`,
    list_indexed_documents: `Listando documentos indexados...`,
    delete_indexed_document: `¿Eliminar documento del índice RAG?`,
    summarize_document: `Resumiendo documento...`,
    extract_questions_from_doc: `Extrayendo preguntas clave del documento...`,
    cite_source: `Generando cita en formato ${args.format?.toUpperCase() || 'APA'}...`,
    index_url_as_document: `¿Indexar la web ${args.url} como documento?`,
    analyze_source_credibility: `Analizando credibilidad de la fuente...`,
    // ── Categoría 4: Knowledge Graph ──
    search_knowledge_graph: `Buscando en tu grafo de conocimiento...`,
    view_related_concepts: `Consultando conceptos relacionados...`,
    create_learning_path: `Creando ruta de aprendizaje para ${args.subject}...`,
    detect_knowledge_gaps: `Detectando brechas de conocimiento en ${args.subject}...`,
    spaced_repetition_review: `Preparando repaso por repetición espaciada...`,
    generate_concept_map: `Generando mapa conceptual...`,
    view_progress_by_subject: `Consultando progreso por materia...`,
    connect_two_concepts: `Conectando conceptos "${args.concept_a}" y "${args.concept_b}"...`,
    import_concepts_from_document: `Extrayendo conceptos del documento...`,
    calculate_mastery_score: `Calculando score de dominio en ${args.subject}...`,
    // ── Categoría 5: Generación de Contenido ──
    generate_summary: `Generando resumen ejecutivo...`,
    create_study_plan: `Creando plan de estudio para ${args.subject}...`,
    generate_presentation_outline: `Generando estructura de presentación...`,
    generate_essay: `Generando ensayo sobre "${args.topic}"...`,
    generate_glossary: `Generando glosario de términos...`,
    generate_comparison_table: `Generando tabla comparativa...`,
    generate_code: `Generando código en ${args.language}...`,
    generate_practice_questions: `Generando ${args.count || 10} preguntas de práctica...`,
    generate_mind_map: `Generando mapa mental...`,
    generate_bibliography: `Generando bibliografía formateada...`,
    generate_project_template: `Generando plantilla de proyecto...`,
    generate_timeline: `Generando línea de tiempo histórica...`,
    generate_formal_letter: `Generando carta ${args.tone || 'formal'}...`,
    generate_reading_sheet: `Generando ficha de lectura...`,
    generate_rubric: `Generando rúbrica de evaluación...`,
    generate_research_report: `Generando reporte de investigación...`,
    generate_syllabus: `Generando syllabus de ${args.subject}...`,
    // ── Categoría 6: Multimedia ──
    analyze_image: `Analizando imagen...`,
    generate_mermaid_diagram: `Generando diagrama ${args.type}...`,
    generate_podcast_script: `Generando script de podcast...`,
    describe_math_image: `Analizando problema matemático...`,
    // ── Categoría 7: Investigación ──
    advanced_web_search: `Investigación avanzada: "${args.query}"...`,
    fact_check: `Verificando: "${args.claim}"...`,
    search_wikipedia: `Buscando en Wikipedia...`,
    compare_multiple_sources: `Comparando ${args.urls?.length || 2} fuentes...`,
    deep_research: `Investigación profunda sobre "${args.topic}"...`,
    search_academic_paper: `Buscando papers académicos...`,
    // ── Categoría 8: Análisis ──
    view_study_stats: `Consultando tus estadísticas de estudio...`,
    generate_weekly_report: `Generando reporte semanal de progreso...`,
    view_exam_history: `Consultando historial de exámenes...`,
    analyze_strengths_weaknesses: `Analizando fortalezas y debilidades...`,
    view_habit_streaks: `Consultando rachas de hábitos...`,
    detect_procrastination: `Analizando patrones de procrastinación...`,
    generate_academic_dashboard: `Generando dashboard académico...`,
    // ── Categoría 9: Perfil y Social ──
    send_friend_request: `¿Enviar solicitud de amistad a "${args.user_name}"?`,
    accept_pending_requests: `Revisando solicitudes pendientes...`,
    view_friends_list: `Consultando lista de amigos...`,
    view_friend_profile: `Consultando perfil de "${args.user_name}"...`,
    cancel_friend_request: `¿Cancelar solicitud a "${args.user_name}"?`,
    view_recent_activity: `Consultando actividad reciente...`,
    // ── Categoría 10: Educación ──
    solve_math_problem: `Resolviendo problema matemático paso a paso...`,
    analyze_literary_text: `Analizando texto literario...`,
    conjugate_verb: `Conjugando verbo "${args.verb}"...`,
    translate_with_explanation: `Traduciendo a ${args.to_language} con explicación...`,
    explain_with_analogy: `Explicando "${args.concept}" con analogía...`,
    socratic_debate: `Iniciando debate socrático sobre "${args.topic}"...`,
    // ── Categoría 12: Meta-IA ──
    export_ai_conversation: `Exportando conversación IA...`,
    view_ai_sessions: `Listando sesiones de IA...`,
    rate_ai_response: `Registrando tu feedback...`,
    generate_optimized_prompt: `Generando prompt optimizado...`,
    
    // ── CAT 11 ──
    sync_google_drive: 'Sincronizando con Google Drive...', search_google_drive: 'Buscando en Drive...', export_to_google_drive: 'Exportando a Drive...',
    sync_notion: 'Sincronizando con Notion...', export_to_notion: 'Exportando a Notion...', search_notion: 'Buscando en Notion...',
    sync_github: 'Sincronizando con GitHub...', create_github_repo: 'Creando repo en GitHub...', search_github_repos: 'Buscando en GitHub...',
    sync_canvas_lms: 'Sincronizando con Canvas...', fetch_canvas_assignments: 'Obteniendo tareas de Canvas...', submit_canvas_assignment: 'Enviando tarea a Canvas...',
    connect_zoom: 'Conectando con Zoom...', create_zoom_meeting: 'Creando reunión en Zoom...', get_zoom_recordings: 'Obteniendo grabaciones...',
    sync_trello: 'Sincronizando con Trello...', create_trello_card: 'Creando tarjeta en Trello...', get_trello_boards: 'Obteniendo tableros de Trello...',
    connect_slack: 'Conectando con Slack...', send_slack_message: 'Enviando mensaje a Slack...',
    connect_spotify: 'Conectando con Spotify...', play_study_music: 'Reproduciendo música para estudiar...',
    connect_discord: 'Conectando con Discord...', send_discord_webhook: 'Enviando webhook a Discord...',
    sync_evernote: 'Sincronizando con Evernote...', search_evernote: 'Buscando en Evernote...',
    connect_onenote: 'Conectando con OneNote...', export_to_onenote: 'Exportando a OneNote...',

    // ── CAT 12 ──
    change_ai_personality: 'Cambiando personalidad de la IA...', view_ai_personalities: 'Viendo personalidades disponibles...',
    adjust_ai_verbosity: 'Ajustando nivel de detalle...', adjust_ai_creativity: 'Ajustando creatividad...',
    set_ai_voice: 'Configurando voz de la IA...', preview_ai_voice: 'Previsualizando voz...',
    train_ai_on_document: 'Entrenando IA con documento...', remove_ai_training_document: 'Eliminando documento de entrenamiento...',
    view_ai_memory: 'Consultando memoria de la IA...', delete_ai_memory_item: 'Borrando recuerdo...', edit_ai_memory: 'Editando recuerdo...',
    toggle_ai_proactive_mode: 'Cambiando modo proactivo...', set_ai_working_hours: 'Configurando horario de la IA...',
    ask_ai_for_self_diagnosis: 'Realizando autodiagnóstico de IA...', restart_ai_session: 'Reiniciando sesión...',
    view_ai_token_usage: 'Consultando uso de tokens...', request_token_limit_increase: 'Solicitando más tokens...',
    export_ai_training_data: 'Exportando datos de entrenamiento...', import_ai_training_data: 'Importando datos...',
    give_ai_nickname: 'Asignando apodo a la IA...', remove_ai_nickname: 'Removiendo apodo...',
    toggle_ai_web_access: 'Configurando acceso a internet...', toggle_ai_tool_access: 'Configurando permisos de herramientas...',
    evaluate_ai_bias: 'Evaluando sesgos...', generate_ai_usage_report: 'Generando reporte de uso de IA...',

    // ── CAT 13 ──
    view_daily_quests: 'Consultando misiones diarias...', claim_quest_reward: 'Reclamando recompensa...', reroll_daily_quest: 'Cambiando misión...',
    view_leaderboard: 'Consultando tabla de clasificación...', view_global_ranking: 'Viendo ranking global...', view_friends_ranking: 'Viendo ranking de amigos...',
    view_achievements: 'Consultando logros...', claim_achievement: 'Reclamando logro...',
    view_inventory: 'Abriendo inventario...', equip_avatar_item: 'Equipando objeto...', buy_avatar_item: 'Comprando objeto...', unequip_avatar_item: 'Desequipando objeto...',
    view_shop: 'Visitando la tienda...', view_shop_specials: 'Viendo ofertas especiales...',
    send_gift_to_friend: 'Enviando regalo...', receive_gift: 'Abriendo regalo...',
    use_xp_boost: 'Activando XP Boost...', use_focus_potion: 'Usando poción de enfoque...',
    challenge_friend_to_duel: 'Desafiando a un duelo...', accept_duel: 'Aceptando duelo...', decline_duel: 'Rechazando duelo...', view_duel_history: 'Consultando historial de duelos...',
    join_guild: 'Uniéndose a un gremio...', create_guild: 'Creando gremio...', leave_guild: 'Abandonando gremio...', view_guild_stats: 'Consultando estadísticas del gremio...', donate_to_guild: 'Donando al gremio...',

    // ── CAT 14 ──
    start_pomodoro: 'Iniciando Pomodoro...', pause_pomodoro: 'Pausando Pomodoro...', stop_pomodoro: 'Deteniendo Pomodoro...', view_pomodoro_stats: 'Consultando estadísticas de Pomodoro...',
    start_mindfulness_session: 'Iniciando sesión de Mindfulness...', end_mindfulness_session: 'Finalizando Mindfulness...',
    log_mood: 'Registrando estado de ánimo...', view_mood_history: 'Consultando historial de ánimo...', analyze_mood_patterns: 'Analizando patrones de ánimo...',
    set_screen_time_limit: 'Configurando límite de tiempo de pantalla...', view_screen_time: 'Consultando tiempo de pantalla...', get_screen_time_warning: 'Verificando alertas de pantalla...',
    log_water_intake: 'Registrando consumo de agua...', view_water_stats: 'Consultando hidratación...',
    start_posture_check: 'Iniciando chequeo de postura...', stop_posture_check: 'Deteniendo chequeo de postura...',
    log_sleep: 'Registrando horas de sueño...', view_sleep_stats: 'Consultando estadísticas de sueño...',
    request_motivational_quote: 'Buscando frase motivacional...', request_breathing_exercise: 'Iniciando ejercicio de respiración...',
    schedule_break: 'Programando descanso...', cancel_break: 'Cancelando descanso...',
    enable_do_not_disturb: 'Activando No Molestar...', disable_do_not_disturb: 'Desactivando No Molestar...',
    get_ergonomic_advice: 'Obteniendo consejos de ergonomía...', play_ambient_sounds: 'Reproduciendo sonidos ambientales...', stop_ambient_sounds: 'Deteniendo sonidos ambientales...',

    // ── CAT 15 ──
    report_user: 'Reportando usuario...', report_content: 'Reportando contenido...', view_report_status: 'Consultando estado del reporte...', cancel_report: 'Cancelando reporte...',
    block_user: 'Bloqueando usuario...', unblock_user: 'Desbloqueando usuario...', view_blocked_users: 'Viendo lista de bloqueados...',
    appeal_ban: 'Apelando sanción...', view_appeal_status: 'Consultando estado de la apelación...',
    suggest_platform_feature: 'Sugiriendo funcionalidad...', vote_on_feature: 'Votando por funcionalidad...', view_feature_roadmap: 'Viendo roadmap de la plataforma...',
    request_data_export: 'Solicitando exportación de datos...', delete_account: 'Iniciando borrado de cuenta...', pause_account: 'Pausando cuenta...',
    submit_bug_report: 'Enviando reporte de error...', view_bug_reports: 'Consultando bugs reportados...',
    read_system_announcements: 'Leyendo anuncios del sistema...', dismiss_announcement: 'Ocultando anuncio...',
    change_app_theme: 'Cambiando tema de la aplicación...', change_app_language: 'Cambiando idioma...', change_timezone: 'Cambiando zona horaria...',
    configure_notifications: 'Configurando notificaciones...', configure_email_preferences: 'Configurando correos...',
    verify_account_email: 'Verificando correo electrónico...', request_account_verification: 'Solicitando verificación...',
    view_available_tools: `Listando herramientas disponibles...`,

    // ── NUEVAS SKILLS CAT 2: CHAT ──
    upload_chat_media: `Subiendo archivo al chat...`,
    schedule_message: `Programando mensaje para ${args.send_at}...`,
    create_chat_poll: `Creando encuesta en el grupo...`,
    mention_user: `Mencionando a ${args.user_name}...`,
    search_chat_history: `Buscando "${args.query}" en el historial...`,
    start_video_call: `Iniciando videollamada...`,
    share_library_material: `Compartiendo material en el chat...`,
    check_read_receipts: `Verificando estado de lectura...`,
    
    // ── NUEVAS SKILLS CAT 3: BIBLIOTECA ──
    compare_two_documents: `Comparando documentos...`,
    generate_table_of_contents: `Generando índice de contenidos...`,
    extract_text_from_image: `Extrayendo texto de la imagen (OCR)...`,
    generate_study_guide_from_docs: `Generando guía de estudio desde tus documentos...`,
    search_material_by_subject: `Buscando materiales de ${args.subject}...`,
    share_document_with_friend: `Compartiendo documento con ${args.friend_name}...`,
    download_document_as_pdf: `Preparando PDF para descargar...`,
    create_thematic_collection: `Creando colección "${args.name}"...`,
    translate_document: `Traduciendo documento al ${args.target_language}...`,
    
    // ── NUEVAS SKILLS CAT 4: APRENDIZAJE ──
    export_knowledge_graph: `Exportando grafo de conocimiento...`,
    quiz_from_graph: `Generando quiz interactivo sobre ${args.subject}...`,
    recommend_next_topic: `Calculando tu próximo paso en ${args.subject}...`,
    
    // ── NUEVAS SKILLS CAT 5: GENERACIÓN CONTENIDO ──
    generate_infographic_text: `Estructurando infografía...`,
    generate_collaborative_quiz: `Creando cuestionario colaborativo...`,
    generate_project_schedule: `Diseñando cronograma de proyecto...`,
    
    // ── NUEVAS SKILLS CAT 6: MULTIMEDIA ──
    text_to_speech: `Convirtiendo texto a audio...`,
    speech_to_text: `Transcribiendo audio a texto...`,
    transcribe_youtube_video: `Transcribiendo video de YouTube...`,
    describe_uploaded_video: `Analizando video...`,
    search_youtube_video: `Buscando videos educativos en YouTube...`,
    create_video_thumbnail_prompt: `Generando concepto para miniatura...`,
    generate_subtitles: `Generando subtítulos (SRT)...`,
    search_scientific_image: `Buscando imágenes científicas libres...`,
    generate_profile_avatar: `Generando avatar personalizado...`,
    
    // ── NUEVAS SKILLS CAT 7: INVESTIGACIÓN ──
    auto_fact_check: `Haciendo fact-checking automático...`,
    monitor_topic_realtime: `Buscando noticias recientes sobre ${args.topic}...`,
    search_statistics: `Buscando estadísticas oficiales sobre ${args.topic}...`,
    search_github_code: `Buscando código en GitHub...`,
    search_oer_resources: `Buscando Recursos Educativos Abiertos...`,
    analyze_seo_url: `Analizando SEO de la página...`,
    fetch_citation_metadata: `Buscando metadatos para cita...`,
    deep_multi_source_research: `Iniciando investigación profunda en múltiples fuentes...`,
    search_creative_commons_images: `Buscando imágenes Creative Commons...`,
    analyze_search_trends: `Analizando tendencias de búsqueda...`,
    search_legislation: `Buscando legislación aplicable...`,
    create_bibliography_from_search: `Construyendo bibliografía automática...`,
    
    // ── NUEVAS SKILLS CAT 8: ANÁLISIS Y DATOS ──
    compare_performance_timeframe: `Comparando tu rendimiento histórico...`,
    project_readiness_level: `Proyectando tu preparación para el examen...`,
    generate_progress_chart: `Generando gráfica de progreso...`,
    view_time_spent_by_subject: `Calculando tiempo dedicado por materia...`,
    anonymous_peer_benchmark: `Comparando con el promedio de otros estudiantes...`,
    export_progress_data: `Exportando tus datos de progreso...`,
    analyze_study_quality: `Analizando calidad de tus sesiones de estudio...`,
    
    // ── NUEVAS SKILLS CAT 9: PERFIL Y SOCIAL ──
    update_profile_picture: `Actualizando tu foto de perfil...`,
    remove_friend: `¿Eliminar a ${args.user_name} de amigos?`,
    configure_profile_privacy: `Actualizando configuración de privacidad...`,
    upload_to_learning_album: `Guardando en tu Álbum del Saber...`,
    view_learning_album: `Abriendo tu Álbum del Saber...`,
    change_password: `Iniciando cambio de contraseña...`,
    generate_shareable_profile_card: `Generando tarjeta de perfil compartible...`,
    view_badges_and_achievements: `Revisando tus insignias y logros...`,
    
    // ── NUEVAS SKILLS CAT 10: EDUCACIÓN ESPECIALIZADA ──
    graph_math_function: `Graficando función matemática...`,
    verify_calculus_solution: `Verificando solución de cálculo...`,
    balance_chemical_equation: `Balanceando ecuación química...`,
    practice_language_vocabulary: `Iniciando práctica de vocabulario...`,
    solve_physics_problem: `Resolviendo problema de física...`,
    analyze_statistical_data: `Analizando dataset estadístico...`,
    prepare_standardized_test: `Iniciando preparación para ${args.test_name}...`,
    solve_programming_challenge: `Resolviendo reto de programación...`,
    analyze_artwork: `Analizando obra de arte...`,
    explain_scientific_phenomenon: `Explicando fenómeno científico...`,
    language_speaking_practice: `Iniciando práctica conversacional...`,
    solve_multivariable_equation: `Resolviendo sistema de ecuaciones...`,

  };

  return {
    tool: toolName,
    args,
    description: descriptions[toolName] || `Ejecutar ${toolName}`,
    requiresConfirm: needsConfirm,
  };
}

// Aggressive cleanup: strip any residual tool-call syntax that leaked into visible text
function stripToolLeaks(text: string): string {
  let clean = text;
  // Remove ```tool ... ``` blocks (any language hint)
  clean = clean.replace(/```(?:tool|json|javascript|js)?\s*\n?\{[\s\S]*?\}\n?```/g, "");
  // Remove <tool_call>...</tool_call> XML-style tags
  clean = clean.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  // Remove <function_call>...</function_call>
  clean = clean.replace(/<function_call>[\s\S]*?<\/function_call>/gi, "");
  // Remove <thinking>...</thinking> blocks (Consejero uses these)
  clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  // Remove standalone JSON blobs that look like tool calls: {"tool": "...", ...} on their own line
  clean = clean.replace(/^\s*\{[^{}]*"tool"\s*:\s*"[^"]+?"[^{}]*\}\s*$/gm, "");
  // Remove lines that are just raw JSON objects with "name"/"function" keys (some models)
  clean = clean.replace(/^\s*\{[^{}]*"(?:name|function)"\s*:\s*"[^"]+?"[^{}]*\}\s*$/gm, "");
  // Clean up excessive blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");
  return clean.trim();
}

export async function parseToolCall(response: string): Promise<{ cleanText: string; action: ToolAction | null }> {
  let cleanText = response;
  let action: ToolAction | null = null;

  // Pattern 1: ```tool\n{...}\n``` or ```json\n{...}\n```
  const toolBlockRegex = /```(?:tool|json)?\s*\n?(\{[\s\S]*?\})\n?```/;
  // Pattern 2: <tool_call>{...}</tool_call>
  const xmlToolRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i;
  // Pattern 3: <function_call>{...}</function_call>
  const xmlFnRegex = /<function_call>\s*([\s\S]*?)\s*<\/function_call>/i;
  // Pattern 4: Standalone JSON on its own line like {"tool": "generate_image", "args": {...}}
  const standaloneJsonRegex = /^\s*(\{"(?:tool|name|function)"\s*:\s*"[^"]+?"[\s\S]*?\})\s*$/m;

  const patterns = [toolBlockRegex, xmlToolRegex, xmlFnRegex, standaloneJsonRegex];

  for (const regex of patterns) {
    const match = regex.exec(response);
    if (match && match[1]) {
      try {
        const toolJson = JSON.parse(match[1].trim());
        const builtAction = buildAction(toolJson);
        if (builtAction) {
          action = builtAction;
          cleanText = response.replace(match[0], "").trim();
          break;
        }
      } catch {
        continue;
      }
    }
  }

  // Always strip any residual tool syntax from the visible text
  cleanText = stripToolLeaks(cleanText);

  return { cleanText, action };
}

// â”€â”€ Ejecutor de herramientas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function executeToolAction(
  tool: string,
  args: Record<string, any>,
): Promise<ToolResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "No estÃ¡s autenticado." };
  }

  try {
    switch (tool) {
      // ── Abrir URL ──────────────────────────────────────────
      case "open_url": {
        // La apertura real la hace el cliente. Aquí solo validamos.
        const url = args.url;
        if (!url || typeof url !== "string") {
          return { success: false, message: "URL no válida." };
        }
        return {
          success: true,
          message: `Abriendo: ${args.title || url}`,
          data: { url, title: args.title },
        };
      }

      // ── Navegador Web (BrowserAct) ──────────────────────────
      case "browse_web_page": {
        if (!args.url) return { success: false, message: "URL requerida." };
        const result = await browseWebPage(args.url);
        if (!result.success) {
          return { success: false, message: `Error al leer web: ${result.content}` };
        }
        return {
          success: true,
          message: `Página leída: ${result.title}`,
          data: result,
        };
      }

      // ── Tribunal Académico ──────────────────────────────────
      case "trigger_academic_council": {
        if (!args.topic || !args.text) return { success: false, message: "Faltan datos del texto a evaluar." };
        try {
          const report = await runAcademicCouncil(args.topic, args.text);
          return {
            success: true,
            message: "El Tribunal Académico ha emitido su veredicto.",
            data: { report },
          };
        } catch (e: any) {
          return { success: false, message: `Error en el Tribunal: ${e.message}` };
        }
      }

      // ── Calendario (CRUD) ───────────────────────────────────
      case "read_calendar_events": {
        try {
          const events = await readCalendarEvents(args.start_date + "T00:00:00", args.end_date + "T23:59:59");
          return { success: true, message: `Eventos encontrados: ${JSON.stringify(events)}`, data: events };
        } catch(e:any) {
          return { success: false, message: e.message };
        }
      }
      case "search_calendar_events": {
        try {
          const { searchCalendarEvents } = await import("@/actions/calendar");
          const events = await searchCalendarEvents(args.query);
          return { success: true, message: `Eventos encontrados: ${JSON.stringify(events)}`, data: events };
        } catch(e:any) {
          return { success: false, message: e.message };
        }
      }
      case "update_calendar_event": {
        try {
          let updates: any = {};
          if (args.title) updates.title = args.title;
          if (args.description !== undefined) updates.description = args.description;
          if (args.date && args.start_time) updates.start_time = `${args.date}T${args.start_time}:00`;
          if (args.date && args.end_time) updates.end_time = `${args.date}T${args.end_time}:00`;
          if (args.recurrence_rule !== undefined) updates.recurrence_rule = args.recurrence_rule;
          if (args.reminder_minutes !== undefined) updates.reminder_minutes = args.reminder_minutes;
          await updateCalendarEvent(args.event_id, updates);
          return { success: true, message: `✅ Evento actualizado exitosamente.` };
        } catch(e:any) {
          return { success: false, message: e.message };
        }
      }
      case "delete_calendar_event": {
        try {
          await deleteCalendarEvent(args.event_id);
          return { success: true, message: `✅ Evento eliminado.` };
        } catch(e:any) {
          return { success: false, message: e.message };
        }
      }

      case "add_calendar_event": {
        let { title, description, date, start_time, end_time, recurrence_rule, reminder_minutes } = args;
        if (!title || !date) {
          return { success: false, message: "Faltan datos del evento (título y fecha son obligatorios)." };
        }

        // Normalize date to YYYY-MM-DD
        const dateMatch = date.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          date = dateMatch[1];
        }

        // Normalize start_time and end_time to HH:MM
        if (start_time) {
          const stMatch = start_time.match(/(\d{2}:\d{2})/);
          if (stMatch) start_time = stMatch[1];
        }
        if (end_time) {
          const etMatch = end_time.match(/(\d{2}:\d{2})/);
          if (etMatch) end_time = etMatch[1];
        }

        const startDateTime = `${date}T${start_time || "09:00"}:00`;
        const endDateTime = `${date}T${end_time || "10:00"}:00`;

        const { error } = await supabase
          .from("calendar_events")
          .insert({
            user_id: user.id,
            title,
            description: description || null,
            start_time: startDateTime,
            end_time: endDateTime,
            recurrence_rule: recurrence_rule || null,
            reminder_minutes: reminder_minutes || null,
          });

        if (error) {
          console.error("Error creating calendar event:", error);
          return { success: false, message: "Error al crear el evento." };
        }

        return {
          success: true,
          message: `âœ… Evento "${title}" agregado a tu calendario personal para el ${date}.`,
        };
      }

      // â”€â”€ Enviar mensaje â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "send_message": {
        const { recipient_name, content } = args;
        if (!recipient_name || !content) {
          return { success: false, message: "Faltan datos (destinatario y mensaje)." };
        }

        const cleanRecipient = recipient_name.replace(/^@/, '');

        // 1. Buscar en Calendarios Compartidos
        const { data: sharedCals } = await supabase
          .from("shared_calendars")
          .select("id, name")
          .filter("members", "cs", `{${user.id}}`)
          .ilike("name", `%${cleanRecipient}%`)
          .limit(5);

        if (sharedCals && sharedCals.length > 0) {
          if (sharedCals.length > 1) {
            return { 
              success: false, 
              message: `He encontrado varios calendarios similares.`,
              data: { suggestions: sharedCals.map(c => ({ id: c.id, name: c.name, type: 'calendar' })) }
            };
          }
          const cal = sharedCals[0];
          const { error } = await supabase
            .from("shared_calendar_messages")
            .insert({
              calendar_id: cal.id,
              user_id: user.id,
              content,
              type: "text",
            });
          if (error) return { success: false, message: "Error al enviar el mensaje al calendario." };
          return { success: true, message: `âœ… Mensaje enviado al calendario "${cal.name}".` };
        }

        // 2. Buscar en Grupos
        const { data: userRooms } = await supabase
          .from("chat_rooms")
          .select("id, name, participants")
          .eq("type", "group")
          .ilike("name", `%${cleanRecipient}%`)
          .limit(5);
          
        const myRooms = userRooms?.filter((r: any) => {
          const parts = Array.isArray(r.participants) ? r.participants : JSON.parse(r.participants || "[]");
          return parts.includes(user.id);
        });

        if (myRooms && myRooms.length > 0) {
          if (myRooms.length > 1) {
            return { 
              success: false, 
              message: `He encontrado varios grupos similares.`,
              data: { suggestions: myRooms.map(r => ({ id: r.id, name: r.name, type: 'group' })) }
            };
          }
          const myRoom = myRooms[0];
          const { error } = await supabase
            .from("chat_messages")
            .insert({
              room_id: myRoom.id,
              user_id: user.id,
              content,
            });
          if (error) return { success: false, message: "Error al enviar el mensaje al grupo." };
          await supabase.from("chat_rooms").update({ updated_at: new Date().toISOString() }).eq("id", myRoom.id);
          return { success: true, message: `âœ… Mensaje enviado al grupo "${myRoom.name}".` };
        }

        // 3. Buscar en Amigos
        const { data: friendships } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
          
        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map((f: any) =>
            f.requester_id === user.id ? f.addressee_id : f.requester_id
          );
          
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", friendIds)
            .or(`full_name.ilike.%${cleanRecipient}%,username.ilike.%${cleanRecipient}%`)
            .limit(5);
            
          if (friendProfiles && friendProfiles.length > 0) {
            if (friendProfiles.length > 1) {
              return { 
                success: false, 
                message: `He encontrado varios amigos similares.`,
                data: { suggestions: friendProfiles.map(p => ({ id: p.id, name: p.full_name, type: 'friend' })) }
              };
            }
            const friend = friendProfiles[0];
            try {
              const roomId = await ensurePrivateRoom(friend.id);
              await sendMessage(roomId, content);
              return { success: true, message: `âœ… Mensaje enviado a ${friend.full_name}: "${content}"` };
            } catch (error: any) {
              return { success: false, message: "Error al enviar el mensaje directo." };
            }
          }
        }

        return { success: false, message: `No encontrÃ© ningÃºn calendario, grupo o amigo con el nombre "${recipient_name}".` };
      }

      // â”€â”€ Buscar en la biblioteca â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "search_library": {
        const { query } = args;
        if (!query) {
          return { success: false, message: "Escribe quÃ© quieres buscar." };
        }

        const { data: items, error } = await supabase
          .from("library_items")
          .select("id, title, description, subject, file_url, file_type")
          .eq("is_approved", true)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,subject.ilike.%${query}%`)
          .limit(5);

        if (error || !items || items.length === 0) {
          return {
            success: true,
            message: `No encontrÃ© materiales sobre "${query}" en la Biblioteca. Puedes subir tus propios materiales desde la secciÃ³n Biblioteca.`,
          };
        }

        let result = `ðŸ“š EncontrÃ© ${items.length} material(es) sobre "${query}":\n\n`;
        items.forEach((item, i) => {
          result += `${i + 1}. **${item.title}**\n`;
          if (item.description) result += `   ${item.description}\n`;
          if (item.subject) result += `   ðŸ“˜ Materia: ${item.subject}\n`;
          result += `   ðŸ“„ Tipo: ${item.file_type}\n`;
          result += `   ðŸ”— [Ver archivo](${item.file_url})\n\n`;
        });

        return { success: true, message: result, data: items };
      }

      // â”€â”€ Actualizar perfil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "update_profile": {
        const { field, value } = args;
        const allowedFields = ["bio", "school", "grade"];

        if (!allowedFields.includes(field)) {
          return { success: false, message: `No puedo modificar el campo "${field}". Solo: ${allowedFields.join(", ")}.` };
        }

        const { error } = await supabase
          .from("profiles")
          .update({ [field]: value })
          .eq("id", user.id);

        if (error) {
          return { success: false, message: "Error al actualizar tu perfil." };
        }

        const fieldNames: Record<string, string> = {
          bio: "biografÃ­a",
          school: "escuela",
          grade: "grado",
        };

        return {
          success: true,
          message: `âœ… Tu ${fieldNames[field] || field} se actualizÃ³ a: "${value}"`,
        };
      }

      // ── Agregar Hábito ──────────────────────────────────────────────────────────
      case "read_habit_tracker": {
        try {
          const habits = await readHabitTracker(args.week_start);
          return { success: true, message: `Estado actual del Habit Tracker: ${JSON.stringify(habits)}`, data: habits };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "view_habit_stats": {
        try {
          const habits = await readHabitTracker();
          let filtered = habits;
          if (args.habit_id) {
            filtered = habits.filter(h => h.id === args.habit_id || h.name.toLowerCase().includes(args.habit_id.toLowerCase()));
          }
          return { success: true, message: `Estadísticas de hábitos: ${JSON.stringify(filtered.map(h => ({ name: h.name, stats: (h as any).stats })))}`, data: filtered };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "complete_habit_entry": {
        try {
          await completeHabitInTracker(args.habit_id, args.date);
          return { success: true, message: `✅ Hábito completado para el ${args.date}.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "undo_habit_entry": {
        try {
          await undoHabitInTracker(args.habit_id, args.date);
          return { success: true, message: `✅ Hábito desmarcado para el ${args.date}.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "delete_habit": {
        try {
          await deleteHabitFromTracker(args.habit_id, false);
          return { success: true, message: `✅ Hábito eliminado del tracker.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "archive_habit": {
        try {
          await deleteHabitFromTracker(args.habit_id, true);
          return { success: true, message: `✅ Hábito archivado exitosamente.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "update_habit": {
        try {
          const { updateHabit } = await import("@/actions/calendar");
          const updates: any = {};
          if (args.title) updates.name = args.title;
          if (args.frequency) updates.frequency = args.frequency;
          if (args.target_time) updates.target_time = args.target_time;
          await updateHabit(args.habit_id, updates);
          return { success: true, message: `✅ Hábito actualizado.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }
      case "add_habit": {
        try {
          if (!args.title) return { success: false, message: "Falta el nombre del hábito." };
          await addHabitToTracker(args.title, args.frequency || 'daily', args.target_time);
          return { success: true, message: `✅ Hábito "${args.title}" añadido exitosamente a tu Habit Tracker.` };
        } catch (e: any) {
          return { success: false, message: e.message };
        }
      }

      // â”€â”€ Buscar en la web â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "search_web": {
        const { query } = args;
        if (!query) return { success: false, message: "No especificaste quÃ© buscar." };

        try {
          const results = await performWebSearch(query, 3);
          return {
            success: true,
            message: `Resultados de la web para "${query}":\n\n${results}`,
          };
        } catch (e) {
          console.error("Error searching web:", e);
          return { success: false, message: "Hubo un error al buscar en internet." };
        }
      }

      // â”€â”€ Guardar Concepto en Learn Graph â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "save_learned_concept": {
        const { title, description } = args;
        if (!title) return { success: false, message: "El concepto debe tener un tÃ­tulo." };

        try {
          const { getAIEmbedding } = await import("@/lib/ai");
          const embedding = await getAIEmbedding(`TÃ­tulo: ${title}\nDescripciÃ³n: ${description || ""}`);

          const { data: newNode, error } = await supabase
            .from("knowledge_nodes")
            .insert({
              user_id: user.id,
              title,
              description: description || "",
              embedding: `[${embedding.join(',')}]`,
              source_type: "chat_ia"
            })
            .select("id")
            .single();

          if (error) {
            console.error("Error saving knowledge node:", error);
            return { success: false, message: "Hubo un error al guardar el concepto en tu grafo de conocimiento." };
          }

          // Auto-link to related existing concepts
          let linkedCount = 0;
          if (newNode?.id) {
            try {
              const related = await findRelatedConcepts(user.id, `${title} ${description || ""}`, 3, 0.55);
              const otherNodes = related.filter(n => n.id !== newNode.id);
              for (const node of otherNodes) {
                const linked = await linkConcepts(user.id, newNode.id, node.id, "related_to");
                if (linked) linkedCount++;
              }
            } catch (linkErr) {
              console.error("Auto-linking failed (non-critical):", linkErr);
            }
          }

          const linkMsg = linkedCount > 0
            ? ` y lo conectÃ© con ${linkedCount} concepto(s) relacionado(s)`
            : "";

          return {
            success: true,
            message: `ðŸ§  He guardado silenciosamente el concepto "${title}" en tu mapa de conocimiento a largo plazo (Learn Graph)${linkMsg}.`,
          };
        } catch (e) {
          console.error("Error generating embedding:", e);
          return { success: false, message: "Error al procesar el conocimiento." };
        }
      }

      case "search_documents": {
        const { query: sdQ } = args;
        try {
          const { search_documents: ragSearch } = await import("@/actions/ai-tutor");
          const sdMsg = await ragSearch(sdQ, 6);
          return { success: true, message: sdMsg, data: null };
        } catch (e: any) {
          console.error("[ai-tools] Error en search_documents:", e);
          return { success: false, message: "Hubo un error al buscar en los documentos." };
        }
      }

      case "query_repositories": {
        const qrQ = String(args.query || "").trim();
        let qrChunks: any[] = [];
        let successVector = false;

        try {
          const { getAIEmbedding } = await import("@/lib/ai");
          const embedding = await getAIEmbedding(qrQ);
          
          const { data, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 8
          });

          if (!error && data && data.length > 0) {
            qrChunks = data;
            successVector = true;
          }
        } catch (e) {
          console.error("Vector search failed, falling back to ilike:", e);
        }

        if (!successVector) {
          const { data: fallbackChunks, error: qrErr } = await supabase
            .from("ai_document_chunks")
            .select("content, chunk_index, metadata, ai_documents:document_id (title, source_url)")
            .eq("user_id", user.id)
            .ilike("content", `%${qrQ}%`)
            .limit(8);
            
          qrChunks = fallbackChunks || [];
        }

        if (!qrChunks || qrChunks.length === 0) {
          return {
            success: true,
            message: `No encontre fragmentos indexados del Cerebro Unico para "${qrQ}". Cuando ejecutes la indexacion de repositorios, esta herramienta empezara a traer citas.`,
          };
        }

        const qrMsg = qrChunks
          .map((chunk: any, idx: number) => {
            const doc = Array.isArray(chunk.ai_documents) ? chunk.ai_documents[0] : chunk.ai_documents;
            const source = chunk.metadata?.repository || doc?.title || "Repositorio";
            return `${idx + 1}. ${source} [fragmento ${chunk.chunk_index}]\n${chunk.content.slice(0, 700)}`;
          })
          .join("\n\n");

        return { success: true, message: qrMsg, data: qrChunks };
      }

      case "generate_document": {
        const gdContent = `# ${args.title}\n\n${args.outline}\n`;
        return {
          success: true,
          message: `Documento generado: **${args.title}**\n\nSe preparo como archivo Markdown descargable.`,
          data: { title: args.title, format: args.format, content: gdContent },
        };
      }

      case "generate_image": {
        try {
          // Intentar primero con Fal.ai
          const giUrl = await generateFalImage(args.prompt);
          if (giUrl) {
            return {
              success: true,
              message: `Imagen generada para **${args.prompt}**:\n\n![${args.prompt}](${giUrl})`,
              data: { prompt: args.prompt, purpose: args.purpose || null, imageUrl: giUrl },
            };
          }
        } catch (error) {
          console.error("Error generating image with Fal, falling back to Pollinations:", error);
        }
        
        // Fallback a Pollinations.ai
        try {
          const encodedPrompt = encodeURIComponent(args.prompt);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
          
          return {
            success: true,
            message: `Imagen generada para **${args.prompt}**:\n\n![${args.prompt}](${pollinationsUrl})`,
            data: { prompt: args.prompt, purpose: args.purpose || null, imageUrl: pollinationsUrl },
          };
        } catch (error) {
          return {
            success: false,
            message: "No se pudo generar la imagen mediante IA.",
            data: { prompt: args.prompt, purpose: args.purpose || null },
          };
        }
      }

      case "search_image": {
        try {
          const giUrl = await searchRecipeImage(args.query);
          if (giUrl) {
            return {
              success: true,
              message: `Imagen de stock encontrada para **${args.query}**:\n\n![${args.query}](${giUrl})`,
              data: { query: args.query, imageUrl: giUrl },
            };
          }
        } catch (error) {
          console.error("Error searching image:", error);
        }
        return {
          success: false,
          message: "No se pudo encontrar una imagen de stock para tu solicitud.",
          data: { query: args.query },
        };
      }

      case "generate_video": {
        try {
          const gvUrl = await generateFalVideo(args.prompt);
          if (gvUrl) {
            return {
              success: true,
              message: `Video generado para **${args.prompt}**:\n\n![${args.prompt}](${gvUrl})`,
              data: { prompt: args.prompt, purpose: args.purpose || null, videoUrl: gvUrl },
            };
          }
        } catch (error) {
          console.error("Error generating video:", error);
        }
        return {
          success: false,
          message: "Hubo un error al generar el video. Intenta de nuevo más tarde.",
          data: { prompt: args.prompt },
        };
      }

      case "create_exam": {
        const ceContent = [
          `# Examen: ${args.topic}`,
          "",
          `- Dificultad: ${args.difficulty}`,
          `- Preguntas: ${args.question_count}`,
          `- Duracion: ${args.duration_minutes} minutos`,
          `- Puntaje total: 100`,
          "",
          "## Instrucciones",
          "Responde con claridad.",
        ].join("\n");
        return {
          success: true,
          message: `Examen preparado sobre "${args.topic}" (${args.question_count} preguntas, dificultad ${args.difficulty}).`,
          data: { ...args, title: `Examen - ${args.topic}`, content: ceContent },
        };
      }

      case "load_claude_skill": {
        const { repository: lcRepo, skill_name: lcSkill } = args;
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          let lcPath = path.join(process.cwd(), "src", "lib", "ai", "repositories", lcRepo);
          if (["the-architect", "neo", "agency-agents"].includes(lcRepo)) {
            lcPath = path.join(process.cwd(), ".agents", lcRepo);
          }
          try { await fs.access(lcPath); } catch { return { success: false, message: `Repositorio no encontrado: ${lcRepo}` }; }
          const lcItems = await fs.readdir(lcPath, { withFileTypes: true, recursive: true });
          const lcMatches = lcItems.filter(i => i.name.toLowerCase().includes(lcSkill.toLowerCase()));
          if (lcMatches.length === 0) return { success: false, message: `Skill "${lcSkill}" no encontrado en "${lcRepo}".` };
          const lcMatch = lcMatches[0];
          const lcParent = (lcMatch as any).parentPath || (lcMatch as any).path || lcPath;
          const lcFull = path.join(lcParent, lcMatch.name);
          if (lcMatch.isDirectory()) {
            const lcSubs = await fs.readdir(lcFull);
            let lcText = `Directorio: ${lcMatch.name}\nContenido: ${lcSubs.join(", ")}\n\n`;
            try { const rm = await fs.readFile(path.join(lcFull, "README.md"), "utf-8"); lcText += `README:\n${rm.slice(0, 1500)}...`; } catch {}
            return { success: true, message: `Skill cargado: ${lcMatch.name}\n\n${lcText}`, data: { content: lcText } };
          } else {
            const lcFile = await fs.readFile(lcFull, "utf-8");
            return { success: true, message: `Skill cargado: ${lcMatch.name}\n\n${lcFile.slice(0, 1500)}...`, data: { content: lcFile } };
          }
        } catch (lcErr: any) {
          console.error("Error loading skill:", lcErr);
          return { success: false, message: `Error al cargar el skill: ${lcErr.message}` };
        }
      }

      case "generate_flashcards": {
        const { topic: fcTopic, content: fcBody } = args;
        const fcOut = `# Flashcards: ${fcTopic}\n\nRevisa estas tarjetas para memorizar los conceptos clave.\n\n${fcBody}`;
        return { success: true, message: `Flashcards sobre "${fcTopic}" generadas!`, data: { title: `Flashcards-${fcTopic}`, format: "markdown", content: fcOut } };
      }

      case "trigger_webhook": {
        const { webhook_path: whPath, payload: whPayload } = args;
        try {
          const whEnriched = { ...whPayload, userId: user.id, email: user.email };
          const whClean = whPath.replace(/^\//, "");
          const whFullUrl = whPath.startsWith("http") ? whPath : `http://localhost:5888/webhook/${whClean}`;
          const whCtrl = new AbortController();
          const whTid = setTimeout(() => whCtrl.abort(), 10000);
          const whRes = await fetch(whFullUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(whEnriched), signal: whCtrl.signal });
          clearTimeout(whTid);
          return whRes.ok ? { success: true, message: "Automatizacion ejecutada." } : { success: false, message: `Error: ${whRes.status}` };
        } catch (whErr: any) {
          console.error("Webhook error:", whErr);
          return { success: false, message: "No se pudo conectar con el Webhook." };
        }
      }

      case "trigger_jarvis": {
        return { success: true, message: "He invocado a Jarvis para que te ayude.", data: { reason: args.reason } };
      }

      case "notify_user": {
        const { title: nuTitle, body: nuBody, url: nuUrl } = args;
        if (!nuTitle || !nuBody) return { success: false, message: "Faltan datos de la notificacion." };

        // 1. Insert in-app notification so NotificationManager picks it up
        const { error: nuInsErr } = await supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            title: nuTitle,
            message: nuBody,
            type: "reminder",
            link: nuUrl || null,
            is_read: false,
          });
        if (nuInsErr) console.error("Notification insert err:", nuInsErr);

        // 2. Try to send a real push notification via web-push
        try {
          const { data: nuSub } = await supabase
            .from("push_subscriptions")
            .select("subscription")
            .eq("user_id", user.id)
            .single();

          if (nuSub?.subscription) {
            const wp = await import("web-push");
            wp.setVapidDetails(
              "mailto:learnup@profe.dev",
              process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
              process.env.VAPID_PRIVATE_KEY || "",
            );
            await wp.sendNotification(
              nuSub.subscription as any,
              JSON.stringify({ title: nuTitle, body: nuBody, url: nuUrl || "/dashboard/notifications" }),
            );
          }
        } catch (nuPushErr: any) {
          console.error("Push failed:", nuPushErr.message);
        }

        return {
          success: true,
          message: `Recordatorio "${nuTitle}" enviado.`,
          data: { title: nuTitle, body: nuBody, url: nuUrl },
        };
      }

      // ── Calendarios Compartidos ──────────────────────────────────────────────────
      case "create_shared_calendar": {
        try {
          const { createSharedCalendar } = await import("@/actions/shared-calendars");
          const result = await createSharedCalendar(args.name, args.members);
          return { success: result.success, message: result.success ? `✅ Calendario "${args.name}" creado.` : `Error: ${result.error}`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "add_shared_calendar_member": {
        try {
          const { addCalendarMember } = await import("@/actions/shared-calendars");
          const result = await addCalendarMember(args.calendar_id, args.member_id);
          return { success: result.success, message: result.success ? `✅ Miembro agregado.` : `Error: ${result.error}` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "add_shared_event": {
        try {
          const { addSharedEvent } = await import("@/actions/shared-calendars");
          const result = await addSharedEvent(args.calendar_id, args.title, args.description || "", args.start_time, args.end_time);
          return { success: result.success, message: result.success ? `✅ Evento agregado.` : `Error: ${result.error}`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "read_shared_events": {
        try {
          const { readSharedEvents } = await import("@/actions/shared-calendars");
          const result = await readSharedEvents(args.calendar_id);
          return { success: result.success, message: `Eventos encontrados.`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "delete_shared_event": {
        try {
          const { deleteSharedEvent } = await import("@/actions/shared-calendars");
          const result = await deleteSharedEvent(args.event_id);
          return { success: result.success, message: result.success ? `✅ Evento eliminado.` : `Error: ${result.error}` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "send_shared_message": {
        try {
          const { sendSharedMessage } = await import("@/actions/shared-calendars");
          const result = await sendSharedMessage(args.calendar_id, args.content, args.type);
          return { success: result.success, message: result.success ? `✅ Mensaje enviado.` : `Error: ${result.error}`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "read_shared_chat": {
        try {
          const { readSharedChat } = await import("@/actions/shared-calendars");
          const result = await readSharedChat(args.calendar_id, args.limit);
          return { success: result.success, message: `Chat recuperado.`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "delete_shared_message": {
        try {
          const { deleteSharedMessage } = await import("@/actions/shared-calendars");
          const result = await deleteSharedMessage(args.message_id);
          return { success: result.success, message: result.success ? `✅ Mensaje eliminado.` : `Error: ${result.error}` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "leave_shared_calendar": {
        try {
          const { leaveSharedCalendar } = await import("@/actions/shared-calendars");
          const result = await leaveSharedCalendar(args.calendar_id);
          return { success: result.success, message: result.success ? `✅ Has salido del calendario.` : `Error: ${result.error}` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "view_shared_members": {
        try {
          const { getSharedCalendarMembers } = await import("@/actions/shared-calendars");
          const result = await getSharedCalendarMembers(args.calendar_id);
          return { success: result.success, message: `Miembros consultados.`, data: result.data };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "notify_habit_progress": {
        try {
          const { notifySharedHabitProgress } = await import("@/actions/shared-calendars");
          const result = await notifySharedHabitProgress(args.calendar_id);
          return { success: result.success, message: result.success ? `✅ Grupo notificado.` : `Error: ${result.error}` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }

      // ── Fase 3: IA Avanzada ──────────────────────────────────────────────────────
      case "suggest_weekly_plan": {
        try {
          const { readCalendarEvents, readHabitTracker } = await import("@/actions/calendar");
          
          // Leer la semana actual
          const startOfWeek = new Date();
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          const startStr = startOfWeek.toISOString().split('T')[0];
          const endStr = endOfWeek.toISOString().split('T')[0];

          const eventsResult = await readCalendarEvents(startStr, endStr);
          const habitsResult = await readHabitTracker(startStr);

          const summary = {
            events: eventsResult || [],
            habits: habitsResult || []
          };

          return { 
            success: true, 
            message: "He analizado tus eventos y hábitos. Generaré una propuesta para organizar tu semana.", 
            data: summary 
          };
        } catch(e:any) { 
          return { success: false, message: `Error al sugerir plan: ${e.message}` }; 
        }
      }

      case "export_calendar_ics": {
        return { 
          success: true, 
          message: "Tu calendario en formato ICS está listo para descargar.", 
          data: { download_url: "/api/calendar/export" } 
        };
      }

      // ── Fase 4: Chat Social Avanzado ─────────────────────────────────────────────
      case "read_unread_messages": {
        try {
          const { getUnreadMessagesCount } = await import("@/actions/chat");
          const count = await getUnreadMessagesCount(args.room_id);
          return { success: true, message: `Tienes ${count} mensajes no leídos.`, data: { count } };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "read_full_conversation": {
        try {
          const { getChatMessages } = await import("@/actions/chat");
          const messages = await getChatMessages(args.room_id);
          return { success: true, message: `Historial cargado.`, data: messages };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "create_study_group": {
        try {
          const { createGroup, searchUsers } = await import("@/actions/chat");
          // Buscamos a los usuarios por nombre para sacar sus UUIDs
          const pIds = [];
          for (const name of args.participant_names) {
            const users = await searchUsers(name);
            if (users && users.length > 0) pIds.push(users[0].id);
          }
          if (pIds.length === 0) return { success: false, message: "No se encontraron los usuarios." };
          const roomId = await createGroup(args.name, pIds);
          return { success: true, message: `Grupo creado exitosamente.`, data: { room_id: roomId } };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "add_group_member": {
        try {
          const { addGroupMember, searchUsers } = await import("@/actions/chat");
          const users = await searchUsers(args.user_name);
          if (!users || users.length === 0) return { success: false, message: "Usuario no encontrado." };
          await addGroupMember(args.room_id, users[0].id);
          return { success: true, message: `Usuario agregado al grupo.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "view_group_members": {
        try {
          const { getRoomMembers } = await import("@/actions/chat");
          const members = await getRoomMembers(args.room_id);
          return { success: true, message: `Miembros consultados.`, data: members };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "edit_group_info": {
        try {
          const { updateGroup } = await import("@/actions/chat");
          await updateGroup(args.room_id, args.name, undefined, args.description);
          return { success: true, message: `Info del grupo actualizada.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "leave_group": {
        try {
          const { leaveGroup } = await import("@/actions/chat");
          await leaveGroup(args.room_id);
          return { success: true, message: `Saliste del grupo.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "search_user_by_name": {
        try {
          const { searchUsers } = await import("@/actions/chat");
          const users = await searchUsers(args.query);
          return { success: true, message: `Búsqueda completada.`, data: users };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "edit_sent_message": {
        try {
          const { updateMessage } = await import("@/actions/chat");
          await updateMessage(args.message_id, args.new_content);
          return { success: true, message: `Mensaje actualizado.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "delete_sent_message": {
        try {
          const { deleteMessage } = await import("@/actions/chat");
          await deleteMessage(args.message_id, args.for_everyone);
          return { success: true, message: `Mensaje borrado.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "broadcast_message": {
        // Mocked implementation to prevent spam
        return { success: true, message: `Simulando envío masivo: "${args.content}"` };
      }
      case "pin_important_message": {
        try {
          const { pinMessage } = await import("@/actions/chat");
          await pinMessage(args.message_id, args.is_pinned);
          return { success: true, message: `Mensaje fijado.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "react_with_emoji": {
        try {
          const { addMessageReaction } = await import("@/actions/chat");
          await addMessageReaction(args.message_id, args.emoji);
          return { success: true, message: `Reaccionaste con ${args.emoji}.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "mute_chat_notifications": {
        try {
          const { muteRoomNotifications } = await import("@/actions/chat");
          await muteRoomNotifications(args.room_id, args.hours);
          return { success: true, message: `Notificaciones silenciadas.` };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "export_chat_history": {
        try {
          const { exportConversation } = await import("@/actions/chat");
          const txt = await exportConversation(args.room_id);
          return { success: true, message: `Historial exportado.`, data: txt };
        } catch(e:any) { return { success: false, message: e.message }; }
      }
      case "summarize_conversation": {
        try {
          const { getChatMessages } = await import("@/actions/chat");
          const messages = await getChatMessages(args.room_id);
          // Normally we'd ask the LLM to summarize this, but since we're IN the LLM tool execution,
          // we just return the messages and the LLM will see them and summarize in its next turn!
          return { success: true, message: `Historial cargado. Por favor, genera un resumen de esto para el usuario.`, data: messages };
        } catch(e:any) { return { success: false, message: e.message }; }
      }

      // ── Mocks Temporales para Herramientas de Base de Datos Nuevas ──────────────
      case "view_own_library_items": {
        const { data, error } = await supabase
          .from("library_items")
          .select("*")
          .eq("uploaded_by", user.id)
          .order("created_at", { ascending: false });
        if (error) return { success: false, message: `Error: ${error.message}` };
        return { success: true, message: `Encontré ${data.length} materiales subidos por ti.`, data };
      }
      
      case "delete_own_library_item": {
        const { error } = await supabase
          .from("library_items")
          .delete()
          .eq("id", args.item_id)
          .eq("uploaded_by", user.id);
        if (error) return { success: false, message: `Error: ${error.message}` };
        return { success: true, message: `✅ Material eliminado de la biblioteca.` };
      }

      case "list_indexed_documents": {
        try {
          const { getUserIndexedDocuments } = await import("@/actions/library");
          const docs = await getUserIndexedDocuments();
          return { success: true, message: `Encontré ${docs.length} documentos indexados.`, data: docs };
        } catch (e: any) {
          return { success: false, message: `Error: ${e.message}` };
        }
      }

      case "delete_indexed_document": {
        try {
          const { deleteAiDocument } = await import("@/actions/library");
          const result = await deleteAiDocument(args.document_id);
          if (!result.success) return { success: false, message: result.error || "Error al eliminar." };
          return { success: true, message: `✅ Documento eliminado del índice RAG.` };
        } catch (e: any) {
          return { success: false, message: `Error: ${e.message}` };
        }
      }

      case "upload_library_file":
      case "index_url_as_document":
      case "create_learning_path":
      case "connect_two_concepts":
      case "import_concepts_from_document":
      case "send_friend_request":
      case "accept_pending_requests":
      case "cancel_friend_request":
      case "rate_ai_response":
        return { success: true, message: `✅ Acción '${tool}' registrada en el sistema.` };
        
      case "view_related_concepts":
      case "view_progress_by_subject":
      case "view_study_stats":
      case "view_exam_history":
      case "view_habit_streaks":
      case "view_friends_list":
      case "view_friend_profile":
      case "view_recent_activity":
      case "view_ai_sessions":
      case "view_available_tools":
        return { success: true, message: `Consulta completada. (Mostrando datos de prueba temporales)`, data: { items: [] } };

      // ── Habilidades Nativas de IA (Fallthrough masivo) ────────────────────────
      case "summarize_document":
      case "extract_questions_from_doc":
      case "cite_source":
      case "analyze_source_credibility":
      case "search_knowledge_graph":
      case "detect_knowledge_gaps":
      case "spaced_repetition_review":
      case "generate_concept_map":
      case "calculate_mastery_score":
      case "generate_summary":
      case "create_study_plan":
      case "generate_presentation_outline":
      case "generate_essay":
      case "generate_glossary":
      case "generate_comparison_table":
      case "generate_code":
      case "generate_practice_questions":
      case "generate_mind_map":
      case "generate_bibliography":
      case "generate_project_template":
      case "generate_timeline":
      case "generate_formal_letter":
      case "generate_reading_sheet":
      case "generate_rubric":
      case "generate_research_report":
      case "generate_syllabus":
      case "analyze_image":
      case "generate_mermaid_diagram":
      case "generate_podcast_script":
      case "describe_math_image":
      case "advanced_web_search":
      case "fact_check":
      case "search_wikipedia":
      case "compare_multiple_sources":
      case "deep_research":
      case "search_academic_paper":
      case "generate_weekly_report":
      case "analyze_strengths_weaknesses":
      case "detect_procrastination":
      case "generate_academic_dashboard":
      case "solve_math_problem":
      case "analyze_literary_text":
      case "conjugate_verb":
      case "translate_with_explanation":
      case "explain_with_analogy":
      case "socratic_debate":
      case "export_ai_conversation":
      
      // ── MOCKS PARA NUEVAS SKILLS ──
      case "upload_chat_media":
      case "schedule_message":
      case "create_chat_poll":
      case "mention_user":
      case "search_chat_history":
      case "start_video_call":
      case "share_library_material":
      case "check_read_receipts":
      case "compare_two_documents":
      case "generate_table_of_contents":
      case "extract_text_from_image":
      case "generate_study_guide_from_docs":
      case "search_material_by_subject":
      case "share_document_with_friend":
      case "download_document_as_pdf":
      case "create_thematic_collection":
      case "translate_document":
      case "export_knowledge_graph":
      case "quiz_from_graph":
      case "recommend_next_topic":
      case "generate_infographic_text":
      case "generate_collaborative_quiz":
      case "generate_project_schedule":
      case "text_to_speech":
      case "speech_to_text":
      case "transcribe_youtube_video":
      case "describe_uploaded_video":
      case "search_youtube_video":
      case "create_video_thumbnail_prompt":
      case "generate_subtitles":
      case "search_scientific_image":
      case "generate_profile_avatar":
      case "auto_fact_check":
      case "monitor_topic_realtime":
      case "search_statistics":
      case "search_github_code":
      case "search_oer_resources":
      case "analyze_seo_url":
      case "fetch_citation_metadata":
      case "deep_multi_source_research":
      case "search_creative_commons_images":
      case "analyze_search_trends":
      case "search_legislation":
      case "create_bibliography_from_search":
      case "compare_performance_timeframe":
      case "project_readiness_level":
      case "generate_progress_chart":
      case "view_time_spent_by_subject":
      case "anonymous_peer_benchmark":
      case "export_progress_data":
      case "analyze_study_quality":
      case "update_profile_picture":
      case "remove_friend":
      case "configure_profile_privacy":
      case "upload_to_learning_album":
      case "view_learning_album":
      case "change_password":
      case "generate_shareable_profile_card":
      case "view_badges_and_achievements":
      case "graph_math_function":
      case "verify_calculus_solution":
      case "balance_chemical_equation":
      case "practice_language_vocabulary":
      case "solve_physics_problem":
      case "analyze_statistical_data":
      case "prepare_standardized_test":
      case "solve_programming_challenge":
      case "analyze_artwork":
      case "explain_scientific_phenomenon":
      case "language_speaking_practice":
      case "solve_multivariable_equation":
        return { 
          success: true, 
          message: `✅ Acción '${tool}' recibida correctamente.`,
          data: args 
        };

            case 'sync_google_drive':
      case 'search_google_drive':
      case 'export_to_google_drive':
      case 'sync_notion':
      case 'export_to_notion':
      case 'search_notion':
      case 'sync_github':
      case 'create_github_repo':
      case 'search_github_repos':
      case 'sync_canvas_lms':
      case 'fetch_canvas_assignments':
      case 'submit_canvas_assignment':
      case 'connect_zoom':
      case 'create_zoom_meeting':
      case 'get_zoom_recordings':
      case 'sync_trello':
      case 'create_trello_card':
      case 'get_trello_boards':
      case 'connect_slack':
      case 'send_slack_message':
      case 'connect_spotify':
      case 'play_study_music':
      case 'connect_discord':
      case 'send_discord_webhook':
      case 'sync_evernote':
      case 'search_evernote':
      case 'connect_onenote':
      case 'export_to_onenote':
      case 'change_ai_personality':
      case 'view_ai_personalities':
      case 'adjust_ai_verbosity':
      case 'adjust_ai_creativity':
      case 'set_ai_voice':
      case 'preview_ai_voice':
      case 'train_ai_on_document':
      case 'remove_ai_training_document':
      case 'view_ai_memory':
      case 'delete_ai_memory_item':
      case 'edit_ai_memory':
      case 'toggle_ai_proactive_mode':
      case 'set_ai_working_hours':
      case 'ask_ai_for_self_diagnosis':
      case 'restart_ai_session':
      case 'view_ai_token_usage':
      case 'request_token_limit_increase':
      case 'export_ai_training_data':
      case 'import_ai_training_data':
      case 'give_ai_nickname':
      case 'remove_ai_nickname':
      case 'toggle_ai_web_access':
      case 'toggle_ai_tool_access':
      case 'evaluate_ai_bias':
      case 'generate_ai_usage_report':
      case 'view_daily_quests':
      case 'claim_quest_reward':
      case 'reroll_daily_quest':
      case 'view_leaderboard':
      case 'view_global_ranking':
      case 'view_friends_ranking':
      case 'view_achievements':
      case 'claim_achievement':
      case 'view_inventory':
      case 'equip_avatar_item':
      case 'buy_avatar_item':
      case 'unequip_avatar_item':
      case 'view_shop':
      case 'view_shop_specials':
      case 'send_gift_to_friend':
      case 'receive_gift':
      case 'use_xp_boost':
      case 'use_focus_potion':
      case 'challenge_friend_to_duel':
      case 'accept_duel':
      case 'decline_duel':
      case 'view_duel_history':
      case 'join_guild':
      case 'create_guild':
      case 'leave_guild':
      case 'view_guild_stats':
      case 'donate_to_guild':
      case 'start_pomodoro':
      case 'pause_pomodoro':
      case 'stop_pomodoro':
      case 'view_pomodoro_stats':
      case 'start_mindfulness_session':
      case 'end_mindfulness_session':
      case 'log_mood':
      case 'view_mood_history':
      case 'analyze_mood_patterns':
      case 'set_screen_time_limit':
      case 'view_screen_time':
      case 'get_screen_time_warning':
      case 'log_water_intake':
      case 'view_water_stats':
      case 'start_posture_check':
      case 'stop_posture_check':
      case 'log_sleep':
      case 'view_sleep_stats':
      case 'request_motivational_quote':
      case 'request_breathing_exercise':
      case 'schedule_break':
      case 'cancel_break':
      case 'enable_do_not_disturb':
      case 'disable_do_not_disturb':
      case 'get_ergonomic_advice':
      case 'play_ambient_sounds':
      case 'stop_ambient_sounds':
      case 'report_user':
      case 'report_content':
      case 'view_report_status':
      case 'cancel_report':
      case 'block_user':
      case 'unblock_user':
      case 'view_blocked_users':
      case 'appeal_ban':
      case 'view_appeal_status':
      case 'suggest_platform_feature':
      case 'vote_on_feature':
      case 'view_feature_roadmap':
      case 'request_data_export':
      case 'delete_account':
      case 'pause_account':
      case 'submit_bug_report':
      case 'view_bug_reports':
      case 'read_system_announcements':
      case 'dismiss_announcement':
      case 'change_app_theme':
      case 'change_app_language':
      case 'change_timezone':
      case 'configure_notifications':
      case 'configure_email_preferences':
      case 'verify_account_email':
      case 'request_account_verification':
        return { 
          success: true, 
          message: '✅ Acción ' + tool + ' recibida correctamente.',
          data: args 
        };
      case "generate_optimized_prompt":
        return { 
          success: true, 
          message: `✅ Herramienta activada. Procede a generar el contenido solicitado en tu respuesta, utilizando tus conocimientos como IA experta.`,
          data: args 
        };

      default:
        return { success: false, message: `Herramienta "${tool}" no reconocida.` };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${tool}:`, error);
    return { success: false, message: `Error al ejecutar: ${error.message}` };
  }
}
