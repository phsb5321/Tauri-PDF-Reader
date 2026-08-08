/**
 * Packaged home-journey E2E (tauri-driver + WebdriverIO).
 *
 * User-gates the catch-up epic (#89 resume-and-play, #91 resume line + Also
 * in progress, #92 two-sided TTS setup signal) in the PACKAGED app — the
 * exact artifact a user would run, with a real library profile behind real
 * IPC. Every one of those PRs was jsdom-asserted and green; this lane is the
 * answer to "but does it mount in the shipped app?" (the repo's scar list
 * says a component that renders in jsdom can still be unreachable — three
 * times).
 *
 * Two lanes, one spec — the lane decides which half of each assertion runs:
 *
 *   no-key lane (VITE_E2E_NATIVE_TTS=none, SEED=single):
 *     fresh-launch state, exactly like a real user after #73's session-only
 *     key: NO key, ONE in-flight book. Asserts the setup signal is present
 *     and Configure opens Settings; "Also in progress" is ABSENT with a
 *     single book; plain Resume lands on the stored page with no narration;
 *     resume-and-play degrades honestly (lands, still idle, reader bar shows
 *     the setup message).
 *   key lane (VITE_E2E_NATIVE_TTS=fixture, SEED=dual):
 *     TTS initialized through the e2e-tts-fixture backend (no network).
 *     Asserts the setup signal is GONE with a key present; "Also in
 *     progress" is PRESENT with two books; resume-and-play starts narration
 *     (oracle: the TTS store reaching "playing" — not a human listening).
 *
 * Both lanes assert: the resume line renders the real document's stored
 * state ("Page 2 of 5 · 40% · last read …"), and NOTHING auto-plays on
 * launch (playbackState stays "idle" before any actor action).
 *
 * Actor contract: every activation goes through a visible public control
 * (accessible-name button / keyboard), dispatched with `element.click()`
 * after `waitForClickable()` — WebKitGTK software rendering drops WebDriver's
 * synthetic pointer events even when the element reports clickable
 * (vimeflow#65 class, pinned by #80; do not "modernise" back to raw pointer
 * dispatch). `window.__E2E_READ__` is read-only — it observes stores for the
 * verdict, it never performs an action.
 *
 * Run with:  E2E_SPEC=./e2e/home-journey.e2e.mjs against a binary built
 * `--features e2e-tts-fixture` and a frontend built `VITE_E2E_NATIVE=true`
 * with the lane envs — see scripts/e2e-home.sh (pnpm test:e2e:home).
 */

/* global browser, $, expect */

const READY_MSG =
  "native bootstrap (window.__E2E_READ__.ready) never became ready — check VITE_E2E_NATIVE build + e2e-tts-fixture feature";

/** WebKitGTK software rendering drops pointer dispatch (vimeflow#65 class). */
function domClick(selector) {
  return browser.execute(
    (sel) => document.querySelector(sel)?.click(),
    selector,
  );
}

describe("Packaged home journey (catch-up epic #89 #91 #92)", () => {
  it("renders the catch-up home, resumes to the stored page, and holds the two-sided TTS signal", async () => {
    // 1. Hermetic profile seeded + lane key state decided (bootstrap ran
    //    pre-render, so the home's mount query deterministically sees rows).
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: READY_MSG },
    );
    await browser.setWindowSize(1200, 800);

    // ITEM 4: NOTHING auto-plays on launch. Before any actor action.
    // (Observer functions must be CALLED inside execute — the return value of
    // execute is JSON-serialized, so functions are dropped.)
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("idle");
    expect(await browser.execute(() => window.__E2E_READ__.isActive())).toBe(
      false,
    );

    // ITEM 1a: the resume line renders with the REAL stored document state.
    const heading = await $("h2#continue-reading-heading");
    await heading.waitForExist({ timeout: 15000 });
    // textContent, not getText: the CSS text-transform uppercases the visible
    // glyphs, but the accessible name / DOM text stays "Continue reading".
    expect(
      await browser.execute(
        () => document.querySelector("h2#continue-reading-heading")?.textContent,
      ),
    ).toBe("Continue reading");

    const meta = await $(".resume-line-meta");
    await meta.waitForExist({ timeout: 15000 });
    const metaText = await meta.getText();
    expect(metaText).toContain("Page 2 of 5");
    expect(metaText).toContain("40%");
    expect(metaText).toContain("last read today");

    const progress = await $(".resume-line progress");
    expect(await progress.getAttribute("value")).toBe("40");
    expect(await progress.getAttribute("aria-label")).toBe(
      "E2E Resume Fixture A progress",
    );

    const hasKey = await browser.execute(() => window.__E2E_READ__.hasKey());

    if (!hasKey) {
      // ITEM 1b (negative): ONE book in flight → "Also in progress" ABSENT.
      expect(await $(".also-in-progress").isExisting()).toBe(false);

      // ITEM 3a: no key → the setup signal is present on the home.
      const signal = await $(".resume-section-tts-signal");
      await signal.waitForExist({ timeout: 15000 });
      expect(await signal.getText()).toContain(
        "AI TTS requires an ElevenLabs API key",
      );

      // ...and Configure opens Settings through the real shell.
      const configure = await $(".resume-section-tts-signal-action");
      await configure.waitForClickable({ timeout: 15000 });
      await domClick(".resume-section-tts-signal-action");
      const settings = await $("dialog.settings-backdrop[open]");
      await settings.waitForExist({ timeout: 10000 });
      expect(await settings.getText()).toContain("Settings");
      await domClick("button.settings-close");
      await settings.waitForExist({ timeout: 5000, reverse: true });

      // ITEM 2a: plain Resume lands on the stored page, no narration.
      await domClick('button[aria-label^="Resume E2E Resume Fixture A, page"]');
      await browser.waitUntil(
        async () => (await $('input[aria-label="Current page"]').getValue()) === "2",
        {
          timeout: 15000,
          timeoutMsg: "plain Resume did not land on stored page 2",
        },
      );
      expect(await browser.execute(() => window.__E2E_READ__.playbackState())).toBe(
        "idle",
      );

      // ITEM 2c: resume-and-play degrades honestly with no key — lands, still
      // idle, and the reader's own bar shows the setup message (no promise of
      // audio it cannot keep).
      await browser.keys(["Control", "l"]);
      const play = await $(
        'button[aria-label="Resume E2E Resume Fixture A and start reading aloud"]',
      );
      await play.waitForClickable({ timeout: 15000 });
      await domClick(
        'button[aria-label="Resume E2E Resume Fixture A and start reading aloud"]',
      );
      await browser.waitUntil(
        async () => (await $('input[aria-label="Current page"]').getValue()) === "2",
        {
          timeout: 15000,
          timeoutMsg: "resume-and-play (no key) did not land on stored page 2",
        },
      );
      expect(await browser.execute(() => window.__E2E_READ__.playbackState())).toBe(
        "idle",
      );
      const barSetup = await $(".ai-playback-setup-message");
      await barSetup.waitForExist({ timeout: 10000 });
      expect(await barSetup.getText()).toContain(
        "AI TTS requires an ElevenLabs API key",
      );
    } else {
      // ITEM 3b: key present → the setup signal is GONE from the home.
      expect(await $(".resume-section-tts-signal").isExisting()).toBe(false);

      // ITEM 1b (positive): TWO books in flight → "Also in progress" with the
      // second book and its own stored page.
      const also = await $(".also-in-progress");
      await also.waitForExist({ timeout: 15000 });
      // textContent, not getText: WebKit's getText drops ellipsis-clipped
      // nowrap spans from the rendered-text computation (the row title is
      // present in the DOM and the a11y tree but absent from getText). The
      // row's resume-and-play button accessible name is the a11y proof.
      const alsoText = await browser.execute(
        () => document.querySelector(".also-in-progress")?.textContent ?? "",
      );
      expect(alsoText).toContain("E2E Resume Fixture B");
      expect(alsoText).toContain("Page 2 of 3");
      await $(
        'button[aria-label="Resume E2E Resume Fixture B and start reading aloud"]',
      ).waitForExist({ timeout: 5000 });

      // ITEM 2b: resume-and-play lands on the stored page AND starts
      // narration. Oracle: the TTS store reaching "playing" (the fixture
      // backend is real IPC with real marks; no human listens).
      const play = await $(
        'button[aria-label="Resume E2E Resume Fixture A and start reading aloud"]',
      );
      await play.waitForClickable({ timeout: 15000 });
      await domClick(
        'button[aria-label="Resume E2E Resume Fixture A and start reading aloud"]',
      );
      await browser.waitUntil(
        async () => (await $('input[aria-label="Current page"]').getValue()) === "2",
        {
          timeout: 15000,
          timeoutMsg: "resume-and-play did not land on stored page 2",
        },
      );
      await browser.waitUntil(
        async () =>
          (await browser.execute(() =>
            window.__E2E_READ__.playbackState(),
          )) === "playing",
        {
          timeout: 10000,
          timeoutMsg: "TTS store never reached 'playing' after resume-and-play",
        },
      );
      // The public control flipped to Pause (isPlaying renders the pause
      // button in the playback bar).
      await browser.waitUntil(
        async () => (await $('button[title="Pause (Ctrl+Space)"]').isExisting()),
        { timeout: 10000, timeoutMsg: "play control did not flip to Pause" },
      );
    }
  });
});
