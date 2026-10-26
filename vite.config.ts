import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { omniRouteDevApi } from "./lib/omniroute/devServer";

export default defineConfig({
  plugins: [
    omniRouteDevApi(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      // OmniRoute handlers run locally via omniRouteDevApi; other APIs use production.
      "/api": {
        target: "https://www.hivez.in",
        changeOrigin: true,
      },
    },
  },
});
