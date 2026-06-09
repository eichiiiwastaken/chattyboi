import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    include: ["lib/__tests__/**/*.test.ts"],
  },
});
