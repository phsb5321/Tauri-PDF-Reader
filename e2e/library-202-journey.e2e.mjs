/**
 * Packaged library-202 journey (tauri-driver + WebdriverIO) — the user gate
 * for slice 202 (#183 tail): visible "Read aloud" labels, 0%-vs-divider
 * treatment, declared-scale + keyboard reachability.
 *
 * Complements (never replaces) e2e/home-journey.e2e.mjs, which owns the
 * resume-and-play state-machine oracle in the packaged app; this spec gates
 * the SLICE-202 affordances on the exact same packaged artifact.
 *
 * THREE lanes, one spec — the RUNNER exports E2E_202_LANE and each `it`
 * bails immediately outside its lane, so an early return is a skipped it,
 * never an executed pass (evidence counts executed its per lane):
 *
 *   no-key (VITE_E2E_NATIVE_TTS=none, SEED=single):
 *     visible label, width matrix (640/1200/2560) overflow+visibility,
 *     hollow-track computed style, EXPLICIT declared 125% scale
 *     observation, keyboard-only Tab→:focus-visible→Enter (lands stored
 *     page, no page turn, stays idle, honest setup message), optional
 *     150% slider run (only after 125% is explicitly observed).
 *   key (VITE_E2E_NATIVE_TTS=fixture, SEED=dual):
 *     row-level labeled control + width matrix; the labeled control drives
 *     the TTS store to "playing" (fixture backend, no network).
 *   zero (VITE_E2E_NATIVE_TTS=none, SEED=zero-progress):
 *     THE 0%-vs-divider gate: the seeded 500-page book sits in flight at
 *     0% and is the resume line. Asserts the empty modifier, the accent
 *     start nub (token-equal to the fill), the hollow track, the "0%"
 *     readout — contrasted against the 40% row book in the SAME run —
 *     plus labels, width matrix, declared 125%, and the keyboard path.
 *
 * Actor contract: every activation goes through a public control — accessible
 * name / visible label / keyboard. `domClick`/`domType` exist because WebKitGTK
 * software rendering drops WebDriver synthetic POINTER events (vimeflow#65);
 * keyboard events (browser.keys) are real and used for the keyboard journey.
 * domType uses the NATIVE value setter (React's ValueTracker dedupes a plain
 * `.value` set). All __E2E_READ__/computed-style reads are observer-side and
 * read-only; nothing here mutates stores or IPC directly.
 *
 * Run with: E2E_SPEC=./e2e/library-202-journey.e2e.mjs and E2E_202_LANE set
 * by e2e/run-202-library-journey.sh (heavy-lock holder) against a binary
 * built --features e2e-tts-fixture and a frontend built VITE_E2E_NATIVE=true
 * with the lane envs.
 */

/* global browser, $, expect, process */

const READY_MSG =
  "native bootstrap (window.__E2E_READ__.ready) never became ready — check VITE_E2E_NATIVE build + e2e-tts-fixture feature";

const LINE_A = 'button[aria-label="Resume E2E Resume Fixture A and read aloud"]';
const LINE_ZERO =
  'button[aria-label="Resume E2E Zero Progress Fixture and read aloud"]';

/** WebKitGTK software rendering drops pointer dispatch (vimeflow#65 class). */
function domClick(selector) {
  return browser.execute(
    (sel) => document.querySelector(sel)?.click(),
    selector,
  );
}

/** Type into a public field at DOM level (native setter — see above). */
function domType(selector, value) {
  return browser.execute(
    (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return el.value === val;
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

/** EXPLICIT declared-scale observation (the default uiScale is 1.25 → the
 * app sets documentElement inline font-size "125%"; asserted, not inferred). */
async function assertDeclaredScale125() {
  const inline = await browser.execute(
    () => document.documentElement.style.fontSize,
  );
  expect(inline).toBe("125%");
}

/** Observer probe: no horizontal document overflow at the current size. */
async function assertNoOverflow(widthLabel) {
  const { scrollWidth, innerWidth } = await browser.execute(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (scrollWidth > innerWidth + 1) {
    throw new Error(
      `${widthLabel}: horizontal overflow ${scrollWidth} > ${innerWidth}`,
    );
  }
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
}

async function assertReadAloudVisible(widthLabel) {
  const rect = await browser.execute(() => {
    const el = document.querySelector(
      'button[aria-label*="and read aloud"]',
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      right: r.right,
      left: r.left,
      top: r.top,
      bottom: r.bottom,
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

/** Width matrix: labeled control stays visible, nothing overflows, the
 * actions row is allowed to wrap (the narrow-width contract). */
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
    const wrap = await browser.execute(() => {
      const el = document.querySelector(".resume-line-actions");
      return el ? getComputedStyle(el).flexWrap : null;
    });
    expect(wrap).toBe("wrap");
  }
}

/**
 * Keyboard-only journey: fresh load, Tab from the top until `targetSelector`'s
 * label has focus (bounded walk), assert the visible-focus indicator, fire
 * with Enter, and prove it lands `storedPage` WITHOUT a page turn and WITHOUT
 * audio (idle + honest setup message).
 */
async function keyboardJourney(targetLabel, storedPage) {
  await browser.refresh();
  await waitReady();
  await browser.setWindowSize(1200, 800);
  await browser.pause(250);

  let focused = "";
  for (let tabs = 0; tabs < 40 && focused !== targetLabel; tabs++) {
    await browser.keys("Tab");
    focused = await browser.execute(
      () => document.activeElement?.getAttribute("aria-label") ?? "",
    );
  }
  expect(focused).toBe(targetLabel);
  expect(
    await browser.execute(
      () => document.activeElement?.matches(":focus-visible") ?? false,
    ),
  ).toBe(true);
  await browser.keys("Enter");

  await browser.waitUntil(
    async () =>
      (await $('input[aria-label="Current page"]').getValue()) ===
      String(storedPage),
    {
      timeout: 15000,
      timeoutMsg: `keyboard path did not land on stored page ${storedPage}`,
    },
  );
  expect(
    await browser.execute(() => window.__E2E_READ__.playbackState()),
  ).toBe("idle");
  const barSetup = await $(".ai-playback-setup-message");
  await barSetup.waitForExist({ timeout: 10000 });
  // NO UNWANTED PAGE TURN: no narration started, so the page must still be
  // the stored page after a settle delay.
  await browser.pause(1500);
  expect(await $('input[aria-label="Current page"]').getValue()).toBe(
    String(storedPage),
  );
}

/** Explicit lane identity: an inactive lane's early return must be visible
 * as SKIPPED in the run output — never masquerade as an executed pass. */
function laneGate(expected) {
  const lane = process.env.E2E_202_LANE;
  if (lane !== expected) {
    console.info(`[library-202] lane=${lane} it="${expected}" SKIPPED (this run is lane ${lane})`);
    return false;
  }
  console.info(`[library-202] lane=${lane} it="${expected}" EXECUTED`);
  return true;
}

describe("Packaged library-202 journey (#183 tail: labels, 0% vs divider, scale)", () => {
  it("no-key lane: visible labels, width matrix, declared 125%, keyboard-only path, optional 150%", async () => {
    if (!laneGate("no-key")) return;
    await waitReady();
    await browser.setWindowSize(1200, 800);

    // Nothing auto-plays on launch (pre-action observer check).
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("idle");

    // EXPLICIT declared-scale observation (required before any optional
    // increased-scale run).
    await assertDeclaredScale125();

    // FR-1: the resume line's read-aloud control is VISIBLY labeled.
    const control = await $(LINE_A);
    await control.waitForExist({ timeout: 15000 });
    const labelText = await browser.execute(
      () => document.querySelector(".resume-line-play")?.textContent ?? "",
    );
    expect(labelText).toContain("Read aloud");
    expect(
      await browser.execute(() =>
        document
          .querySelector(".resume-line-play")
          ?.className.includes("button--secondary"),
      ),
    ).toBe(true);

    // FR-3: width matrix — no overflow, labeled control visible, wrap on.
    await widthMatrix();

    // FR-2 (packaged tier, seeded 40% book): the track is a HOLLOW container
    // and the empty modifier is ABSENT at 40%.
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

    // Optional stronger run: 150% via the PUBLIC slider — only after the
    // declared 125% state was explicitly observed above. Drive with arrow
    // keys (step 5: 125 → 150), then re-probe the home at 640.
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

    // Keyboard-only path on the seeded book (stored page 2).
    await keyboardJourney("Resume E2E Resume Fixture A and read aloud", 2);
  });

  it("key lane: the row's labeled control drives narration from the home", async () => {
    if (!laneGate("key")) return;
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
    await domClick(LINE_A);
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
    // NO UNWANTED PAGE TURN while observing: the fixture page narrates
    // ~20s, so an auto-turn must not fire inside this window.
    await browser.pause(1200);
    expect(await $('input[aria-label="Current page"]').getValue()).toBe("2");
  });

  it("zero lane: 0% in-flight book reads as progress — empty modifier, accent nub, hollow track", async () => {
    if (!laneGate("zero")) return;
    await waitReady();
    await browser.setWindowSize(1200, 800);

    // RED TRIPWIRE (packaged tier): the zero-progress seed must be present —
    // a 0% in-flight book is unreachable through any public control, so a
    // missing seed means the gate cannot run and MUST fail, never skip.
    // (Wait for the line to exist first: the home's mount query is async.)
    const lineMetaEl = await $(".resume-line-meta");
    await lineMetaEl.waitForExist({ timeout: 15000 });
    const lineMeta = await browser.execute(
      () => document.querySelector(".resume-line-meta")?.textContent ?? "",
    );
    if (!lineMeta.includes("of 500")) {
      throw new Error(
        `zero-progress seed absent — resume line meta was "${lineMeta}". The packaged 0% gate cannot run without the authorized zero-progress bootstrap seed (packaged RED).`,
      );
    }

    // The zero book is the resume line (stamped most-recently-opened); the
    // seeded 40% book drops to the "Also in progress" row — the contrast
    // pair lives in ONE run.
    expect(lineMeta).toContain("Page 2 of 500");
    expect(lineMeta).toContain("0%");

    // EXPLICIT declared-scale observation.
    await assertDeclaredScale125();

    // FR-2, the named packaged assertion: empty modifier PRESENT on the
    // 0% line; hollow track; accent nub token-equal to the fill.
    const zeroTrack = await browser.execute(() => {
      const el = document.querySelector(".resume-line .resume-line-bar");
      if (!el) return null;
      const cs = getComputedStyle(el);
      const nub = getComputedStyle(el, "::before");
      const fill = el.querySelector(".resume-line-bar-fill");
      return {
        emptyModifier: el.className.includes("resume-line-bar--empty"),
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
        nubWidth: nub.width,
        nubHeight: nub.height,
        nubRadius: nub.borderRadius,
        nubBackground: nub.backgroundColor,
        fillBackground: fill ? getComputedStyle(fill).backgroundColor : null,
        fillWidth: fill ? getComputedStyle(fill).width : null,
      };
    });
    expect(zeroTrack).not.toBeNull();
    expect(zeroTrack.emptyModifier).toBe(true);
    expect(zeroTrack.boxShadow).toContain("inset");
    expect(zeroTrack.backgroundColor).toContain("0, 0, 0, 0");
    expect(zeroTrack.nubWidth).toBe("4px");
    expect(zeroTrack.nubHeight).toBe("4px");
    expect(zeroTrack.nubRadius).toContain("50%");
    expect(zeroTrack.nubBackground).toBe(zeroTrack.fillBackground);

    // The contrast pair: the 40% book is the ROW (no line bar there — its
    // no-empty-modifier packaged assertion lives in the no-key lane at
    // 40%); here we pin the row identity by name and stored place.
    const alsoText = await browser.execute(
      () => document.querySelector(".also-in-progress")?.textContent ?? "",
    );
    expect(alsoText).toContain("E2E Resume Fixture A");
    expect(alsoText).toContain("Page 2 of 5");

    // The labeled control exists on BOTH the zero line and the 40% row.
    await $(LINE_ZERO).waitForExist({ timeout: 15000 });
    const rowLabelText = await browser.execute(
      () =>
        document.querySelector(".also-in-progress-row-play")?.textContent ??
        "",
    );
    expect(rowLabelText).toContain("Read aloud");

    // Width matrix with the 0% line: no overflow, labeled control visible.
    await widthMatrix();

    // Keyboard-only path on the ZERO book (stored page 2, lands there,
    // no page turn, stays idle, honest setup message).
    await keyboardJourney("Resume E2E Zero Progress Fixture and read aloud", 2);
  });
});
