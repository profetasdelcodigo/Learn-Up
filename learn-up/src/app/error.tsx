"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * error.tsx — Next.js App Router global error boundary.
 * Rendered automatically when a Server Component or page throws.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error.tsx]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-brand-black p-8 text-center">
      {/* Animated ring */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full border-2 border-red-500/30 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-red-500/60 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
      </div>

      <h1 className="text-2xl font-black text-white mb-3">Ups, algo falló</h1>
      <p className="text-gray-400 text-sm max-w-sm mb-2 leading-relaxed">
        Un error inesperado ocurrió. No te preocupes — tus datos están seguros.
        Puedes reintentar o volver al inicio.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-700 font-mono bg-gray-900 px-3 py-1.5 rounded-lg mb-6">
          Ref: {error.digest}
        </p>
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-6 py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
        <a
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white border border-gray-700 font-semibold rounded-full hover:border-brand-gold/50 transition-all"
        >
          <Home className="w-4 h-4" />
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
