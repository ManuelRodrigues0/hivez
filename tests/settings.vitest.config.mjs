import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

export default {
  root,
  resolve: {
    alias: [{ find: "@", replacement: path.join(root, "src") }],
    dedupe: ["react", "react-dom"],
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["tests/settings.test.tsx"],
    environment: "happy-dom",
    environmentOptions: { happyDOM: { url: "http://localhost:5173" } },
    setupFiles: ["tests/settings.setup.ts"],
  },
};
