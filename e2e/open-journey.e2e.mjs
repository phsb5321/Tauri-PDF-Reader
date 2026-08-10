/**
 * Packaged open-journey E2E (tauri-driver + WebdriverIO).
 *
 * The OPEN path's two claims, gated in the packaged app:
 *
 *   1. Toolbar Open SHOWS THE READER — clicking the toolbar's Open control
 *      must display the reader surface (the rendered text layer), not merely
 *      put a document in the store. The store is what currently lies: on
 *      main, `handleOpenFile` sets pdfDocument/currentDocument but nothing
 *      clears `showLibrary`, so `libraryShowing = showLibrary || !pdfDocument`
 *      stays true and PdfViewer never mounts.
 *   2. A FAILED OPEN IS VISIBLE — opening a corrupt PDF must show the user an
 *      error on the surface they are looking at. On main, the store error
 *      renders only inside PdfViewer (`.pdf-viewer-error`), which is never
 *      mounted while the library shows — the failure is silent.
 *
 * Two phases, one hermetic profile (fresh app process per phase):
 *   OPEN_PHASE=open-good    — the observer's dialog seam returns the GOOD
 *     fixture (E2E Resume Fixture B); the actor clicks Toolbar Open; the
 *     reader must display the rendered page. Expected RED on main.
 *   OPEN_PHASE=open-corrupt — the seam returns a garbage `.pdf`; the open
 *     flow throws; an error must be visible on the shown surface. Expected
 *     RED on main.
 *
 * The GTK file dialog is WebDriver-impossible (the documented bootstrap
 * seam); the observer supplies the path at build time (VITE_E2E_OPEN_PATH,
 * see src/hooks/useFileDialog.ts). The ACTOR clicks the real button; the
 * real handler chain runs below the dialog. `window.__E2E_READ__` is
 * read-only observer instrumentation.
 *
 * Run with:  E2E_SPEC=./e2e/open-journey.e2e.mjs  OPEN_PHASE=open-good|open-corrupt
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true` — see e2e/run-open-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.OPEN_PHASE || "open-good";

describe("Packaged open journey (Toolbar Open shows the reader; failed open is visible)", () => {
  it(`${PHASE}: ${PHASE === "open-good" ? "the reader displays after Toolbar Open" : "a failed open shows an error on the visible surface"}`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // ── The ACTOR clicks the toolbar Open control (public). ────────────────
    const openBtn = await $("button.open-button");
    await openBtn.waitForExist({ timeout: 15000 });
    await openBtn.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document.querySelector("button.open-button")?.click(),
    );

    if (PHASE === "open-good") {
      // ── THE CLAIM: the reader surface displays — the rendered text layer
      //    of the opened document. The store updating is NOT the claim. ─────
      try {
        await browser.waitUntil(
          async () =>
            browser.execute(() => {
              const spans = document.querySelectorAll(
                ".textLayer span, [class*='textLayer'] span",
              );
              return Array.from(spans).some((s) =>
                (s.textContent || "").includes("bravo lectrice"),
              );
            }),
          {
            timeout: 30000,
            timeoutMsg:
              "reader never displayed after Toolbar Open — document loaded into the store but the surface did not change",
          },
        );
      } catch (err) {
        console.log(
          "DIAG open-good:",
          JSON.stringify(
            await browser.execute(() => ({
              storeHasDoc: !!document.querySelector(".document-title"),
              title: document.querySelector(".document-title")?.textContent ?? null,
              textLayerCount: document.querySelectorAll(
                ".textLayer span, [class*='textLayer'] span",
              ).length,
              libraryShowing: !!document.querySelector(".library-view, .library-body, .resume-section"),
            })),
          ),
        );
        throw err;
      }
      console.log(
        "DIAG open-good:",
        JSON.stringify({
          readerDisplayed: true,
          title: await browser.execute(
            () => document.querySelector(".document-title")?.textContent ?? null,
          ),
        }),
      );
    } else {
      // ── THE CLAIM: a failed open shows an error on the surface shown. ────
      try {
        await browser.waitUntil(
          async () =>
            browser.execute(() => {
              const err = document.querySelector(
                ".pdf-viewer-error, [class*='error']:not([class*='error-hidden'])",
              );
              return !!err && (err.textContent || "").trim().length > 0;
            }),
          {
            timeout: 30000,
            timeoutMsg:
              "failed open was silent — no error visible on the surface the user is looking at",
          },
        );
      } catch (err) {
        console.log(
          "DIAG open-corrupt:",
          JSON.stringify(
            await browser.execute(() => ({
              bodyHasErrorText: /(invalid|failed|corrupt|error|unable)/i.test(
                document.body.textContent ?? "",
              ),
              errorEls: Array.from(
                document.querySelectorAll("[class*='error']"),
              ).map((el) => el.className),
              storeError: window.__E2E_READ__.storeError
                ? window.__E2E_READ__.storeError()
                : "n/a",
            })),
          ),
        );
        throw err;
      }
      console.log(
        "DIAG open-corrupt:",
        JSON.stringify({
          errorVisible: true,
          text: await browser.execute(
            () =>
              document.querySelector(".pdf-viewer-error, [class*='error']")
                ?.textContent ?? null,
          ),
        }),
      );
    }
  });
});
