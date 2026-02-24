-- Migration: Add missing columns to chat_messages table
-- Fixes PGRST204 errors: "Could not find the 'is_deleted_for_everyone' column"

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

-- Also ensure updated_at column exists
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
