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
      // mockIPC headless E2E rung (jsdom, CI-runnable). The tauri-driver real
      // E2E lives in e2e/*.e2e.mjs and runs via wdio, never vitest.
      "e2e/**/*.spec.ts",
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
        // E2E specs are test infrastructure, not source-under-test — don't let
        // their own functions drag the coverage denominator below the ratchet.
        "e2e/**",
        "src/main.tsx",
        // E2E-only bootstrap shim (VITE_E2E_NATIVE): drives the real play path for
        // the tauri-driver native-play E2E, never imported by vitest. Same class
        // as e2e/** — test infrastructure, excluded from the coverage denominator.
        "src/e2e-native-bootstrap.ts",
        "src/vite-env.d.ts",
      ],
      // Coverage ratchet — last raised by 052-sonar-gate (2026-07-30).
      // Floors are pinned just under the MEASURED baseline at this commit, not
      // an aspirational 80%. They act as a REGRESSION gate — coverage may not
      // drop below the floor — and MUST be ratcheted UP as tests are added,
      // never silently down. Target: 80 across the board.
      // Policy + ratchet history: docs/coverage-budget.md.
      //
      // 052 (2026-07-30): measured 57.52 / 89.97 / 60.32 / 57.52 for
      // statements / branches / functions / lines. Added interaction coverage
      // for the Sonar new-code accessibility fixes and raised every floor that
      // increased. See docs/coverage-budget.md for earlier baselines.
      thresholds: {
        lines: 57,
        functions: 60,
        branches: 89,
        statements: 57,
      },
    },
  },
});
