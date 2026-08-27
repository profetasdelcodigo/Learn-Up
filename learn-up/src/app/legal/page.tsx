"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LEGAL_TEXT } from "@/lib/legal-text";

export default function LegalPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg-base)]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--bg-base)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Link
            href="/dashboard/settings"
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--foreground)]">
              Marco Legal y Privacidad
            </h1>
            <p className="text-sm text-gray-500">
              Learn Up S.A.C.
            </p>
          </div>
        </div>
      </header>

      {/* ── Warning banner ── */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-start gap-3 rounded-xl border border-brand-emerald/30 bg-brand-emerald/10 p-4 text-sm text-brand-emerald/90">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Hemos adaptado nuestras políticas para que sean fáciles de entender para estudiantes, 
            cumpliendo con la normativa de protección al menor (COPPA/GDPR-K).
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="mx-auto max-w-4xl px-4 pb-20">
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass overflow-hidden rounded-2xl border border-white/10 px-8 py-10 shadow-2xl"
        >
          <div className="prose prose-invert prose-sm md:prose-base max-w-none text-gray-300">
            {LEGAL_TEXT.split("\n").map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <br key={lIdx} />;

              // Headers
              if (trimmed.startsWith("### "))
                return <h4 key={lIdx} className="mt-6 mb-2 text-base font-bold text-brand-gold">{trimmed.replace(/^###\s*/, "")}</h4>;
              if (trimmed.startsWith("## "))
                return <h3 key={lIdx} className="mt-8 mb-3 text-lg font-bold text-[var(--foreground)]">{trimmed.replace(/^##\s*/, "")}</h3>;
              if (trimmed.startsWith("# "))
                return <h2 key={lIdx} className="mt-4 mb-6 text-2xl md:text-3xl font-display font-bold text-[var(--foreground)]">{trimmed.replace(/^#\s*/, "")}</h2>;

              // Bullet lists
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
                return <li key={lIdx} className="my-2 ml-4 list-disc marker:text-brand-gold">{trimmed.replace(/^- /, "")}</li>;
              }

              // Italic footers
              if (trimmed.startsWith("*") && trimmed.endsWith("*")) {
                 return <p key={lIdx} className="mt-8 pt-6 border-t border-white/10 text-xs text-gray-500 italic text-center">{trimmed.replace(/\*/g, "")}</p>
              }

              // Dividers
              if (trimmed.startsWith("---")) {
                 return null;
              }

              // Regular paragraph
              return <p key={lIdx} className="my-3 leading-relaxed">{trimmed}</p>;
            })}
          </div>
        </motion.article>
      </main>
    </div>
  );
}
