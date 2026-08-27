-- Learn Up: align the Knowledge Graph RPC with the schema actually used by the table.
-- The original knowledge_nodes table was created with the pgvector type as vector(768),
-- while a later migration qualified the parameter as extensions.vector(768).
-- Apply after verifying the current database shape with the diagnostic SQL supplied separately.

CREATE OR REPLACE FUNCTION public.match_knowledge_nodes(
  query_embedding public.vector(768),
  match_threshold double precision DEFAULT 0.65,
  match_count integer DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  confidence_level integer,
  source_type text,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    kn.id,
    kn.title,
    kn.description,
    kn.confidence_level,
    kn.source_type,
    kn.created_at,
    (1 - (kn.embedding <=> query_embedding))::double precision AS similarity
  FROM public.knowledge_nodes AS kn
  WHERE kn.user_id = p_user_id
    AND kn.embedding IS NOT NULL
    AND (1 - (kn.embedding <=> query_embedding)) > match_threshold
  ORDER BY kn.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_nodes(public.vector(768), double precision, integer, uuid)
  TO authenticated, service_role;
