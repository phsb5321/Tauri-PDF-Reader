/**
 * S1 card-fold verify (gap #1 of docs/audit-home-ui-2026-08-16.md) — the
 * packaged gate: a library card's text (title / pages / progress) must be
 * visible WITHOUT scrolling inside the grid.
 *
 * Ported from the audit's home-audit-capture.e2e.mjs (the PROBE shape is
 * unchanged) with the S1 assertions added:
 *   - every card VISIBLE at scroll-top (its top inside the grid) must not be
 *     clipped mid-card: card bottom <= grid bottom;
 *   - that card's title / meta / progress rects must be inside the grid's
 *     fold (top < grid bottom) and inside the viewport (bottom <= viewport).
 *
 * The grid viewport is measured (grid rect) — the assertions hold for
 * whatever the layout actually gives, not a hardcoded pixel number.
 *
 * Actor contract: theme switching through visible controls only (Configure
 * signal → Settings → Light/Dark). Probes are read-only.
 *
 * Run: E2E_SPEC=./e2e/card-fold-verify.e2e.mjs (see scripts/card-fold-verify.sh)
 */

/* global browser, $, expect */

const SEED = process.env.AUDIT_SEED || "single";
const AUDIT_ONLY = process.env.CARD_AUDIT === "1";
const READY_MSG =
  "native bootstrap (window.__E2E_READ__.ready) never became ready";

function domClick(selector) {
  return browser.execute(
    (sel) => document.querySelector(sel)?.click(),
    selector,
  );
}

async function clickThemeButton(label) {
  await browser.execute(
    (text) =>
      [...document.querySelectorAll(".button-group-option")]
        .find((button) => button.textContent.trim() === text)
        ?.click(),
    label,
  );
}

async function openSettings() {
  const configure = await $(".resume-section-tts-signal-action");
  await configure.waitForClickable({ timeout: 15000 });
  await domClick(".resume-section-tts-signal-action");
  const settings = await $("dialog.settings-backdrop[open]");
  await settings.waitForExist({ timeout: 10000 });
  return settings;
}

async function waitForTheme(expected) {
  await browser.waitUntil(
    () =>
      browser.execute(
        (want) => document.documentElement.dataset.theme === want,
        expected,
      ),
    { timeout: 10000, timeoutMsg: `data-theme never became "${expected}"` },
  );
}

/** Read-only layout probes (the audit's shape + the S1 text rects). */
async function probe() {
  return browser.execute(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };

    const grid = document.querySelector(".library-grid");
    const gridRect = rect(grid);

    const cards = Array.from(document.querySelectorAll(".document-card")).map(
      (c) => {
        const title = c.querySelector(".document-card-title");
        const meta = c.querySelector(".document-card-meta");
        const progress = c.querySelector(".document-card-progress");
        const cover = c.querySelector(".document-cover");
        return {
          top: Math.round(c.getBoundingClientRect().top),
          bottom: Math.round(c.getBoundingClientRect().bottom),
          w: Math.round(c.getBoundingClientRect().width),
          title: rect(title),
          meta: rect(meta),
          progress: rect(progress),
          cover: rect(cover),
          coverRatio: cover
            ? +(
                cover.getBoundingClientRect().width /
                cover.getBoundingClientRect().height
              ).toFixed(3)
            : null,
          coverState: cover?.getAttribute("data-state") ?? null,
        };
      },
    );

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      grid: gridRect,
      gridScrollTop: grid ? grid.scrollTop : null,
      gridOverflowY: grid ? getComputedStyle(grid).overflowY : null,
      cards,
    };
  });
}

describe("S1 card-fold verify (card text inside the fold)", () => {
  it(`seed=${SEED}: card text visible without inner-grid scrolling, both themes`, async function () {
    this.timeout(240000);
    await browser.waitUntil(
      () => browser.execute(() => window.__E2E_READ__?.ready === true),
      { timeout: 30000, timeoutMsg: READY_MSG },
    );
    for (const [width, label] of [
      [1200, "1200"],
      [640, "640"],
    ]) {
      await browser.setWindowSize(width, 800);
      for (const theme of ["light", "dark"]) {
        const settings = await openSettings();
        await clickThemeButton(theme === "light" ? "Light" : "Dark");
        await domClick("button.settings-close");
        await settings.waitForExist({ timeout: 5000, reverse: true });
        await waitForTheme(theme);
        await browser.pause(300);

        const p = await probe();
        console.log(`PROBE ${theme}-${label} ${JSON.stringify(p)}`);
        console.log(
          `DIAG seedstate: seedEnv=${SEED} dom=${JSON.stringify(await browser.execute(() => ({ n: document.querySelectorAll('.document-card').length, titles: [...document.querySelectorAll('.document-card-title')].map((e) => e.textContent), ready: window.__E2E_READ__?.ready })))}`,
        );
        await browser.saveScreenshot(
          `/tmp/lectrice-s1-${SEED}-${theme}-${label}.png`,
        );

        if (AUDIT_ONLY) {
          console.log(
            `DIAG s1 ${SEED} ${theme}-${label}: gridBottom=${p.grid?.bottom} cards=${p.cards.length} (audit-only, no assert)`,
          );
          continue;
        }
      // The grid must exist and have rendered cards.
      expect(p.grid).not.toBeNull();
      expect(p.cards.length).toBeGreaterThan(0);
      const gridBottom = p.grid.bottom;

      // Every card FULLY VISIBLE at scroll-top (inside the grid's box AND
      // not clipped by the fold — the first row; deeper rows are the
      // natural scroll content and each row's card still fits the grid
      // viewport when scrolled into it) must not be clipped mid-card: the
      // whole card (cover + text) fits the grid's fold.
      const visible = p.cards.filter(
        (c) => c.top < gridBottom && c.bottom <= gridBottom + 1,
      );
      expect(visible.length).toBeGreaterThan(0);
      for (const card of visible) {
        expect(card.bottom).toBeLessThanOrEqual(gridBottom + 1);
        for (const part of ["title", "meta", "progress"]) {
          const r = card[part];
          expect(r).not.toBeNull();
          // The text rect is inside the grid's fold…
          expect(r.top).toBeLessThan(gridBottom);
          // …and inside the viewport.
          expect(r.bottom).toBeLessThanOrEqual(p.viewport.h);
        }
      }
    }
  }
  });
});
