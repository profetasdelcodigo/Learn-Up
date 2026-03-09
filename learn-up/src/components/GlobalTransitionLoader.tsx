"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { isGlobalLoadingAtom } from "@/store/loader";
import PageLoader from "@/components/PageLoader";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function GlobalTransitionLoader() {
  const isGlobalLoading = useAtomValue(isGlobalLoadingAtom);
  const setIsGlobalLoading = useSetAtom(isGlobalLoadingAtom);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Reset local routing transition state when pathname or arguments actually change
  // with an artificial delay to allow the premium animation to be appreciated
  useEffect(() => {
    if (isGlobalLoading) {
      const timer = setTimeout(() => {
        setIsGlobalLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, isGlobalLoading, setIsGlobalLoading]);

  // Give a solid background on transitions or transparent? We want full premium overlay.
  if (!isGlobalLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-brand-black/90 backdrop-blur-sm transition-all duration-300">
      <PageLoader label="Recopilando el conocimiento..." />
    </div>
  );
}
