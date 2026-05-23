-- Ejecuta esto en el editor SQL de tu panel de Supabase (Proyecto Learn Up: pylxmtgzhngkdjxnufyf)
-- Este script crea la base del Learn Graph, activa pgvector y define la función de búsqueda semántica.

-- 1. Habilitar la extensión de Inteligencia Artificial (vectores)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear tabla de Nodos de Conocimiento (conceptos aprendidos)
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    embedding vector(768), -- Vector de 768 dimensiones (ej. text-embedding-004)
    confidence_level INTEGER DEFAULT 5 CHECK (confidence_level BETWEEN 1 AND 10),
    source_type TEXT,      -- ej: 'chat_ia', 'library_pdf', 'practice'
    source_id TEXT,        -- ID de referencia opcional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear tabla de Enlaces de Conocimiento (aristas del grafo relacional)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    source_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT DEFAULT 'related_to',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar la seguridad (Row Level Security)
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de seguridad para asegurar la privacidad del estudiante
-- Políticas para knowledge_nodes
CREATE POLICY "Users view own knowledge nodes" 
ON public.knowledge_nodes FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own knowledge nodes" 
ON public.knowledge_nodes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own knowledge nodes" 
ON public.knowledge_nodes FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own knowledge nodes" 
ON public.knowledge_nodes FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Políticas para knowledge_edges
CREATE POLICY "Users view own knowledge edges" 
ON public.knowledge_edges FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own knowledge edges" 
ON public.knowledge_edges FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own knowledge edges" 
ON public.knowledge_edges FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own knowledge edges" 
ON public.knowledge_edges FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 6. Crear función RPC para la búsqueda semántica basada en similitud de coseno
CREATE OR REPLACE FUNCTION public.match_knowledge_nodes(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  confidence_level int,
  source_type text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    kn.id,
    kn.title,
    kn.description,
    kn.confidence_level::int,
    kn.source_type,
    kn.created_at,
    (1 - (kn.embedding <=> query_embedding))::float AS similarity
  FROM public.knowledge_nodes kn
  WHERE kn.user_id = auth.uid()
    AND (1 - (kn.embedding <=> query_embedding)) > match_threshold
  ORDER BY kn.embedding <=> query_embedding
  LIMIT match_count;
$$;
