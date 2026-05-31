import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", "src-tauri"],
    // Performance: Domain tests should complete quickly without external dependencies
    // Fail if any individual test takes longer than 5 seconds
    testTimeout: 5000,
    // Fail if the entire test suite takes too long (indicates test pollution)
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules",
        "dist",
        "src-tauri",
        "**/*.d.ts",
        "**/*.config.*",
        "**/tests/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Coverage ratchet — last raised by 019-coverage-ratchet (2026-05-31).
      // Floors are pinned just under the MEASURED baseline at this commit, not
      // an aspirational 80%. They act as a REGRESSION gate — coverage may not
      // drop below the floor — and MUST be ratcheted UP as tests are added,
      // never silently down. Raised from 42/53/80/42 (009, 2026-05-30) after the
      // 010–015 store-test branches merged; now measured: stmts 46.91 /
      // branch 88.72 / funcs 59.58 / lines 46.91. Target: 80 across the board.
      // Policy + ratchet history: docs/coverage-budget.md.
      thresholds: {
        lines: 46,
        functions: 59,
        branches: 88,
        statements: 46,
      },
    },
  },
});
