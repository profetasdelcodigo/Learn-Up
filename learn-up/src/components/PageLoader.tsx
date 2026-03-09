import { Sparkles } from "lucide-react";

/**
 * Universal premium loading screen — used across all pages for consistent UX.
 * Replaces all bare <Loader2 className="animate-spin" /> full-page loaders.
 */
export default function PageLoader({
  label = "Cargando...",
}: {
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black">
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo container */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl border border-brand-gold/50 bg-brand-black/50 backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          {/* Rotating golden border */}
          <div className="absolute inset-0 rounded-3xl border-t-2 border-brand-gold animate-[spin_3s_linear_infinite] opacity-50" />
          <Sparkles className="w-10 h-10 text-brand-gold animate-pulse" />
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold text-white tracking-widest uppercase">
            Learn <span className="text-brand-gold">Up</span>
          </h2>
          {label && <p className="text-sm text-gray-400">{label}</p>}
          {/* Bouncing dots */}
          <div className="flex gap-1 mt-1">
            <span
              className="w-2 h-2 rounded-full bg-brand-gold animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-brand-gold animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-brand-gold animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
