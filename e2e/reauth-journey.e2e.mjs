/**
 * Packaged reauthorization journey (tauri-driver + WebdriverIO) — the
 * issue #120 lost-grant black-box lane.
 *
 * A library book whose path lost its fs grant (pre-persisted-scope rows, or
 * a cleared scope) failed to open silently. The fix: on scope denial, the
 * resume path re-asks for the book through the native picker, the backend
 * re-verifies the selection's hash against the row id, and the read retries
 * under the fresh grant — cancel and wrong-file are visible refusals.
 *
 * Phases over ONE hermetic profile (the observer pre-places the fixtures and
 * the out-of-scope copy; the bootstrap relocates row A out of scope on first
 * launch):
 *
 *   REAUTH_PHASE=seed    — first launch: bootstrap seeds + relocates row A
 *                          to the OUT-OF-SCOPE copy. Nothing asserted.
 *   REAUTH_PHASE=good    — the actor clicks the resume line; the picker
 *                          (observer seam) returns the in-scope fixture A;
 *                          relocate accepts (hash match); the reader must
 *                          display the rendered page text.
 *   REAUTH_PHASE=cancel  — the picker returns null; the library must stay
 *                          with a visible OPEN_CANCELLED alert.
 *   REAUTH_PHASE=wrong   — the picker returns the corrupt fixture; relocate
 *                          must refuse (HASH_MISMATCH); the library stays
 *                          with a visible WRONG_DOCUMENT alert and the row
 *                          untouched.
 *
 * This lane deliberately does NOT arm the dialog/fs fixture-bytes seams: the
 * fs read must be the REAL scope-gated plugin-fs read so the denial is real.
 * Only the picker outcome is observer-supplied (build-time env), the same
 * WebDriver-impossible seam class as VITE_E2E_OPEN_PATH.
 *
 * Run with:  REAUTH_PHASE=seed|good|cancel|wrong  E2E_SPEC=./e2e/reauth-journey.e2e.mjs
 * against a binary built --features e2e-tts-fixture and a frontend built
 * VITE_E2E_NATIVE=true + the phase's REAUTH envs — see e2e/run-reauth-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.REAUTH_PHASE || "seed";

describe("Packaged reauthorization journey (lost fs grant, issue #120)", () => {
  it(`${PHASE}: ${
    PHASE === "seed"
      ? "bootstrap relocates the book out of scope"
      : PHASE === "good"
        ? "same-hash re-pick reopens the book in the reader"
        : PHASE === "cancel"
          ? "cancelling the reauthorization leaves a visible OPEN_CANCELLED alert"
          : "a wrong file is refused with a visible WRONG_DOCUMENT alert"
  }`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    if (PHASE === "seed") return;

    // ── The ACTOR clicks the resume line for the seeded book (public). ────
    const resumeButton = await $(
      'button[aria-label^="Resume E2E Resume Fixture A, page"]',
    );
    await resumeButton.waitForExist({ timeout: 15000 });
    await browser.execute(() =>
      document
        .querySelector(
          'button[aria-label^="Resume E2E Resume Fixture A, page"]',
        )
        ?.click(),
    );

    if (PHASE === "good") {
      // The book reopens: the reader displays the fixture's rendered text.
      try {
        await browser.waitUntil(
          async () =>
            browser.execute(() => {
              const spans = document.querySelectorAll(
                ".textLayer span, [class*='textLayer'] span",
              );
              return Array.from(spans).some((s) =>
                (s.textContent || "").includes("alpha lectrice"),
              );
            }),
          {
            timeout: 30000,
            timeoutMsg:
              "reader never displayed after same-hash reauthorization",
          },
        );
      } catch (err) {
        const alert = await $(".library-error-banner");
        const alertText = await alert.isExisting();
        console.log(
          `[reauth-good] reader not reached; alert present=${alertText}` +
            (alertText ? ` text=${await alert.getText()}` : ""),
        );
        throw err;
      }
      return;
    }

    // cancel / wrong: the refusal is VISIBLE on the shown surface.
    const alert = await $(".library-error-banner");
    await alert.waitForExist({ timeout: 20000 });
    const text = await alert.getText();
    expect(text).toContain(
      PHASE === "cancel" ? "OPEN_CANCELLED" : "WRONG_DOCUMENT",
    );
    // The reader must NOT have mounted.
    expect(
      await browser.execute(() =>
        document.querySelectorAll(".textLayer span").length,
      ),
    ).toBe(0);
  });
});
