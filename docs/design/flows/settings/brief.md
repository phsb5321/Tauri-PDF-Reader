# Brief — Settings, the configuration modal (Hi-Fi Design Slice)

## Surface

- **Screen / route:** `src/components/settings/SettingsPanel.tsx` — a native `<dialog>` modal
  (`aria-modal="true"`, `:62`) with a focus trap (`useFocusTrap`, `:34-38`), backdrop-click close
  (`:49-55`), Escape close. Mounted at shell level (`ReaderView.tsx:460-463`) precisely so it is
  reachable **from the home too**, not only with a document open (`ReaderView.tsx:92-96` comment).
  Seven sections, one visible at a time (`SettingsPanel.tsx:18-25` types, nav `:79-153`):
  appearance (`ThemeToggle.tsx`), rendering (`RenderSettings.tsx`), tts (`AiTtsSettings.tsx` — the
  playback-bar component reused, `:150`), performance (`PerformanceSettings.tsx`), cache
  (`CacheSettings.tsx`), highlights (`HighlightSettings.tsx`), shortcuts (`KeyboardShortcuts.tsx`).
  `DebugOverlay.tsx`/`DebugLogs.tsx` are developer surfaces — out of scope.
- **Window:** the modal must fit **640×600** — the window minimum is the modal's real constraint.
  At 1200×800 it must not balloon into an empty field (settings is a tool, not a stage).
- **Reader context:** task-mode, not reading-mode. The reader is here **to fix something** (theme,
  render quality, API key, cache size, shortcut discovery) and leave. Keyboard-heavy: tab/arrow
  navigation through the nav rail, Escape to exit, form controls must show focus. Reached from three
  places: Toolbar gear (`Toolbar.tsx:184-185`), library fresh-install empty state
  (`LibraryView.tsx:311-318`), playback-bar Configure (`AiPlaybackBar.tsx:905-910`).
- **States to cover (from the code):**
  - opening with DB not yet initialized — `loadFromDatabase()` fires on open (`:41-44`): design the
    brief loading skeleton, not a blank flash.
  - each of the 7 sections active (nav highlight + content swap, `:79-153`).
  - TTS section in its three connection states — `ConnectionStatus`/`"API key required"`
    (`AiTtsSettings.tsx:36-43`), key masked with visibility toggle (`:107, :211-215`).
  - controls-disabled during writes (the settings stores' saving states).

## Source spec

- `specs/078-config-file/` — where settings persist.
- `specs/263-settings-log-privacy/` — "settings write paths never trace stored values": the privacy
  stance this surface must never visually contradict.
- `specs/014-settings-store-tests/` — the store contract.
- `specs/196-narration-cockpit/` — the TTS section's cockpit sibling (consistency obligation).
- `docs/brand/brand-spec.md`.

## Required deliverables

1. `index.html` — hi-fi mock at 1200×800 and 640×600 covering: the 7-section nav + one section open
   (rendering), the TTS section in "API key required" state, and the 640px fit for the worst section
   (shortcuts — the longest list, `KeyboardShortcuts.tsx`), and the section labels verbatim
   (`SettingsPanel.tsx:86-152`).
2. `variants/` — exactly two named directions, justified by real use:
   - **Direction A — "Rail + pane":** left icon+label rail (current shape), single scroll pane.
     Justification: 7 sections with mixed heights; a rail keeps every section one click away and the
     pane scrolls independently — matches the fix-and-leave posture.
   - **Direction B — "Index + sheet":** a compact index screen; choosing a section slides a sheet
     with only that section, Back returns to the index. Justification: at 640×600 a rail + pane is
     cramped; a sheet gives each section the full modal width — matches the small-window reality of
     a desktop app used half-screened next to the document it configures.
3. `review.md` — 5-dimension critique against renders at both sizes, including a **keyboard pass**
   (tab order visible, focus trap legible) — the modal is the most keyboard-dependent surface in the
   app.

## Constraints

- **Numbers:** nav items ≥ 24px hit height with visible focus; modal width stated at both window
  sizes (and ≤ 90% of 640px); internal scroll for the pane, never the whole modal; Escape and
  backdrop-click close preserved; form labels bound (`htmlFor` — `AiTtsSettings.tsx:185,194` pattern);
  the API-key field is `type`-switched with masked default (`:201-215`) — render it masked.
- **Copy pair (this surface):**
  > ✅ "API key required" as the connection status (`AiTtsSettings.tsx:43`) + "Get your API key from…"
  > link (`:218`) — neutral, exact, actionable.
  > ❌ "Just a tiny step away from paradise 🚀" — and, worse than silly: any copy or layout that
  > echoes the stored key back in a label/log (the 263 privacy rule — settings write paths never
  > trace stored values).
- **Brand rules:** settings is pure **app** register — blue accents (`--color-accent`), general
  icons only (gears, sliders, keys are chrome; the bird does not sit on the gear). Mauve appears only
  where a control _is_ the voice (the TTS speak-test affordance, if any). Mono for values (paths,
  cache MB, keycounts). Radii 4px chrome / 8px cards. No emoji, no gradients, tokens only.

## Real content

- Section labels verbatim: Appearance / Rendering / Text-to-Speech / Performance / Audio Cache /
  Highlights / Keyboard Shortcuts (`SettingsPanel.tsx:97-153`).
- Real controls: theme toggle (Latte/Mocha), render-quality radio set (`RenderSettings.tsx`), cache
  size slider in MB (`CacheSettings.tsx`), shortcut keycaps from `KeyboardShortcuts.tsx`, provider
  select + key field + voice list from `AiTtsSettings.tsx`.

## Output location

```text
docs/design/flows/settings/
├── brief.md
├── index.html
├── variants/
│   ├── direction-a.html
│   └── direction-b.html
└── review.md
```

## Out of scope

- The NarrationCockpit tabs (owned by `playback-bar/`); DebugOverlay/DebugLogs; any store/IPC
  behaviour; adding or removing sections.
