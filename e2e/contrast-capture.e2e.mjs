/**
 * Packaged contrast capture (tauri-driver + WebdriverIO).
 *
 * Captures the reading home at the fixed 1200×800 viewport in BOTH themes —
 * the issue #120 receipt pair for the contrast slice. Uses the shared
 * hermetic profile (scripts/e2e-profile.sh) and the no-key lane
 * (VITE_E2E_NATIVE_TTS=none, seed=single) so the composition matches the
 * authoritative light baseline (/tmp/lectrice-cover-home-before.png): one
 * in-flight book, resume line, one grid card.
 *
 * Actor contract (user-gate): every activation goes through a visible
 * public control — the Settings dialog is opened with the home's visible
 * Configure action, and the theme is switched with the visible Light/Dark
 * buttons. `window.__E2E_READ__` and `document.documentElement.dataset` are
 * READ ONLY here — they observe the verdict, they never perform an action.
 *
 * Outputs:
 *   /tmp/lectrice-contrast-125-light.png  (home, explicit light)
 *   /tmp/lectrice-contrast-125-dark.png   (home, explicit dark)
 *
 * Run with:  E2E_SPEC=./e2e/contrast-capture.e2e.mjs against a binary built
 * `--features e2e-tts-fixture` and a frontend built `VITE_E2E_NATIVE=true`
 * with the no-key lane envs — see scripts/e2e-contrast-capture.sh.
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

/** Read computed colour pairs of key home text nodes (read-only probe). */
async function computedPairs(label) {
  const pairs = await browser.execute(() => {
    const selectors = [
      "h2#continue-reading-heading",
      ".resume-line-title",
      ".document-card-title",
      ".document-card--grid .document-card-meta",
    ];
    return selectors.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const style = getComputedStyle(el);
      return {
        sel,
        color: style.color,
        background: style.backgroundColor,
        opacity: style.opacity,
      };
    });
  });
  console.log(`${label}`, JSON.stringify(pairs));
  return pairs;
}

/** Live cascade pins: token text colours + full opacity on key home nodes. */
async function assertComputedPairs(label, primaryColor) {
  const pairs = await computedPairs(label);
  const title = pairs.find((pair) => pair.sel === ".document-card-title");
  expect(title?.color).toBe(primaryColor);
  for (const pair of pairs) {
    if (pair.missing) continue;
    // expect-webdriverio takes a single argument — no custom messages.
    expect(pair.opacity).toBe("1");
    expect(pair.color).not.toBe(pair.background);
  }
}

describe("Packaged contrast capture (light + dark, 1200×800)", () => {
  it("captures the home in explicit light and explicit dark", async () => {
    await browser.setWindowSize(1200, 800);

    // 1. Native bootstrap ready, home mounted.
    await browser.waitUntil(
      () => browser.execute(() => window.__E2E_READ__?.ready === true),
      { timeout: 30000, timeoutMsg: READY_MSG },
    );
    const heading = await $("h2#continue-reading-heading");
    await heading.waitForExist({ timeout: 30000 });
    // The heading styles text-transform: uppercase, so the live DOM text is
    // "CONTINUE READING".
    await expect(heading.getText()).resolves.toMatch(/continue reading/i);

    // 2. Open Settings through the home's visible Configure action.
    const configure = await $(".resume-section-tts-signal-action");
    await configure.waitForClickable({ timeout: 15000 });
    await domClick(".resume-section-tts-signal-action");
    const settings = await $("dialog.settings-backdrop[open]");
    await settings.waitForExist({ timeout: 10000 });
    await expect(settings.getText()).resolves.toContain("Appearance");

    // 3. Explicit light first (deterministic starting point), close, capture.
    await clickThemeButton("Light");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("light");
    await assertComputedPairs("COMPUTED_LIGHT", "rgb(76, 79, 105)");
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-light.png");

    // 4. Explicit dark through the same visible control, close, capture.
    await domClick(".resume-section-tts-signal-action");
    await settings.waitForExist({ timeout: 10000 });
    await clickThemeButton("Dark");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });
    await waitForTheme("dark");
    await assertComputedPairs("COMPUTED_DARK", "rgb(205, 214, 244)");
    await browser.saveScreenshot("/tmp/lectrice-contrast-125-dark.png");
  });
});
