import type { NextConfig } from "next";

// @ts-ignore
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Configuración de PWA y rendimiento
};

export default withPWA(nextConfig);
