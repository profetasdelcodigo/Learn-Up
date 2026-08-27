-- ============================================================================
-- Habilitar extensiones necesarias para Database Webhooks de Supabase
-- Resuelve: ERROR 3F000: schema "supabase_functions" does not exist
-- ============================================================================

-- pg_net permite hacer peticiones HTTP desde PostgreSQL (necesario para webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- El schema supabase_functions es creado automáticamente por Supabase
-- cuando se habilita pg_net, pero si no existe, lo creamos manualmente:
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- Función auxiliar que Supabase Database Webhooks necesita
CREATE OR REPLACE FUNCTION supabase_functions.http_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = supabase_functions
AS $$
DECLARE
  request_id bigint;
  payload jsonb;
  url text := TG_ARGV[0]::text;
  method text := TG_ARGV[1]::text;
  headers jsonb DEFAULT '{}'::jsonb;
  params jsonb DEFAULT '{}'::jsonb;
  timeout_ms integer DEFAULT 1000;
BEGIN
  IF url IS NULL OR url = 'null' THEN
    RETURN NEW;
  END IF;

  IF TG_ARGV[2] IS NOT NULL THEN
    headers = TG_ARGV[2]::jsonb;
  END IF;

  IF TG_ARGV[3] IS NOT NULL THEN
    params = TG_ARGV[3]::jsonb;
  END IF;

  IF TG_ARGV[4] IS NOT NULL THEN
    timeout_ms = TG_ARGV[4]::integer;
  END IF;

  CASE
    WHEN method = 'GET' THEN
      SELECT http_get INTO request_id FROM net.http_get(
        url,
        params,
        headers,
        timeout_ms
      );
    WHEN method = 'POST' THEN
      payload = jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        'schema', TG_TABLE_SCHEMA,
        'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END
      );
      SELECT http_post INTO request_id FROM net.http_post(
        url,
        payload,
        params,
        headers,
        timeout_ms
      );
    ELSE
      RAISE EXCEPTION 'method must be GET or POST';
  END CASE;

  RETURN NEW;
END
$$;
