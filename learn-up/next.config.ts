import type { NextConfig } from "next";
import path from "path";

// @ts-expect-error: next-pwa lacks type declaration file
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Silencia el warning de workspace root en Render
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withPWA(nextConfig);
