import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

import MainLayout from "@/components/MainLayout";
import PushNotificationManager from "@/components/PushNotificationManager";
import SmoothScroll from "@/components/SmoothScroll";
import HardwareBackHandler from "@/components/HardwareBackHandler";
import OfflineDetector from "@/components/OfflineDetector";
import DeepLinkHandler from "@/components/DeepLinkHandler";

export const metadata: Metadata = {
  metadataBase: new URL("https://learn-up-qmgx.onrender.com"),
  title: "Learn Up | Tu Tutor Inteligente con IA",
  description:
    "La plataforma educativa del futuro impulsada por Inteligencia Artificial. Estudia en cualquier lugar del mundo, resuelve exámenes a medida, crea salas de estudio virtuales y domina cualquier tema con tu Tutor IA.",
  keywords: [
    "educación global",
    "inteligencia artificial",
    "tutor IA",
    "aprender en línea",
    "salas de estudio virtuales",
    "Learn Up",
    "exámenes con IA",
    "herramientas para estudiantes",
    "latinoamérica",
  ],
  authors: [{ name: "Learn Up Team" }],
  openGraph: {
    title: "Learn Up | El futuro de la educación mundial con IA",
    description:
      "Únete a estudiantes de todo el mundo en Learn Up. Potencia tu aprendizaje con inteligencia artificial, salas interactivas y tutores 24/7.",
    url: "https://learn-up-qmgx.onrender.com",
    siteName: "Learn Up",
    locale: "es",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
  verification: {
    google: "zl6ZuW5FSlPy4L91cqxU7FWLmQ9yLsR-B8K3oS4JiOQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} antialiased bg-brand-black text-white`}
      >
        <SmoothScroll>
          <OfflineDetector />
          <PushNotificationManager />
          <HardwareBackHandler />
          <DeepLinkHandler />
          <MainLayout>{children}</MainLayout>
        </SmoothScroll>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["EducationalOrganization", "WebApplication"],
              name: "Learn Up",
              url: "https://learn-up-qmgx.onrender.com",
              logo: "https://learn-up-qmgx.onrender.com/favicon.svg",
              description:
                "La plataforma educativa del futuro impulsada por Inteligencia Artificial. Estudia en cualquier lugar del mundo, resuelve exámenes a medida y crea salas de estudio.",
              applicationCategory: "EducationalApplication",
              operatingSystem: "All",
            }),
          }}
        />
      </body>
    </html>
  );
}
