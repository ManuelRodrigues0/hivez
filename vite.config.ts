import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      // Local dev forwards /api calls (e.g. Gemini verification) to the deployed Vercel API.
      "/api": {
        target: "https://www.hivez.in",
        changeOrigin: true,
      },
    },
  },
});