import { createAdminClient } from "@/utils/supabase/admin";

const LIMITS: Record<string, number> = {
  tavily: 1000,
  serper: 2000,
};

function getCurrentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function canUseService(serviceName: string): Promise<boolean> {
  const limit = LIMITS[serviceName];
  if (!limit) return true;

  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("No se puede verificar cuota: falta SUPABASE_SERVICE_ROLE_KEY.");
    return true;
  }

  const month = getCurrentMonth();

  try {
    const { data, error } = await supabase
      .from("api_usage")
      .select("usage_count")
      .eq("service_name", serviceName)
      .eq("month", month)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error(`Error verificando cuota de ${serviceName}:`, error);
      return true;
    }

    if (data && data.usage_count >= limit) {
      console.warn(
        `Limite alcanzado para ${serviceName} este mes (${data.usage_count}/${limit}).`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exception verificando cuota de ${serviceName}:`, error);
    return true;
  }
}

export async function incrementUsage(serviceName: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.warn("No se puede incrementar cuota: falta SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const month = getCurrentMonth();

  try {
    const { data, error } = await supabase
      .from("api_usage")
      .select("id, usage_count")
      .eq("service_name", serviceName)
      .eq("month", month)
      .single();

    if (error && error.code === "PGRST116") {
      await supabase.from("api_usage").insert({
        service_name: serviceName,
        month,
        usage_count: 1,
      });
    } else if (data) {
      await supabase
        .from("api_usage")
        .update({
          usage_count: data.usage_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    } else if (error) {
      console.error(`Error leyendo cuota de ${serviceName}:`, error);
    }
  } catch (error) {
    console.error(`Error incrementando cuota de ${serviceName}:`, error);
  }
}
