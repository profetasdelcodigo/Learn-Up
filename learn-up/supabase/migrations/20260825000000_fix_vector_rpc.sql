-- MIGRATION: Fix pgvector RPC signature for knowledge_nodes

-- Drop the old function (in case the signature changes entirely, 
-- but since we're just casting or changing type names, it's safer to drop or replace).
-- We'll just CREATE OR REPLACE with the exact correct type.
-- We ensure the parameter is typed strictly as public.vector.

CREATE OR REPLACE FUNCTION public.match_knowledge_nodes(
  query_embedding public.vector(768),
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
  'Busca conceptos semánticamente similares en el Learn Graph de un estudiante usando cosine similarity. (Fixed Signature)';
