import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/app-root-mock-isolation.test.ts"],
    // The isolation module imports the App test, registering its scoped test
    // first. Both assertions therefore share one worker and one mock lifecycle.
    isolate: false,
  },
});
