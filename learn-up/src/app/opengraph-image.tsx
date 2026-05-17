import { ImageResponse } from "next/og";

// Elimino edge runtime para que se genere estáticamente y WhatsApp no sufra timeout.

export const alt = "Learn Up - La Plataforma Educativa Global del Futuro";
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
          {/* Learn Up Logo - Book + Sparkle + Neural Nodes */}
          <svg
            width="70"
            height="70"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 6.5l0.5 1.5l1.5 0.5l-1.5 0.5l-0.5 1.5l-0.5-1.5l-1.5-0.5l1.5-0.5z"
              fill="#22d3ee"
              stroke="#22d3ee"
              strokeWidth="0.5"
            />
            <circle cx="10" cy="14" r="1" fill="#22d3ee" />
            <circle cx="14" cy="14" r="1" fill="#22d3ee" />
            <circle cx="12" cy="11" r="1" fill="#22d3ee" />
            <path d="M12 11L10 14" stroke="#22d3ee" strokeWidth="1" />
            <path d="M12 11L14 14" stroke="#22d3ee" strokeWidth="1" />
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
            fontSize: "32px",
            color: "#fbbf24",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.3,
            marginBottom: "16px",
            fontWeight: "600",
          }}
        >
          La Plataforma Educativa Global del Futuro
        </p>
        <p
          style={{
            fontSize: "24px",
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.5,
          }}
        >
          Salas de estudio interactivas · Generador de exámenes IA · Aprendizaje colaborativo mundial
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
