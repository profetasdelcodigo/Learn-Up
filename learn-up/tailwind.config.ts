import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-black": "#0A0A0F",
        "brand-gold": "#F0C850",
        "brand-gold-dim": "#C8A632",
        "brand-purple": "#8B5CF6",
        "brand-emerald": "#10B981",
        "brand-blue-glow": "#38BDF8",
        "brand-pink": "#F472B6",
        "brand-orange": "#FB923C",
        "brand-cyan": "#22D3EE",
        "brand-violet": "#8B5CF6",
        "brand-indigo": "#818CF8",
        "surface-1": "#111118",
        "surface-2": "#16161F",
        "surface-3": "#1E1E28",
        "border-subtle": "rgba(255,255,255,0.06)",
        "border-accent": "rgba(240,200,80,0.15)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-gold": "0 0 20px rgba(240,200,80,0.15), 0 0 60px rgba(240,200,80,0.05)",
        "glow-purple": "0 0 20px rgba(139,92,246,0.15), 0 0 60px rgba(139,92,246,0.05)",
        "glow-blue": "0 0 20px rgba(56,189,248,0.15), 0 0 60px rgba(56,189,248,0.05)",
        "glow-emerald": "0 0 20px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05)",
        "glow-violet": "0 0 20px rgba(139,92,246,0.25), 0 0 60px rgba(139,92,246,0.1)",
        "card": "0 4px 30px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(240,200,80,0.08)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-1": "radial-gradient(at 20% 30%, rgba(139,92,246,0.08) 0%, transparent 50%), radial-gradient(at 80% 70%, rgba(240,200,80,0.06) 0%, transparent 50%)",
        "mesh-2": "radial-gradient(at 70% 20%, rgba(56,189,248,0.06) 0%, transparent 50%), radial-gradient(at 30% 80%, rgba(16,185,129,0.05) 0%, transparent 50%)",
      },
      animation: {
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
