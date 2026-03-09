"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSetAtom } from "jotai";
import { isGlobalLoadingAtom } from "@/store/loader";

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
  const pathname = usePathname();
  const setIsGlobalLoading = useSetAtom(isGlobalLoadingAtom);

  const handleBack = () => {
    setIsGlobalLoading(true);
    if (href) {
      if (pathname !== href) {
        router.push(href);
      } else {
        setIsGlobalLoading(false);
      }
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`back-btn ${className || ""}`}
      aria-label="Volver"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
}
