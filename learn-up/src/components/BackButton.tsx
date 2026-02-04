"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/utils/cn"; // Assuming utils/cn exists, or I will use standard class string

export default function BackButton({
  className,
  label = "Volver",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={`flex items-center gap-2 text-brand-gold hover:text-white transition-colors group mb-6 ${className || ""}`}
    >
      <div className="p-2 rounded-full bg-brand-gold/10 group-hover:bg-brand-gold/20 transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </div>
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );
}
