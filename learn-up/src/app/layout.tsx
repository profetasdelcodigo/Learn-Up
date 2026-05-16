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
  title: "Learn Up | Tu Tutor IA",
  description:
    "Plataforma educativa integral con IA, herramientas sociales y más.",
  icons: {
    icon: "/favicon.svg",
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
      </body>
    </html>
  );
}
