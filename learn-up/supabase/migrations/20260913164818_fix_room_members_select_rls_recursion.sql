-- Fix recursive RLS policy on room_members.
-- The previous policy queried room_members from its own policy, causing PostgreSQL 42P17.

DROP POLICY IF EXISTS "Users can view members of rooms they are in" ON public.room_members;

CREATE POLICY "Users can view members of rooms they are in"
ON public.room_members
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE cr.id = room_members.room_id
          AND (SELECT auth.uid() AS uid) = ANY (cr.participants)
    )
);
