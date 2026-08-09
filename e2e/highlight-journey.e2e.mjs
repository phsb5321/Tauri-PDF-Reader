/**
 * Packaged highlight-journey E2E (tauri-driver + WebdriverIO).
 *
 * The first packaged lane for the HIGHLIGHTS surface: text selection in the
 * reader → the floating color toolbar → a persisted highlight that renders as
 * an overlay mark and SURVIVES A REAL APP RESTART.
 *
 * Why this surface: the production highlights DDL lives in the FRONTEND
 * (`src/lib/db-init.ts`, not the Rust migrations), and an out-of-process
 * consumer reads `v_highlight_citations` straight from SQLite — a schema
 * contract with someone outside this repo. jsdom mocks the whole wire; this
 * lane runs it for real.
 *
 * Two phases, one hermetic profile (the runner keeps XDG_* constant):
 *   HIGHLIGHT_PHASE=create — resume the fixture, DRAG-SELECT text with the
 *     mouse (the actor's pointer, via WebDriver Actions), click the "Highlight
 *     with Yellow" color button (element.click() — the vimeflow#65 pin), and
 *     assert the overlay mark appears with the selected text.
 *   HIGHLIGHT_PHASE=verify — the app RELAUNCHES on the same profile; resume
 *     the same document and assert the SAME overlay mark is there, loaded
 *     from real SQLite through real IPC. Nothing is created in this phase —
 *     if the row did not persist, the overlay is absent and this phase REDs.
 *
 * Actor contract: every activation is a public control (mouse drag on the
 * rendered page, button click, keyboard). `window.__E2E_READ__` is read-only
 * observer instrumentation (state oracle only, never drives).
 *
 * After each phase the runner reads the profile DB through the
 * `v_highlight_citations` view (observer post-mortem) — the schema contract
 * check.
 *
 * Run with:  E2E_SPEC=./e2e/highlight-journey.e2e.mjs  HIGHLIGHT_PHASE=create|verify
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true` — see e2e/run-highlight-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.HIGHLIGHT_PHASE || "create";

/**
 * A mid-paragraph fragment of the page-2 text. Deliberately NOT the first
 * word: the actor's drag starts a few px into the paragraph (the mouse must
 * land on a rendered glyph), so the selection text is robust mid-paragraph
 * but clipped at the start. A prefix assertion on the first word would fail
 * on a healthy selection.
 */
const SELECTED_TEXT = "lectrice fixture page two";

describe("Packaged highlight journey (create → persist → survive restart)", () => {
  it(`${PHASE}: highlight is ${PHASE === "create" ? "created and rendered" : "still rendered after relaunch"}`, async () => {
    // 1. Hermetic profile seeded (bootstrap ran pre-render).
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // 2. The resume line is the entry point (same public flow as home-journey).
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

    // 3. Land on page 2 — the paragraph page — and let the text layer render.
    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) === "2",
      { timeout: 15000, timeoutMsg: "resume did not land on page 2" },
    );
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const spans = document.querySelectorAll(
            ".textLayer span, [class*='textLayer'] span",
          );
          return Array.from(spans).some((s) =>
            (s.textContent || "").includes("catch-up"),
          );
        }),
      { timeout: 30000, timeoutMsg: "page-2 paragraph never rendered" },
    );

    if (PHASE === "create") {
      // 4. ACTOR: drag the mouse across the paragraph to select it. Real
      //    pointer input through WebDriver Actions — with GDK_BACKEND=x11 the
      //    hit-test coordinates are correct (the negative-dpr trap is closed).
      //    pdf.js may split the paragraph into several spans, so the drag
      //    spans the UNION of every paragraph span's rect.
      const geometry = await browser.execute(() => {
        const spans = Array.from(
          document.querySelectorAll(".textLayer span"),
        ).filter((s) => (s.textContent || "").includes("lectrice"));
        if (spans.length === 0) return null;
        const rects = spans.map((s) => s.getBoundingClientRect());
        const left = Math.min(...rects.map((r) => r.left));
        const top = Math.min(...rects.map((r) => r.top));
        const right = Math.max(...rects.map((r) => r.right));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        return { left, top, width: right - left, height: bottom - top };
      });
      expect(geometry).not.toBeNull();
      // Drag from just inside the first glyph across to the paragraph end.
      const y = geometry.top + geometry.height / 2;
      const x1 = geometry.left + 15;
      const x2 = geometry.left + geometry.width - 15;
      await browser.performActions([
        {
          type: "pointer",
          id: "mouse1",
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", x: Math.round(x1), y: Math.round(y) },
            { type: "pointerDown", button: 0 },
            {
              type: "pointerMove",
              x: Math.round(x2),
              y: Math.round(y),
              duration: 200,
            },
            { type: "pointerUp", button: 0 },
          ],
        },
      ]);
      await browser.releaseActions();

      // The selection pipeline (document mouseup → selection rects) renders
      // the floating color toolbar — a PUBLIC control.
      const toolbar = await $('[role="toolbar"][aria-label="Highlight colors"]');
      await toolbar.waitForExist({ timeout: 10000, timeoutMsg: "highlight toolbar never appeared after selection" });

      // 5. ACTOR: pick Yellow.
      const yellow = await $('button[aria-label="Highlight with Yellow"]');
      await yellow.waitForClickable({ timeout: 10000 });
      await browser.execute(() =>
        document
          .querySelector('button[aria-label="Highlight with Yellow"]')
          ?.click(),
      );

      // 6. The overlay mark renders with the selected text as its name.
      try {
        await browser.waitUntil(
          async () =>
            browser.execute(
              () =>
                !!document.querySelector(
                  '[aria-label*="Highlight: "][aria-label*="lectrice fixture page two"]',
                ),
            ),
          {
            timeout: 15000,
            timeoutMsg: "highlight overlay never rendered after creating",
          },
        );
      } catch (err) {
        console.log(
          "DIAG hl-create:",
          JSON.stringify(
            await browser.execute(() => ({
              toolbarExists: !!document.querySelector('[role="toolbar"]'),
              overlayCount: document.querySelectorAll('[aria-label^="Highlight: "]').length,
              logs: window.__E2E_READ__.logs().slice(-30),
            })),
          ),
        );
        throw err;
      }
      const mark = await browser.execute(() =>
        document.querySelector('[aria-label*="Highlight: "]')?.getAttribute("aria-label"),
      );
      expect(mark).toContain(SELECTED_TEXT);
    } else {
      // VERIFY phase: the app relaunched on the SAME profile. The overlay must
      // be present WITHOUT any creation action — loaded from real SQLite.
      try {
        await browser.waitUntil(
          async () =>
            browser.execute(
              () =>
                !!document.querySelector(
                  '[aria-label*="Highlight: "][aria-label*="lectrice fixture page two"]',
                ),
            ),
          {
            timeout: 15000,
            timeoutMsg:
              "highlight overlay absent after relaunch — the highlight did not persist",
          },
        );
      } catch (err) {
        // DIAG: is the data there but the UI not loading it? The observer may
        // inspect read-only state — the store and the app's own read IPC — to
        // separate persistence loss from a load-path defect.
        console.log(
          "DIAG hl-verify:",
          JSON.stringify(
            await browser.execute(async () => ({
              storeCount: window.__E2E_READ__.storeHighlights().length,
              ipc: await window.__E2E_READ__.ipcHighlights(),
              overlayCount: document.querySelectorAll(
                '[aria-label^="Highlight: "]',
              ).length,
            })),
          ),
        );
        throw err;
      }
      const mark = await browser.execute(() =>
        document.querySelector('[aria-label*="Highlight: "]')?.getAttribute("aria-label"),
      );
      expect(mark).toContain(SELECTED_TEXT);
    }
  });
});
