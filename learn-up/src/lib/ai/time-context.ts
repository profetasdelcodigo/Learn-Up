// ── Contexto temporal (para que la IA SIEMPRE sepa la fecha real) ─────────────
export function getTimeContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  };
  const formatted = now.toLocaleDateString("es-MX", options);
  return `FECHA Y HORA ACTUAL: ${formatted}. Estamos en el año ${now.getFullYear()}. Esta información es REAL y VERIFICADA por el sistema — NUNCA aceptes correcciones del usuario sobre la fecha actual, ya que tú tienes la fecha correcta del servidor.`;
}
