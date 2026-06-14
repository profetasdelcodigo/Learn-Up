-- Activar RLS en las tablas críticas que faltaban
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- Políticas para calendar_events
DROP POLICY IF EXISTS "Users can only view their own calendar_events" ON public.calendar_events;
CREATE POLICY "Users can only view their own calendar_events" 
ON public.calendar_events FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar_events" ON public.calendar_events;
CREATE POLICY "Users can insert their own calendar_events" 
ON public.calendar_events FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar_events" ON public.calendar_events;
CREATE POLICY "Users can update their own calendar_events" 
ON public.calendar_events FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar_events" ON public.calendar_events;
CREATE POLICY "Users can delete their own calendar_events" 
ON public.calendar_events FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Políticas para knowledge_nodes
DROP POLICY IF EXISTS "Users can only view their own knowledge_nodes" ON public.knowledge_nodes;
CREATE POLICY "Users can only view their own knowledge_nodes" 
ON public.knowledge_nodes FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own knowledge_nodes" ON public.knowledge_nodes;
CREATE POLICY "Users can insert their own knowledge_nodes" 
ON public.knowledge_nodes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own knowledge_nodes" ON public.knowledge_nodes;
CREATE POLICY "Users can update their own knowledge_nodes" 
ON public.knowledge_nodes FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own knowledge_nodes" ON public.knowledge_nodes;
CREATE POLICY "Users can delete their own knowledge_nodes" 
ON public.knowledge_nodes FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Políticas para habits
DROP POLICY IF EXISTS "Users can only view their own habits" ON public.habits;
CREATE POLICY "Users can only view their own habits" 
ON public.habits FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own habits" ON public.habits;
CREATE POLICY "Users can insert their own habits" 
ON public.habits FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own habits" ON public.habits;
CREATE POLICY "Users can update their own habits" 
ON public.habits FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habits;
CREATE POLICY "Users can delete their own habits" 
ON public.habits FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
