import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error: next-pwa lacks type declaration file
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
});

// ── Security Headers ─────────────────────────────────────────
// Se aplican en producción y desarrollo.
const securityHeaders = [
  // Evita que el browser detecte el MIME type incorrectamente
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Previene clickjacking: la app solo puede ser embebida en sí misma
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // Controla cuánta información de referrer se comparte
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Fuerza HTTPS durante 1 año (solo activo con HTTPS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Desactiva características del navegador que no usamos
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",          // cámara: solo origen propio (video calls)
      "microphone=(self)",      // micrófono: solo origen propio (video calls)
      "geolocation=()",         // geolocalización: deshabilitada
      "payment=()",             // API de pagos: deshabilitada
      "usb=()",                 // USB: deshabilitado
      "display-capture=(self)", // screen share: solo origen propio
    ].join(", "),
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      // Solo este origen puede cargar scripts (+ inline para Next.js)
      "default-src 'self'",
      // Scripts: self + unsafe-inline necesario para Next.js hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
      // Estilos: self + inline para Tailwind/CSS-in-JS
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fuentes: self + Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Imágenes: self + Supabase Storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://img.youtube.com https://images.unsplash.com https://plus.unsplash.com",
      // Medios (audio/video): self + Supabase Storage
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
      // Conexiones API: self + Supabase + Google AI + LiveKit + Sentry + Umami
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://generativelanguage.googleapis.com https://*.livekit.cloud wss://*.livekit.cloud https://*.sentry.io https://cloud.umami.is https://api.umami.is",
      // Frames: YouTube para reproductores embebidos
      "frame-src 'self' https://www.youtube.com https://youtube.com",
      // Worker scripts (PWA service worker)
      "worker-src 'self' blob:",
      // Bloquea object/embed
      "object-src 'none'",
      // Base URI restringida
      "base-uri 'self'",
      // Formularios solo al propio origen
      "form-action 'self'",
      // Solo manifests del propio origen
      "manifest-src 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
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

  // Silence Next.js 16 Turbopack/webpack compatibility warning
  turbopack: {},

  // Aplica los security headers a todas las rutas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Dominios permitidos para next/image
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default withSentryConfig(
  withPWA(nextConfig),
  {
    org: "profetas-del-codigo",
    project: "javascript-nextjs",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },
  }
);
