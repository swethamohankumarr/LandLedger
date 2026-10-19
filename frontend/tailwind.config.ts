import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        elevated: "var(--bg-elev)",
        surface: "var(--surface)",
        border: "var(--border)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        primary: "var(--primary)",
        "primary-soft": "var(--primary-soft)",
        emerald: "var(--emerald)",
        amber: "var(--amber)",
        rose: "var(--rose)",
        sky: "var(--sky)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        glow: "0 0 40px -12px var(--primary)",
        card: "0 8px 30px -12px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
