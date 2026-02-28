import { Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-black">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl border border-brand-gold/50 bg-brand-black/50 backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          {/* Outer Rotating Glow */}
          <div className="absolute inset-0 rounded-3xl border-t-2 border-brand-gold animate-[spin_3s_linear_infinite] opacity-50" />

          <Sparkles className="w-10 h-10 text-brand-gold animate-pulse" />
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-bold font-sans text-white tracking-widest uppercase mb-2 text-glow">
            Learn <span className="text-brand-gold">Up</span>
          </h2>
          <div className="flex gap-1">
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
