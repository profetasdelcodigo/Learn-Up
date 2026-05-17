import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Learn Up - Plataforma Educativa con IA";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom right, #0A0A0A, #111827)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow Effects */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "-10%",
            width: "50%",
            height: "50%",
            background: "radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, rgba(0,0,0,0) 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            right: "-10%",
            width: "60%",
            height: "60%",
            background: "radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, rgba(0,0,0,0) 70%)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "140px",
            height: "140px",
            backgroundColor: "rgba(0, 229, 255, 0.1)",
            borderRadius: "50%",
            marginBottom: "40px",
            border: "2px solid rgba(0, 229, 255, 0.3)",
            boxShadow: "0 0 60px rgba(0, 229, 255, 0.2)",
          }}
        >
          {/* Lucide BookOpen Icon */}
          <svg
            width="70"
            height="70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00E5FF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <h1
          style={{
            fontSize: "84px",
            fontWeight: "bold",
            color: "white",
            marginBottom: "24px",
            textAlign: "center",
            letterSpacing: "-0.02em",
          }}
        >
          Learn Up
        </h1>
        <p
          style={{
            fontSize: "38px",
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.4,
          }}
        >
          La plataforma educativa del futuro.
          <br />
          Domina cualquier tema con tu Tutor IA 24/7.
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
