"use client";

/**
 * Skeleton components — animated placeholders for loading states.
 * Use these instead of spinners for content-aware loading UX.
 */

/** Base shimmer bar — any width/height */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-gray-800 rounded-lg animate-pulse ${className}`} />
  );
}

/** Card skeleton — matches the Library / Dashboard card shape */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gray-900/80 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 ${className}`}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="h-4 w-3/4" />
          <SkeletonBar className="h-3 w-1/2" />
        </div>
      </div>
      {/* Body lines */}
      <SkeletonBar className="h-3 w-full" />
      <SkeletonBar className="h-3 w-5/6" />
      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  );
}

/** Row skeleton — matches notification / list item shapes */
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border border-gray-800 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="h-4 w-2/3" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** 3-card grid skeleton — perfect for Library / Album grids */
export function SkeletonGrid({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Profile skeleton */
export function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="w-24 h-24 rounded-full bg-gray-800 animate-pulse" />
      <SkeletonBar className="h-5 w-40" />
      <SkeletonBar className="h-4 w-28" />
      <div className="w-full space-y-3 mt-4">
        <SkeletonBar className="h-14 w-full rounded-2xl" />
        <SkeletonBar className="h-14 w-full rounded-2xl" />
        <SkeletonBar className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
