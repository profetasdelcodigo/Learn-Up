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
import ConditionalNav from "@/components/ConditionalNav";

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
        <WelcomeTutorial />
        <main className="min-h-screen pb-20 md:pb-0">{children}</main>
        <ConditionalNav />
      </body>
    </html>
  );
}
