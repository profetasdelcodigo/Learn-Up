import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import withPWAInit from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const appDir = dirname(fileURLToPath(import.meta.url));
const buildCacheId =
  process.env.RENDER_GIT_COMMIT ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  "local";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  buildExcludes: [/middleware-manifest\.json$/],
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/[^/]+\/chat(?:\/.*)?$/i,
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https?:\/\/[^/]+\/ai(?:\/.*)?$/i,
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/chat(?:\/.*)?$/i,
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
      /Module not found: Can't resolve 'encoding'/,
      /Module not found: Can't resolve 'canvas'/,
      /Module not found: Can't resolve 'sharp'/,
    ];

    return config;
  },
  async headers() {
    const headers = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "media-src 'self' data: blob: https:",
          "connect-src 'self' https: wss: blob:",
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];

    return [{ source: "/(.*)", headers }];
  },
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: "/monitoring",
};

export default withSentryConfig(withPWA(nextConfig), sentryOptions);