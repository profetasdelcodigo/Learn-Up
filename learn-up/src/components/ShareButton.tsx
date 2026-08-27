"use client";

import { useAtom } from "jotai";
import { shareModalOpenAtom, sharePayloadAtom, type SharePayload } from "@/lib/store";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  payload: SharePayload;
  className?: string;
  variant?: "icon" | "text" | "full";
}

export default function ShareButton({ payload, className = "", variant = "icon" }: ShareButtonProps) {
  const [, setOpen] = useAtom(shareModalOpenAtom);
  const [, setPayload] = useAtom(sharePayloadAtom);

  const handleShare = () => {
    setPayload(payload);
    setOpen(true);
  };

  if (variant === "text") {
    return (
      <button onClick={handleShare} className={`text-amber-500 hover:text-amber-400 font-medium ${className}`}>
        Compartir
      </button>
    );
  }

  if (variant === "full") {
    return (
      <button onClick={handleShare} className={`flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors ${className}`}>
        <Share2 className="w-4 h-4" />
        <span>Compartir</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleShare} 
      className={`p-2 rounded-full text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors ${className}`}
      title="Compartir"
    >
      <Share2 className="w-5 h-5" />
    </button>
  );
}
