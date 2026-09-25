import { defineConfig } from "vitest/config"

/**
 * Tests for the extension run against the root repository's installed
 * toolchain (`npx vitest --config extension/vitest.config.ts`), so the
 * extension does not need its own node_modules to be verified.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    root: __dirname,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
  },
})
