-- Supabase Migration: Purge Unused Tables
-- This script removes all dead and duplicate tables from the schema to improve performance and maintainability.

-- Drop unused social / chat tables
DROP TABLE IF EXISTS public.event_chats CASCADE;

-- Drop duplicated / old habit tables
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habit_entries CASCADE;

-- Drop duplicated events table (we use calendar_events and shared_calendar_events)
DROP TABLE IF EXISTS public.events CASCADE;

-- Drop duplicated notifications table (we use notifications, not notification_log)
DROP TABLE IF EXISTS public.notification_log CASCADE;

-- Drop unused study tools tables
DROP TABLE IF EXISTS public.exam_questions CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.flashcard_cards CASCADE;
DROP TABLE IF EXISTS public.flashcard_decks CASCADE;
DROP TABLE IF EXISTS public.study_plans CASCADE;

-- Drop unused gamification / source saving tables
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.saved_sources CASCADE;
DROP TABLE IF EXISTS public.generated_content CASCADE;

-- (Intentionally preserving knowledge_nodes and knowledge_edges for the AI's Learn Graph)
