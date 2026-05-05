import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// In a server environment, we ideally use a service role key to bypass RLS,
// but for simplicity we can use the anon key if RLS allows it, or assume this is server-side.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

const LIMITS: Record<string, number> = {
  tavily: 1000,
  serper: 2000,
};

function getCurrentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Verifica si el servicio todavía tiene tokens disponibles este mes.
 */
export async function canUseService(serviceName: string): Promise<boolean> {
  const limit = LIMITS[serviceName];
  if (!limit) return true; // Si no hay límite configurado, se permite

  const month = getCurrentMonth();

  try {
    const { data, error } = await supabase
      .from('api_usage')
      .select('usage_count')
      .eq('service_name', serviceName)
      .eq('month', month)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error verificando cuota de ${serviceName}:`, error);
      return true; // En caso de duda, permitimos para no bloquear la app
    }

    if (data) {
      // Detenemos ANTES de que alcance el límite exacto para no agotar la cuenta
      if (data.usage_count >= limit) {
        console.warn(`Límite alcanzado para ${serviceName} este mes (${data.usage_count}/${limit}).`);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error(`Exception verificando cuota de ${serviceName}:`, error);
    return true;
  }
}

/**
 * Incrementa el uso del servicio en 1.
 */
export async function incrementUsage(serviceName: string): Promise<void> {
  const month = getCurrentMonth();

  try {
    // Intentar buscar el registro del mes
    const { data, error } = await supabase
      .from('api_usage')
      .select('id, usage_count')
      .eq('service_name', serviceName)
      .eq('month', month)
      .single();

    if (error && error.code === 'PGRST116') {
      // No existe, lo creamos
      await supabase.from('api_usage').insert({
        service_name: serviceName,
        month,
        usage_count: 1,
      });
    } else if (data) {
      // Existe, incrementamos
      await supabase
        .from('api_usage')
        .update({ usage_count: data.usage_count + 1, updated_at: new Date().toISOString() })
        .eq('id', data.id);
    }
  } catch (error) {
    console.error(`Error incrementando cuota de ${serviceName}:`, error);
  }
}
