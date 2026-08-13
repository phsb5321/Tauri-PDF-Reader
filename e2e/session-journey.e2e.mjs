/**
 * Packaged session-journey E2E (tauri-driver + WebdriverIO).
 *
 * The first packaged lane for the SESSION surface: create a reading session
 * with two documents through the real UI, restore it, and prove the
 * last-read document opens AT ITS SAVED PAGE — across a real app restart.
 *
 * #85 (`95a8407`) wired restore to open the session's last-read document at
 * its saved page; before that, `handleSessionRestored` was a `// TODO` stub.
 * That wiring has never run in a packaged build — and the highlights lane
 * (#100) proved that "reachable" and "does the thing" can come apart.
 *
 * Two phases, one hermetic profile (the runner keeps XDG_* constant):
 *   SESSION_PHASE=create — seed dual (doc A page 2/5, doc B page 2/3), open
 *     the Sessions panel, create "E2E Session" with A+B, restore it, and
 *     assert the last-read document (highest position = B) opens at its
 *     saved page (2), NOT page 1. Then navigate forward while the session
 *     is active and restore again — since #114, restore lands on the
 *     LIBRARY ROW's page (the autosave target), so after Next the row
 *     advances to 3 and the second restore must land on the row's 3, not
 *     the add-time snapshot.
 *   SESSION_PHASE=verify — the app RELAUNCHES on the same profile; the
 *     session must still exist, restore must behave identically, and delete
 *     (public 2-click confirm) must remove it from the list.
 *
 * Actor contract: every activation is a public control (toolbar button,
 * dialog input, checkbox, row click, delete button) dispatched with
 * element.click() after waitForClickable() — the vimeflow#65 pin.
 * `window.__E2E_READ__` is read-only observer instrumentation.
 *
 * Run with:  E2E_SPEC=./e2e/session-journey.e2e.mjs  SESSION_PHASE=create|verify
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true` — see e2e/run-session-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.SESSION_PHASE || "create";

/** The claim being gated (#85): restore lands on the LAST-READ document at
 *  ITS SAVED PAGE — not page 1, not the wrong document. */
const SESSION_NAME = "E2E Session";
const LAST_READ_TITLE = "E2E Resume Fixture B"; // highest session position
const LAST_READ_SAVED_PAGE = "2"; // B's library row (seeded current_page)

describe("Packaged session journey (create → restore → survive restart → delete)", () => {
  it(`${PHASE}: session restore lands the last-read document on its saved page`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // ── 1. Open the Sessions panel (public toolbar control). ──────────────
    const sessionsBtn = await $("button.sessions-button");
    await sessionsBtn.waitForExist({ timeout: 15000 });
    await sessionsBtn.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document.querySelector("button.sessions-button")?.click(),
    );

    if (PHASE === "create") {
      // ── 2. Create the session: New Session → name → select A + B. ───────
      const newSession = await browser.execute(() => {
        const btn = Array.from(
          document.querySelectorAll(
            '[role="complementary"][aria-label="Reading Sessions"] button',
          ),
        ).find((b) => (b.textContent || "").includes("New Session"));
        if (btn) btn.click();
        return !!btn;
      });
      if (!newSession) {
        console.log(
          "DIAG session-open:",
          JSON.stringify(
            await browser.execute(() => ({
              panelExists: !!document.querySelector(
                '[role="complementary"][aria-label="Reading Sessions"]',
              ),
              panelText: document
                .querySelector(
                  '[role="complementary"][aria-label="Reading Sessions"]',
                )
                ?.textContent?.slice(0, 200),
              buttons: Array.from(document.querySelectorAll("button")).map(
                (b) => b.textContent?.trim().slice(0, 30),
              ),
            })),
          ),
        );
      }
      expect(newSession).toBe(true);

      const nameInput = await $("#session-name");
      await nameInput.waitForExist({ timeout: 10000 });
      await nameInput.setValue(SESSION_NAME);

      // Select BOTH fixture documents via their public checkboxes.
      for (const title of ["E2E Resume Fixture A", "E2E Resume Fixture B"]) {
        await browser.execute((t) => {
          const label = Array.from(
            document.querySelectorAll(".create-session-dialog__doc-item"),
          ).find((l) => (l.textContent || "").includes(t));
          const cb = label?.querySelector("input[type=checkbox]");
          if (cb && !cb.checked) cb.click();
        }, title);
      }

      await browser.execute(() => {
        const submit = Array.from(
          document.querySelectorAll(".create-session-dialog button"),
        ).find((b) => (b.textContent || "").includes("Create Session"));
        submit?.click();
      });

      // ── 3. The session appears in the list (create works). ──────────────
      await browser.waitUntil(
        async () =>
          browser.execute(
            (n) =>
              Array.from(
                document.querySelectorAll(".session-menu__list *"),
              ).some((el) => (el.textContent || "").includes(n)),
            SESSION_NAME,
          ),
        { timeout: 15000, timeoutMsg: "created session never appeared in the list" },
      );

      // ── 4. Restore: click the session row. ───────────────────────────────
      await browser.execute((n) => {
        const row = Array.from(
          document.querySelectorAll(".session-menu__list button"),
        ).find((b) => (b.textContent || "").includes(n));
        row?.click();
      }, SESSION_NAME);

      // The reader opens (public toolbar title) — the LAST-READ document.
      await browser.waitUntil(
        async () =>
          browser.execute(
            (t) =>
              (document.querySelector(".document-title")?.textContent || "").includes(t),
            LAST_READ_TITLE,
          ),
        { timeout: 15000, timeoutMsg: "restore did not open the last-read document" },
      );

      // ── 5. THE CLAIM: it opens at its SAVED PAGE (2), not page 1. ───────
      //      Observed, not asserted yet — the full evidence trail is logged
      //      and the verdict lands at the end of the phase. The page settles
      //      AFTER the title appears (showInReader lands on the library row's
      //      page, then handleSessionRestored overrides to the session page),
      //      so wait for the settle before reading.
      await browser.pause(800);
      const pageAfterRestore = await $('input[aria-label="Current page"]').getValue();

      // ── 6. Tracking check: navigate forward while the session is active,
      //       then restore again. Since #114, restore lands on the LIBRARY
      //       ROW's page (the autosave target — the session snapshot can
      //       only lag it), not on the add-time snapshot: from the restored
      //       page 2, Next goes to 3, autosave writes the row to 3, and the
      //       second restore must land on the ROW's 3. The pre-#114 premise
      //       ("the snapshot does not chase the reader, restore lands back
      //       on the snapshot's 2") was superseded by #114 and is kept here
      //       only as history. ──
      const next = await $('button[title="Next page (Right Arrow)"]');
      await next.waitForClickable({ timeout: 10000 });
      await browser.execute(() =>
        document.querySelector('button[title="Next page (Right Arrow)"]')?.click(),
      );
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === "3",
        { timeout: 10000, timeoutMsg: "next-page navigation failed" },
      );

      // ── The #114 precondition, asserted not assumed: the library row must
      //    catch up with the reader (autosave flush, 500 ms debounce + IPC)
      //    BEFORE the second restore — if autosave regresses, the lane fails
      //    HERE with a named timeout instead of a confusing landing mismatch.
      //    Read-only observer poll over the public row. ──
      await browser.waitUntil(
        async () => {
          const shown = await $('input[aria-label="Current page"]').getValue();
          const row = await browser.execute(
            (t) => window.__E2E_READ__.ipcDocumentRowPageByTitle(t),
            LAST_READ_TITLE,
          );
          return row !== null && shown === String(row);
        },
        {
          timeout: 5000,
          timeoutMsg:
            "library row never caught up with the reader after Next (autosave flush)",
        },
      );

      await browser.execute(() =>
        document.querySelector("button.sessions-button")?.click(),
      );
      await browser.waitUntil(
        async () =>
          browser.execute(
            (n) =>
              Array.from(
                document.querySelectorAll(".session-menu__list button"),
              ).some((b) => (b.textContent || "").includes(n)),
            SESSION_NAME,
          ),
        { timeout: 15000, timeoutMsg: "session list did not reappear" },
      );
      await browser.execute((n) => {
        const row = Array.from(
          document.querySelectorAll(".session-menu__list button"),
        ).find((b) => (b.textContent || "").includes(n));
        row?.click();
      }, SESSION_NAME);
      await browser.waitUntil(
        async () =>
          browser.execute(
            (t) =>
              (document.querySelector(".document-title")?.textContent || "").includes(t),
            LAST_READ_TITLE,
          ),
        { timeout: 15000, timeoutMsg: "second restore did not open the last-read document" },
      );
      await browser.pause(800);
      const pageAfterNavRestore = await $('input[aria-label="Current page"]').getValue();

      // The #114 oracle: the second restore lands on the LIBRARY ROW's page
      // (the autosave target). The row is read through the read-only observer
      // at assertion time — never hardcoded — so this pins the row-wins
      // contract against whichever page the row actually holds.
      const rowAfterNav = await browser.execute(
        (t) => window.__E2E_READ__.ipcDocumentRowPageByTitle(t),
        LAST_READ_TITLE,
      );

      console.log(
        "DIAG session-create:",
        JSON.stringify({
          phase: "create",
          lastReadTitle: LAST_READ_TITLE,
          pageAfterRestore,
          pageAfterNavRestore,
          rowAfterNav,
          claim:
            "first restore lands on the saved page; second restore lands on the library row's page",
        }),
      );
      expect(pageAfterRestore).toBe(LAST_READ_SAVED_PAGE);
      expect(pageAfterNavRestore).toBe(String(rowAfterNav));
    } else {
      // ── VERIFY phase: the session must SURVIVE the restart. ─────────────
      await browser.waitUntil(
        async () =>
          browser.execute(
            (n) =>
              Array.from(
                document.querySelectorAll(".session-menu__list *"),
              ).some((el) => (el.textContent || "").includes(n)),
            SESSION_NAME,
          ),
        { timeout: 15000, timeoutMsg: "session did not survive the restart (list empty)" },
      );

      // ── The #114 precondition: the row persisted across the relaunch at
      //    the page the create phase ended on (saved page 2 + one Next = 3,
      //    deterministic from the seeds). If the row write did not survive,
      //    the lane fails HERE, before any restore can mask it. ──
      const EXPECTED_ROW_AFTER_NEXT = String(Number(LAST_READ_SAVED_PAGE) + 1);
      await browser.waitUntil(
        async () =>
          (await browser.execute(
            (t) => window.__E2E_READ__.ipcDocumentRowPageByTitle(t),
            LAST_READ_TITLE,
          )) === Number(EXPECTED_ROW_AFTER_NEXT),
        {
          timeout: 5000,
          timeoutMsg: "persisted library row is not page 3 after relaunch",
        },
      );

      // Restore behaves identically after restart.
      await browser.execute((n) => {
        const row = Array.from(
          document.querySelectorAll(".session-menu__list button"),
        ).find((b) => (b.textContent || "").includes(n));
        row?.click();
      }, SESSION_NAME);
      await browser.waitUntil(
        async () =>
          browser.execute(
            (t) =>
              (document.querySelector(".document-title")?.textContent || "").includes(t),
            LAST_READ_TITLE,
          ),
        { timeout: 15000, timeoutMsg: "post-restart restore did not open the last-read document" },
      );
      await browser.pause(800);
      const pageAfterRestart = await $('input[aria-label="Current page"]').getValue();

      // The #114 oracle after a genuine relaunch: restore lands on the
      // LIBRARY ROW's page, read through the read-only observer. Probed
      // BEFORE the delete below so the delete cannot influence the oracle.
      const rowAfterRestart = await browser.execute(
        (t) => window.__E2E_READ__.ipcDocumentRowPageByTitle(t),
        LAST_READ_TITLE,
      );

      // ── Delete (public 2-click confirm) and assert it leaves the list. ──
      await browser.execute(() =>
        document.querySelector("button.sessions-button")?.click(),
      );
      await browser.waitUntil(
        async () =>
          browser.execute(
            (n) =>
              Array.from(
                document.querySelectorAll(".session-menu__list *"),
              ).some((el) => (el.textContent || "").includes(n)),
            SESSION_NAME,
          ),
        { timeout: 15000, timeoutMsg: "session list did not reappear for delete" },
      );
      const del = await $("button.session-item__delete");
      await del.waitForClickable({ timeout: 10000 });
      // First click arms the confirm; second (within 3 s) deletes.
      await browser.execute(() =>
        document.querySelector("button.session-item__delete")?.click(),
      );
      await browser.execute(() =>
        document.querySelector("button.session-item__delete")?.click(),
      );
      await browser.waitUntil(
        async () =>
          browser.execute(
            (n) =>
              !Array.from(
                document.querySelectorAll(".session-menu__list *"),
              ).some((el) => (el.textContent || "").includes(n)),
            SESSION_NAME,
          ),
        { timeout: 10000, timeoutMsg: "session was not deleted after 2-click confirm" },
      );

      console.log(
        "DIAG session-verify:",
        JSON.stringify({
          phase: "verify",
          survivedRestart: true,
          pageAfterRestart,
          rowAfterRestart,
          claim: "restore lands the last-read document at the library row's page",
        }),
      );
      expect(pageAfterRestart).toBe(String(rowAfterRestart));
    }
  });
});
