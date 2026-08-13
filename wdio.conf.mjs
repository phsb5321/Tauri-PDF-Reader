/**
 * WebdriverIO config for the Tauri E2E critical-loop harness.
 *
 * Drives the BUILT debug app (src-tauri/target/debug/tauri-pdf-reader) through
 * tauri-driver, which spawns WebKitWebDriver (from webkitgtk_4_1) to control the
 * WebKitGTK webview. Run under Xvfb on a headless/Wayland host so it never
 * touches the live session. See package.json `test:e2e`.
 */
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "src-tauri/target/debug/tauri-pdf-reader");
// tauri-driver lookup: PATH first (the flake devShell now ships the pinned
// build, and a `nix profile install` on the CI runner lands in
// ~/.nix-profile/bin), then the legacy hardcoded path as fallback. An
// explicit TAURI_DRIVER env override wins over both.
const TAURI_DRIVER =
  process.env.TAURI_DRIVER ||
  (() => {
    try {
      return execSync("command -v tauri-driver", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      return path.resolve(process.env.HOME, ".cargo/bin/tauri-driver");
    }
  })();
const NATIVE_DRIVER = process.env.WEBKIT_WEBDRIVER || "WebKitWebDriver";

let tauriDriver;

export const config = {
  hostname: "127.0.0.1",
  port: 4444,
  // ONE spec per run, selected by E2E_SPEC. There is deliberately no glob /
  // unified default suite: the two specs need mutually-exclusive build flags so
  // they cannot share a binary —
  //   critical-loop.e2e.mjs : VITE_E2E (window.__E2E__ bridge), default cargo.
  //   native-play.e2e.mjs   : VITE_E2E_NATIVE + cargo --features e2e-tts-fixture.
  // `pnpm test:e2e` runs critical-loop; `test:e2e:native` runs native-play;
  // `test:e2e:all` runs both lanes back-to-back (scripts/e2e-all.sh). Neither
  // lane runs in CI (WebKitGTK + a display — vimeflow#65).
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
