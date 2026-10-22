import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Next compiles JSX itself (tsconfig "preserve"); tests need it transformed.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }] },
});
