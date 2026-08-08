import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The `@/` alias comes from tsconfig paths, which vitest does not read on its
  // own. Tests that reach into app/ (card visuals, tutorial steps) need it.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["game/tests/**/*.test.ts"],
    environment: "node",
    coverage: { enabled: false },
  },
});
