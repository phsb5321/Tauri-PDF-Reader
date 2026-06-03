/**
 * WebdriverIO config for the Tauri E2E critical-loop harness.
 *
 * Drives the BUILT debug app (src-tauri/target/debug/tauri-pdf-reader) through
 * tauri-driver, which spawns WebKitWebDriver (from webkitgtk_4_1) to control the
 * WebKitGTK webview. Run under Xvfb on a headless/Wayland host so it never
 * touches the live session. See package.json `test:e2e`.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "src-tauri/target/debug/tauri-pdf-reader");
const TAURI_DRIVER = path.resolve(process.env.HOME, ".cargo/bin/tauri-driver");
const NATIVE_DRIVER = process.env.WEBKIT_WEBDRIVER || "WebKitWebDriver";

let tauriDriver;

export const config = {
  hostname: "127.0.0.1",
  port: 4444,
  // Default to the critical-loop spec; override with E2E_SPEC for the
  // native-play spec (which needs a binary built --features e2e-tts-fixture
  // and a frontend built VITE_E2E_NATIVE=true).
  specs: [process.env.E2E_SPEC || "./e2e/critical-loop.e2e.mjs"],
  maxInstances: 1,
  capabilities: [{ "tauri:options": { application: APP } }],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: { ui: "bdd", timeout: 120000 },
  logLevel: "warn",
  // Spawn tauri-driver before the session (give it a moment to bind), kill after.
  onPrepare: async () => {
    tauriDriver = spawn(
      TAURI_DRIVER,
      ["--port", "4444", "--native-driver", NATIVE_DRIVER],
      { stdio: [null, process.stdout, process.stderr] },
    );
    await new Promise((r) => setTimeout(r, 2500));
  },
  onComplete: () => {
    if (tauriDriver) tauriDriver.kill();
  },
};
