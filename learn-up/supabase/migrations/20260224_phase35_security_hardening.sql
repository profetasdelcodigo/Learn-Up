-- ============================================================
-- Migration: Phase 35 — DB Security & Performance Hardening
-- Fixes all Supabase Security Advisor ERRORs and key WARNINGs
-- ============================================================

-- ── 1. Enable RLS on habit_tracker (ERROR: rls_disabled_in_public) ──────────
ALTER TABLE public.habit_tracker ENABLE ROW LEVEL SECURITY;

-- Allow users to manage only their own habits
CREATE POLICY "Users manage own habit_tracker"
  ON public.habit_tracker FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── 2. Add indexes for unindexed foreign keys (INFO: unindexed_foreign_keys) ─
-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- event_chats
CREATE INDEX IF NOT EXISTS idx_event_chats_event_id ON public.event_chats(event_id);

-- events
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

-- friendships
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON public.friendships(addressee_id);

-- habit_logs
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON public.habit_logs(user_id);

-- habit_tracker
CREATE INDEX IF NOT EXISTS idx_habit_tracker_user_id ON public.habit_tracker(user_id);

-- library_items
CREATE INDEX IF NOT EXISTS idx_library_items_user_id ON public.library_items(user_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ── 3. Fix auth.uid() re-evaluation in RLS policies (PERF: auth_rls_initplan) ─
-- Replace auth.uid() with (select auth.uid()) to avoid row-by-row re-evaluation

-- recipes
DROP POLICY IF EXISTS "Users can see own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can save recipes" ON public.recipes;

CREATE POLICY "Users can see own recipes"
  ON public.recipes FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can save recipes"
  ON public.recipes FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- events
DROP POLICY IF EXISTS "Usuarios pueden manejar sus propios eventos" ON public.events;
CREATE POLICY "Usuarios pueden manejar sus propios eventos"
  ON public.events FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- event_participants (Participantes pueden ver sus eventos)
DROP POLICY IF EXISTS "Participantes pueden ver sus eventos" ON public.event_participants;
CREATE POLICY "Participantes pueden ver sus eventos"
  ON public.event_participants FOR SELECT
  USING ((select auth.uid()) = user_id);

-- event_chats
DROP POLICY IF EXISTS "Chat visible para participantes" ON public.event_chats;
CREATE POLICY "Chat visible para participantes"
  ON public.event_chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = event_chats.event_id
        AND ep.user_id = (select auth.uid())
    )
  );

-- push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- notifications (Insertar notificaciones)
DROP POLICY IF EXISTS "Insertar notificaciones" ON public.notifications;
CREATE POLICY "Insertar notificaciones"
  ON public.notifications FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ── 4. Fix mutable search_path on functions (WARN: function_search_path_mutable) ─
ALTER FUNCTION public.check_username SET search_path = public;
ALTER FUNCTION public.check_username_availability SET search_path = public;

-- ── 5. Clean up duplicate permissive policies on event_participants ──────────
-- "Acceso total participants" (true/true) conflicts with specific policies
DROP POLICY IF EXISTS "Acceso total participants" ON public.event_participants;
-- Re-create a clean single policy
CREATE POLICY "Event participants access"
  ON public.event_participants FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── 6. Clean up duplicate permissive policies on notifications ───────────────
DROP POLICY IF EXISTS "Acceso total notifications" ON public.notifications;
-- The remaining "Permitir todo notifications" and "Insertar notificaciones"
-- policies cover all needed access, this just eliminated the duplicate.
