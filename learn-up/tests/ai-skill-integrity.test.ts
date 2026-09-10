import { describe, expect, it } from "vitest";
import { aiRegistry } from "@/lib/ai/skills";
import { getToolDefinition, getToolDefinitions } from "@/lib/ai/tool-contract";
import { AI_AGENT_REGISTRY } from "@/lib/ai/agent-registry";

describe("Learn Up AI skills", () => {
  it("registers the universal skill packs", () => {
    const skillIds = aiRegistry.getAllSkills().map((skill) => skill.id).sort();
    expect(skillIds).toEqual([
      "analytics",
      "calendar",
      "chat",
      "content_generation",
      "education",
      "knowledge-graph",
      "library",
      "multimedia",
      "research",
      "social",
    ]);
  });

  it("has schema + executor + safe policy for every registered tool", () => {
    const tools = aiRegistry.getAllTools();
    expect(tools.length).toBeGreaterThan(50);
    const ids = new Set<string>();

    for (const tool of tools) {
      expect(tool.id).toBeTruthy();
      expect(ids.has(tool.id)).toBe(false);
      ids.add(tool.id);
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeTruthy();
      expect(typeof tool.execute).toBe("function");
      expect(["read", "write", "destructive"].includes(tool.risk)).toBe(true);
      expect(typeof tool.requiresConfirmation).toBe("boolean");
      expect(typeof tool.supportsAutopilot).toBe("boolean");
      if (tool.risk === "destructive") {
        expect(tool.requiresConfirmation).toBe(true);
        expect(tool.supportsAutopilot).toBe(false);
      }
    }
  });

  it("keeps every conversational role available", () => {
    expect(Object.keys(AI_AGENT_REGISTRY)).toEqual(expect.arrayContaining([
      "profesor",
      "examenes",
      "consejero",
      "nutrirecetas",
      "jarvis",
    ]));
  });

  it("keeps the canonical universal tools executable", () => {
    const canonical = [
      "add_calendar_event", "read_calendar_events", "update_calendar_event", "delete_calendar_event", "search_calendar_events",
      "add_habit", "read_habit_tracker", "complete_habit_entry", "undo_habit_entry", "update_habit", "delete_habit", "view_habit_stats",
      "create_shared_calendar", "add_shared_calendar_member", "add_shared_event", "read_shared_events", "delete_shared_event",
      "send_shared_message", "read_shared_chat", "delete_shared_message", "leave_shared_calendar", "view_shared_members", "notify_habit_progress", "suggest_weekly_plan", "export_calendar_ics",
      "send_message", "read_unread_messages", "read_full_conversation", "create_study_group", "add_group_member", "view_group_members", "edit_group_info", "leave_group",
      "search_user_by_name", "edit_sent_message", "delete_sent_message", "broadcast_message", "pin_important_message", "react_with_emoji", "mute_chat_notifications", "export_chat_history", "summarize_conversation",
      "search_library", "upload_library_file", "view_own_library_items", "delete_own_library_item", "search_documents", "list_indexed_documents", "delete_indexed_document", "summarize_document", "extract_questions_from_doc", "cite_source", "index_url_as_document", "analyze_source_credibility", "translate_document",
      "save_learned_concept", "search_knowledge_graph", "view_related_concepts", "create_learning_path", "detect_knowledge_gaps", "spaced_repetition_review", "generate_concept_map", "view_progress_by_subject", "connect_two_concepts", "import_concepts_from_document", "calculate_mastery_score",
      "generate_summary", "create_study_plan", "generate_presentation_outline", "generate_essay", "generate_glossary", "generate_comparison_table", "generate_code", "generate_practice_questions", "generate_mind_map", "generate_bibliography", "generate_project_template", "generate_timeline", "generate_formal_letter", "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus",
      "generate_image", "search_image", "analyze_image", "generate_mermaid_diagram", "generate_podcast_script", "describe_math_image", "text_to_speech", "transcribe_audio", "generate_srt", "generate_thumbnail", "generate_ai_profile_avatar", "search_youtube_video", "search_scientific_images",
      "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_academic_paper", "search_wikipedia", "monitor_topic_realtime", "search_statistics_data", "compare_sources_multiple", "search_github_code", "search_open_education", "analyze_seo", "search_doi_isbn", "deep_research", "analyze_search_trends", "search_legislation", "create_bibliography_from_search",
      "view_study_stats", "generate_weekly_report", "view_exam_history", "analyze_strengths_weaknesses", "view_habit_streaks", "detect_procrastination", "generate_academic_dashboard", "view_activity_heatmap", "analyze_time_distribution", "predict_exam_score", "calculate_gpa", "export_stats_csv",
      "update_profile", "update_avatar", "search_users", "send_friend_request", "accept_friend_request", "decline_friend_request", "remove_friend", "view_friends_list", "view_user_profile", "toggle_privacy_mode", "view_recent_activity", "upload_learning_album_image", "view_learning_album", "update_password", "generate_shareable_profile_card", "view_badges_and_achievements",
      "solve_math_problem", "graph_math_function", "verify_calculus_solution", "balance_chemical_equation", "analyze_literary_text", "conjugate_verb", "translate_with_explanation", "practice_language_vocabulary", "solve_physics_problem", "analyze_statistical_data", "generate_historical_context", "explain_with_analogy", "prepare_standardized_test", "solve_programming_challenge", "analyze_artwork", "explain_scientific_phenomenon", "simulate_socratic_dialogue", "language_speaking_practice", "solve_multivariable_equation",
    ];

    const registered = new Set(aiRegistry.getAllTools().map((tool) => tool.id));
    const missing = canonical.filter((id) => !registered.has(id));
    expect(missing).toEqual([]);
  });

  it("keeps the policy catalog internally resolvable", () => {
    const definitions = getToolDefinitions();
    expect(definitions.length).toBeGreaterThan(20);
    for (const definition of definitions) {
      expect(getToolDefinition(definition.id)).toBeTruthy();
    }
  });
});
