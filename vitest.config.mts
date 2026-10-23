import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Loads .env.local locally; in CI, DATABASE_URL comes from the workflow environment.
    env: loadEnv("test", process.cwd(), ""),
    fileParallelism: false,
  },
});
