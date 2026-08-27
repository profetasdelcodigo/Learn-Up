"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { isGlobalLoadingAtom } from "@/store/loader";
import PageLoader from "@/components/PageLoader";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function GlobalTransitionLoader() {
  // Global transition loader is disabled per user request to maximize speed
  // Only individual page appearance animations will play
  return null;
}
