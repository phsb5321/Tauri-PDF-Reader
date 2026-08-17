/**
 * Packaged highlights-panel DOCKING measurement (tauri-driver + WebKitGTK).
 *
 * The defect this lane pins: `HighlightsPanel` mounted straight into
 * `.app-layout-main`, which is a flex COLUMN. A 300px-wide panel became a
 * column item — it stacked BELOW the reading surface and was then clipped away
 * by that container's `overflow: hidden`. "Docked" is a geometric claim, so it
 * is asserted geometrically, never by eye:
 *
 *   - the panel and the page are SIDE BY SIDE: panel.left >= page.right - 1
 *     (a real dock; a stacked panel has its left edge at the page's left);
 *   - the panel is INSIDE the viewport: right <= innerWidth, bottom <=
 *     innerHeight (the clipping half of the bug);
 *   - the panel is TALL: it stretches the reading row rather than collapsing to
 *     content height;
 *   - the page KEEPS its width: page.right <= panel.left (the dock takes its
 *     own 300px instead of overlaying the page);
 *   - the panel is actually 300px wide and not squeezed by the page.
 *
 * HOW THE PANEL IS OPENED — the honest caveat. `toggle-highlights` has NO
 * in-app control and NO keyboard chord in this build: its only real affordance
 * is the native GtkMenuBar item built in `src-tauri/src/lib.rs` (View → Toggle
 * Highlights). WebDriver cannot click a native GTK menu — the codebase already
 * documents this at `lib.rs:216` ("the prior E2E faked this by emitting
 * menu-action from the frontend"). So this lane opens the panel through
 * `window.__E2E__.emitMenu("toggle-highlights")`, which emits the SAME
 * `menu-action` event the native item emits and is handled by the SAME
 * `useMenuActions` listener.
 *
 * That is a seam, not a user gesture, and it is called out rather than dressed
 * up: this lane certifies the LAYOUT that results once the panel is open, and
 * does NOT certify that a user can reach it. The reachability gap is real and
 * is left to its own slice — it is a missing control, not a docking bug.
 * Everything after the open is production code: real React tree, real CSS,
 * real WebKitGTK layout, real geometry read back off the live DOM.
 *
 * Requires a frontend built with BOTH `VITE_E2E_NATIVE=true` (hermetic seeded
 * profile) and `VITE_E2E=true` (the `emitMenu` seam) — the two bootstraps are
 * independent flags in `src/main.tsx` and compose.
 *
 * Run: E2E_SPEC=./e2e/highlights-dock.e2e.mjs  (see scripts/highlights-dock-capture.sh)
 */

/* global browser, $, expect */

const DOCK_WIDTH = 300;

/** Read the live geometry of the reading surface, the page and the dock. */
function readLayout() {
  return browser.execute(() => {
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        left: Math.round(r.left),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
      };
    };
    const surface = document.querySelector(".reader-surface");
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      surfaceDirection: surface
        ? getComputedStyle(surface).flexDirection
        : null,
      panel: box(".highlights-panel"),
      page: box(".pdf-viewer"),
      surface: box(".reader-surface"),
    };
  });
}

describe("Packaged highlights panel docking", () => {
  it("docks beside the page instead of stacking below it and being clipped", async () => {
    // 1. Hermetic profile seeded; bootstrap ran before the first render.
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // 2. Enter the reader through the public resume control — the panel is
    //    gated on a document being open, so this must be a real document.
    const resume = await $(
      'button[aria-label^="Resume E2E Resume Fixture A, page"]',
    );
    await resume.waitForExist({ timeout: 15000 });
    await resume.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document
        .querySelector('button[aria-label^="Resume E2E Resume Fixture A, page"]')
        ?.click(),
    );
    await browser.waitUntil(
      async () => browser.execute(() => !!document.querySelector(".pdf-viewer")),
      { timeout: 20000, timeoutMsg: "reader never mounted" },
    );

    // 3. Baseline: with the panel closed the page owns the full width. Captured
    //    so the "page keeps its width" assertion below is a comparison against
    //    a measured before, not against a guess.
    const before = await readLayout();
    console.log(`DOCK_BEFORE ${JSON.stringify(before)}`);
    expect(before.panel).toBeNull();

    // 4. Open the panel via the menu-action seam (see the header caveat).
    const emitted = await browser.execute(async () => {
      if (!window.__E2E__?.emitMenu) return false;
      await window.__E2E__.emitMenu("toggle-highlights");
      return true;
    });
    // NOTE: this expect() takes ONE argument. The two-arg `expect(v, "msg")`
    // form is NOT supported by the expect build these packaged lanes run
    // against ("Expect takes at most one argument.") and turns a real
    // assertion into a harness error — the same trap the contrast lane hit.
    // Context goes in an explicit throw or the probe log instead.
    if (!emitted) {
      throw new Error(
        "window.__E2E__.emitMenu is missing — build the frontend with VITE_E2E=true as well as VITE_E2E_NATIVE=true",
      );
    }

    const panelEl = await $(".highlights-panel");
    await panelEl.waitForExist({
      timeout: 10000,
      timeoutMsg: "highlights panel never mounted after toggle-highlights",
    });

    // 5. MEASURE.
    const after = await readLayout();
    console.log(`DOCK_AFTER ${JSON.stringify(after)}`);

    const { panel, page, viewport, surface, surfaceDirection } = after;
    expect(panel).not.toBeNull();
    expect(page).not.toBeNull();

    // The dock only exists because the surface is a row; assert the mechanism,
    // so a regression names its own cause instead of just moving a rectangle.
    expect(surfaceDirection).toBe("row");

    // (a) SIDE BY SIDE, not stacked. A stacked panel shares the page's left
    //     edge; a docked one starts at/after the page's right edge.
    if (panel.left < page.right - 1) {
      throw new Error(
        `STACKED, NOT DOCKED: panel.left ${panel.left} is before page.right ${page.right} ` +
          `(panel ${JSON.stringify(panel)}, page ${JSON.stringify(page)})`,
      );
    }

    // (b) NOT CLIPPED: fully inside its container on both axes.
    //
    //     Containment is asserted against the SURFACE, not `window.innerWidth`.
    //     The document is one pixel wider than `innerWidth` on this platform
    //     (`.app-layout` is `width: 100vw`) — the 1px artifact recorded as gap
    //     #5 of docs/audit-home-ui-2026-08-16.md, which predates this change and
    //     is a separate slice. Measuring the dock against the window would fold
    //     that unrelated 1px into this assertion and make a docked panel look
    //     clipped; the surface is the box the panel is actually laid out in.
    expect(panel.right).toBeLessThanOrEqual(surface.right);
    expect(panel.bottom).toBeLessThanOrEqual(surface.bottom);
    //     Vertically the window IS the right oracle — the stacking bug pushed
    //     the panel past the bottom of the screen, and no artifact applies.
    expect(panel.bottom).toBeLessThanOrEqual(viewport.h);

    // (c) The dock keeps its width — not squeezed to nothing by the page.
    expect(panel.w).toBe(DOCK_WIDTH);

    // (d) It stretches the reading row instead of collapsing to content height.
    //     Compared against the surface, so this holds at any window size.
    expect(panel.h).toBe(surface.h);
    expect(panel.h).toBeGreaterThan(viewport.h / 2);

    // (e) The page yielded exactly the dock's width and kept the rest — the
    //     panel docks BESIDE it rather than overlaying it.
    expect(page.right).toBeLessThanOrEqual(panel.left);
    expect(before.page.w - page.w).toBe(DOCK_WIDTH);

    await browser.saveScreenshot("/tmp/lectrice-highlights-dock.png");
  });
});
