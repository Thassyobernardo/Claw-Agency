import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["verbose"],
    server: {
      deps: {
        // pdfkit is CJS — load it natively without ESM transform
        external: [/pdfkit/, /fontkit/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
