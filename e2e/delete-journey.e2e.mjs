/**
 * Packaged delete-journey E2E (tauri-driver + WebdriverIO).
 *
 * The first packaged lane for the DELETE surface: removing a library document
 * through the real UI must remove the document row AND clear its cached audio
 * — files on disk plus metadata rows. Before this lane, the only coverage was
 * a Rust behavioral test (real temp dir) and a source-pin vitest that reads
 * library/mod.rs to assert the wiring — neither runs the shipped app.
 *
 * SECURITY.md's retention section claimed the on-disk audio file is orphaned
 * on delete; tracing (13/08/2026) showed `library_remove_document` →
 * `AudioCacheService::clear_document` → `SqliteAudioCacheRepo::delete_for_document`
 * removes `{cache_key}.mp3` + `{cache_key}.json` and drops the metadata rows
 * BEFORE the row delete — the doc was stale and is corrected in the same
 * slice. This lane is the packaged proof of that claim.
 *
 * Two phases, one hermetic profile (the runner keeps XDG_* constant):
 *   DELETE_PHASE=seed   — boot, wait for the bootstrap, assert the seeded
 *     fixture card is visible (a deterministic "app closed" point; the
 *     observer then pre-seeds ONE real cache entry: a metadata row + .mp3 in
 *     the app cache dir, the exact shape repo.store writes).
 *   DELETE_PHASE=delete — boot on the same profile (row + file must survive
 *     the relaunch), click the card's public delete button
 *     (`.document-card-delete`, aria-label "Remove from library"); the
 *     build-time seam accepts the WebDriver-impossible native confirm; assert
 *     the card disappears from the library surface AND the library row is
 *     gone via the read-only observer probe.
 *
 * The file/metadata half of the oracle is asserted by the RUNNER (post-phase
 * sqlite3 + fs checks), because the observer cannot touch the filesystem.
 *
 * Actor contract: every activation is a public control dispatched with
 * element.click() after waitForClickable() — the vimeflow#65 pin (WebDriver
 * pointer dispatch fires zero onClick handlers on WebKitGTK software
 * rendering; element.click() fires the same React handler a real click
 * would). `window.__E2E_READ__` is read-only observer instrumentation.
 *
 * Run with:  E2E_SPEC=./e2e/delete-journey.e2e.mjs  DELETE_PHASE=seed|delete
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true VITE_E2E_CONFIRM=accept` — see
 * e2e/run-delete-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.DELETE_PHASE || "seed";
const TITLE = "E2E Resume Fixture A";

describe("Packaged delete journey (UI delete removes the row and its cached audio)", () => {
  it(`${PHASE}: ${PHASE === "seed" ? "the seeded fixture card is visible" : "the real UI delete removes the document"}`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // ── The seeded card must be on the library surface. ────────────────────
    await browser.waitUntil(
      async () =>
        browser.execute(
          (t) =>
            Array.from(document.querySelectorAll(".library-view, .library-body")).some(
              (el) => (el.textContent || "").includes(t),
            ),
          TITLE,
        ),
      { timeout: 15000, timeoutMsg: "seeded fixture card never appeared in the library" },
    );

    if (PHASE === "seed") {
      console.log(
        "DIAG delete-seed:",
        JSON.stringify({
          phase: "seed",
          title: TITLE,
          cardVisible: true,
          claim: "library shows the seeded fixture before the observer pre-seeds the cache entry",
        }),
      );
      return;
    }

    // ── The ACTOR clicks the card's public delete button. It is
    //    hover-revealed (grid/list CSS holds the control at opacity 0 until
    //    the CARD is hovered — hovering the button itself does not reveal
    //    it), so the actor moves the real pointer over the public card
    //    first, waits for the control's computed opacity to reach 1 AND for
    //    clickability, then dispatches the click as `element.click()` via
    //    browser.execute — the vimeflow#65 pin: on WebKitGTK
    //    software-rendering, WebDriver's Actions-API pointer dispatch
    //    silently fires ZERO onClick handlers (the 04/08/2026 BLOCKED
    //    verdict; native-play.e2e.mjs documents the same class), while
    //    `element.click()` fires the SAME React onClick as a real click.
    //    The waitForClickable() above already proved the button is
    //    genuinely visible/enabled/unobscured. The build-time seam accepts
    //    the native confirm; the real removeDocument chain (cache clear
    //    FIRST, then row delete) runs below it. ─────────────────────────────
    const card = await $(".document-card");
    await card.waitForExist({ timeout: 15000 });
    await card.moveTo();

    const deleteBtn = await $(".document-card-delete");
    await deleteBtn.waitForExist({ timeout: 15000 });
    await browser.waitUntil(
      async () =>
        Number.parseFloat(
          (await deleteBtn.getCSSProperty("opacity")).value,
        ) === 1,
      {
        timeout: 5000,
        timeoutMsg: "delete control never revealed on card hover",
      },
    );
    await deleteBtn.waitForClickable({ timeout: 15000 });

    // ── Observer pre-flight, ASSERTED: the confirm seam must be active, or
    //    the native GTK dialog blocks the chain below it and the lane must
    //    fail HERE (named), never click into a modal it cannot dismiss. ────
    const seamDiag = await browser.execute(() => ({
      confirmSeamed: window.__E2E_READ__.confirmSeamed(),
      confirmKind: typeof window.confirm,
      confirmSrc: String(window.confirm).slice(0, 48),
    }));
    console.log("DIAG delete-seam:", JSON.stringify(seamDiag));
    expect(seamDiag.confirmSeamed).toBe(true);
    await browser.execute(() =>
      document.querySelector(".document-card-delete")?.click(),
    );

    // ── THE CLAIM (UI half): the card leaves the library surface. ──────────
    try {
      await browser.waitUntil(
        async () =>
          browser.execute(
            (t) =>
              !Array.from(document.querySelectorAll(".library-view, .library-body")).some(
                (el) => (el.textContent || "").includes(t),
              ),
            TITLE,
          ),
        { timeout: 15000, timeoutMsg: "document card still visible after delete" },
      );
    } catch (err) {
      console.log(
        "DIAG delete-fail:",
        JSON.stringify(
          await browser.execute((t) => ({
            cardStillVisible: Array.from(
              document.querySelectorAll(".library-view, .library-body"),
            ).some((el) => (el.textContent || "").includes(t)),
            title: t,
            confirmSeamed: window.__E2E_READ__.confirmSeamed(),
            logs: window.__E2E_READ__.logs().slice(-20),
          }), TITLE),
        ),
      );
      throw err;
    }

    // ── THE CLAIM (DB half, observer): the documents row is gone. ──────────
    const rowAfterDelete = await browser.execute(
      (t) => window.__E2E_READ__.ipcDocumentRowPageByTitle(t),
      TITLE,
    );
    console.log(
      "DIAG delete-phase:",
      JSON.stringify({
        phase: "delete",
        title: TITLE,
        cardGone: true,
        rowAfterDelete,
        claim: "UI card gone AND library row gone (cache files/metadata asserted by the runner)",
      }),
    );
    expect(rowAfterDelete).toBeNull();
  });
});
