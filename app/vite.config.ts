import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { parseAuthConfig } from "./src/services/authConfig";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  parseAuthConfig({ url: env.VITE_SUPABASE_URL || "", publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || "" });
  parseAuthConfig(JSON.parse(readFileSync(new URL("./public/auth-config.json", import.meta.url), "utf8")));
  return {
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: ["terminal.local"],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const bank = id.match(/\/src\/data\/([^/]+-bank)\.json$/);
          return bank ? `questions-${bank[1]}` : undefined;
        },
      },
    },
  },
  };
});
