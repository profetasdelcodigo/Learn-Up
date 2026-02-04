import React from "react";

export default function Logo({
  className = "w-8 h-8",
  classNameText = "text-xl",
}: {
  className?: string;
  classNameText?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative flex items-center justify-center ${className} text-brand-gold`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full"
        >
          {/* Book */}
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <path d="M12 6c0 2-2 3-2 5" />

          {/* Neural Network Nodes (Minimalist overlay) */}
          <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />

          {/* Connections */}
          <path d="M12 13L16 8" strokeWidth="1" className="opacity-70" />
          <path d="M12 13L8 8" strokeWidth="1" className="opacity-70" />
        </svg>
      </div>
      <span className={`font-bold text-white tracking-tight ${classNameText}`}>
        Learn Up
      </span>
    </div>
  );
}
