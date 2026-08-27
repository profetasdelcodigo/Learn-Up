-- ============================================================================
-- Migración: Crear tablas del Knowledge Graph y Habits
-- Estas tablas son usadas por knowledge-graph.ts y ai-tools.ts
-- pero nunca fueron creadas formalmente.
-- ============================================================================

-- 1. Habilitar la extensión pgvector (necesaria para embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. Tabla: knowledge_nodes (Learn Graph — conceptos aprendidos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  embedding vector(768),  -- Dimensión del embedding de Gemini
  confidence_level integer DEFAULT 5 CHECK (confidence_level BETWEEN 1 AND 10),
  source_type text DEFAULT 'chat_ia' CHECK (source_type IN ('chat_ia', 'manual', 'exam', 'import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para knowledge_nodes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_user_id 
  ON public.knowledge_nodes(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_embedding 
  ON public.knowledge_nodes 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

COMMENT ON TABLE public.knowledge_nodes IS 
  'Conceptos aprendidos por cada estudiante, con embeddings para búsqueda semántica (Learn Graph)';

-- ============================================================================
-- 3. Tabla: knowledge_edges (relaciones entre conceptos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'related_to' CHECK (
    relationship_type IN ('related_to', 'prerequisite_of', 'extends', 'contrasts_with')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_node_id, target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_user_id 
  ON public.knowledge_edges(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source 
  ON public.knowledge_edges(source_node_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target 
  ON public.knowledge_edges(target_node_id);

COMMENT ON TABLE public.knowledge_edges IS 
  'Relaciones entre conceptos en el Learn Graph de cada estudiante';

-- ============================================================================
-- 4. Función RPC: match_knowledge_nodes (búsqueda semántica por embedding)
-- Usada por knowledge-graph.ts → findRelatedConcepts()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_knowledge_nodes(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  confidence_level integer,
  source_type text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kn.id,
    kn.title,
    kn.description,
    kn.confidence_level,
    kn.source_type,
    kn.created_at,
    (1 - (kn.embedding <=> query_embedding))::float AS similarity
  FROM public.knowledge_nodes kn
  WHERE 
    kn.user_id = p_user_id
    AND kn.embedding IS NOT NULL
    AND (1 - (kn.embedding <=> query_embedding)) > match_threshold
  ORDER BY kn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_knowledge_nodes IS 
  'Busca conceptos semánticamente similares en el Learn Graph de un estudiante usando cosine similarity';

-- ============================================================================
-- 5. Tabla: habits (Rastreador de hábitos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  streak integer DEFAULT 0,
  completed_dates jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id 
  ON public.habits(user_id);

COMMENT ON TABLE public.habits IS 
  'Hábitos de estudio de cada usuario, con streaks y fechas completadas';

-- ============================================================================
-- 6. RLS básico (las políticas detalladas van en la migración de auditoría)
-- ============================================================================
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. Grants para el rol authenticated
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_nodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_edges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_nodes TO authenticated;

-- También al service_role para operaciones de backend
GRANT ALL ON public.knowledge_nodes TO service_role;
GRANT ALL ON public.knowledge_edges TO service_role;
GRANT ALL ON public.habits TO service_role;
GRANT EXECUTE ON FUNCTION public.match_knowledge_nodes TO service_role;
