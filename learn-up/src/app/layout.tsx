import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import MainLayout from "@/components/MainLayout";
import PushNotificationManager from "@/components/PushNotificationManager";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-brand-black text-white`}
      >
        <PushNotificationManager />
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
