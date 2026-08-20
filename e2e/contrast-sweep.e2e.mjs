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
 *   - FORM-CONTROL text is not a text child — placeholders and closed
 *     select labels are probed explicitly (the exact UA-default defect
 *     class that produced the reported dark-on-dark bug);
 *   - its colour is composited over the painted ancestor surface when the
 *     text itself is translucent; the element's OWN opacity folds into the
 *     ratio (a 0.5-opacity control paints at half strength); ancestor
 *     opacity is NOT folded (documented limitation — no home node uses it);
 *   - DISABLED controls are skipped (WCAG 1.4.3's inactive-UI-component
 *     exception — the user cannot act on them);
 *   - the AA threshold follows WCAG large-text rules: >=24px, or >=18.66px
 *     at weight >=700, needs 3:1; everything else needs 4.5:1.
 *
 * SCOPE: the home/library surface only (the seeded library with cards).
 * The reader and settings surfaces are covered by contrast-capture's
 * curated list. Fail-closed: an empty sweep is a FAILED sweep (it would
 * otherwise pass by finding nothing), and the library must actually have
 * rendered cards before the home surface counts as swept.
 *
 * Run: E2E_SPEC=./e2e/contrast-sweep.e2e.mjs (see
 * scripts/e2e-contrast-sweep.sh).
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

async function driveFormControls(active) {
  const search = await $(".search-input");
  const shelf = await $(".shelf-new-input");
  const submit = await $(".shelf-new-submit");
  if (active) {
    await search.setValue("E2E");
    await shelf.setValue("Contrast probe");
  } else {
    for (const input of [search, shelf]) {
      await input.click();
      await browser.keys(["Control", "a"]);
      await browser.keys("Backspace");
    }
  }
  await browser.waitUntil(async () => (await submit.isEnabled()) === active, {
    timeout: 5000,
    timeoutMsg: `shelf submit never became ${active ? "enabled" : "disabled"}`,
  });
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.querySelectorAll(".document-card").length > 0,
      ),
    { timeout: 5000, timeoutMsg: "search state hid every seeded card" },
  );
}

/** Walk every painted text-bearing element and return its contrast verdict. */
async function sweep(theme) {
  return browser.execute((themeLabel) => {
    // Reuse the modern WebKit colour shape already handled by
    // contrast-capture's delete-button oracle. Unknown computed syntax is
    // recorded below and makes the sweep red; it is never a silent skip.
    const parseColor = (str) => {
      if (!str) return null;
      const value = String(str).trim();
      const srgb =
        /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)$/.exec(
          value,
        );
      if (srgb) {
        return {
          r: Number(srgb[1]) * 255,
          g: Number(srgb[2]) * 255,
          b: Number(srgb[3]) * 255,
          a: srgb[4] === undefined ? 1 : Number(srgb[4]),
        };
      }
      const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
      if (!rgb) return null;
      const comma = rgb[1].split(",").map((s) => parseFloat(s.trim()));
      if (comma.length >= 3 && !comma.some((n) => Number.isNaN(n))) {
        return {
          r: comma[0],
          g: comma[1],
          b: comma[2],
          a: comma.length > 3 ? comma[3] : 1,
        };
      }
      return null;
    };

    // A nested parseable color must not make an unsupported outer function
    // look valid. Unknown computed syntax belongs in `unparseable` below.
    if (
      parseColor(
        "color-mix(in srgb, rgb(255, 0, 0) 50%, rgb(255, 255, 255))",
      ) !== null
    ) {
      throw new Error(
        "color parser accepted a nested function as a full color",
      );
    }

    const unparseable = [];

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
        const raw = getComputedStyle(node).backgroundColor;
        const bg = parseColor(raw);
        if (!bg) {
          unparseable.push({
            kind: "background",
            node: node.tagName,
            color: raw,
          });
        } else if (bg.a > 0) {
          acc = over(acc, bg);
        }
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

    /** WCAG 1.4.3 has an explicit exception for INACTIVE UI components —
     * disabled controls are excused from contrast. Skip them (they are
     * still "visible", so without this the gate would fail on a control the
     * user cannot act on). */
    const isInactive = (el) => el.disabled === true;

    /** Effective glyph alpha: the element's own opacity folds into the
     * ratio (a 0.5-opacity control paints at half strength — measuring it
     * at full strength would certify an invisible label). Ancestor opacity
     * is NOT folded (no home node uses it; documented limitation). */
    const effectiveFg = (fgRaw, surface, elOpacity) => {
      const alpha = fgRaw.a * elOpacity;
      return over({ r: fgRaw.r, g: fgRaw.g, b: fgRaw.b, a: alpha }, surface);
    };

    const verdict = (cs, fgRaw, surface, elOpacity) => {
      const fg = effectiveFg(fgRaw, surface, elOpacity);
      const value = ratio(fg, surface);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      return { value, required: isLarge ? 3 : 4.5 };
    };

    for (const el of document.querySelectorAll("body *")) {
      if (!hasOwnText(el)) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) === 0) continue;
      if (isInactive(el)) continue;

      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;

      const fgRaw = parseColor(cs.color);
      if (!fgRaw) {
        unparseable.push({ kind: "text", node: describe(el), color: cs.color });
        continue;
      }
      // A fully transparent glyph paints nothing — not a contrast question.
      if (fgRaw.a === 0) continue;

      painted += 1;

      const surface = paintedSurface(el);
      const { value, required } = verdict(
        cs,
        fgRaw,
        surface,
        parseFloat(cs.opacity),
      );

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

    // Form-control value text is a property, not a text child. Measure the
    // value while populated and the placeholder while empty; both states are
    // driven below through the real controls.
    for (const el of document.querySelectorAll("input, textarea")) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) === 0 || isInactive(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;

      const valueText = el.value?.trim();
      const placeholder = el.getAttribute("placeholder")?.trim();
      const text = valueText || placeholder;
      if (!text) continue;
      const textStyle = valueText ? cs : getComputedStyle(el, "::placeholder");
      const fgRaw = parseColor(textStyle.color);
      if (!fgRaw) {
        unparseable.push({
          kind: valueText ? "input-value" : "placeholder",
          node: describe(el),
          color: textStyle.color,
        });
        continue;
      }
      if (fgRaw.a === 0) continue;
      painted += 1;
      const surface = paintedSurface(el);
      const { value, required } = verdict(
        cs,
        fgRaw,
        surface,
        parseFloat(cs.opacity),
      );
      if (value + 0.01 < required) {
        results.push({
          theme: themeLabel,
          node: `${describe(el)}::${valueText ? "value" : "placeholder"}`,
          text: text.slice(0, 40),
          color: textStyle.color,
          surface: `rgba(${Math.round(surface.r)}, ${Math.round(surface.g)}, ${Math.round(surface.b)}, ${surface.a})`,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          ratio: Math.round(value * 100) / 100,
          required,
        });
      }
    }

    for (const el of document.querySelectorAll("select")) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (parseFloat(cs.opacity) === 0) continue;
      if (isInactive(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const fgRaw = parseColor(cs.color);
      if (!fgRaw) {
        unparseable.push({
          kind: "select",
          node: describe(el),
          color: cs.color,
        });
        continue;
      }
      if (fgRaw.a === 0) continue;
      painted += 1;
      const surface = paintedSurface(el);
      const { value, required } = verdict(
        cs,
        fgRaw,
        surface,
        parseFloat(cs.opacity),
      );
      if (value + 0.01 < required) {
        results.push({
          theme: themeLabel,
          node: describe(el),
          text: `select:${(el.options[el.selectedIndex]?.textContent || "").trim().slice(0, 40)}`,
          color: cs.color,
          surface: `rgba(${Math.round(surface.r)}, ${Math.round(surface.g)}, ${Math.round(surface.b)}, ${surface.a})`,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          ratio: Math.round(value * 100) / 100,
          required,
        });
      }
    }

    return { theme: themeLabel, painted, violations: results, unparseable };
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

      // Both states are user-reachable and paint different text: empty inputs
      // paint placeholders; populated inputs paint their values and enable Add.
      await driveFormControls(false);
      const placeholderResult = await sweep(`${theme}:placeholder`);
      await driveFormControls(true);
      const activeResult = await sweep(`${theme}:active`);

      // Required negative controls: the gate must observe an active value in
      // modern WebKit color(srgb) syntax AND the now-enabled submit label.
      const previous = await browser.execute(() => {
        const search = document.querySelector(".search-input");
        const submit = document.querySelector(".shelf-new-submit");
        const saved = {
          searchColor: search.style.color,
          searchBackground: search.style.backgroundColor,
          submitColor: submit.style.color,
          submitBackground: submit.style.backgroundColor,
        };
        search.style.color = "color(srgb 1 1 1)";
        search.style.backgroundColor = "color(srgb 1 1 1)";
        submit.style.color = "rgb(255, 255, 255)";
        submit.style.backgroundColor = "rgb(255, 255, 255)";
        return saved;
      });
      let negative;
      try {
        negative = await sweep(`${theme}:negative-control`);
      } finally {
        await browser.execute((saved) => {
          const search = document.querySelector(".search-input");
          const submit = document.querySelector(".shelf-new-submit");
          search.style.color = saved.searchColor;
          search.style.backgroundColor = saved.searchBackground;
          submit.style.color = saved.submitColor;
          submit.style.backgroundColor = saved.submitBackground;
        }, previous);
      }
      if (negative.unparseable.length > 0) {
        throw new Error(
          `negative control silently lost a color: ${JSON.stringify(negative.unparseable)}`,
        );
      }
      if (
        !negative.violations.some((v) =>
          v.node.includes(".search-input::value"),
        )
      ) {
        throw new Error(
          "negative control: active search value escaped the sweep",
        );
      }
      if (
        !negative.violations.some((v) => v.node.includes(".shelf-new-submit"))
      ) {
        throw new Error(
          "negative control: enabled shelf submit escaped the sweep",
        );
      }

      const result = {
        theme,
        painted: placeholderResult.painted + activeResult.painted,
        violations: [
          ...placeholderResult.violations,
          ...activeResult.violations,
        ],
        unparseable: [
          ...placeholderResult.unparseable,
          ...activeResult.unparseable,
        ],
      };
      console.log(
        `DIAG sweep ${theme}:`,
        JSON.stringify({
          painted: result.painted,
          violations: result.violations.length,
          unparseable: result.unparseable.length,
        }),
      );
      for (const v of result.violations)
        console.log("DIAG violation:", JSON.stringify(v));
      for (const u of result.unparseable)
        console.log("DIAG unparseable:", JSON.stringify(u));

      // Empty or unparseable is unknown, never green.
      if (result.painted < 10) {
        throw new Error(
          `sweep found only ${result.painted} painted text states in ${theme} — the surface never rendered`,
        );
      }
      if (result.unparseable.length > 0) {
        throw new Error(
          `sweep could not parse ${result.unparseable.length} painted color(s) in ${theme}`,
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
