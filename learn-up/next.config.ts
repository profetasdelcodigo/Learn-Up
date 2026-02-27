import type { NextConfig } from "next";

// @ts-expect-error: next-pwa lacks type declaration file
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Configuración de PWA y rendimiento
};

export default withPWA(nextConfig);
