"use client";

import React from "react";

const LEGAL_TEXT = `# Términos y Condiciones

## Learn Up S.A.C.

### Última actualización
26 de agosto de 2026

- **Plataforma:** Learn Up
- **Servicio:** Herramientas educativas asistidas por IA
- **Jurisdicción:** Perú
`;

export default function LegalPage() {
  return (
    <main className="min-h-screen p-6 md:p-10 bg-[var(--background)] text-[var(--foreground)]">
      <article className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-black/20 p-6 md:p-10">
        {LEGAL_TEXT.split("\n").map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <br key={lIdx} />;

          if (trimmed.startsWith("### "))
            return (
              <h4 key={lIdx} className="mt-6 mb-2 text-base font-bold text-brand-gold">
                {trimmed.replace(/^###\s*/, "")}
              </h4>
            );
          if (trimmed.startsWith("## "))
            return (
              <h3 key={lIdx} className="mt-8 mb-3 text-lg font-bold text-[var(--foreground)]">
                {trimmed.replace(/^##\s*/, "")}
              </h3>
            );
          if (trimmed.startsWith("# "))
            return (
              <h2 key={lIdx} className="mt-4 mb-6 text-2xl md:text-3xl font-display font-bold text-[var(--foreground)]">
                {trimmed.replace(/^#\s*/, "")}
              </h2>
            );

          if (trimmed.startsWith("- ")) {
            const parts = trimmed.replace(/^- /, "").split("**");
            if (parts.length > 2) {
              return (
                <li key={lIdx} className="my-2 ml-4 list-disc marker:text-brand-gold">
                  <strong className="text-[var(--foreground)]">{parts[1]}</strong>
                  {parts[2]}
                </li>
              );
            }
            return (
              <li key={lIdx} className="my-2 ml-4 list-disc marker:text-brand-gold">
                {trimmed.replace(/^- /, "")}
              </li>
            );
          }

          return <p key={lIdx} className="my-2 leading-7">{trimmed}</p>;
        })}
      </article>
    </main>
  );
}
