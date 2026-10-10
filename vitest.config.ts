import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@life-simulator/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./apps/server/test/setup.ts"],
    include: [
      "packages/shared/src/**/*.test.ts",
      "apps/server/src/**/*.test.ts",
      "apps/server/test/**/*.test.ts",
    ],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
