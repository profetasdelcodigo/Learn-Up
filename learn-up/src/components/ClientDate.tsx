/**
 * ClientDate - Renders a date ONLY on the client to avoid hydration mismatches (Error 418).
 * Server renders a safe placeholder; client replaces it with the real locale-formatted date.
 */
"use client";

import { useEffect, useState } from "react";

interface ClientDateProps {
  dateString: string;
  format?: "short" | "long" | "time" | "relative";
  locale?: string;
  className?: string;
}

function getRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHour < 24) return `hace ${diffHour}h`;
  if (diffDay < 7) return `hace ${diffDay}d`;
  return date.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
}

export default function ClientDate({
  dateString,
  format = "short",
  locale = "es-ES",
  className,
}: ClientDateProps) {
  const [label, setLabel] = useState<string>("···"); // safe placeholder

  useEffect(() => {
    const date = new Date(dateString);
    let formatted: string;

    switch (format) {
      case "relative":
        formatted = getRelative(date);
        break;
      case "time":
        formatted = date.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        });
        break;
      case "long":
        formatted = date.toLocaleString(locale);
        break;
      case "short":
      default:
        formatted = date.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
        });
    }

    setLabel(formatted);
  }, [dateString, format, locale]);

  return <span className={className}>{label}</span>;
}
