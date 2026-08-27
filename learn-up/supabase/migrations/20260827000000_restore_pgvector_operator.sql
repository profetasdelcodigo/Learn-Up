-- Restore the known-good pgvector signature/operator resolution.
-- The previous fix forced extensions.vector and extensions.<=>, which can fail
-- when pgvector is installed in the extension's configured schema/operator class.

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
  WHERE kn.user_id = p_user_id
    AND kn.embedding IS NOT NULL
    AND (1 - (kn.embedding <=> query_embedding)) > match_threshold
  ORDER BY kn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_nodes(vector(768), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_nodes(vector(768), float, int, uuid) TO service_role;
