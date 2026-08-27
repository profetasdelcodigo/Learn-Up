-- MIGRATION: 20260718000000_chat_social_upgrade.sql
-- Descripción: Agrega soporte para grupos avanzados, miembros de sala, tipos de media y reacciones

-- 1. Crear tabla de miembros de sala (room_members)
CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    muted_until TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(room_id, user_id)
);

-- Habilitar RLS en room_members
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of rooms they are in" 
ON public.room_members FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.room_members rm 
        WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own membership (e.g. mute, last_read_at)" 
ON public.room_members FOR UPDATE 
USING (user_id = auth.uid());

-- 2. Modificar tabla de mensajes
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS media_type TEXT, -- 'image', 'file', 'poll'
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB; -- Para guardar opciones de encuestas, resultados, etc.

-- 3. Crear tabla de reacciones (message_reactions)
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

-- Habilitar RLS en message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their rooms" 
ON public.message_reactions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.chat_messages m
        JOIN public.room_members rm ON rm.room_id = m.room_id
        WHERE m.id = message_reactions.message_id AND rm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can react to messages in their rooms" 
ON public.message_reactions FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_messages m
        JOIN public.room_members rm ON rm.room_id = m.room_id
        WHERE m.id = message_id AND rm.user_id = auth.uid()
    )
    AND user_id = auth.uid()
);

CREATE POLICY "Users can remove their own reactions" 
ON public.message_reactions FOR DELETE 
USING (user_id = auth.uid());


-- 4. Migrar datos existentes (de chat_rooms.participants a room_members)
DO $$
DECLARE
    r RECORD;
    participant_id UUID;
    is_admin BOOLEAN;
BEGIN
    FOR r IN SELECT id, participants, admins FROM public.chat_rooms LOOP
        -- Iterar sobre el arreglo (UUID[] o TEXT[])
        IF r.participants IS NOT NULL THEN
            FOREACH participant_id IN ARRAY r.participants::UUID[] LOOP
                -- Verificar si es admin
                is_admin := false;
                IF r.admins IS NOT NULL THEN
                    IF participant_id::TEXT = ANY(r.admins::TEXT[]) THEN
                        is_admin := true;
                    END IF;
                END IF;

                -- Insertar ignorando conflictos (por el UNIQUE constraint)
                -- Y verificar que el usuario exista en auth.users para evitar error 23503
                INSERT INTO public.room_members (room_id, user_id, role)
                SELECT r.id, participant_id, CASE WHEN is_admin THEN 'admin' ELSE 'member' END
                WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = participant_id)
                ON CONFLICT (room_id, user_id) DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END $$;
