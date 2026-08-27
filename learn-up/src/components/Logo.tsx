import React from "react";

export default function Logo({
  className = "w-8 h-8",
  classNameText = "text-xl",
  showText = true,
}: {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative flex items-center justify-center ${className} text-brand-gold`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Book - Golden */}
          <path
            d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Blue Intelligence Sparkle/Star */}
          <g className="text-cyan-400">
            <path
              d="M15 6.5l0.5 1.5l1.5 0.5l-1.5 0.5l-0.5 1.5l-0.5-1.5l-1.5-0.5l1.5-0.5z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Neural Network Nodes - Blue accent */}
          <g className="text-cyan-400/80">
            <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="14" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
          </g>

          {/* Subtle connections */}
          <g className="text-cyan-400/40" strokeWidth="1">
            <path d="M12 11L10 14" stroke="currentColor" />
            <path d="M12 11L14 14" stroke="currentColor" />
          </g>
        </svg>
      </div>
      {showText && (
        <span
          className={`font-bold text-white tracking-tight ${classNameText}`}
        >
          Learn Up
        </span>
      )}
    </div>
  );
}
