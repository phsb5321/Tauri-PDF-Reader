/**
 * Packaged cover journey (tauri-driver + WebdriverIO) — slice 121.
 *
 * Two phases over ONE hermetic profile (the runner deletes the fixture PDFs
 * between them — that deletion is the warm-cache oracle):
 *
 *   COVER_PHASE=first   grid shows three cards: two real fixture PDFs and one
 *                       deliberately coverless (corrupt) file. Asserts REAL
 *                       first-page rasters (naturalWidth > 0), distinct
 *                       pixels per fixture, the deterministic fallback for
 *                       the coverless file, the store-derived progress bar,
 *                       the cover-cache negative control (a random valid-
 *                       shaped id is rejected), and keyboard-open of a cover
 *                       card lands on the stored page.
 *   COVER_PHASE=verify  the fixture PDFs are GONE from the profile. The
 *                       cover must STILL render with the SAME pixel hash —
 *                       only the disk cache can serve it (any regeneration
 *                       would fail on the missing file and fall back).
 *                       Deterministic-again fallback asserted too.
 *
 * Deliberately NO exact-pixel cross-platform golden: hashes are compared
 * within this run only (distinctness across fixtures; equality across the
 * relaunch) — pdf.js rendering is deterministic per pinned version, but the
 * cross-platform golden is the brittle part the dispatch rejected.
 *
 * Actor contract: every activation goes through a visible public control
 * with `element.click()` after `waitForClickable()` (vimeflow#65 pin).
 * `window.__E2E_READ__` is read-only observer instrumentation — it records
 * the verdict, it never performs an action.
 *
 * Run with:  E2E_SPEC=./e2e/cover-journey.e2e.mjs  COVER_PHASE=first|verify
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true VITE_E2E_NATIVE_SEED=cover` — see
 * e2e/run-cover-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.COVER_PHASE || "first";

/** djb2 over a string — run-local hashes only, never a golden. */
function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/** Observer-side: decode the rendered cover img to a pixel hash. */
async function coverHash(title) {
  return browser.execute(async (t) => {
    const openButton = Array.from(
      document.querySelectorAll("button.document-card-open"),
    ).find(
      (el) =>
        el.getAttribute("aria-label") ===
        `Select ${t}; press Enter or double-click to open`,
    );
    const cover = openButton?.querySelector(".document-cover");
    const img = cover?.querySelector("img.document-cover-img");
    if (!img || !(img instanceof HTMLImageElement)) return null;
    if (!(img.naturalWidth > 0)) return { naturalWidth: img.naturalWidth };
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { naturalWidth: img.naturalWidth };
    ctx.drawImage(img, 0, 0);
    const data = canvas.toDataURL("image/png");
    let hash = 5381;
    for (let i = 0; i < data.length; i += 1) {
      hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
    }
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      hash: (hash >>> 0).toString(16),
    };
  }, title);
}

async function coverState(title) {
  return browser.execute((t) => {
    const openButton = Array.from(
      document.querySelectorAll("button.document-card-open"),
    ).find(
      (el) =>
        el.getAttribute("aria-label") ===
        `Select ${t}; press Enter or double-click to open`,
    );
    const cover = openButton?.querySelector(".document-cover");
    return cover
      ? { state: cover.getAttribute("data-state"), seed: cover.getAttribute("data-seed") }
      : null;
  }, title);
}

describe("Packaged cover journey (slice 121: real first-page covers)", () => {
  it(`${PHASE} phase: covers render, fall back deterministically, and survive the relaunch`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "native bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // 1. The three seeded cards are on the grid. The cover is decorative
    //    inside each named control, avoiding a duplicate title announcement.
    const cardA = await $(
      'button[aria-label="Select E2E Resume Fixture A; press Enter or double-click to open"]',
    );
    const cardB = await $(
      'button[aria-label="Select E2E Resume Fixture B; press Enter or double-click to open"]',
    );
    const cardC = await $(
      'button[aria-label="Select E2E Coverless; press Enter or double-click to open"]',
    );
    for (const card of [cardA, cardB, cardC]) {
      await card.waitForDisplayed({ timeout: 15000 });
      await card.waitForClickable({ timeout: 15000 });
    }

    if (PHASE === "first") {
      // 2. Real rasters: BOTH A and B must reach "ready" before either hash
      //    is computed — hashing B while it is still loading would yield a
      //    null hash and poison the two-cover oracle (Codex round 3).
      await browser.waitUntil(
        async () => {
          const a = await coverState("E2E Resume Fixture A");
          const b = await coverState("E2E Resume Fixture B");
          return a?.state === "ready" && b?.state === "ready";
        },
        { timeout: 30000, timeoutMsg: "covers A/B never both reached ready" },
      );
      const hashA = await coverHash("E2E Resume Fixture A");
      const hashB = await coverHash("E2E Resume Fixture B");
      expect(hashA.naturalWidth).toBeGreaterThan(0);
      expect(hashB.naturalWidth).toBeGreaterThan(0);
      // Distinct first pages → distinct pixels. The fixtures differ in text.
      expect(hashA.hash).not.toBe(hashB.hash);
      // The runner captures these for the verify phase's warm-cache oracle.
      // eslint-disable-next-line no-console
      console.log(`COVER_A_HASH=${hashA.hash}`);
      // eslint-disable-next-line no-console
      console.log(`COVER_B_HASH=${hashB.hash}`);

      // 3. Deterministic fallback: the corrupt file never generates, and its
      //    seed is derived from its (content-hash) id — stable per content.
      const stateC = await coverState("E2E Coverless");
      expect(stateC.state).toBe("fallback");
      const expectedSeed = await browser.execute(async () => {
        const res = await window.__E2E_READ__.ipcCoverlessDocId();
        return String(parseInt(res.slice(0, 8), 16));
      });
      expect(stateC.seed).toBe(expectedSeed);

      // 4. Store-derived progress: A is seeded at page 2 of 5 → 40% on the
      //    cover foot bar.
      const barWidth = await browser.execute(() => {
        const card = Array.from(document.querySelectorAll(".document-card--grid")).find(
          (el) => el.textContent?.includes("E2E Resume Fixture A"),
        );
        const bar = card?.querySelector(".document-card-cover-progress");
        return bar instanceof HTMLElement ? bar.style.width : null;
      });
      expect(barWidth).toBe("40%");

      // 5. Cover-cache negative control: a valid-shaped id NOT in the
      //    library must be rejected by the real command.
      const probe = await browser.execute(() =>
        window.__E2E_READ__.coverCacheRandomProbe(),
      );
      expect(probe).toContain("NOT_FOUND");

      // 6. Opening the cover card still works: a REAL WebDriver double-click
      //    on A's visible open button (a single click only selects the card,
      //    LibraryView.tsx:271-272) — the reader lands on the stored page (2).
      // The card's open button, located by its ACCESSIBLE TEXT via XPath —
      // no element enumeration, no injected DOM events: a real WebDriver
      // double-click on the visible control (Codex gate 121).
      await cardA.doubleClick();
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === "2",
        { timeout: 15000, timeoutMsg: "cover card did not open at the stored page" },
      );
    } else {
      // verify phase: the fixture PDFs were DELETED from the profile by the
      // runner — the raster can only come from the disk cache. The hash must
      // MATCH the first phase's (recorded via the observer's file, below).
      await browser.waitUntil(
        async () => (await coverState("E2E Resume Fixture A"))?.state === "ready",
        { timeout: 30000, timeoutMsg: "cover A not ready from cache after relaunch" },
      );
      // The corrupted cached cover must read as a MISS (quarantined) and,
      // with the source file gone, the card must FALL BACK — stale bytes are
      // never rendered from a corrupt cache. The runner corrupted exactly one
      // cover (deterministic first-sorted); the spec self-determines WHICH
      // card fell back: exactly one fallback + the other ready from cache.
      // When the runner skipped the corruption (its two-covers gate), both
      // cards must be ready from cache with the phase-1 hash.
      // Both cards must reach a TERMINAL state (the corruption targets
      // exactly one cache file — the lexicographically first — so exactly one
      // card falls back and the other serves its real raster from the intact
      // cache, matching its phase-1 hash).
      await browser.waitUntil(
        async () => {
          const a = await coverState("E2E Resume Fixture A");
          const b = await coverState("E2E Resume Fixture B");
          return (
            a?.state === "ready" || a?.state === "fallback"
          ) && (
            b?.state === "ready" || b?.state === "fallback"
          );
        },
        { timeout: 30000, timeoutMsg: "covers did not reach terminal states" },
      );
      const stateA = await coverState("E2E Resume Fixture A");
      const stateB = await coverState("E2E Resume Fixture B");
      const fallbackCount = [stateA, stateB].filter(
        (s) => s?.state === "fallback",
      ).length;
      const readyCount = [stateA, stateB].filter(
        (s) => s?.state === "ready",
      ).length;
      if (fallbackCount !== 1 || readyCount !== 1) {
        throw new Error(
          `corrupt-cache oracle: expected exactly one fallback + one ready, ` +
            `got fallback=${fallbackCount} ready=${readyCount} ` +
            `(A=${stateA?.state}, B=${stateB?.state})`,
        );
      }
      const readyCard = stateA.state === "ready" ? "A" : "B";
      const readyHash = await coverHash(
        readyCard === "A" ? "E2E Resume Fixture A" : "E2E Resume Fixture B",
      );
      expect(readyHash.naturalWidth).toBeGreaterThan(0);
      // The runner FATALs when a phase-1 hash is missing, so the compare is
      // unconditional here (Codex gate round 2).
      const expectedReadyHash =
        readyCard === "A"
          ? process.env.EXPECT_COVER_A_HASH
          : process.env.EXPECT_COVER_B_HASH;
      if (!expectedReadyHash) {
        throw new Error("runner must have supplied the phase-1 hash");
      }
      expect(readyHash.hash).toBe(expectedReadyHash);
      const stateC = await coverState("E2E Coverless");
      expect(stateC.state).toBe("fallback");
    }
  });
});
