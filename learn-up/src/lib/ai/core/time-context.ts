const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || "America/Lima";

export function getCurrentDateTimeContext(timeZone = DEFAULT_TIME_ZONE): string {
  const now = new Date();
  const locale = "es-PE";
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "long",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const weekday = get("weekday");
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  const timeZoneName = get("timeZoneName");

  return [
    "CONTEXTO TEMPORAL ACTUAL — DATOS VERIFICADOS POR EL SERVIDOR",
    `Fecha: ${weekday}, ${day} de ${month} de ${year}`,
    `Hora local: ${hour}:${minute}:${second}`,
    `Zona horaria: ${timeZone}${timeZoneName ? ` (${timeZoneName})` : ""}`,
    `Timestamp ISO del servidor: ${now.toISOString()}`,
    "Usa estos datos como referencia absoluta para expresiones como hoy, mañana, ayer, esta semana, la próxima semana, este mes y fechas relativas. No inventes la fecha ni la hora.",
  ].join("\n");
}
