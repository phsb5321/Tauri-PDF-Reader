/**
 * Critical-loop E2E (tauri-driver + WebdriverIO), un-skipped.
 *
 * Asserts the primary journey end-to-end against the BUILT app:
 *   launch → open fixture PDF → text renders → playback bar appears →
 *   synced karaoke (the REAL rAF loop advances the highlight index over real
 *   time) → a native menu action dispatches (next-page advances the page).
 *
 * The native file dialog and a live ElevenLabs key/audio device are bypassed via
 * window.__E2E__ (src/e2e-bridge.ts), which only drives the production
 * services/stores — so this exercises the real loop, kicked off programmatically.
 */

/* global browser, $, expect */

// SCOPE (honest, per adversarial review): this proves, against the real built
// app — app launch, fixture load + REAL PDF text render, the REAL mounted rAF
// karaoke loop advancing the shared highlight index over real time, and the
// frontend `useMenuActions` listener dispatching a menu-action. It does NOT yet
// prove: the native file dialog / `useOpenPdf` open path, the play-button →
// `speakWithHighlight` → Tauri-TTS playback path, or the native menu → Rust
// `on_menu_event` mapping. Those are tracked harness follow-ups.
describe("Critical loop (load → render → synced karaoke → menu dispatch)", () => {
  it("B1 (slice 109): the toolbar Open button leaves the library and shows the reader", async () => {
    // The app just launched — the reading home is the startup surface. The
    // toolbar Open button is the ONLY visible open path on packaged Linux
    // (the native File->Open menu is hidden); before 109 it loaded the book
    // and never left the library.
    await browser.waitUntil(
      async () =>
        browser.execute(() => !!(window.__E2E__ && window.__E2E__.ready)),
      { timeout: 30000, timeoutMsg: "E2E bridge never became ready" },
    );
    const installed = await browser.execute(async () =>
      window.__E2E__.installDialogFixture(),
    );
    expect(installed).toBe(true);

    // Library is showing (startup surface).
    expect(await $("h1").getText()).toBe("Library");

    // Click the REAL toolbar Open button — the dialog IPC is intercepted by
    // the bridge, so the handler runs to completion.
    await browser.execute(() =>
      document.querySelector("button.open-button")?.click(),
    );

    // The reader must appear: the page input exists and the library h1 is
    // gone. This is the assertion that was red before 109.
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const h1 = document.querySelector("h1");
          const pageInput = document.querySelector(
            'input[aria-label="Current page"]',
          );
          return (
            !!pageInput && (!h1 || (h1.textContent || "").trim() !== "Library")
          );
        }),
      {
        timeout: 30000,
        timeoutMsg: "toolbar Open never left the library (slice 109 B1)",
      },
    );
    const diag = await browser.execute(() => ({
      pageInput: !!document.querySelector('input[aria-label="Current page"]'),
      h1: document.querySelector("h1")?.textContent ?? null,
      title: document.querySelector(".document-title")?.textContent ?? null,
    }));
    console.log("DIAG open-toolbar:", JSON.stringify(diag));

    // Return to the library for the next it-block (the existing flow expects
    // the startup surface and toggles its own way in).
    await browser.keys(["Control", "l"]);
  });

  it("launches, loads+renders the fixture, the real rAF loop advances the karaoke index, and a menu-action dispatches", async () => {
    // 1. App launched + E2E bridge present.
    await browser.waitUntil(
      async () => browser.execute(() => !!(window.__E2E__ && window.__E2E__.ready)),
      { timeout: 30000, timeoutMsg: "E2E bridge (window.__E2E__) never became ready" },
    );
    await expect($("[class*='toolbar']")).toBeExisting();
    await browser.setWindowSize(1200, 800);

    // 2. Open the fixture PDF (no native dialog).
    const res = await browser.execute(async () => window.__E2E__.loadFixture());
    expect(res.pages).toBeGreaterThanOrEqual(2);

    // The reading home is now the startup surface. Leave it through the real
    // user command instead of giving the E2E bridge a test-only view setter.
    await browser.keys(["Control", "l"]);

    // 3. REAL render: wait until a text-layer span actually carries the
    //    fixture's own words — proves pdf.js rendered the text, not just that an
    //    empty text-layer div exists. Plus the playback bar appears (doc open).
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const spans = document.querySelectorAll(
            ".textLayer span, [class*='textLayer'] span, [class*='text-layer'] span",
          );
          return Array.from(spans).some((s) =>
            /alpha|lectrice|fixture/i.test(s.textContent || ""),
          );
        }),
      { timeout: 30000, timeoutMsg: "fixture text never rendered in the text layer" },
    );
    await $("[class*='playback']").waitForExist({ timeout: 15000 });

    // 4. Synced karaoke: start with explicit marks; the REAL mounted rAF loop
    //    must advance the highlight index over real wall-clock.
    await browser.execute(() =>
      window.__E2E__.startKaraoke(
        "alpha beta gamma",
        [
          { word: "alpha", startTime: 0, endTime: 0.4, charStart: 0, charEnd: 5 },
          { word: "beta", startTime: 0.4, endTime: 0.8, charStart: 6, charEnd: 10 },
          { word: "gamma", startTime: 0.8, endTime: 1.2, charStart: 11, charEnd: 16 },
        ],
        1.2,
      ),
    );
    const start = await browser.execute(() => window.__E2E__.getState());
    expect(start.highlightActive).toBe(true);
    expect(start.currentWordIndex).toBe(0);

    await browser.waitUntil(
      async () => {
        const s = await browser.execute(() => window.__E2E__.getState());
        return s.currentWordIndex > 0;
      },
      { timeout: 5000, timeoutMsg: "karaoke index did not advance via the real loop" },
    );

    // 5. Native menu action: next-page must advance the page (fixture is 2 pages).
    const before = (await browser.execute(() => window.__E2E__.getState())).currentPage;
    await browser.execute(async (a) => window.__E2E__.emitMenu(a), "next-page");
    await browser.waitUntil(
      async () => {
        const s = await browser.execute(() => window.__E2E__.getState());
        return s.currentPage > before;
      },
      { timeout: 8000, timeoutMsg: "menu next-page did not advance the page" },
    );
  });
});

  it("B4 (slice 109): a failed open surfaces the error banner on the library", async () => {
    await browser.execute(async () =>
      window.__E2E__.installCorruptOpenFixture(),
    );
    await browser.execute(() =>
      document.querySelector("button.open-button")?.click(),
    );
    // The corrupt bytes are not a PDF: the open fails and the library must
    // show the error banner (role=alert), never a silent nothing.
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const banner = document.querySelector('[role="alert"]');
          return !!banner;
        }),
      { timeout: 30000, timeoutMsg: "failed open never surfaced an error banner (slice 109 B4)" },
    );
    const diag = await browser.execute(() => ({
      alert: document.querySelector('[role="alert"]')?.textContent ?? null,
      library: document.querySelector("h1")?.textContent ?? null,
    }));
    console.log("DIAG open-failed:", JSON.stringify(diag));
    // Dismiss and return to a clean library for any following steps.
    await browser.execute(() =>
      document.querySelector('[role="alert"] button')?.click(),
    );
  });
