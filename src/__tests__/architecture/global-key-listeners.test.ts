/**
 * Architecture Test: every global keydown listener has a named owner
 *
 * The defect spec 067 closes was not a missing binding. It was four listeners
 * for one command set, added independently, none of them aware of the others:
 *
 * - `useKeyboardShortcuts` — 229 lines, never mounted, so its bindings were
 *   advertised and dead. Deleted.
 * - `PdfViewer` — page keys, bound directly to the store, skipping the
 *   stop-playback-first guard the menu path applies. Moved to `useCommandKeys`.
 * - `AiPlaybackBar`, `HighlightCreationHandler`, `HighlightContextMenu` —
 *   legitimately component-owned, because each needs state a window-level
 *   listener cannot see.
 *
 * Nothing failed when a fifth was added, which is why there were four. So this
 * asserts the property rather than trusting the cleanup: a `keydown` listener
 * on `window` or `document` may only live in a file listed below, with the
 * reason it is not in the command registry written next to it.
 *
 * Adding one somewhere else fails here. That is the point — the failure is the
 * prompt to ask whether the key belongs in `COMMAND_CHORDS` instead, which is
 * the question nobody was asked the previous four times.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Why each file is allowed to bind a global key directly instead of going
 * through `COMMAND_CHORDS`. A file with no entry here is a failure.
 */
const OWNERS: Record<string, string> = {
  "hooks/useCommandKeys.ts":
    "the command registry itself — the one listener this rule wants everything to go through",
  "hooks/useFocusTrap.ts":
    "Tab/Shift+Tab cycling and Escape within a trapped subtree; needs the focusable set of one container",
  "components/PdfViewer.tsx":
    "Home/End to the first/last page; no MenuAction id exists for them and the native menu has no such item",
  "components/playback-bar/AiPlaybackBar.tsx":
    "Ctrl+Space can start playback from idle, which needs the page text; Escape stops it",
  "components/pdf-viewer/HighlightCreationHandler.tsx":
    "Ctrl+Shift+H acts on the pending selection, which only this component holds",
  "components/pdf-viewer/HighlightContextMenu.tsx":
    "Escape dismisses this menu specifically; 'close the innermost thing' is not expressible from window",
  "components/pdf-viewer/HighlightToolbar.tsx":
    "Escape cancels this toolbar while a selection is pending; same reason as the context menu",
};

/**
 * Listeners in code that is never mounted. They are not owners — nothing reaches
 * them — and they are listed separately so the allowlist above cannot be read as
 * blessing them.
 *
 * `PlaybackBar` is the pre-ElevenLabs playback bar. It binds Ctrl+Space and
 * Escape exactly as `AiPlaybackBar` does, and is reachable only through
 * `components/playback-bar/index.ts`, which nothing imports. It is the same
 * defect as the deleted `useKeyboardShortcuts`: a parallel implementation that
 * kept working in the abstract because nothing ran it.
 *
 * It is not deleted here because the dead subtree is eight files
 * (`PlaybackBar`, `VoiceSelector`, `SpeedSlider`, `ChunkNavigation` and their
 * CSS, plus four barrel lines) and removing them is a different change with a
 * different reason to revert. Spec 067 records it as out of scope. When it goes,
 * the stale-entry test below is what makes this list go with it.
 */
const DEAD_UNMOUNTED: Record<string, string> = {
  "components/playback-bar/PlaybackBar.tsx":
    "legacy pre-AI playback bar, no importer of the barrel that exports it; slated for deletion",
};

const DECLARED = { ...OWNERS, ...DEAD_UNMOUNTED };

/** `window.addEventListener("keydown"` or the `document.` equivalent. */
const GLOBAL_KEYDOWN =
  /\b(?:window|document)\.addEventListener\(\s*["']keydown["']/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Tests dispatch key events on purpose; the rule is about production code.
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe("global keydown listeners", () => {
  const binders = sourceFiles(SRC)
    .filter((file) => GLOBAL_KEYDOWN.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file).split(/[\\/]/).join("/"))
    .sort();

  it("are all declared, with the reason each stays out of the registry", () => {
    const undeclared = binders.filter((file) => !(file in DECLARED));
    expect(
      undeclared,
      `${undeclared.join(", ")} binds a global keydown listener without an entry in OWNERS. ` +
        `If the key is a reader command, add it to COMMAND_CHORDS in src/hooks/useCommandKeys.ts ` +
        `instead. If it genuinely needs component-local state, add it to OWNERS with the reason.`,
    ).toEqual([]);
  });

  it("has no stale entry left behind by a deletion", () => {
    const gone = Object.keys(DECLARED).filter(
      (file) => !binders.includes(file),
    );
    expect(
      gone,
      `${gone.join(", ")} is listed in OWNERS but no longer binds a global keydown listener. ` +
        `Remove the entry so the list keeps describing the code.`,
    ).toEqual([]);
  });

  it("found the listeners at all", () => {
    // Guards against the regex quietly ceasing to match, which would turn both
    // assertions above into tautologies over an empty set.
    expect(binders.length).toBeGreaterThanOrEqual(5);
  });
});
