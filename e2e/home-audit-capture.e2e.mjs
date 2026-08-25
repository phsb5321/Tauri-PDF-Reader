/**
 * Packaged home/library audit capture — evidence for docs/audit-home-ui-2026-08-16.md.
 *
 * For one seed profile (empty | single | dual | cover — chosen by the runner),
 * captures the home at 1200×800 and 640×800 in explicit light AND dark, and
 * logs deterministic layout probes:
 *   - sequential heading hierarchy (h1→h3 order, empty-state headings),
 *   - card count, cover boxes (aspect ratio vs 2:3, data-state ready|fallback),
 *   - resume line cover presence,
 *   - horizontal overflow, computed grid columns.
 *
 * Actor contract: theme switching goes through visible controls only (the
 * Configure signal on the resume section when a book is in flight, else the
 * empty state's "Open Settings" action; then the Settings panel's Light/Dark
 * buttons). All probes are read-only.
 *
 * Outputs: /tmp/lectrice-audit-<seed>-<theme>-<width>.png
 */

/* global browser, $, expect */

const SEED = process.env.AUDIT_SEED || "empty";
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
  const trigger = await $('button[aria-label="Settings"]');
  await trigger.waitForClickable({
    timeout: 15000,
    timeoutMsg: "shared toolbar Settings action is unavailable",
  });
  await trigger.click();
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

/** Read-only layout probes over the home surface. */
async function probe() {
  return browser.execute(() => {
    const headingOrder = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5"),
    ).map((h) => `${h.tagName}:${h.textContent.trim()}`);

    const covers = Array.from(document.querySelectorAll(".document-cover")).map(
      (c) => {
        const r = c.getBoundingClientRect();
        return {
          state: c.getAttribute("data-state"),
          w: Math.round(r.width),
          h: Math.round(r.height),
          ratio: +(r.width / r.height).toFixed(3),
        };
      },
    );

    const grid = document.querySelector(".library-grid");
    const gridCols = grid
      ? getComputedStyle(grid).gridTemplateColumns
      : null;

    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        right: Math.round(r.right),
      };
    };

    const cardRects = Array.from(
      document.querySelectorAll(".document-card"),
    ).map((card) => {
      const box = (element) => {
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
        };
      };
      return {
        card: box(card),
        title: box(card.querySelector(".document-card-title")),
        content: box(
          card.querySelector(".document-card-content") ??
            card.querySelector(".document-card-open"),
        ),
      };
    });

    const emptyState = (() => {
      const el = document.querySelector(".empty-state");
      if (!el) return null;
      const h = el.querySelector("h2, h3");
      return {
        title: h?.textContent.trim() ?? null,
        description: el.textContent.trim().slice(0, 160),
        action: Array.from(el.querySelectorAll("button")).map((b) =>
          b.textContent.trim(),
        ),
      };
    })();

    const resumeCoverCount = document.querySelectorAll(
      ".resume-line .document-cover, .resume-section .document-cover",
    ).length;

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      headingOrder,
      cards: document.querySelectorAll(".document-card").length,
      covers,
      resumeCoverCount,
      gridCols,
      gridColumnCount: gridCols ? gridCols.split(/\s+/).length : 0,
      emptyState,
      // WebKitGTK rounds the root box one CSS pixel wider than innerWidth on
      // this lane. Treat only >1px as actual horizontal overflow.
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      hOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
      vScroll: document.documentElement.scrollHeight > window.innerHeight,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      scrollW: document.documentElement.scrollWidth,
      rects: {
        libraryView: rect(".library-view"),
        libraryBody: rect(".library-body"),
        shelfSidebar: rect(".shelf-sidebar"),
        grid: rect(".library-grid"),
        emptyState: rect(".empty-state"),
        resumeLine: rect(".resume-line"),
      },
      cardRects,
    };
  });
}

function assertCardGeometry(result, label) {
  for (const [index, rects] of result.cardRects.entries()) {
    const { card, title, content } = rects;
    if (!card || !title || !content) {
      throw new Error(`${label}: card ${index} is missing geometry`);
    }
    if (title.y < card.y || title.bottom > card.bottom) {
      throw new Error(
        `${label}: card ${index} title escapes card (${JSON.stringify(rects)})`,
      );
    }
    if (content.y < card.y || content.bottom > card.bottom) {
      throw new Error(
        `${label}: card ${index} content escapes card (${JSON.stringify(rects)})`,
      );
    }
    const deadSpace = card.bottom - content.bottom;
    if (deadSpace > 24) {
      throw new Error(
        `${label}: card ${index} has ${deadSpace}px stretched dead space`,
      );
    }
  }
}

describe("Home/library audit capture", () => {
  it(`seed=${SEED}: captures home in light/dark at 1200×800 and 640×800 with probes`, async function () {
    this.timeout(240000);
    await browser.waitUntil(
      () => browser.execute(() => window.__E2E_READ__?.ready === true),
      { timeout: 30000, timeoutMsg: READY_MSG },
    );

    // ---- Light, wide ----
    await browser.setWindowSize(1200, 800);
    let settings = await openSettings();
    await clickThemeButton("Light");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("light");
    let result = await probe();
    assertCardGeometry(result, "light-1200");
    console.log(`PROBE light-1200 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(
      `/tmp/lectrice-audit-${SEED}-light-1200.png`,
    );

    // ---- Dark, wide ----
    settings = await openSettings();
    await clickThemeButton("Dark");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("dark");
    result = await probe();
    assertCardGeometry(result, "dark-1200");
    console.log(`PROBE dark-1200 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(`/tmp/lectrice-audit-${SEED}-dark-1200.png`);

    // ---- Light, narrow (640×800) ----
    await browser.setWindowSize(640, 800);
    settings = await openSettings();
    await clickThemeButton("Light");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("light");
    result = await probe();
    assertCardGeometry(result, "light-640");
    console.log(`PROBE light-640 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(`/tmp/lectrice-audit-${SEED}-light-640.png`);

    // ---- Dark, narrow ----
    settings = await openSettings();
    await clickThemeButton("Dark");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("dark");
    result = await probe();
    assertCardGeometry(result, "dark-640");
    console.log(`PROBE dark-640 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(`/tmp/lectrice-audit-${SEED}-dark-640.png`);

    // ---- Dark, narrow list: the grid fix must not regress the alternate mode.
    await domClick('button[aria-label="List view"]');
    result = await probe();
    assertCardGeometry(result, "dark-list-640");
    if (result.cards > 0 && result.gridColumnCount !== 1) {
      throw new Error(
        `dark-list-640: expected one list column, got ${result.gridColumnCount}`,
      );
    }
    console.log(`PROBE dark-list-640 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(
      `/tmp/lectrice-audit-${SEED}-dark-list-640.png`,
    );
    await domClick('button[aria-label="Grid view"]');

    // ---- Dark, ultrawide: keep useful title width instead of packing every
    // book into minimally-sized columns. Xvfb is deliberately 2560-wide.
    await browser.setWindowSize(2560, 1080);
    result = await probe();
    assertCardGeometry(result, "dark-2560");
    if (result.cards > 0 && result.gridColumnCount > 9) {
      throw new Error(
        `dark-2560: ${result.gridColumnCount} columns exceed the readable cap`,
      );
    }
    if (result.hScroll) {
      throw new Error("dark-2560: library introduced horizontal overflow");
    }
    console.log(`PROBE dark-2560 ${JSON.stringify(result)}`);
    await browser.saveScreenshot(`/tmp/lectrice-audit-${SEED}-dark-2560.png`);
  });
});
