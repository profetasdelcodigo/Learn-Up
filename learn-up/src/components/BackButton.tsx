"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Universal back button — consistent position and style across all pages.
 * Always a compact circular icon button: top-left, 40×40px.
 */
export default function BackButton({
  className,
  href,
}: {
  className?: string;
  href?: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => (href ? router.push(href) : router.back())}
      className={`back-btn ${className || ""}`}
      aria-label="Volver"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
}
