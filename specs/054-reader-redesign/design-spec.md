# Lectrice Reader Redesign · Shared Direction Brief

> Date: 30/07/2026  
> Output gate: three complete HTML directions and three 1440×900 screenshots before production implementation

## Deep restatement

Lectrice does not need a cosmetic reskin. The current interface exposes working
features, but it does not communicate the product’s reason to exist. On launch, the
user sees a largely empty dark canvas and two utility buttons of equal importance.
Once a document is open, page navigation, zoom, playback, voice, speed, cache,
export, and settings become separate control islands. The result feels like a test
harness for a PDF renderer rather than a reading instrument whose defining behavior
is reading aloud. The redesign must make the page the visual anchor, make listening
state legible at a glance, and lower the cognitive cost of moving between reading
and listening. It must preserve the application’s existing capabilities and
accessibility work rather than inventing a different product.

The target user is a desktop reader working through research papers, technical
documents, books, or long reports. They may alternate between close reading and
listening, may rely on keyboard navigation, and may use synchronized highlighting
for focus or accessibility. The emotional target is calm competence: local,
private, fast, and trustworthy, with enough personality that Lectrice is
recognizable. The interface should feel authored and native to a desktop tool, not
like a SaaS dashboard embedded in a window.

Based on this understanding, produce three genuinely different visual versions for
the user to compare.

## Common product content

All directions must present the same active-reader scenario:

- Product: **Lectrice**
- Tagline/voice promise: **Every page, read aloud.**
- Open document: **Lectrice end to end fixture**
- Current content: **alpha beta gamma delta epsilon**
- Page state: **Page 1 of 2**
- Zoom state: **Fit width · 118%**
- Voice: **LJSpeech · English**
- Playback: active or ready, **1.2×**, automatic page continuation enabled
- Cache/status: **Page audio ready**
- Available tasks: open document, show sessions/library, previous/next page, zoom,
  play/pause/stop, select voice, change speed, export audio, open settings

Do not add AI summaries, chat, fake usage statistics, cloud sync, folders, comments,
or other unimplemented features.

## Audience and use context

- Primary distance: roughly 1 metre on a 13–16 inch laptop or desktop display.
- Primary platform: macOS desktop today; the visual grammar must remain feasible in
  Tauri/WebView on Linux and Windows.
- Primary input: mouse/trackpad plus keyboard.
- Primary accessibility requirements: visible focus, 44×44 primary hit targets,
  body text at least 14px, text contrast at least 4.5:1, reduced-motion-safe
  transitions, unambiguous button labels or tooltips, state not conveyed by color
  alone.

## Output

- One standalone HTML file per direction under `design-demos/`.
- Fixed comparison viewport: **1440×900 CSS pixels**.
- Each direction must render the complete desktop reader, not a mood board.
- Each file must include assumptions and design reasoning in its opening HTML
  comment.
- Each design must be clickable enough to demonstrate:
  - play/pause state;
  - opening/closing a navigation or session surface;
  - changing a visible reader control such as zoom, page, or voice.
- Use the real Lectrice mark at `../../../public/lectrice-mark.svg`.
- Use the real fixture page image at `assets/e2e-fixture-page-1.png`.
- No network-loaded fonts, images, or scripts. The prototype must render offline.

## Known constraints

- Preserve the meaning **blue = app; mauve = voice**.
- No purple/blue gradient wallpaper, glassmorphism, neon glow, emoji icons,
  decorative statistics, rounded-card grids, or generic dashboard composition.
- No fabricated product imagery. The PDF page itself is the content hero.
- At most two font families per direction; system fonts are acceptable for the
  prototype when chosen intentionally, but production will remain self-hosted.
- Use line icons only for real controls.
- Use spacing and alignment as the primary structure. Corners stay tight; 8px is the
  ordinary maximum.
- The production implementation must eventually use existing stores, generated
  Tauri bindings, and shared components. These direction HTML files are design
  evidence only.

## Image-material checkpoint

No decorative imagery is required. Removing a stock image would not reduce the
reader’s information, so none should be introduced. The real logo, current app
capture, and real fixture page are sufficient core assets. The fixture page is
shared across all three directions to keep comparison honest.

## Form derivation: five questions

1. **Narrative role:** this is the main working state, not onboarding or marketing.
   It must communicate “read, listen, stay oriented.”
2. **Viewer distance:** desktop/laptop distance makes 14–16px UI copy and a large,
   high-contrast page appropriate; tiny metadata is not.
3. **Visual temperature:** calm and focused, with voice activity providing the one
   expressive pulse.
4. **Capacity:** the page needs most of the area. Secondary controls should occupy
   no more than one compact top band, one revealable rail, and one playback surface.
5. **Content-specific visual motif:** Lectrice’s three nested voice chevrons become a
   hierarchy motif—three levels of chrome (document, navigation, voice) and repeated
   angular signals only where listening state is expressed. This motif would not
   make equal sense for a generic PDF editor.

## Evidence gate

The three directions are checked by a runnable script rather than by eye:

```bash
python3 specs/054-reader-redesign/design-demos/render-screenshots.py
```

It re-captures each screenshot and fails on:

1. any page or console error;
2. any request that is not `file:`/`data:`, any WebSocket, or any worker —
   sockets and workers are separate Playwright events, so watching `request`
   alone would let a direction phone home and still be called offline;
3. a capture that is not 1440×900;
4. any visible interactive control below 44×44;
5. any text run below the brief's contrast floor (4.5:1, or 3:1 for large text
   per WCAG 1.4.3). Only text whose background resolves to an opaque colour can
   be judged from the DOM, so unresolvable runs are counted and reported — and
   a direction where *nothing* resolves fails rather than passing vacuously;
6. any element that still animates under an emulated
   `prefers-reduced-motion: reduce` (the 0.01ms reset idiom is not motion);
7. a required interaction — play/pause, revealing the session or inspector
   surface, next page — that mutates no observable state; a play control that
   does not re-describe itself once playback starts; or a session surface that
   leaves under 60% of the fixture page visible or covers its centre. "The page
   is the visual anchor" is a layout claim, so it is asserted, not eyeballed.

Current result: all three directions pass; 42 / 36 / 31 text runs contrast-
checked with none unresolvable. Each gate has a negative control: reverting the
Latte accent darkening reproduces 11 contrast failures, stripping a direction's
reduced-motion block reproduces 8 animation failures, and removing the fixture
page image trips the page-anchor assertion.

Latte's `blue #1e66f5`, `mauve #8839ef` and `subtext0 #6c6f85` all clear 3:1 but
not 4.5:1 on `base`, so the directions use hue-matched darker variants
(`#1152cf`, `#7526c9`, `#5c5f77`) for text. Smallest rendered font size is
reported, not gated (A and B use 10px eyebrow chrome, C bottoms out at 12px);
the brief's 14px floor governs production body copy, so that trade-off is part
of what the reviewer is choosing between.

## Direction isolation

The three designers receive only this brief and `design-demos/brand-spec.md`.
They must not inspect or imitate the other generated directions.

- **Direction A — seconds roulette, style 02:** Neo-Brutalism, reinterpreted through
  Lectrice’s actual Catppuccin blue/mauve palette and tight angular geometry.
- **Direction B — verified real-world reference:** Speechify’s award-cited reduction
  of cognitive load; translate the principle into a desktop reading surface with
  one obvious listening control and progressive disclosure.
- **Direction C — best-fit design philosophy:** Information Architects / iA Writer;
  prioritize the document, typographic calm, and revealable navigation with a
  distinctive Lectrice voice state.

