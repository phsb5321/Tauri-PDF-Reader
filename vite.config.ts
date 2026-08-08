import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

/**
 * Bundle pdf.js CMap tables from the installed pdfjs-dist package.
 *
 * pdf.js fetches CMap files by name at runtime (cMapUrl + "<name>.bcmap"),
 * so a directory copy — not an asset import — is the right shape. Copying
 * from node_modules at build time means the bundled tables always track the
 * installed pdfjs-dist version: no checked-in duplicate to go stale, and no
 * CDN. The size-oracle test would flag a version-URL mismatch in the old
 * scheme; this scheme has no URL to drift — the source of truth is the
 * package the app imports.
 */
function bundlePdfjsCmaps(): Plugin {
  return {
    name: 'bundle-pdfjs-cmaps',
    buildStart() {
      const src = join(process.cwd(), 'node_modules/pdfjs-dist/cmaps');
      const dst = join(process.cwd(), 'public/cmaps');
      if (!existsSync(src)) {
        throw new Error(
          `pdfjs-dist cmaps not found at ${src} — run pnpm install first`,
        );
      }
      cpSync(src, dst, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), bundlePdfjsCmaps()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  server: {
    // Tauri expects a fixed port, fail if that port is not available
    strictPort: true,
    host: host || false,
    port: 1420,
  },

  // Required for PDF.js worker handling
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },

  // Env variables starting with TAURI_ are exposed to the client
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari14',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
