import { describe, expect, it } from "vitest";
import { aiRegistry } from "@/lib/ai/skills";
import { getToolDefinition, getToolDefinitions } from "@/lib/ai/tool-contract";
import { AI_AGENT_REGISTRY } from "@/lib/ai/agent-registry";

describe("Learn Up AI skills", () => {
  it("registers all universal skill packs currently supported", () => {
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
    expect(tools.length).toBeGreaterThan(1);
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

  it("keeps the five conversational entry points present", () => {
    expect(Object.keys(AI_AGENT_REGISTRY)).toEqual(expect.arrayContaining([
      "profesor",
      "examenes",
      "consejero",
      "jarvis",
    ]));
  });

  it("keeps canonical critical skills executable", () => {
    const critical = [
      "add_calendar_event", "read_calendar", "update_calendar_event", "delete_calendar_event", "create_recurring_event",
      "search_calendar_events", "add_habit", "read_habits", "complete_habit", "undo_habit", "delete_habit", "view_habit_stats",
      "send_message", "read_unread_messages", "read_full_conversation", "create_study_group", "add_group_member", "view_group_members",
      "edit_group_info", "leave_group", "search_user_by_name", "edit_sent_message", "delete_sent_message", "broadcast_message",
      "create_chat_poll", "pin_important_message", "react_with_emoji", "search_chat_history", "mute_chat_notifications", "export_chat_history",
      "summarize_conversation", "search_library", "search_documents", "upload_library_file", "delete_own_library_item", "list_indexed_documents",
      "delete_indexed_document", "summarize_document", "extract_questions_from_doc", "cite_source", "index_url_as_document", "analyze_source_credibility",
      "search_knowledge_graph", "view_related_concepts", "create_learning_path", "detect_knowledge_gaps", "spaced_repetition_review",
      "generate_concept_map", "view_progress_by_subject", "connect_two_concepts", "import_concepts_from_document", "calculate_mastery_score",
      "generate_summary", "create_study_plan", "generate_presentation_outline", "generate_essay", "generate_glossary", "generate_comparison_table",
      "generate_code", "generate_practice_questions", "generate_mind_map", "generate_bibliography", "generate_project_template", "generate_timeline",
      "generate_reading_sheet", "generate_rubric", "generate_research_report", "generate_syllabus", "generate_mermaid_diagram", "generate_podcast_script",
      "search_image", "analyze_image", "describe_math_image", "search_youtube_video", "search_youtube_transcripts", "generate_srt", "generate_thumbnail", "generate_ai_profile_avatar",
      "search_web", "advanced_web_search", "browse_web_page", "fact_check", "search_academic_paper", "search_wikipedia", "monitor_topic_realtime",
      "search_statistics_data", "compare_sources_multiple", "search_github_code", "search_open_education", "analyze_seo", "search_doi_isbn",
      "deep_research", "search_scientific_images", "analyze_search_trends", "search_legislation", "create_bibliography_from_search",
      "view_study_stats", "generate_weekly_report", "view_exam_history", "analyze_strengths_weaknesses", "view_habit_streaks",
      "compare_performance_timeframe", "project_readiness_level", "view_activity_heatmap", "view_time_spent_by_subject", "anonymous_peer_benchmark",
      "detect_procrastination", "generate_academic_dashboard", "export_progress_data", "analyze_study_quality", "calculate_gpa", "predict_exam_score",
      "update_profile", "update_avatar", "search_users", "send_friend_request", "accept_friend_request", "decline_friend_request", "remove_friend",
      "view_friends_list", "view_user_profile", "toggle_privacy_mode", "view_recent_activity", "upload_learning_album_image", "view_learning_album", "update_password", "view_badges_and_achievements",
      "solve_math_problem", "graph_math_function", "verify_derivative_integral", "balance_chemical_equation", "analyze_literary_text", "conjugate_verb",
      "translate_with_explanation", "practice_vocabulary", "solve_physics_problem", "analyze_statistical_data", "explain_with_analogy",
      "generate_subject_practice", "prepare_standardized_exam", "solve_programming_exercise", "analyze_artwork", "explain_scientific_phenomenon",
      "socratic_debate", "practice_language_speaking", "solve_multivariable_equation",
    ];

    const all = new Set(aiRegistry.getAllTools().map((tool) => tool.id));
    const missing = critical.filter((id) => !all.has(id));
    expect(missing).toEqual([]);
    for (const id of critical) expect(typeof aiRegistry.getTool(id)?.execute).toBe("function");
  });

  it("keeps the policy catalog internally resolvable", () => {
    const definitions = getToolDefinitions();
    expect(definitions.length).toBeGreaterThan(1);
    for (const definition of definitions) {
      expect(getToolDefinition(definition.id)).toBeTruthy();
      if (definition.risk === "high") expect(definition.requiresConfirmation).toBe(true);
    }
  });
});
