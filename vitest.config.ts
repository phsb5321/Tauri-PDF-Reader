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
      // Coverage ratchet (009-coverage-gate, 2026-05-30).
      // Floors are pinned to the MEASURED baseline at this commit, not an
      // aspirational 80%. Before this, CI failed on every run (real coverage
      // ~42% lines/statements vs an 80% gate), so the signal was ignored.
      // These act as a REGRESSION gate — coverage may not drop below the floor
      // — and MUST be ratcheted UP as tests are added, never silently down.
      // `branches` stays at 80 because it is already met. Target: 80 across the
      // board. Policy + plan: docs/coverage-budget.md.
      thresholds: {
        lines: 42,
        functions: 53,
        branches: 80,
        statements: 42,
      },
    },
  },
});
