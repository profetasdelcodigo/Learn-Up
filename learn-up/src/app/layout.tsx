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

import WelcomeTutorial from "@/components/WelcomeTutorial";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Learn Up",
  description:
    "Plataforma educativa integral con IA, herramientas sociales y más.",
  icons: {
    icon: "/favicon.ico", // Using default for now, will replace with SVG later if asked, or just reference the component via code in head if standard favicon wasn't generated
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
        <WelcomeTutorial />
        <main className="min-h-screen pb-20 md:pb-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
