/*
 * Spec 079 composed first-reader journey.
 *
 * Three fresh app processes share one hermetic profile:
 *   no-key-open     — empty library -> public Open -> visible setup path;
 *   configured-close — public Resume -> Play -> highlight/page mutation ->
 *                      genuine WM_DELETE_WINDOW close and process death;
 *   resume-verify   — fresh process -> public Resume -> same page/highlight.
 *
 * The GTK picker and deterministic TTS provider are the two native seams a
 * WebDriver cannot operate. The runner supplies them at build/process
 * boundaries. Every in-app action uses a visible public control;
 * window.__E2E_READ__ only observes state.
 */

/* global browser, $, expect */

import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PHASE = process.env.NORTH_STAR_PHASE;
const RESULT_DIR = process.env.NORTH_STAR_RESULT_DIR;
const APP_PATH = process.env.NORTH_STAR_APP_PATH;
const SOURCE_SHA = process.env.NORTH_STAR_SOURCE_SHA;
const VALID_PHASES = new Set([
  "no-key-open",
  "configured-close",
  "resume-verify",
]);

if (!VALID_PHASES.has(PHASE)) {
  throw new Error(
    `NORTH_STAR_PHASE must name one of ${[...VALID_PHASES].join(", ")}`,
  );
}
if (!RESULT_DIR || !APP_PATH || !/^[0-9a-f]{40}$/.test(SOURCE_SHA || "")) {
  throw new Error(
    "NORTH_STAR_RESULT_DIR, NORTH_STAR_APP_PATH and a full NORTH_STAR_SOURCE_SHA are required",
  );
}

const phasePath = `${RESULT_DIR}/${PHASE}.json`;
const expectedPath = `${RESULT_DIR}/expected-document.json`;

function recordStep(name, actorAction, oracleObservation, startedAt) {
  return {
    name,
    actor_action: actorAction,
    oracle_observation: oracleObservation,
    elapsed_ms: Date.now() - startedAt,
    failure_reason: null,
    result: "pass",
  };
}

function writePhase(steps, extra = {}) {
  writeFileSync(
    phasePath,
    `${JSON.stringify({ phase: PHASE, source_sha: SOURCE_SHA, steps, ...extra }, null, 2)}\n`,
  );
}

async function waitReady() {
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
      ),
    { timeout: 40000, timeoutMsg: "native bootstrap never became ready" },
  );
  await browser.setWindowSize(1200, 800);
}

async function publicDomClick(selector) {
  const element = await $(selector);
  await element.waitForExist({ timeout: 15000 });
  await element.waitForClickable({ timeout: 15000 });
  const clicked = await browser.execute((sel) => {
    const control = document.querySelector(sel);
    if (!(control instanceof HTMLElement)) return false;
    control.click();
    return true;
  }, selector);
  expect(clicked).toBe(true);
}

async function publicButtonByText(label) {
  const found = await browser.execute((text) => {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, label);
  expect(found).toBe(true);
}

async function renderedParagraph() {
  await browser.waitUntil(
    async () =>
      browser.execute(() =>
        [...document.querySelectorAll(".textLayer span")].some((span) =>
          (span.textContent || "").includes("alpha lectrice"),
        ),
      ),
    { timeout: 30000, timeoutMsg: "opened PDF never rendered its text layer" },
  );
}

async function waitPage(page) {
  await browser.waitUntil(
    async () =>
      (await $('input[aria-label="Current page"]').getValue()) === String(page),
    { timeout: 15000, timeoutMsg: `reader never reached page ${page}` },
  );
}

async function waitLibraryRow(title, page) {
  await browser.waitUntil(
    async () =>
      (await browser.execute(
        (name) => window.__E2E_READ__.ipcDocumentRowPageByTitle(name),
        title,
      )) === page,
    {
      timeout: 10000,
      timeoutMsg: `library row for ${title} never persisted page ${page}`,
    },
  );
}

async function createHighlight() {
  await browser.waitUntil(
    async () =>
      browser.execute(() =>
        [...document.querySelectorAll(".textLayer span")].some((span) =>
          (span.textContent || "").includes("lectrice fixture page two"),
        ),
      ),
    { timeout: 30000, timeoutMsg: "page-two paragraph never rendered" },
  );

  const geometry = await browser.execute(() => {
    const spans = [...document.querySelectorAll(".textLayer span")].filter(
      (span) => (span.textContent || "").includes("lectrice"),
    );
    if (spans.length === 0) return null;
    const rects = spans.map((span) => span.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, right, top, bottom };
  });
  expect(geometry).not.toBeNull();

  const y = Math.round((geometry.top + geometry.bottom) / 2);
  await browser.performActions([
    {
      type: "pointer",
      id: "north-star-pointer",
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", x: Math.round(geometry.left + 15), y },
        { type: "pointerDown", button: 0 },
        {
          type: "pointerMove",
          x: Math.round(geometry.right - 15),
          y,
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
    timeoutMsg: "public highlight toolbar never appeared",
  });
  await publicDomClick('button[aria-label="Highlight with Yellow"]');
  await browser.waitUntil(
    async () =>
      browser.execute(
        () =>
          !!document.querySelector(
            '[aria-label*="Highlight: "][aria-label*="lectrice fixture page two"]',
          ),
      ),
    {
      timeout: 15000,
      timeoutMsg: "acknowledged highlight overlay never appeared",
    },
  );
  return browser.execute(
    () =>
      document
        .querySelector('[aria-label*="Highlight: "]')
        ?.getAttribute("aria-label") ?? "",
  );
}

function processIsAlive() {
  const escaped = APP_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let pids;
  try {
    pids = execFileSync("pgrep", ["-f", `^${escaped}`], {
      encoding: "utf8",
    }).trim();
  } catch {
    return false;
  }
  for (const pid of pids.split(/\s+/)) {
    if (!pid) continue;
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const state = stat.match(/^\d+ \(.*\) ([A-Za-z])/);
      if (state && state[1] !== "Z") return true;
    } catch {
      // The process disappeared between pgrep and /proc: continue.
    }
  }
  return false;
}

async function normalCloseAndObserve() {
  const windowAlive = () => {
    try {
      execFileSync("xdotool", ["search", "--name", "Lectrice"], {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  };
  if (!windowAlive() || !processIsAlive()) {
    throw new Error(
      "normal-close precondition failed: window or app process absent",
    );
  }

  const started = Date.now();
  spawn("xdotool", ["search", "--name", "Lectrice", "windowquit"], {
    detached: true,
    stdio: "ignore",
  }).unref();

  let windowGoneAt = null;
  let processGoneAt = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (windowGoneAt === null && !windowAlive()) windowGoneAt = Date.now();
    if (!processIsAlive()) {
      processGoneAt = Date.now();
      if (windowGoneAt === null && !windowAlive()) windowGoneAt = Date.now();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (windowGoneAt === null || processGoneAt === null) {
    throw new Error(
      `normal close did not remove window/process (window=${windowGoneAt}, process=${processGoneAt})`,
    );
  }
  if (processGoneAt - windowGoneAt > 3000) {
    throw new Error(
      `original process outlived its window by ${processGoneAt - windowGoneAt}ms`,
    );
  }
  return {
    window_close_ms: windowGoneAt - started,
    process_end_ms: processGoneAt - started,
  };
}

const expected =
  PHASE === "no-key-open"
    ? null
    : JSON.parse(readFileSync(expectedPath, "utf8"));

describe("Spec 079 packaged north-star journey", () => {
  it(`${PHASE}: completes its ordered public-reader boundaries`, async function () {
    this.timeout(300000);
    await waitReady();
    const steps = [];

    if (PHASE === "no-key-open") {
      let started = Date.now();
      expect(await browser.execute(() => window.__E2E_READ__.hasKey())).toBe(
        false,
      );
      const empty = await browser.execute(() => ({
        cards: document.querySelectorAll(".document-card").length,
        hasOpen: [...document.querySelectorAll("button")].some(
          (button) => button.textContent?.trim() === "Open a PDF",
        ),
      }));
      expect(empty.cards).toBe(0);
      expect(empty.hasOpen).toBe(true);
      steps.push(
        recordStep(
          "fresh_profile",
          "Launch the packaged app with a new profile",
          "Library has zero document cards and exposes the Open a PDF control",
          started,
        ),
      );

      started = Date.now();
      await publicButtonByText("Open a PDF");
      await renderedParagraph();
      // WebKit getText() drops the ellipsis-clipped toolbar title; the DOM
      // text is also its accessible text and remains the public identity.
      const title = await browser.execute(
        () =>
          document.querySelector(".document-title")?.textContent?.trim() ?? "",
      );
      expect(title.length).toBeGreaterThan(0);
      steps.push(
        recordStep(
          "open_pdf",
          "Activate the empty-state Open a PDF control and choose the deterministic picker fixture",
          `Rendered PDF text layer and document title ${title}`,
          started,
        ),
      );

      started = Date.now();
      const setup = await $(".ai-playback-setup-message");
      await setup.waitForExist({ timeout: 10000 });
      expect(await setup.getText()).toContain(
        "AI TTS requires an ElevenLabs API key",
      );
      await publicDomClick("button.ai-playback-setup-btn");
      const form = await $('form[aria-label="Connect ElevenLabs"]');
      await form.waitForExist({ timeout: 10000 });
      expect(await $("#api-key").isExisting()).toBe(true);
      expect(await form.getText()).toContain("elevenlabs.io");
      steps.push(
        recordStep(
          "no_key_setup_visible",
          "Activate Configure from the no-key playback message",
          "Connect ElevenLabs form, API-key field, provider link, and egress disclosure are visible",
          started,
        ),
      );
      await publicDomClick("button.ai-tts-settings-close");

      await publicDomClick('button[title="Next page (Right Arrow)"]');
      await waitPage(2);
      await waitLibraryRow(title, 2);
      writeFileSync(
        expectedPath,
        `${JSON.stringify({ title, page: 3, highlight: "lectrice fixture page two" }, null, 2)}\n`,
      );
      writePhase(steps, { document_title: title });
      return;
    }

    if (PHASE === "configured-close") {
      let started = Date.now();
      expect(await browser.execute(() => window.__E2E_READ__.hasKey())).toBe(
        true,
      );
      const resumeSelector =
        'button[aria-label^="Resume "][aria-label*=", page "]';
      await publicDomClick(resumeSelector);
      await waitPage(2);
      expect(
        await browser.execute(
          () =>
            document.querySelector(".document-title")?.textContent?.trim() ??
            "",
        ),
      ).toBe(expected.title);
      await publicDomClick("button.ai-playback-button");
      await browser.waitUntil(
        async () =>
          browser.execute(
            () =>
              window.__E2E_READ__.playbackState() === "playing" &&
              window.__E2E_READ__.wordCount() > 0 &&
              window.__E2E_READ__.currentWordIndex() >= 0,
          ),
        {
          timeout: 15000,
          timeoutMsg:
            "Play did not cross the fixture boundary into playing word-timed narration",
        },
      );
      steps.push(
        recordStep(
          "start_narration",
          "Activate Play after deterministic supported setup",
          "Native fixture playback is playing with word timings and an advanced word index",
          started,
        ),
      );

      started = Date.now();
      const highlightLabel = await createHighlight();
      await publicDomClick('button[title="Next page (Right Arrow)"]');
      await waitPage(3);
      await waitLibraryRow(expected.title, 3);
      steps.push(
        recordStep(
          "mutate_acknowledged_state",
          "Create a Yellow highlight through the public selection toolbar and navigate to page 3",
          `Reader acknowledges page 3 and ${highlightLabel}`,
          started,
        ),
      );

      started = Date.now();
      const close = await normalCloseAndObserve();
      steps.push(
        recordStep(
          "normal_close_process_ended",
          "Close the window through WM_DELETE_WINDOW",
          `Window closed in ${close.window_close_ms}ms and original process ended in ${close.process_end_ms}ms`,
          started,
        ),
      );
      writePhase(steps, { document_title: expected.title, close });
      return;
    }

    let started = Date.now();
    expect(await browser.execute(() => window.__E2E_READ__.hasKey())).toBe(
      true,
    );
    expect(await $(".library-view").isExisting()).toBe(true);
    steps.push(
      recordStep(
        "relaunch_new_process",
        "Launch a new packaged application process on the same hermetic profile",
        "Fresh WebDriver session reached a new native bootstrap on the existing profile",
        started,
      ),
    );

    started = Date.now();
    const resumeSelector =
      'button[aria-label^="Resume "][aria-label*=", page 3"]';
    await publicDomClick(resumeSelector);
    await waitPage(3);
    const title = await browser.execute(
      () =>
        document.querySelector(".document-title")?.textContent?.trim() ?? "",
    );
    expect(title).toBe(expected.title);
    steps.push(
      recordStep(
        "resume_same_document_page",
        "Activate the public Resume control for page 3",
        `Reader reopened ${title} at page 3`,
        started,
      ),
    );

    started = Date.now();
    await browser.waitUntil(
      async () =>
        browser.execute(
          (fragment) =>
            [...document.querySelectorAll('[aria-label*="Highlight: "]')].some(
              (mark) => mark.getAttribute("aria-label")?.includes(fragment),
            ),
          expected.highlight,
        ),
      {
        timeout: 15000,
        timeoutMsg: "acknowledged highlight is absent after relaunch",
      },
    );
    steps.push(
      recordStep(
        "highlight_present",
        "Observe the resumed page without creating another highlight",
        `Persisted highlight containing ${expected.highlight} is rendered`,
        started,
      ),
    );
    writePhase(steps, { document_title: title });
  });
});
