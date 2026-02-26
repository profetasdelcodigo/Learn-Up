-- Migration: Add missing columns to chat_rooms for advanced Group Settings
-- Fixes Phase 39 Error 500 when creating groups

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS admins TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS only_admins_message BOOLEAN DEFAULT FALSE;
