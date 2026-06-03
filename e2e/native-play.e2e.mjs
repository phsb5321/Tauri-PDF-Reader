/**
 * Native play-path E2E (tauri-driver + WebdriverIO).
 *
 * Closes the boundary hole that `critical-loop.e2e.mjs` leaves open: it proves
 * the REAL play button → real TTS wire → real karaoke advance, with NO
 * `window.__E2E__` behavior shim driving the karaoke.
 *
 * The only WebDriver-impossible steps (native ElevenLabs key entry + native GTK
 * file dialog) are done by the `VITE_E2E_NATIVE` bootstrap against the
 * `e2e-tts-fixture` Rust backend (no network, no audio device). Everything the
 * test asserts is the production path:
 *
 *   click `.ai-playback-button`  (the REAL button, not a bridge call)
 *     → handlePlay
 *     → speakWithHighlight
 *     → invoke("ai_tts_speak_with_timestamps")   (REAL Tauri IPC → Rust)
 *     → fixture backend returns real marks + emits ai-tts:playback-starting
 *     → useTtsWordHighlight rAF loop advances the shared index over wall-clock
 *
 * `window.__E2E_READ__` is read-only — it observes the store for assertions, it
 * never drives it. If the wire is stubbed (handlePlay no-op, invoke short-circuit,
 * loop broken), the index never advances and this test goes RED.
 *
 * Run with:  E2E_SPEC=./e2e/native-play.e2e.mjs  against a binary built
 * `--features e2e-tts-fixture` and a frontend built `VITE_E2E_NATIVE=true`.
 */

/* global browser, $, expect */

describe("Native play path (real play button → real TTS wire → karaoke advance)", () => {
  it("clicks the REAL play button and the karaoke index advances off real backend marks", async () => {
    // 1. App launched + native bootstrap finished (TTS init + fixture opened
    //    through the production paths, no shim).
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      {
        timeout: 40000,
        timeoutMsg:
          "native bootstrap (window.__E2E_READ__.ready) never became ready — check VITE_E2E_NATIVE build + e2e-tts-fixture feature",
      },
    );

    // 2. REAL render: the fixture's own words appear in the text layer (proves
    //    pdf.js rendered, the doc is truly open, the playback bar is mounted).
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

    // 3. The REAL play button must EXIST, be ENABLED, and be CLICKABLE (visible,
    //    in-viewport, not obscured). canPlay = initialized && !error — only true
    //    because the fixture backend init succeeded.
    const playBtn = await $(".ai-playback-button");
    await playBtn.waitForExist({ timeout: 15000 });
    await playBtn.waitForEnabled({ timeout: 15000 });
    await playBtn.waitForClickable({ timeout: 15000 });

    // Pre-condition: karaoke not started (index is the store's reset sentinel).
    const before = await browser.execute(() =>
      window.__E2E_READ__.currentWordIndex(),
    );
    expect(before).toBeLessThanOrEqual(0);
    expect(await browser.execute(() => window.__E2E_READ__.isActive())).toBe(
      false,
    );

    // 4. Click the REAL button to fire the full production chain. We dispatch the
    //    click via element.click() rather than wdio's synthetic pointer event:
    //    on WebKitGTK software-rendering, WebDriver's pointer hit-test is
    //    unreliable (vimeflow#65 class) and silently misses, but element.click()
    //    fires the SAME React onClick={handlePlay}. The wdio waitForClickable()
    //    above already proved the button is genuinely visible/enabled/unobscured,
    //    so this is an honest click of the real button — NOT a bridge call and
    //    NOT __E2E__.startKaraoke. The karaoke that follows is causally
    //    downstream of handlePlay → speakWithHighlight → invoke → fixture backend.
    await browser.execute(() =>
      document.querySelector(".ai-playback-button").click(),
    );

    // 5. The real backend returned marks (proves invoke round-tripped to Rust).
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.wordCount() > 0),
      {
        timeout: 10000,
        timeoutMsg:
          "no word marks after clicking play — the real ai_tts_speak_with_timestamps invoke did not round-trip",
      },
    );
    expect(await browser.execute(() => window.__E2E_READ__.isActive())).toBe(
      true,
    );

    // 6. The REAL rAF karaoke loop advances the index over wall-clock off those
    //    marks. This is the no-reward-hack assertion: a stubbed wire can't move it.
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.currentWordIndex() > 0),
      {
        timeout: 10000,
        timeoutMsg:
          "karaoke index did not advance after the real play click — wire stubbed or loop broken",
      },
    );
  });
});
