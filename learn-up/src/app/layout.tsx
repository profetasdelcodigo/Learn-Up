import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
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
import ShareModal from "@/components/ShareModal";
import JarvisGlobalWidget from "@/components/JarvisGlobalWidget";

export const metadata: Metadata = {
  metadataBase: new URL("https://learn-up-qmgx.onrender.com"),
  title: "Learn Up | La Plataforma Educativa Global del Futuro",
  description:
    "Aprende con IA. Salas en vivo, exámenes a medida y más. ¡Gratis!",
  keywords: [
    "educación online",
    "salas de estudio virtuales",
    "tutor con inteligencia artificial",
    "aprender en línea",
    "plataforma educativa colaborativa",
    "Learn Up",
    "generador de exámenes IA",
    "estudio global",
  ],
  authors: [{ name: "Learn Up Team" }],
  openGraph: {
    title: "Learn Up | La Plataforma Educativa Global del Futuro",
    description:
      "Aprende con IA. Salas en vivo, exámenes a medida y más. ¡Gratis!",
    url: "https://learn-up-qmgx.onrender.com",
    siteName: "Learn Up",
    locale: "es",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Learn Up - La Plataforma Educativa Global del Futuro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn Up | La Plataforma Educativa Global del Futuro",
    description:
      "Aprende con IA. Salas en vivo, exámenes a medida y más. ¡Gratis!",
    images: ["/og-image.jpg"],
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
          <ShareModal />
          <JarvisGlobalWidget />
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
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
