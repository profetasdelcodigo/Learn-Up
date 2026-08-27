"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * global-error.tsx — catches crashes in the root layout itself.
 * Must include <html> and <body> tags.
 */
export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          padding: "2rem",
          textAlign: "center",
          margin: 0,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "2px solid rgba(239,68,68,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <AlertTriangle style={{ width: 32, height: 32, color: "#f87171" }} />
        </div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: 12 }}>
          Error crítico
        </h1>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            maxWidth: 300,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          La aplicación encontró un error grave. Por favor recárgala.
        </p>
        <button
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            background: "#D4AF37",
            color: "#000",
            fontWeight: 700,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          <RefreshCw style={{ width: 16, height: 16 }} />
          Recargar app
        </button>
      </body>
    </html>
  );
}
