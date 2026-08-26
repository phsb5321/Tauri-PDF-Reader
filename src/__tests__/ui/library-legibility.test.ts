import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("library legibility contract", () => {
  it("enlarges the adjustable rem scale without replacing the user-agent preference", () => {
    const global = read("src/styles/index.css");
    const app = read("src/styles/App.css");

    expect(global).toMatch(/:root\s*\{[^}]*font-size:\s*125%/s);
    expect(global).not.toMatch(/:root\s*\{[^}]*font-size:\s*\d+(?:\.\d+)?px/s);
    expect(app).toMatch(/body\s*\{[^}]*font-size:\s*var\(--text-base\)/s);
  });

  it("keeps the declared 640px narrow journey reachable by the native window", () => {
    const config = JSON.parse(read("src-tauri/tauri.conf.json"));
    expect(config.app.windows[0].minWidth).toBe(640);
  });

  it("lets CSS own the Sort face and binds both painted colours to semantic tokens", () => {
    const library = read("src/components/library/LibraryView.css");
    const select =
      library.match(/\.library-sort select\s*\{([^}]*)\}/s)?.[1] ?? "";

    expect(select).toMatch(/(?:-webkit-)?appearance:\s*none/);
    expect(select).toMatch(/background(?:-color)?:\s*var\(--color-input-bg\)/);
    expect(select).toMatch(/color:\s*var\(--color-text-primary\)/);
  });

  it("keeps reader chrome themed and starts books fitted to the whole page", () => {
    const viewer = read("src/components/PdfViewer.tsx");
    const main = read("src/main.tsx");
    const zoomCss = read("src/components/ZoomControls.css");
    const cacheCss = read("src/components/audio-progress/CacheProgressBar.css");

    expect(viewer).toMatch(/setFitMode\("fit-page"\)/);
    expect(main).toContain('import "pdfjs-dist/web/pdf_viewer.css"');
    expect(zoomCss).toMatch(
      /\.zoom-select\s*\{[^}]*(?:-webkit-)?appearance:\s*none/s,
    );
    expect(cacheCss).toMatch(
      /\.cache-progress-bar__track\s*\{[^}]*background:\s*var\(--color-track\)/s,
    );
  });
});
