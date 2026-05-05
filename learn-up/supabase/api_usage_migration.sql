-- Ejecuta esto en el editor SQL de tu panel de Supabase (Learn Up)

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    month TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que solo haya un registro por servicio cada mes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_service_month'
    ) THEN
        ALTER TABLE api_usage ADD CONSTRAINT unique_service_month UNIQUE (service_name, month);
    END IF;
END $$;

-- Como actualmente te quedan 200 peticiones en Tavily (de 1000), 
-- insertamos 800 para que se detenga cuando gaste tus últimas 200 este mes.
INSERT INTO api_usage (service_name, month, usage_count) 
VALUES ('tavily', to_char(now(), 'YYYY-MM'), 800)
ON CONFLICT (service_name, month) 
DO UPDATE SET usage_count = 800;
