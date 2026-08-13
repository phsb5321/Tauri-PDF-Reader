/**
 * Packaged contrast capture (tauri-driver + WebdriverIO) — issue #120 lane.
 *
 * Certifies the contrast slice (#125) in the PACKAGED app, fail-closed:
 *
 *   Home, explicit light AND dark (hermetic profile, no-key seed, 1200×800):
 *     - every probed text node MUST exist (missing = red, never skipped);
 *     - its colour is alpha-1 and the node renders at full opacity;
 *     - its contrast is computed against the PAINTED ANCESTOR SURFACE
 *       (walking up through rgba layers with alpha compositing — a
 *       transparent local background is not an oracle) and must clear
 *       4.5:1 in both themes;
 *     - the grid delete button paints the semantic surface (exact computed
 *       colour per theme) and its error-text icon clears 4.5:1 on it.
 *
 *   Reader, explicit dark — the LIVE repaired surfaces from this PR:
 *     - resume (public control), drag-select the fixture paragraph (real
 *       WebDriver Actions pointer — same actor path as
 *       highlight-journey.e2e.mjs), pick "Highlight with Yellow";
 *     - the rendered `.highlight-rect` MUST compute `mix-blend-mode: screen`
 *       and `opacity: 0.5` — the dark rule this PR restored from the dropped
 *       comma-@media prelude;
 *     - the CSSOM (real parser output) must contain BOTH theme forms
 *       (attribute twin + `:root:not([data-theme="light"])` media fallback)
 *       for the LIVE repaired selectors (highlight-rect, highlight-toolbar),
 *       matched per-item through comma-joined selector lists. The other
 *       repaired files (HighlightContextMenu, NoteEditor, TtsHighlight)
 *       have no render site — their components are not imported anywhere —
 *       so their CSS never ships in a chunk; their fixed forms are covered
 *       by the parse-level twin contract in design-tokens.test.ts.
 *
 * Actor contract: activations go through visible public controls only
 * (Configure action, Light/Dark buttons, Resume, pointer drag-select,
 * colour button, context-menu menuitem). `window.__E2E_READ__` and DOM
 * reads are observer-only — they never act.
 *
 * Outputs: /tmp/lectrice-contrast-125-light.png, -dark.png,
 *          -reader-dark.png
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

/** Click the visible theme button by its label text (actor action). */
async function clickThemeButton(label) {
  await browser.execute(
    (text) =>
      [...document.querySelectorAll(".button-group-option")]
        .find((button) => button.textContent.trim() === text)
        ?.click(),
    label,
  );
}

async function waitForTheme(expected) {
  await browser.waitUntil(
    () =>
      browser.execute(
        (want) => document.documentElement.dataset.theme === want,
        expected,
      ),
    {
      timeout: 10000,
      timeoutMsg: `data-theme never became "${expected}"`,
    },
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

/**
 * Compute text contrast against the PAINTED ancestor surface, compositing
 * rgba backgrounds up the tree. A transparent local background is NOT a
 * verdict — the nearest ancestor that actually paints is.
 */
async function contrastOracle(label, selectors) {
  const pairs = await browser.execute((sels) => {
    const parseColor = (str) => {
      const m = /rgba?\(([^)]+)\)/.exec(str);
      if (!m) return null;
      const p = m[1].split(",").map((s) => parseFloat(s.trim()));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a);
      if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      const ch = (k) =>
        (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
      return { r: ch("r"), g: ch("g"), b: ch("b"), a };
    };
    const paintedSurface = (el) => {
      let node = el;
      let acc = null;
      while (node && node !== document.documentElement) {
        const c = parseColor(getComputedStyle(node).backgroundColor);
        if (c) acc = acc ? over(c, acc) : c;
        if (acc && acc.a >= 0.999) return acc;
        node = node.parentElement;
      }
      const body = parseColor(getComputedStyle(document.body).backgroundColor);
      return acc && body ? over(acc, body) : acc || body;
    };
    const luminance = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (fg, bg) => {
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    return sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const style = getComputedStyle(el);
      const fg = parseColor(style.color);
      const bg = paintedSurface(el);
      return {
        sel,
        color: style.color,
        surface: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        opacity: style.opacity,
        ratio: fg ? ratio(fg, bg) : null,
      };
    });
  }, selectors);
  console.log(`${label}`, JSON.stringify(pairs));
  for (const pair of pairs) {
    expect(pair.missing).toBeFalsy();
    expect(pair.opacity).toBe("1");
    expect(pair.ratio).not.toBeNull();
    expect(pair.ratio).toBeGreaterThanOrEqual(4.5);
  }
  return pairs;
}

/** Grid delete button: semantic surface + its icon clears 4.5:1 on it. */
async function deleteButtonOracle(label) {
  const result = await browser.execute(() => {
    const el = document.querySelector(
      ".document-card--grid .document-card-delete",
    );
    if (!el) return { missing: true };
    const parseColor = (str) => {
      const fn = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)/.exec(
        str,
      );
      if (fn)
        return {
          r: Number(fn[1]) * 255,
          g: Number(fn[2]) * 255,
          b: Number(fn[3]) * 255,
          a: fn[4] !== undefined ? Number(fn[4]) : 1,
        };
      const m = /rgba?\(([^)]+)\)/.exec(str);
      if (!m) return null;
      const p = m[1].split(",").map((s) => parseFloat(s.trim()));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const luminance = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const style = getComputedStyle(el);
    const fg = parseColor(style.color);
    const bg = parseColor(style.backgroundColor);
    return {
      background: style.backgroundColor,
      color: style.color,
      ratio: fg && bg ? ratio(fg, bg) : null,
    };
  });
  console.log(`${label}`, JSON.stringify(result));
  expect(result.missing).toBeFalsy();
  expect(result.ratio).not.toBeNull();
  expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  return result;
}

/**
 * The repaired dark rules must SURVIVE the real parser in BOTH forms: the
 * pre-fix comma-@media prelude made the engine drop the rule, so neither
 * form would exist here. Both forms are required for every selector.
 */
async function assertRepairedDarkRules() {
  // The LIVE repaired selectors: their chunks ship with the reader
  // (HighlightOverlay.css via PdfViewer) and the selection toolbar
  // (HighlightToolbar.css via HighlightCreationHandler). The other three
  // repaired files (HighlightContextMenu, NoteEditor, TtsHighlight) have NO
  // render site — grep of the import graph shows nothing imports those
  // components — so their CSS never reaches a shipped chunk; their fixed
  // forms are covered by the parse-level twin contract in
  // design-tokens.test.ts instead.
  //
  // The matcher parses comma-joined selector lists (esbuild merges rules
  // with identical declarations), so each list item is matched separately
  // against the required dark prefix + target selector.
  const selectors = [".highlight-rect", ".highlight-toolbar"];
  const found = await browser.execute((sels) => {
    const result = Object.fromEntries(
      sels.map((sel) => [sel, { attribute: false, media: false }]),
    );
    const attributePrefix = '[data-theme="dark"] ';
    const mediaPrefix = ':root:not([data-theme="light"]) ';
    const walk = (rules, inDarkMedia) => {
      for (const rule of rules) {
        const mediaText = rule.conditionText || rule.media?.mediaText || "";
        if (mediaText && /prefers-color-scheme:\s*dark/.test(mediaText)) {
          try {
            walk(rule.cssRules, true);
          } catch {
            /* cross-origin sheet — skip */
          }
          continue;
        }
        if (!rule.selectorText) continue;
        const items = rule.selectorText
          .split(",")
          .map((item) => item.trim().replace(/\s+/g, " "));
        for (const item of items) {
          for (const sel of sels) {
            if (item.startsWith(attributePrefix) && item.endsWith(sel))
              result[sel].attribute = true;
            if (
              inDarkMedia &&
              item.startsWith(mediaPrefix) &&
              item.endsWith(sel)
            )
              result[sel].media = true;
          }
        }
        if (rule.cssRules) {
          try {
            walk(rule.cssRules, inDarkMedia);
          } catch {
            /* skip */
          }
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, false);
      } catch {
        /* skip */
      }
    }
    return result;
  }, selectors);
  console.log("CSSOM_DARK_RULES", JSON.stringify(found));
  for (const sel of selectors) {
    expect(found[sel].attribute).toBe(true);
    expect(found[sel].media).toBe(true);
  }
}

const HOME_TEXT_SELECTORS = [
  "h2#continue-reading-heading",
  ".resume-line-title",
  ".document-card-title",
  ".document-card--grid .document-card-meta",
];

describe("Packaged contrast capture (light + dark home, dark reader repairs)", () => {
  it("certifies home contrast in both themes and the repaired dark reader surfaces", async function () {
    this.timeout(240000);
    await browser.setWindowSize(1200, 800);

    // 1. Native bootstrap ready, home mounted.
    await browser.waitUntil(
      () => browser.execute(() => window.__E2E_READ__?.ready === true),
      { timeout: 30000, timeoutMsg: READY_MSG },
    );
    const heading = await $("h2#continue-reading-heading");
    await heading.waitForExist({ timeout: 30000 });
    // The heading styles text-transform: uppercase — live DOM text is
    // "CONTINUE READING".
    await expect(heading.getText()).resolves.toMatch(/continue reading/i);

    // 2. Explicit light via the visible control; home oracle + capture.
    let settings = await openSettings();
    await expect(settings.getText()).resolves.toContain("Appearance");
    await clickThemeButton("Light");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("light");
    await contrastOracle("COMPUTED_LIGHT", HOME_TEXT_SELECTORS);
    const lightDelete = await deleteButtonOracle("DELETE_BUTTON_LIGHT");
    expect(lightDelete.background).toBe("rgb(230, 233, 239)");
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-light.png");

    // 3. Explicit dark; home oracle + capture (the pre-fix white blob fails
    //    the delete-button ratio here).
    settings = await openSettings();
    await clickThemeButton("Dark");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("dark");
    await contrastOracle("COMPUTED_DARK", HOME_TEXT_SELECTORS);
    const darkDelete = await deleteButtonOracle("DELETE_BUTTON_DARK");
    expect(darkDelete.background).toBe("rgb(24, 24, 37)");
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-dark.png");

    // 4. Resume into the reader (public control), page 2, text rendered.
    const resume = await $(
      'button[aria-label^="Resume E2E Resume Fixture A, page"]',
    );
    await resume.waitForClickable({ timeout: 15000 });
    await domClick('button[aria-label^="Resume E2E Resume Fixture A, page"]');
    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) === "2",
      { timeout: 15000, timeoutMsg: "resume did not land on page 2" },
    );
    await browser.waitUntil(
      () =>
        browser.execute(() =>
          Array.from(document.querySelectorAll(".textLayer span")).some((s) =>
            /lectrice/i.test(s.textContent || ""),
          ),
        ),
      { timeout: 30000, timeoutMsg: "fixture text never rendered" },
    );

    // 5. ACTOR: drag-select the paragraph (real pointer, the
    //    highlight-journey mechanic) → public colour toolbar → Yellow.
    const geometry = await browser.execute(() => {
      const spans = Array.from(document.querySelectorAll(".textLayer span")).filter(
        (s) => (s.textContent || "").includes("lectrice"),
      );
      if (spans.length === 0) return null;
      const rects = spans.map((s) => s.getBoundingClientRect());
      return {
        left: Math.min(...rects.map((r) => r.left)),
        top: Math.min(...rects.map((r) => r.top)),
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
      };
    });
    expect(geometry).not.toBeNull();
    const y = geometry.top + (geometry.bottom - geometry.top) / 2;
    await browser.performActions([
      {
        type: "pointer",
        id: "mouse1",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", x: Math.round(geometry.left + 15), y: Math.round(y) },
          { type: "pointerDown", button: 0 },
          {
            type: "pointerMove",
            x: Math.round(geometry.right - 15),
            y: Math.round(y),
            duration: 200,
          },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);
    await browser.releaseActions();
    const toolbar = await $('[role="toolbar"][aria-label="Highlight colors"]');
    await toolbar.waitForExist({
      timeout: 10000,
      timeoutMsg: "highlight toolbar never appeared after selection",
    });
    const yellow = await $('button[aria-label="Highlight with Yellow"]');
    await yellow.waitForClickable({ timeout: 10000 });
    await domClick('button[aria-label="Highlight with Yellow"]');
    await browser.waitUntil(
      () =>
        browser.execute(
          () =>
            !!document.querySelector(
              '[aria-label*="Highlight: "][aria-label*="lectrice fixture page two"]',
            ),
        ),
      {
        timeout: 15000,
        timeoutMsg: "highlight overlay never rendered",
      },
    );

    // 6. DARK reader: the repaired HighlightOverlay rule must apply live.
    const rectState = await browser.execute(() => {
      const rect = document.querySelector('[aria-label*="Highlight: "]');
      if (!rect) return { missing: true };
      const style = getComputedStyle(rect);
      return { blend: style.mixBlendMode, opacity: style.opacity };
    });
    console.log("HIGHLIGHT_RECT_DARK", JSON.stringify(rectState));
    expect(rectState.missing).toBeFalsy();
    expect(rectState.blend).toBe("screen");
    expect(rectState.opacity).toBe("0.5");

    // 7. Both theme forms of every LIVE repaired rule survive the real
    //    parser (the dead-file rules are covered by the unit twin contract).
    await assertRepairedDarkRules();
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-reader-dark.png");
  });
});
