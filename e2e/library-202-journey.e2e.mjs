/**
 * Packaged library-202 journey (tauri-driver + WebdriverIO) — the user gate
 * for slice 202 (#183 tail): visible "Read aloud" labels, 0%-vs-divider
 * treatment, legibility at width matrix + increased UI text scale, keyboard
 * reachability, and the pinned New shelf form (stretch).
 *
 * Complements (never replaces) e2e/home-journey.e2e.mjs, which owns the
 * resume-and-play state-machine oracle in the packaged app; this spec gates
 * the SLICE-202 affordances on the exact same packaged artifact:
 *
 *   no-key lane (VITE_E2E_NATIVE_TTS=none, SEED=single):
 *     visible label assertions, width matrix (640/1200/2560) overflow +
 *     visibility probes, hollow-track computed-style probe, keyboard-only
 *     Tab→:focus-visible→Enter path (lands stored page, no page turn, stays
 *     idle, honest setup message), 150% UI-scale probe through the public
 *     slider, pinned shelf-form probe (stretch).
 *   key lane (VITE_E2E_NATIVE_TTS=fixture, SEED=dual):
 *     row-level labeled control + width matrix; the labeled control drives
 *     the TTS store to "playing" (fixture backend, no network).
 *
 * Actor contract: every activation goes through a public control — accessible
 * name / visible label / keyboard. `domClick` exists because WebKitGTK
 * software rendering drops WebDriver synthetic POINTER events (vimeflow#65);
 * keyboard events (browser.keys) are real and used for the keyboard journey.
 * Text entry dispatches a DOM input event on the public field (same sanction).
 * All `window.__E2E_READ__` and computed-style reads are observer-side and
 * read-only; nothing in this spec mutates stores or IPC directly.
 *
 * Run with: E2E_SPEC=./e2e/library-202-journey.e2e.mjs against a binary built
 * --features e2e-tts-fixture and a frontend built VITE_E2E_NATIVE=true with
 * the lane envs — see e2e/run-202-library-journey.sh (heavy-lock holder).
 */

/* global browser, $, expect */

const READY_MSG =
  "native bootstrap (window.__E2E_READ__.ready) never became ready — check VITE_E2E_NATIVE build + e2e-tts-fixture feature";

const READ_ALOUD_A = 'button[aria-label="Resume E2E Resume Fixture A and read aloud"]';
const READ_ALOUD_TARGET = "Resume E2E Resume Fixture A and read aloud";

/** WebKitGTK software rendering drops pointer dispatch (vimeflow#65 class). */
function domClick(selector) {
  return browser.execute(
    (sel) => document.querySelector(sel)?.click(),
    selector,
  );
}

/** Type into a public field at DOM level (see actor-contract note above). */
function domType(selector, value) {
  return browser.execute(
    (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    selector,
    value,
  );
}

async function waitReady() {
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
      ),
    { timeout: 40000, timeoutMsg: READY_MSG },
  );
}

/** Observer probe: no horizontal document overflow at the current size. */
function overflowProbe() {
  return browser.execute(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

async function assertNoOverflow(widthLabel) {
  const { scrollWidth, innerWidth } = await overflowProbe();
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  if (scrollWidth > innerWidth + 1) {
    throw new Error(
      `${widthLabel}: horizontal overflow ${scrollWidth} > ${innerWidth}`,
    );
  }
}

async function assertReadAloudVisible(widthLabel) {
  const rect = await browser.execute(() => {
    const el = document.querySelector(
      'button[aria-label*="and read aloud"]',
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      left: r.left,
      width: r.width,
      height: r.height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      text: el.textContent ?? "",
    };
  });
  expect(rect).not.toBeNull();
  expect(rect.text).toContain("Read aloud");
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.right).toBeLessThanOrEqual(rect.innerWidth + 1);
  expect(rect.left).toBeGreaterThanOrEqual(-1);
  expect(rect.top).toBeGreaterThanOrEqual(-1);
  expect(rect.bottom).toBeLessThanOrEqual(rect.innerHeight + 1);
}

/** Width matrix: labeled control stays visible, nothing overflows. */
async function widthMatrix() {
  for (const [w, h] of [
    [640, 800],
    [1200, 800],
    [2560, 1000],
  ]) {
    await browser.setWindowSize(w, h);
    await browser.pause(250);
    await assertNoOverflow(`${w}px`);
    await assertReadAloudVisible(`${w}px`);
    // The actions row must be allowed to wrap (the narrow-width contract).
    const wrap = await browser.execute(() => {
      const el = document.querySelector(".resume-line-actions");
      return el ? getComputedStyle(el).flexWrap : null;
    });
    expect(wrap).toBe("wrap");
  }
}

describe("Packaged library-202 journey (#183 tail: labels, 0% vs divider, scale)", () => {
  it("no-key lane: visible labels, width matrix, keyboard-only path, 150% scale, pinned shelf form", async () => {
    await waitReady();
    await browser.setWindowSize(1200, 800);

    // Nothing auto-plays on launch (pre-action observer check).
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("idle");

    // FR-1: the resume line's read-aloud control is VISIBLY labeled.
    const control = await $(READ_ALOUD_A);
    await control.waitForExist({ timeout: 15000 });
    const labelText = await browser.execute(
      () => document.querySelector(".resume-line-play")?.textContent ?? "",
    );
    expect(labelText).toContain("Read aloud");
    // It is the secondary Button variant next to the primary Resume.
    expect(
      await browser.execute(() =>
        document
          .querySelector(".resume-line-play")
          ?.className.includes("button--secondary"),
      ),
    ).toBe(true);

    // FR-3: width matrix — no overflow, labeled control visible, wrap on.
    await widthMatrix();

    // FR-2 (packaged tier): the track is a HOLLOW container. The seeded
    // book is at 40%, so the empty modifier must be ABSENT here; the 0%
    // branch is gated deterministically in the jsdom suite (the packaged
    // app has no public seam to reach a 0% in-flight book — documented gap).
    const track = await browser.execute(() => {
      const el = document.querySelector(".resume-line-bar");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
        emptyModifier: el.className.includes("resume-line-bar--empty"),
        fillWidth: getComputedStyle(
          el.querySelector(".resume-line-bar-fill"),
        ).width,
        trackWidth: el.getBoundingClientRect().width,
      };
    });
    expect(track).not.toBeNull();
    expect(track.boxShadow).toContain("inset");
    expect(track.backgroundColor).toContain("0, 0, 0, 0");
    expect(track.emptyModifier).toBe(false);
    expect(track.fillWidth).not.toBe("0px");
    expect(track.trackWidth).toBeGreaterThan(0);

    // Stretch (non-blocking for the primary verdict): the New shelf form
    // stays pinned while the list scrolls. Create 12 shelves via the public
    // form at a short window.
    await browser.setWindowSize(640, 500);
    await browser.pause(250);
    for (let i = 1; i <= 12; i++) {
      await domType("#new-shelf-name", `Journey Shelf ${i}`);
      await domClick(".shelf-new-submit");
      await browser.waitUntil(
        async () =>
          (await browser.execute(
            () => document.querySelectorAll(".shelf-list li").length,
          )) ===
          2 + i, // All books + Unfiled + i created shelves
        { timeout: 5000, timeoutMsg: `shelf ${i} did not appear` },
      );
    }
    const shelfProbe = await browser.execute(() => {
      const list = document.querySelector(".shelf-list");
      const form = document.querySelector(".shelf-new");
      if (!list || !form) return null;
      const lr = list.getBoundingClientRect();
      const fr = form.getBoundingClientRect();
      return {
        listScrolls: list.scrollHeight > list.clientHeight,
        formInViewport:
          fr.top >= 0 &&
          fr.bottom <= window.innerHeight + 1 &&
          fr.height > 0,
        formVisible: fr.height > 0 && fr.width > 0,
      };
    });
    expect(shelfProbe).not.toBeNull();
    expect(shelfProbe.listScrolls).toBe(true);
    expect(shelfProbe.formVisible).toBe(true);
    expect(shelfProbe.formInViewport).toBe(true);

    // Increased UI text scale: drive the PUBLIC UI-scale slider to its 150%
    // max with arrow keys (125 → 150 at step 5), through the real Settings
    // dialog, then re-probe the home at 640.
    await browser.setWindowSize(1200, 800);
    await domClick(".resume-section-tts-signal-action");
    const settings = await $("dialog.settings-backdrop[open]");
    await settings.waitForExist({ timeout: 10000 });
    const slider = await $('input[aria-label="UI scale"]');
    await slider.waitForExist({ timeout: 5000 });
    await domClick('input[aria-label="UI scale"]'); // focus (pointer trap)
    for (let i = 0; i < 5; i++) {
      await browser.keys("ArrowRight");
    }
    const scaleText = await browser.execute(
      () =>
        document.querySelector('input[aria-label="UI scale"]')?.getAttribute(
          "aria-valuetext",
        ) ?? "",
    );
    expect(scaleText).toBe("150%");
    await domClick("button.settings-close");
    await settings.waitForExist({ timeout: 5000, reverse: true });

    await browser.setWindowSize(640, 800);
    await browser.pause(250);
    await assertNoOverflow("640px @150% scale");
    await assertReadAloudVisible("640px @150% scale");

    // Keyboard-only path: fresh load, Tab from the top until the read-aloud
    // control has focus (bounded walk), assert a visible-focus indicator,
    // fire it with Enter, and prove it lands the stored page WITHOUT a page
    // turn and WITHOUT audio (no key — honest degradation).
    await browser.refresh();
    await waitReady();
    await browser.setWindowSize(1200, 800);
    await browser.pause(250);

    let focused = "";
    for (let tabs = 0; tabs < 40 && focused !== READ_ALOUD_TARGET; tabs++) {
      await browser.keys("Tab");
      focused = await browser.execute(
        () => document.activeElement?.getAttribute("aria-label") ?? "",
      );
    }
    expect(focused).toBe(READ_ALOUD_TARGET);
    expect(
      await browser.execute(() =>
        document.activeElement?.matches(":focus-visible") ?? false,
      ),
    ).toBe(true);
    await browser.keys("Enter");

    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) === "2",
      { timeout: 15000, timeoutMsg: "keyboard path did not land on page 2" },
    );
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("idle");
    const barSetup = await $(".ai-playback-setup-message");
    await barSetup.waitForExist({ timeout: 10000 });
    // NO UNWANTED PAGE TURN: no narration started, so the page must still
    // be the stored page after a settle delay.
    await browser.pause(1500);
    expect(await $('input[aria-label="Current page"]').getValue()).toBe("2");
  });

  it("key lane: the row's labeled control drives narration from the home", async () => {
    await waitReady();
    await browser.setWindowSize(1200, 800);

    // Two books in flight: the ALSO-IN-PROGRESS row carries the labeled
    // control too (the icon-only regression this slice closes).
    const also = await $(".also-in-progress");
    await also.waitForExist({ timeout: 15000 });
    const rowText = await browser.execute(
      () =>
        document.querySelector(".also-in-progress-row-play")?.textContent ??
        "",
    );
    expect(rowText).toContain("Read aloud");

    await widthMatrix();

    // The LABELED line control starts narration (fixture backend, no
    // network): land page 2, store reaches "playing".
    await domClick(READ_ALOUD_A);
    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) === "2",
      { timeout: 15000, timeoutMsg: "labeled control did not land on page 2" },
    );
    await browser.waitUntil(
      async () =>
        (await browser.execute(() =>
          window.__E2E_READ__.playbackState(),
        )) === "playing",
      {
        timeout: 10000,
        timeoutMsg: "labeled control did not drive TTS to 'playing'",
      },
    );
    // NO UNWANTED PAGE TURN beyond the narration's current page while we
    // observe: the fixture page is long enough (~20s) that an auto-turn
    // would not fire inside this window; assert the page is still 2.
    await browser.pause(1200);
    expect(await $('input[aria-label="Current page"]').getValue()).toBe("2");
  });
});
