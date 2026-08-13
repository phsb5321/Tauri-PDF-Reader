/**
 * Packaged contrast capture (tauri-driver + WebdriverIO) — issue #120 lane.
 *
 * Certifies the contrast slice (#125) in the PACKAGED app, fail-closed.
 *
 * PHASES (runner sets CAPTURE_PHASE; default "home+reader", no-key lane):
 *
 *   "home" (no-key lane, explicit light AND dark, 1200×800, hermetic
 *   profile): every probed text node MUST exist (missing = red, never
 *   skipped); its colour must be alpha-1; the node renders at full opacity;
 *   contrast is computed against the PAINTED ANCESTOR SURFACE — rgba layers
 *   are alpha-composited child-over-parent up the tree (a transparent local
 *   background is not a verdict; html is included; translucent text is
 *   composited over the surface before the ratio) — and must clear 4.5:1 in
 *   both themes. The grid delete button paints the exact semantic surface
 *   colour per theme and its error-text icon clears 4.5:1 on it.
 *
 *   Reader, explicit dark (same run): resume (public control), drag-select
 *   the fixture paragraph (real WebDriver Actions pointer — the
 *   highlight-journey mechanic), pick "Highlight with Yellow"; the rendered
 *   `.highlight-rect` MUST settle at `mix-blend-mode: screen` +
 *   `opacity: 0.5` — the dark rule this PR restored; the CSSOM (real parser
 *   output) must contain BOTH theme forms of the LIVE repaired rules,
 *   matched per exact item inside comma-joined selector lists AND
 *   declaration-aware (opacity 0.5 for highlight-rect — TextLayer's 0.25
 *   rules cannot mask a missing HighlightOverlay fallback; the toolbar's
 *   0 4px 12px shadow).
 *
 *   The other three repaired files (HighlightContextMenu, NoteEditor,
 *   TtsHighlight) have NO render site: nothing imports their components,
 *   and PdfPage — the sole importer of TtsHighlight — is itself never
 *   rendered (`<PdfPage` has zero occurrences; HighlightCreationHandler.tsx
 *   documents the dead render path), so their CSS never ships in a chunk.
 *   Their fixed forms are covered by the parse-level twin contract in
 *   design-tokens.test.ts, and the tts phase below adds packaged NEGATIVE
 *   evidence: fixture playback drives the live karaoke wire, yet no
 *   `.tts-highlight-rect` element ever mounts and its rule is absent from
 *   the shipped CSSOM — the honest receipt for a dead subtree.
 *
 *   "tts" (key lane: seed=dual, fixture TTS): production Ctrl+L enters the
 *   reader; the REAL play button drives the real TTS wire (word marks
 *   round-trip, karaoke index advances); the live repaired CSSOM rules are
 *   present in BOTH theme forms; and the dead-subtree negative holds (no
 *   `.tts-highlight-rect` element or CSSOM rule).
 *
 * Actor contract: activations go through visible public controls only
 * (Configure action, Light/Dark buttons, Resume, pointer drag-select,
 * colour button, real play button, Ctrl+L). `window.__E2E_READ__` and DOM
 * reads are observer-only — they never act.
 *
 * Outputs: /tmp/lectrice-contrast-125-light.png, -dark.png, -reader-dark.png
 */

/* global browser, $, expect */

const PHASE = process.env.CAPTURE_PHASE || "home";
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
 * Text contrast against the PAINTED ancestor surface. Compositing is
 * child-over-parent: walking up from the text node, each accumulated layer
 * is painted OVER the next ancestor's background. Translucent text is
 * composited over the surface before the ratio is taken.
 */
async function contrastOracle(label, selectors) {
  const pairs = await browser.execute((sels) => {
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
      while (node) {
        const c = parseColor(getComputedStyle(node).backgroundColor);
        // The accumulated CHILD layers paint OVER this ancestor's bg.
        if (c) acc = acc ? over(acc, c) : c;
        if (acc && acc.a >= 0.999) return acc;
        node = node.parentElement;
      }
      return acc || { r: 255, g: 255, b: 255, a: 1 };
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
      const effectiveFg = fg && fg.a < 1 ? over(fg, bg) : fg;
      return {
        sel,
        color: style.color,
        surface: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        opacity: style.opacity,
        ratio: effectiveFg ? ratio(effectiveFg, bg) : null,
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
 * Both theme forms of a repaired dark rule must survive the real parser,
 * matched per EXACT item in comma-joined selector lists and
 * DECLARATION-AWARE: the expected declaration must be present in the
 * matched rule, so a different rule on the same selector cannot mask a
 * missing repaired one.
 */
async function assertRepairedDarkRules(expectations) {
  const found = await browser.execute((sels) => {
    const result = Object.fromEntries(
      sels.map((sel) => [sel, { attribute: false, media: false }]),
    );
    const dump = [];
    const EXPECTED = {
      ".highlight-rect": /opacity:\s*0?\.5\b/,
      // WebKit serializes box-shadow colour-first: "rgba(0, 0, 0, 0.4) 0px
      // 4px 12px". Match the lengths anywhere after the property name.
      ".highlight-toolbar": /box-shadow:[^;]*0px 4px 12px/,
    };
    const attributePrefix = '[data-theme="dark"] ';
    const mediaPrefix = ':root:not([data-theme="light"]) ';
    // WebKit serializes `[data-theme=dark]` with or without quotes
    // depending on the rule — normalize quotes before exact comparison.
    const norm = (s) => s.replace(/"/g, "").replace(/\s+/g, " ").trim();
    const attributePrefixNorm = norm(attributePrefix);
    const mediaPrefixNorm = norm(mediaPrefix);
    const walk = (rules, inDarkMedia, sheetName) => {
      for (const rule of rules) {
        const mediaText = rule.conditionText || rule.media?.mediaText || "";
        if (mediaText && /prefers-color-scheme:\s*dark/.test(mediaText)) {
          try {
            walk(rule.cssRules, true, `${sheetName}@media`);
          } catch {
            /* cross-origin sheet — skip */
          }
          continue;
        }
        if (!rule.selectorText) continue;
        if (/highlight-(rect|toolbar)/.test(rule.selectorText)) {
          dump.push({
            sheet: sheetName,
            media: inDarkMedia,
            selectorText: rule.selectorText,
            cssText: rule.cssText,
          });
        }
        const items = rule.selectorText
          .split(",")
          .map((item) => item.trim().replace(/\s+/g, " "));
        for (const item of items) {
          const normalized = norm(item);
          for (const sel of sels) {
            if (
              normalized === attributePrefixNorm + " " + sel &&
              EXPECTED[sel].test(rule.cssText)
            )
              result[sel].attribute = true;
            if (
              inDarkMedia &&
              normalized === mediaPrefixNorm + " " + sel &&
              EXPECTED[sel].test(rule.cssText)
            )
              result[sel].media = true;
          }
        }
        if (rule.cssRules) {
          try {
            walk(rule.cssRules, inDarkMedia, sheetName);
          } catch {
            /* skip */
          }
        }
      }
    };
    let index = 0;
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, false, `sheet${index++}:`);
      } catch {
        /* skip */
      }
    }
    return { result, dump };
  }, Object.keys(expectations));
  console.log("CSSOM_DUMP", JSON.stringify(found.dump));
  console.log("CSSOM_DARK_RULES", JSON.stringify(found.result));
  for (const sel of Object.keys(expectations)) {
    console.log(`CSSOM_ASSERT ${sel}`, JSON.stringify(found.result[sel]));
    expect(found.result[sel].attribute).toBe(true);
    expect(found.result[sel].media).toBe(true);
  }
}

const HOME_TEXT_SELECTORS = [
  "h2#continue-reading-heading",
  ".resume-line-title",
  ".document-card-title",
  ".document-card--grid .document-card-meta",
];

async function waitForReady() {
  await browser.waitUntil(
    () => browser.execute(() => window.__E2E_READ__?.ready === true),
    { timeout: 30000, timeoutMsg: READY_MSG },
  );
}

describe("Packaged contrast capture", () => {
  it("tts phase: live karaoke wire advances; dead tts-highlight-rect subtree never ships", async function () {
    if (PHASE !== "tts") this.skip();
    this.timeout(240000);
    await browser.setWindowSize(1200, 800);
    await waitForReady();

    // Production Ctrl+L enters the already-loaded reader (native-play path).
    await browser.keys(["Control", "l"]);
    await browser.waitUntil(
      () =>
        browser.execute(() =>
          Array.from(document.querySelectorAll(".textLayer span")).some((s) =>
            /alpha|lectrice|fixture/i.test(s.textContent || ""),
          ),
        ),
      { timeout: 30000, timeoutMsg: "fixture text never rendered" },
    );

    // REAL play button → real wire → word marks round-trip from the
    // fixture backend (mirrors native-play's observer reads).
    const playBtn = await $(".ai-playback-button");
    await playBtn.waitForClickable({ timeout: 15000 });
    await domClick(".ai-playback-button");
    await browser.waitUntil(
      async () => browser.execute(() => window.__E2E_READ__.wordCount() > 0),
      {
        timeout: 10000,
        timeoutMsg:
          "no word marks after clicking play — the real ai_tts_speak_with_timestamps invoke did not round-trip",
      },
    );
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.currentWordIndex() > 0),
      {
        timeout: 15000,
        timeoutMsg: "karaoke index never advanced off real backend marks",
      },
    );

    // Dead-subtree negative: TtsHighlight lives under PdfPage, which has no
    // render site — playback must NEVER mount a .tts-highlight-rect and the
    // shipped CSSOM must never contain its rule.
    const deadRect = await browser.execute(
      () => document.querySelectorAll(".tts-highlight-rect").length,
    );
    console.log("TTS_RECT_COUNT", deadRect);
    expect(deadRect).toBe(0);
    const deadRule = await browser.execute(() => {
      let found = false;
      const walk = (rules) => {
        for (const rule of rules) {
          if (rule.cssRules) {
            try {
              walk(rule.cssRules);
            } catch {
              /* skip */
            }
          }
          if (
            rule.selectorText &&
            rule.selectorText.includes(".tts-highlight-rect")
          )
            found = true;
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules);
        } catch {
          /* skip */
        }
      }
      return found;
    });
    console.log("TTS_RECT_RULE_SHIPPED", deadRule);
    expect(deadRule).toBe(false);

    // The LIVE repaired CSSOM rules are present in both theme forms even in
    // the light-themed key lane (parsing is theme-independent). Only
    // .highlight-rect is required here: the Ctrl+L reader never mounts the
    // selection toolbar, so its chunk is not loaded in this phase.
    await assertRepairedDarkRules({ ".highlight-rect": true });
  });

  it("certifies home contrast in both themes and the live repaired dark reader surfaces", async function () {
    if (PHASE !== "home") this.skip();
    this.timeout(240000);
    await browser.setWindowSize(1200, 800);
    await waitForReady();

    const heading = await $("h2#continue-reading-heading");
    await heading.waitForExist({ timeout: 30000 });
    // The heading styles text-transform: uppercase — live DOM text is
    // "CONTINUE READING".
    await expect(heading.getText()).resolves.toMatch(/continue reading/i);

    // Explicit light via the visible control; home oracle + capture.
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

    // Explicit dark; home oracle + capture (the pre-fix white blob fails
    // the delete-button ratio here).
    settings = await openSettings();
    await clickThemeButton("Dark");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("dark");
    await contrastOracle("COMPUTED_DARK", HOME_TEXT_SELECTORS);
    const darkDelete = await deleteButtonOracle("DELETE_BUTTON_DARK");
    expect(darkDelete.background).toBe("rgb(24, 24, 37)");
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-dark.png");

    // Resume into the reader (public control), page 2, text rendered.
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

    // ACTOR: drag-select the paragraph (the highlight-journey mechanic) →
    // public colour toolbar → Yellow.
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

    // DARK reader: the repaired HighlightOverlay rule must apply live.
    // The rect carries a 0.15s opacity transition; the drag pointer rests on
    // the rect, so the hover rule (0.6) animates in. The actor moves the
    // pointer away, then the sample polls until the transition settles — a
    // stable computed result, not a mid-flight animation frame.
    await browser.performActions([
      {
        type: "pointer",
        id: "mouse1",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", x: 8, y: 8, duration: 100 },
        ],
      },
    ]);
    await browser.releaseActions();
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const rect = document.querySelector('[aria-label*="Highlight: "]');
          if (!rect) return false;
          const opacity = parseFloat(getComputedStyle(rect).opacity);
          return Number.isFinite(opacity) && Math.abs(opacity - 0.5) < 0.001;
        }),
      {
        timeout: 10000,
        timeoutMsg: "highlight rect opacity never settled to 0.5",
      },
    );
    const rectState = await browser.execute(() => {
      const rect = document.querySelector('[aria-label*="Highlight: "]');
      if (!rect) return { missing: true };
      const style = getComputedStyle(rect);
      return { blend: style.mixBlendMode, opacity: style.opacity };
    });
    console.log("HIGHLIGHT_RECT_DARK", JSON.stringify(rectState));
    expect(rectState.missing).toBeFalsy();
    expect(rectState.blend).toBe("screen");
    expect(Math.abs(parseFloat(rectState.opacity) - 0.5)).toBeLessThan(0.001);

    // Both theme forms of the LIVE repaired rules, declaration-aware.
    await assertRepairedDarkRules({
      ".highlight-rect": true,
      ".highlight-toolbar": true,
    });
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-reader-dark.png");
  });
});
