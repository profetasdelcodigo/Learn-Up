-- Ensure poll creators cannot be spoofed by other authenticated users.
DROP POLICY IF EXISTS "Users can create polls in their rooms" ON public.chat_polls;

CREATE POLICY "Users can create polls in their rooms"
ON public.chat_polls
FOR INSERT
TO authenticated
WITH CHECK (
  creator_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.room_members rm
    WHERE rm.room_id = chat_polls.room_id
      AND rm.user_id = (SELECT auth.uid())
  )
);
