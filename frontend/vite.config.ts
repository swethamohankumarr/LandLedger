/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages the app is served from /<repo>/, so the workflow sets
// GITHUB_PAGES=true to build with that base. Vercel / local use "/".
const base = process.env.GITHUB_PAGES ? "/LandLedger/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ethers: ["ethers"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
