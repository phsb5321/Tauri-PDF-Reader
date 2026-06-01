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
  it("launches, loads+renders the fixture, the real rAF loop advances the karaoke index, and a menu-action dispatches", async () => {
    // 1. App launched + E2E bridge present.
    await browser.waitUntil(
      async () => browser.execute(() => !!(window.__E2E__ && window.__E2E__.ready)),
      { timeout: 30000, timeoutMsg: "E2E bridge (window.__E2E__) never became ready" },
    );
    await expect($("[class*='toolbar']")).toBeExisting();

    // 2. Open the fixture PDF (no native dialog).
    const res = await browser.execute(async () => window.__E2E__.loadFixture());
    expect(res.pages).toBeGreaterThanOrEqual(2);

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
