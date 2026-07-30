import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const NATIVE_SEMANTIC_SURFACES = [
  ["../../components/audio-progress/CacheProgressBar.tsx", /<progress\b/],
  ["../../components/dialogs/ExportDialog.tsx", /<dialog\b/],
  ["../../components/export-dialog/AudioExportDialog.tsx", /<dialog\b/],
  ["../../components/export-dialog/ExportProgress.tsx", /<progress\b/],
  ["../../components/highlights/HighlightsPanel.tsx", /<button\b/],
  ["../../components/session-menu/CreateSessionDialog.tsx", /<dialog\b/],
  ["../../components/session-menu/SessionMenu.tsx", /<ul\b/],
  ["../../components/settings/CacheSettings.tsx", /<output\b/],
  ["../../components/settings/SettingsPanel.tsx", /<dialog\b/],
  ["../../hooks/useAnnounce.tsx", /<output\b/],
  ["../../ui/components/Dialog/Dialog.tsx", /<dialog\b/],
  ["../../components/highlights/NoteEditor.tsx", /<dialog\b/],
  ["../../components/library/DocumentCard.tsx", /<button\b/],
  ["../../components/pdf-viewer/HighlightOverlay.tsx", /<button\b/],
] as const;

const REDUNDANT_NATIVE_ROLE =
  /\brole\s*=\s*(["'])(?:button|dialog|list|progressbar|presentation)\1/;

describe("native HTML semantics", () => {
  it.each(NATIVE_SEMANTIC_SURFACES)(
    "%s uses its native element without a redundant role",
    (path, nativeElement) => {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");

      expect(source).toMatch(nativeElement);
      expect(source).not.toMatch(REDUNDANT_NATIVE_ROLE);
    },
  );
});
