-- MIGRATION: Fix pgvector RPC signature for document chunks

CREATE OR REPLACE FUNCTION public.match_document_chunks (
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    adc.id, 
    adc.content, 
    adc.chunk_index, 
    adc.metadata, 
    (1 - (adc.embedding OPERATOR(extensions.<=>) query_embedding))::float as similarity 
  FROM public.ai_document_chunks adc
  WHERE 
    adc.user_id = p_user_id
    AND adc.embedding IS NOT NULL
    AND (1 - (adc.embedding OPERATOR(extensions.<=>) query_embedding)) > match_threshold 
  ORDER BY adc.embedding OPERATOR(extensions.<=>) query_embedding 
  LIMIT match_count;
END;
$$;
