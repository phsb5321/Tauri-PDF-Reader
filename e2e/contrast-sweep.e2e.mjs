/**
 * EXHAUSTIVE contrast sweep — every visible text node, both themes.
 *
 * `contrast-capture.e2e.mjs` proves a CURATED list of nodes clears AA. That
 * shape can only ever confirm the nodes someone already thought of, so a
 * dark-on-dark node that nobody listed survives every run — which is exactly
 * what a user reported on the home surface (16/08/2026). This lane inverts
 * the quantifier: it walks EVERY element that paints its own text and fails
 * if ANY of them misses AA.
 *
 * Method (the compositing math is the one `contrast-capture` already uses —
 * child-over-parent alpha compositing up the ancestor chain, because a
 * transparent local background is not a verdict):
 *   - an element qualifies if it has a direct non-whitespace text child and
 *     is actually painted (non-zero box, visible, opacity > 0);
 *   - its colour is composited over the painted ancestor surface when the
 *     text itself is translucent;
 *   - the AA threshold follows WCAG large-text rules: >=24px, or >=18.66px
 *     at weight >=700, needs 3:1; everything else needs 4.5:1.
 *
 * Fail-closed: an empty sweep is a FAILED sweep (it would otherwise pass by
 * finding nothing), and the library must actually have rendered cards before
 * the home surface counts as swept.
 *
 * Run: E2E_SPEC=./e2e/contrast-sweep.e2e.mjs (see run-contrast-sweep.sh)
 */

/* global browser, $, expect */

const AUDIT_ONLY = process.env.SWEEP_AUDIT === "1";

function domClick(selector) {
  return browser.execute(
    (sel) => document.querySelector(sel)?.click(),
    selector,
  );
}

/** The theme buttons live INSIDE the Settings dialog — open it first
 * (the same public Configure action contrast-capture uses), then the sweep
 * must close it before walking the library surface so the dialog itself is
 * not double-counted and the library nodes are swept in their real theme. */
async function openSettings() {
  const configure = await $(".resume-section-tts-signal-action");
  await configure.waitForClickable({ timeout: 15000 });
  await domClick(".resume-section-tts-signal-action");
  const settings = await $("dialog.settings-backdrop[open]");
  await settings.waitForExist({ timeout: 10000 });
  return settings;
}

async function closeSettings() {
  await domClick("button.settings-close");
  await $("dialog.settings-backdrop[open]").waitForExist({
    timeout: 5000,
    reverse: true,
  });
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

/** Walk every painted text-bearing element and return its contrast verdict. */
async function sweep(theme) {
  return browser.execute((themeLabel) => {
    const parseColor = (str) => {
      if (!str) return null;
      const m = /rgba?\(([^)]+)\)/.exec(str);
      if (!m) return null;
      const p = m[1].split(",").map((s) => parseFloat(s.trim()));
      if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };

    const over = (top, bottom) => {
      if (top.a >= 1) return top;
      const a = top.a + bottom.a * (1 - top.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      const ch = (k) =>
        (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
      return { r: ch("r"), g: ch("g"), b: ch("b"), a };
    };

    /** The surface actually painted behind `el`, composited up the tree. */
    const paintedSurface = (el) => {
      let acc = { r: 0, g: 0, b: 0, a: 0 };
      let node = el;
      while (node) {
        const bg = parseColor(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) acc = over(acc, bg);
        if (acc.a >= 1) return acc;
        node = node.parentElement;
      }
      // Nothing opaque all the way up: the canvas is white by default.
      return over(acc, { r: 255, g: 255, b: 255, a: 1 });
    };

    const luminance = (c) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };

    const ratio = (fg, bg) => {
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    /** A stable-enough identifier for a failing node. */
    const describe = (el) => {
      const parts = [];
      let node = el;
      for (let i = 0; node && i < 4; i += 1) {
        let s = node.tagName.toLowerCase();
        if (node.id) s += `#${node.id}`;
        if (node.classList.length) s += `.${[...node.classList].join(".")}`;
        parts.unshift(s);
        node = node.parentElement;
      }
      return parts.join(" > ");
    };

    const hasOwnText = (el) =>
      [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      );

    const results = [];
    let painted = 0;

    for (const el of document.querySelectorAll("body *")) {
      if (!hasOwnText(el)) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) === 0) continue;

      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;

      const fgRaw = parseColor(cs.color);
      if (!fgRaw) continue;
      // A fully transparent glyph paints nothing — not a contrast question.
      if (fgRaw.a === 0) continue;

      painted += 1;

      const surface = paintedSurface(el);
      const fg = fgRaw.a < 1 ? over(fgRaw, surface) : fgRaw;
      const value = ratio(fg, surface);

      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = isLarge ? 3 : 4.5;

      if (value + 0.01 < required) {
        // Ancestor color chain — pin WHERE the failing colour comes from.
        const chain = [];
        let anc = el;
        while (anc && chain.length < 6) {
          const acs = getComputedStyle(anc);
          chain.push(
            `${anc.tagName.toLowerCase()}${
              anc.classList.length ? "." + [...anc.classList].join(".") : ""
            }:${acs.color}`,
          );
          anc = anc.parentElement;
        }
        results.push({
          theme: themeLabel,
          node: describe(el),
          text: el.textContent.trim().slice(0, 40),
          color: cs.color,
          surface: `rgba(${Math.round(surface.r)}, ${Math.round(surface.g)}, ${Math.round(surface.b)}, ${surface.a})`,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          ratio: Math.round(value * 100) / 100,
          required,
          chain,
        });
      }
    }

    return { theme: themeLabel, painted, violations: results };
  }, theme);
}

describe("Exhaustive contrast sweep (every painted text node, both themes)", () => {
  it("no visible text misses WCAG AA on the library surface", async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // The sweep is only meaningful once the library actually painted cards.
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => document.querySelectorAll(".document-card").length > 0,
        ),
      { timeout: 20000, timeoutMsg: "no document cards ever rendered" },
    );

    const all = [];
    for (const theme of ["light", "dark"]) {
      const settings = await openSettings();
      await clickThemeButton(theme === "light" ? "Light" : "Dark");
      await closeSettings();
      await waitForTheme(theme);
      // Let the theme transition settle before reading computed styles.
      await browser.pause(400);

      const result = await sweep(theme);
      console.log(
        `DIAG sweep ${theme}:`,
        JSON.stringify({
          painted: result.painted,
          violations: result.violations.length,
        }),
      );
      for (const v of result.violations) {
        console.log("DIAG violation:", JSON.stringify(v));
      }

      // An empty sweep proves nothing — fail rather than pass by vacuum.
      if (result.painted < 5) {
        throw new Error(
          `sweep found only ${result.painted} painted text nodes in ${theme} — the surface never rendered`,
        );
      }
      all.push(result);
    }

    const total = all.reduce((n, r) => n + r.violations.length, 0);
    console.log(
      "DIAG sweep summary:",
      JSON.stringify({
        light: all[0].violations.length,
        dark: all[1].violations.length,
        paintedLight: all[0].painted,
        paintedDark: all[1].painted,
      }),
    );

    if (AUDIT_ONLY) {
      console.log("DIAG audit-only: not asserting", total, "violation(s)");
      return;
    }
    expect(total).toBe(0);
  });
});
