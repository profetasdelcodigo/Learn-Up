-- Add environment_state JSONB column to ai_sessions to persist NotebookWhiteboard data
ALTER TABLE public.ai_sessions ADD COLUMN environment_state JSONB DEFAULT '{}'::jsonb;
