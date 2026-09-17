import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
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
  cacheId: `learn-up-${buildCacheId}`,
  // Source maps are useful for Sentry/uploaded diagnostics but should not be
  // precached by the PWA service worker. They can be several MB each.
  buildExcludes: [/\.map$/],
  runtimeCaching: [
    {
      urlPattern: /\/chat(?:\/.*)?(?:\?.*)?$/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /\/ai(?:\/.*)?(?:\?.*)?$/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /\/api\/chat(?:\/.*)?$/i,
      handler: "NetworkOnly",
    },
  ],
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "display-capture=(self)",
    ].join(", "),
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://img.youtube.com https://images.unsplash.com https://plus.unsplash.com https://image.pollinations.ai https://*.fal.media",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://generativelanguage.googleapis.com https://*.livekit.cloud wss://*.livekit.cloud https://*.sentry.io https://cloud.umami.is https://api.umami.is",
      "frame-src 'self' https://www.youtube.com https://youtube.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "manifest-src 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,

  // Keep server-only, Node-oriented libraries out of the automatic RSC/Route Handler bundle.
  // They remain installed on Render and are resolved natively at runtime.
  serverExternalPackages: [
    "@fal-ai/serverless-client",
    "@google/generative-ai",
    "groq-sdk",
    "livekit-server-sdk",
    "officeparser",
    "pdf-parse",
    "cheerio",
    "turndown",
    "web-push",
    "resend",
    "youtube-transcript",
  ],

  // CI already runs tsc --noEmit. Keep the production bundle memory-safe on
  // Render while retaining the existing dedicated typecheck in CI.
  typescript: {
    ignoreBuildErrors: true,
  },

  productionBrowserSourceMaps: false,

  experimental: {
    webpackMemoryOptimizations: true,
    serverActions: {
      // Library uploads arrive as FormData through a Server Action.
      // Keep this aligned with the 50 MB AI media storage limit so common
      // school PDFs, presentations and images are not rejected by Next first.
      bodySizeLimit: "50mb",
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@/actions/library": resolve(appDir, "src/client-actions/library.ts"),
      };
    }

    config.ignoreWarnings = [
      { module: /node_modules\/officeparser/ },
      { module: /node_modules\/file-type/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];

    config.module = {
      ...config.module,
      exprContextCritical: false,
      unknownContextCritical: false,
    };

    return config;
  },

  turbopack: {},

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "image.pollinations.ai" },
      { protocol: "https", hostname: "*.fal.media" },
    ],
  },
};

export default withSentryConfig(
  withPWA(nextConfig),
  {
    org: "profetasdelcodigo",
    project: "javascript-nextjs",
    silent: !process.env.CI,
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },
  }
);