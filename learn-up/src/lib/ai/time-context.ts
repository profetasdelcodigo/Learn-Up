// Contexto temporal único de Learn Up. Por defecto usa la zona horaria de Perú.
const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || "America/Lima";

export function getTimeContext(timeZone = DEFAULT_TIME_ZONE): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("es-PE", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "long",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return [
    "FECHA Y HORA ACTUALES — VERIFICADAS POR EL SERVIDOR",
    `Día: ${get("weekday")}`,
    `Fecha: ${get("day")} de ${get("month")} de ${get("year")}`,
    `Hora exacta: ${get("hour")}:${get("minute")}:${get("second")}`,
    `Zona horaria: ${timeZone}`,
    `Timestamp ISO: ${now.toISOString()}`,
    "Usa este contexto para resolver hoy, mañana, ayer, esta semana, próxima semana, este mes y cualquier fecha relativa. No inventes ni supongas la fecha u hora actuales.",
  ].join("\n");
}
