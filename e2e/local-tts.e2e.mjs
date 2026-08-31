/* global browser, $, expect */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Runs in the WebdriverIO Node process, NOT inside browser.execute/WebKit. The
// production CSP therefore stays closed; this observer reads only the hermetic
// fixture's request ledger and performs no action in the app.
const readFixtureRequests = () =>
  globalThis
    .fetch("http://127.0.0.1:5301/requests")
    .then((response) => response.json());

function xdotool(...args) {
  return execFileSync("xdotool", args, { encoding: "utf8" }).trim();
}

/**
 * Calibrate X11 frame offsets from an observed pointer move, then double-click
 * the exact WebKit client point. Openbox decorations are asymmetric, so
 * `(outer-inner)/2` is not a valid coordinate transform.
 */
async function physicalDoubleClick(clientX, clientY) {
  const windows = xdotool("search", "--name", "^Lectrice$")
    .split(/\s+/u)
    .filter(Boolean)
    .map((id) => {
      const geometry = Object.fromEntries(
        xdotool("getwindowgeometry", "--shell", id)
          .split("\n")
          .map((line) => line.split("=")),
      );
      return { id, geometry };
    })
    .sort(
      (left, right) =>
        Number(right.geometry.WIDTH) * Number(right.geometry.HEIGHT) -
        Number(left.geometry.WIDTH) * Number(left.geometry.HEIGHT),
    );
  const target = windows[0];
  if (!target) throw new Error("Lectrice X11 window not found");

  await browser.execute(() => {
    window.__E2E_LAST_POINTER__ = null;
    if (window.__E2E_POINTER_OBSERVER__) return;
    window.__E2E_POINTER_OBSERVER__ = true;
    window.addEventListener("mousemove", (event) => {
      window.__E2E_LAST_POINTER__ = { x: event.clientX, y: event.clientY };
    });
  });
  xdotool("windowfocus", "--sync", target.id);
  xdotool(
    "mousemove",
    "--window",
    target.id,
    String(Math.round(clientX)),
    String(Math.round(clientY)),
  );
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => window.__E2E_LAST_POINTER__)) !== null,
    {
      timeout: 2000,
      timeoutMsg: "X11 pointer calibration emitted no mousemove",
    },
  );
  const observed = await browser.execute(() => window.__E2E_LAST_POINTER__);
  const correctedX = Math.round(clientX + (clientX - observed.x));
  const correctedY = Math.round(clientY + (clientY - observed.y));
  xdotool(
    "mousemove",
    "--window",
    target.id,
    String(correctedX),
    String(correctedY),
    "click",
    "--repeat",
    "2",
    "--delay",
    "80",
    "1",
  );
  await browser.pause(100);
  const landed = await browser.execute(() => window.__E2E_LAST_POINTER__);
  expect(Math.abs(landed.x - clientX)).toBeLessThanOrEqual(2);
  expect(Math.abs(landed.y - clientY)).toBeLessThanOrEqual(2);
}

/** Reach an accessible control through the same Tab order a reader uses. */
async function focusPublicControl(element) {
  for (let step = 0; step < 100; step += 1) {
    if (await element.isFocused()) return;
    await browser.keys(["Tab"]);
  }
  throw new Error("public control was unreachable through keyboard Tab order");
}

/** WebKit may drop pointer activation; keyboard fallback remains fully public. */
async function activatePublicControl(element, changed, fallbackKey = "Enter") {
  await element.click();
  await browser.pause(100);
  if (await changed()) return;
  await focusPublicControl(element);
  await browser.keys([fallbackKey]);
}

async function openNarrationTab(tabId) {
  const cockpit = await $("#narration-cockpit");
  if (!(await cockpit.isExisting())) {
    const settings = await $('button[aria-label="Narration settings"]');
    await settings.waitForClickable({ timeout: 10000 });
    await activatePublicControl(settings, () => cockpit.isDisplayed());
    await cockpit.waitForDisplayed({ timeout: 10000 });
  }
  const tab = await $(`#narration-tab-${tabId}`);
  await tab.waitForClickable({ timeout: 10000 });
  const panel = await $(`#narration-panel-${tabId}`);
  await activatePublicControl(tab, () => panel.isDisplayed());
  await panel.waitForDisplayed({ timeout: 10000 });
}

async function closeNarrationSettings() {
  await browser.keys(["Escape"]);
  await $("#narration-cockpit").waitForExist({
    reverse: true,
    timeout: 5000,
  });
}

async function measureCockpitGeometry(width) {
  await browser.setWindowSize(width, 800);
  await browser.pause(100);
  const beforeHeight = await browser.execute(
    () => document.querySelector(".pdf-viewer")?.getBoundingClientRect().height,
  );
  await openNarrationTab("voice");
  await browser.pause(100);
  const geometry = await browser.execute(() => {
    const viewer = document.querySelector(".pdf-viewer");
    const bar = document.querySelector(".ai-playback-bar");
    const cockpit = document.querySelector(".narration-cockpit");
    const selectors = [
      ".ai-playback-controls button",
      ".ai-playback-settings-section button",
      ".ai-playback-settings-section select",
      ".ai-playback-settings-section input",
      ".narration-cockpit-close",
      '.narration-cockpit-tabs [role="tab"]',
    ].join(",");
    const controls = Array.from(document.querySelectorAll(selectors))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute("aria-label") ??
            element.getAttribute("title") ??
            element.textContent?.trim() ??
            element.tagName,
          width: rect.width,
          height: rect.height,
        };
      });
    if (!viewer || !bar || !cockpit) return null;
    const barRect = bar.getBoundingClientRect();
    const cockpitRect = cockpit.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      viewerHeight: viewer.getBoundingClientRect().height,
      bar: { left: barRect.left, right: barRect.right },
      cockpit: {
        left: cockpitRect.left,
        right: cockpitRect.right,
        height: cockpitRect.height,
        position: getComputedStyle(cockpit).position,
        backdropFilter: getComputedStyle(cockpit).backdropFilter,
      },
      documentScrollWidth: document.documentElement.scrollWidth,
      controls,
    };
  });
  expect(geometry).not.toBeNull();
  expect(beforeHeight).toBeGreaterThan(0);
  const retainedPageRatio = geometry.viewerHeight / beforeHeight;
  if (retainedPageRatio < 0.6) {
    throw new Error(
      `cockpit retained ${retainedPageRatio} at ${geometry.viewport.width}x${geometry.viewport.height}; viewer ${beforeHeight} -> ${geometry.viewerHeight}; cockpit ${geometry.cockpit.height}`,
    );
  }
  expect(geometry.cockpit.position).toBe("static");
  expect(geometry.cockpit.backdropFilter).toBe("none");
  expect(geometry.bar.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.bar.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
  expect(geometry.cockpit.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.cockpit.right).toBeLessThanOrEqual(
    geometry.viewport.width + 1,
  );
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(
    geometry.viewport.width + 1,
  );
  expect(geometry.controls.length).toBeGreaterThanOrEqual(8);
  expect(
    geometry.controls.every(
      (control) => control.width >= 44 && control.height >= 44,
    ),
  ).toBe(true);
  await closeNarrationSettings();
  return {
    ...geometry,
    retainedPageRatio,
  };
}

describe("Local TTS (native config → Rust HTTP → WAV playback)", () => {
  it("plays, replaces a paused queue from selection, and stops", async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "native bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);
    await browser.keys(["Control", "l"]);
    await browser.pause(250);
    if (
      !(await $(".ai-playback-button").isExisting()) &&
      (await $(".library-view").isExisting())
    ) {
      // WebKit occasionally drops the first chord while focus settles after
      // resize. Retry only while the public Library surface is still visible;
      // never toggle a reader that already opened back to the library.
      await browser.keys(["Control", "l"]);
    }

    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.provider() === "local" &&
            window.__E2E_READ__.hasKey() === false,
        ),
      {
        timeout: 15000,
        timeoutMsg: "local provider did not initialize keylessly",
      },
    );

    const cockpitGeometry = [];
    for (const width of [1920, 1440, 767, 640]) {
      cockpitGeometry.push(await measureCockpitGeometry(width));
    }
    await browser.setWindowSize(1200, 800);

    await openNarrationTab("voice");
    const voiceTab = await $("#narration-tab-voice");
    await focusPublicControl(voiceTab);
    await browser.keys(["ArrowRight"]);
    expect(await $("#narration-tab-delivery").isFocused()).toBe(true);
    expect(
      await $("#narration-tab-delivery").getAttribute("aria-selected"),
    ).toBe("true");
    await browser.keys(["ArrowLeft"]);
    expect(await voiceTab.isFocused()).toBe(true);
    expect(await $("#narration-panel-voice").getText()).toContain("Local TTS");
    const reducedMotionEvidence = await browser.execute(() => {
      const seconds = (value) =>
        value
          .split(",")
          .map((duration) =>
            duration.trim().endsWith("ms")
              ? Number.parseFloat(duration) / 1000
              : Number.parseFloat(duration),
          )
          .filter(Number.isFinite);
      const candidates = [
        document.querySelector(".pdf-page-container"),
        ...document.querySelectorAll(".narration-cockpit *"),
      ].filter(Boolean);
      const durations = candidates.flatMap((element) => {
        const style = getComputedStyle(element);
        return [
          ...seconds(style.animationDuration),
          ...seconds(style.transitionDuration),
        ];
      });
      return {
        mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
        maxDurationSeconds: Math.max(0, ...durations),
        pageTransition: getComputedStyle(
          document.querySelector(".pdf-page-container"),
        ).transitionDuration,
      };
    });
    expect(reducedMotionEvidence.mediaMatches).toBe(true);
    expect(reducedMotionEvidence.maxDurationSeconds).toBeLessThanOrEqual(
      0.00001,
    );
    expect(reducedMotionEvidence.pageTransition).toBe("0s");
    await closeNarrationSettings();

    await openNarrationTab("performance");
    const performanceFactsText = await $(".performance-facts").getText();
    expect(performanceFactsText).toContain("Magpie TTS Multilingual 357M");
    expect(performanceFactsText).toContain("Vulkan/RADV fixture");
    expect(performanceFactsText).toContain("Fixture GPU");
    await closeNarrationSettings();

    await openNarrationTab("delivery");
    const continuous = await $('input[value="continuous"]');
    const balanced = await $('input[value="balanced"]');
    await continuous.waitForEnabled({ timeout: 10000 });
    await focusPublicControl(balanced);
    await browser.keys(["ArrowRight"]);
    await browser.waitUntil(() => continuous.isSelected(), {
      timeout: 5000,
      timeoutMsg: "Continuous performance policy did not become selected",
    });
    const normalizeNumbers = await $(
      '//label[.//strong[normalize-space()="Speak written numbers"]]//input',
    );
    expect(await normalizeNumbers.isSelected()).toBe(true);
    await $("#narration-language").selectByAttribute("value", "en");
    await closeNarrationSettings();

    await openNarrationTab("delivery");
    expect(await $('input[value="continuous"]').isSelected()).toBe(true);
    expect(await $("#narration-language").getValue()).toBe("en");
    await closeNarrationSettings();

    await openNarrationTab("selection");
    expect(await $("#narration-panel-selection").getText()).toContain(
      "Paragraph actions",
    );
    await closeNarrationSettings();

    const play = await $(".ai-playback-button");
    await play.waitForExist({ timeout: 15000 });
    await play.waitForEnabled({ timeout: 15000 });
    await play.waitForClickable({ timeout: 15000 });
    expect(await browser.execute(() => window.__E2E_READ__.wordCount())).toBe(
      0,
    );
    expect(await browser.execute(() => window.__E2E_READ__.isActive())).toBe(
      false,
    );

    const playbackStartedAt = Date.now();
    await activatePublicControl(
      play,
      async () =>
        (await browser.execute(() => window.__E2E_READ__.playbackState())) !==
        "idle",
    );
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => window.__E2E_READ__.playbackState())) ===
        "playing",
      {
        timeout: 10000,
        timeoutMsg: "public Play never reached active audio before settings",
      },
    );
    const cockpitOpenBefore = await browser.execute(() => ({
      playbackState: window.__E2E_READ__.playbackState(),
      highlightActive: window.__E2E_READ__.isActive(),
      word: window.__E2E_READ__.currentWordText(),
      logCount: window.__E2E_READ__.logs().length,
    }));
    await openNarrationTab("voice");
    try {
      await browser.waitUntil(
        async () =>
          (await browser.execute(() => window.__E2E_READ__.playbackState())) ===
          "playing",
        {
          timeout: 5000,
          timeoutMsg:
            "narration was not active immediately before cockpit Escape",
        },
      );
    } catch (error) {
      const cockpitOpenAfter = await browser.execute(() => ({
        playbackState: window.__E2E_READ__.playbackState(),
        highlightActive: window.__E2E_READ__.isActive(),
        word: window.__E2E_READ__.currentWordText(),
        logs: window.__E2E_READ__.logs().slice(-40),
      }));
      throw new Error(
        `opening cockpit changed narration: ${JSON.stringify({ cockpitOpenBefore, cockpitOpenAfter })}; ${error}`,
      );
    }
    const escapeBefore = await browser.execute(() => ({
      playbackState: window.__E2E_READ__.playbackState(),
      highlightActive: window.__E2E_READ__.isActive(),
      word: window.__E2E_READ__.currentWordText(),
      logCount: window.__E2E_READ__.logs().length,
    }));
    await closeNarrationSettings();
    const escapeAfter = await browser.execute(() => ({
      playbackState: window.__E2E_READ__.playbackState(),
      highlightActive: window.__E2E_READ__.isActive(),
      word: window.__E2E_READ__.currentWordText(),
      logs: window.__E2E_READ__.logs().slice(-30),
    }));
    if (escapeAfter.playbackState !== "playing") {
      throw new Error(
        `cockpit Escape changed active narration: ${JSON.stringify({ escapeBefore, escapeAfter })}`,
      );
    }

    let alignedHighlight = null;
    const seenHighlights = [];
    const readHighlight = () =>
      browser.execute(() => {
        const highlight = CSS.highlights?.get("tts-current-word");
        const sources = [];
        highlight?.forEach((range) => sources.push(range.toString()));
        return {
          spoken: window.__E2E_READ__.currentWordText(),
          sources,
          active: window.__E2E_READ__.isActive(),
          logs: window.__E2E_READ__.logs().slice(-12),
        };
      });
    try {
      await browser.waitUntil(
        async () => {
          alignedHighlight = await readHighlight();
          const signature = JSON.stringify({
            spoken: alignedHighlight.spoken,
            sources: alignedHighlight.sources,
            active: alignedHighlight.active,
          });
          if (
            !seenHighlights.some((sample) => sample.signature === signature)
          ) {
            seenHighlights.push({ signature, sample: alignedHighlight });
          }
          return (
            alignedHighlight.spoken === "What" &&
            alignedHighlight.sources.includes("What")
          );
        },
        {
          timeout: 15000,
          interval: 40,
          timeoutMsg:
            "standalone heading did not retain the exact source highlight",
        },
      );
    } catch (error) {
      console.warn(
        "[local-tts-e2e] last highlight",
        JSON.stringify({ alignedHighlight, seenHighlights }),
      );
      throw error;
    }
    expect(alignedHighlight).toMatchObject({
      spoken: "What",
      sources: ["What"],
      active: true,
    });
    const initialSourceText = await browser.execute(() =>
      Array.from(document.querySelectorAll(".textLayer span"))
        .map((span) => span.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" / "),
    );
    expect(
      await browser.execute(
        () =>
          document.querySelector(".ai-playback-progress") !== null &&
          document.querySelector(".tts-word-debug") === null,
      ),
    ).toBe(true);

    const receipt = await readFixtureRequests();
    expect(receipt.requests.length).toBeGreaterThanOrEqual(1);
    expect(receipt.requests[0].body.voice).toBe("F1-pt");
    expect(receipt.requests[0].body.input).toBe("What This Book Is About.");
    expect(receipt.requests[0].idempotencyKey).toMatch(/^[0-9a-f]{64}$/);

    // Pause through the public transport, then select a body-text tail and
    // activate the real floating “Read from here” control. This is the native
    // regression for a selection request being consumed as generic Resume.
    const pause = await $('button[title="Pause (Ctrl+Space)"]');
    await pause.waitForClickable({ timeout: 5000 });
    await focusPublicControl(pause);
    await browser.keys(["Enter"]);
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "paused"),
      { timeout: 5000, timeoutMsg: "public Pause did not pause narration" },
    );

    const bodySpan = await $(
      '//div[contains(@class,"textLayer")]//span[contains(.,"This book aims")]',
    );
    await bodySpan.waitForDisplayed({ timeout: 10000 });
    await bodySpan.scrollIntoView({ block: "center", inline: "center" });
    const bodyRect = await browser.execute(() => {
      const span = Array.from(
        document.querySelectorAll(".textLayer span"),
      ).find((candidate) =>
        (candidate.textContent || "").startsWith("This book aims"),
      );
      const rect = span?.getBoundingClientRect();
      return rect
        ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        : null;
    });
    expect(bodyRect).not.toBeNull();
    await physicalDoubleClick(
      bodyRect.left + 4,
      bodyRect.top + bodyRect.height / 2,
    );

    const selectedText = await browser.execute(
      () => window.getSelection()?.toString().trim() ?? "",
    );
    expect(selectedText).toBe("This");
    const readFromHere = await $("button.highlight-read-button");
    await readFromHere.waitForClickable({
      timeout: 10000,
      timeoutMsg: "valid excerpt did not expose Read from here",
    });
    const beforeSelectionRequest = await readFixtureRequests();
    await activatePublicControl(readFromHere, async () => {
      const requests = await readFixtureRequests();
      return requests.requests.length > beforeSelectionRequest.requests.length;
    });

    await browser.waitUntil(
      async () => {
        const requests = await readFixtureRequests();
        return (
          requests.requests.length > beforeSelectionRequest.requests.length
        );
      },
      {
        timeout: 15000,
        timeoutMsg:
          "Read from here resumed the paused queue instead of dispatching the selected tail",
      },
    );
    const afterSelectionRequest = await readFixtureRequests();
    const selectionRequests = afterSelectionRequest.requests.slice(
      beforeSelectionRequest.requests.length,
    );
    const selectedRequest = selectionRequests[0].body.input;
    expect(selectedRequest.startsWith("This book aims")).toBe(true);
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("playing");
    await browser.saveScreenshot(
      `${process.env.LECTRICE_LOCAL_TTS_EVIDENCE_DIR}/read-from-here.png`,
    );

    const stop = await $('button[title="Stop (Esc)"]');
    await stop.waitForEnabled({ timeout: 5000 });
    await browser.keys(["Escape"]);
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "idle"),
      {
        timeout: 5000,
        timeoutMsg: "public Stop did not return playback to idle",
      },
    );
    expect(await browser.execute(() => window.__E2E_READ__.wordCount())).toBe(
      0,
    );
    expect(await browser.execute(() => window.__E2E_READ__.isActive())).toBe(
      false,
    );
    expect(
      await browser.execute(
        () => document.querySelector(".ai-playback-progress") === null,
      ),
    ).toBe(true);

    const paragraphAction = await $(
      'button[aria-label^="Read from paragraph"][aria-label*="This book aims"]',
    );
    await paragraphAction.waitForClickable({
      timeout: 10000,
      timeoutMsg: "body paragraph did not expose its margin play action",
    });
    const paragraphGeometry = await browser.execute(() => {
      const button = document.querySelector(
        'button[aria-label^="Read from paragraph"][aria-label*="This book aims"]',
      );
      const firstLine = Array.from(
        document.querySelectorAll(".textLayer span"),
      ).find((span) => span.textContent?.includes("This book aims"));
      const tickElement = button?.querySelector(".paragraph-action-tick");
      const iconElement = button?.querySelector("svg");
      if (!button || !firstLine || !tickElement || !iconElement) return null;
      const action = button.getBoundingClientRect();
      const line = firstLine.getBoundingClientRect();
      const tickRect = tickElement.getBoundingClientRect();
      const iconRect = iconElement.getBoundingClientRect();
      const tick = getComputedStyle(tickElement);
      const icon = getComputedStyle(iconElement);
      return {
        action: {
          left: action.left,
          right: action.right,
          width: action.width,
          height: action.height,
          centerY: action.top + action.height / 2,
        },
        line: {
          left: line.left,
          centerY: line.top + line.height / 2,
        },
        title: button.getAttribute("title"),
        tickRight: tickRect.right,
        tickCenterY: tickRect.top + tickRect.height / 2,
        iconRight: iconRect.right,
        iconCenterY: iconRect.top + iconRect.height / 2,
        tickBackground: tick.backgroundColor,
        iconVisibility: icon.visibility,
      };
    });
    expect(paragraphGeometry).not.toBeNull();
    expect(paragraphGeometry.action.width).toBeGreaterThanOrEqual(44);
    expect(paragraphGeometry.action.height).toBeGreaterThanOrEqual(44);
    expect(paragraphGeometry.action.right).toBeLessThanOrEqual(
      paragraphGeometry.line.left,
    );
    expect(
      paragraphGeometry.line.left - paragraphGeometry.tickRight,
    ).toBeGreaterThanOrEqual(7);
    expect(
      paragraphGeometry.line.left - paragraphGeometry.iconRight,
    ).toBeGreaterThanOrEqual(7);
    expect(
      Math.abs(
        paragraphGeometry.action.centerY - paragraphGeometry.line.centerY,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(paragraphGeometry.tickCenterY - paragraphGeometry.line.centerY),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(paragraphGeometry.iconCenterY - paragraphGeometry.line.centerY),
    ).toBeLessThanOrEqual(1);
    expect(paragraphGeometry.title).toBeNull();
    expect(paragraphGeometry.tickBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(paragraphGeometry.iconVisibility).toBe("hidden");
    const paragraphActionsNonOverlapping = await browser.execute(() => {
      const rectangles = Array.from(
        document.querySelectorAll("button.paragraph-action-button"),
        (button) => button.getBoundingClientRect(),
      );
      return rectangles.every((left, index) =>
        rectangles
          .slice(index + 1)
          .every(
            (right) =>
              left.right <= right.left ||
              right.right <= left.left ||
              left.bottom <= right.top ||
              right.bottom <= left.top,
          ),
      );
    });
    expect(paragraphActionsNonOverlapping).toBe(true);

    await focusPublicControl(paragraphAction);
    const focusedAction = await browser.execute(() => {
      const button = document.activeElement;
      const style = getComputedStyle(button);
      const icon = button?.querySelector("svg");
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        iconVisibility: icon ? getComputedStyle(icon).visibility : null,
      };
    });
    expect(focusedAction.outlineStyle).not.toBe("none");
    expect(
      Number.parseFloat(focusedAction.outlineWidth),
    ).toBeGreaterThanOrEqual(2);
    expect(focusedAction.iconVisibility).toBe("visible");

    await activatePublicControl(
      paragraphAction,
      async () =>
        (await browser.execute(() => window.__E2E_READ__.playbackState())) !==
        "idle",
    );
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.playbackState() === "playing" &&
            window.__E2E_READ__.currentWordText() === "This",
        ),
      {
        timeout: 10000,
        timeoutMsg: "paragraph action did not start at the chosen paragraph",
      },
    );
    await browser.saveScreenshot(
      `${process.env.LECTRICE_LOCAL_TTS_EVIDENCE_DIR}/paragraph-action.png`,
    );
    const paragraphStop = await $('button[title="Stop (Esc)"]');
    await paragraphStop.waitForEnabled({ timeout: 5000 });
    await browser.keys(["Escape"]);
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "idle"),
      {
        timeout: 5000,
        timeoutMsg: "Stop after paragraph action stayed active",
      },
    );

    const nextPage = await $('button[aria-label="Next page"]');
    await nextPage.waitForClickable({ timeout: 5000 });
    await activatePublicControl(
      nextPage,
      async () =>
        (await browser.execute(() => window.__E2E_READ__.currentPage())) === 2,
    );
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.currentPage() === 2 &&
            window.__E2E_READ__.playbackState() === "idle" &&
            window.__E2E_READ__.isActive() === false,
        ),
      {
        timeout: 10000,
        timeoutMsg:
          "manual next page retained stale playback/highlight authority",
      },
    );

    const pageTwoPlay = await $('button[title="Play (Ctrl+Space)"]');
    await pageTwoPlay.waitForEnabled({ timeout: 5000 });
    await activatePublicControl(
      pageTwoPlay,
      async () =>
        (await browser.execute(() => window.__E2E_READ__.playbackState())) !==
        "idle",
    );
    await browser.waitUntil(
      async () => {
        const requests = await readFixtureRequests();
        return requests.requests.some((request) =>
          request.body.input.startsWith("Second page ready."),
        );
      },
      {
        timeout: 10000,
        timeoutMsg: "fresh Play on page two did not dispatch immediately",
      },
    );
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.playbackState() === "playing" &&
            window.__E2E_READ__.currentWordText() === "Second",
        ),
      {
        timeout: 5000,
        timeoutMsg: "page-two audio started without its first source word",
      },
    );
    await browser.saveScreenshot(
      `${process.env.LECTRICE_LOCAL_TTS_EVIDENCE_DIR}/page-two-play.png`,
    );
    const finalStop = await $('button[title="Stop (Esc)"]');
    await finalStop.waitForEnabled({ timeout: 5000 });
    await browser.keys(["Escape"]);
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "idle"),
      { timeout: 5000, timeoutMsg: "final page-two Stop stayed active" },
    );

    expect(Date.now() - playbackStartedAt).toBeLessThan(20000);

    await openNarrationTab("performance");
    const performanceMeasurement = await $(".performance-measurement");
    await performanceMeasurement.waitForDisplayed({ timeout: 10000 });
    const performanceMeasurementText = await performanceMeasurement.getText();
    expect(performanceMeasurementText).toContain("RTF");
    expect(performanceMeasurementText).toContain(
      "Sustains continuous playback",
    );
    await closeNarrationSettings();

    const completed = await readFixtureRequests();
    expect(
      completed.requests.slice(0, 2).map((request) => request.body.input),
    ).toEqual([
      "What This Book Is About.",
      "This book aims to fill a gap. It connects the dots. Readers benefit.",
    ]);
    expect(completed.requests.length).toBeGreaterThan(2);
    expect(completed.requests[2].body.input).toBe(selectedRequest);
    const pageTwoRequest = completed.requests.find((request) =>
      request.body.input.startsWith("Second page ready."),
    );
    expect(pageTwoRequest).toBeDefined();

    const observed = {
      performanceModel: performanceFactsText.match(
        /Magpie TTS Multilingual 357M/u,
      )?.[0],
      performanceBackend:
        performanceFactsText.match(/Vulkan\/RADV fixture/u)?.[0],
      performanceDevice: performanceFactsText.match(/Fixture GPU/u)?.[0],
      performanceProfile: (await continuous.isSelected())
        ? await continuous.getAttribute("value")
        : null,
      uncachedRtfVisible: performanceMeasurementText.includes("RTF"),
      sourceText: initialSourceText,
      spokenFirstRun: receipt.requests[0]?.body.input ?? null,
      highlightedSourceRange: alignedHighlight.sources.join(" "),
      secondRun: receipt.requests[1]?.body.input ?? null,
      readFromHereReplacedPausedQueue:
        selectedRequest.startsWith("This book aims") &&
        selectionRequests.length > 0,
      paragraphActionStartedAtChosenParagraph:
        completed.requests.some(
          (request) => request.body.input === "This book aims to fill a gap.",
        ) && paragraphGeometry.line.left > paragraphGeometry.action.right,
      paragraphActionNonOverlapping: paragraphActionsNonOverlapping,
      paragraphActionFocusVisible:
        focusedAction.outlineStyle !== "none" &&
        Number.parseFloat(focusedAction.outlineWidth) >= 2 &&
        focusedAction.iconVisibility === "visible",
      paragraphActionPaperMarker:
        paragraphGeometry.title === null &&
        paragraphGeometry.tickBackground !== "rgba(0, 0, 0, 0)" &&
        paragraphGeometry.iconVisibility === "hidden",
      manualPageFreshPlay: pageTwoRequest?.body.input ?? null,
      provider: await browser.execute(() => window.__E2E_READ__.provider()),
      credentialPresent: await browser.execute(() =>
        window.__E2E_READ__.hasKey(),
      ),
      finalPlaybackState: await browser.execute(() =>
        window.__E2E_READ__.playbackState(),
      ),
      cockpitGeometry,
      reducedMotion: reducedMotionEvidence,
    };
    const evidenceDirectory = process.env.LECTRICE_LOCAL_TTS_EVIDENCE_DIR;
    if (!evidenceDirectory) {
      throw new Error("LECTRICE_LOCAL_TTS_EVIDENCE_DIR is required");
    }
    fs.writeFileSync(
      path.join(evidenceDirectory, "observed.json"),
      `${JSON.stringify(observed, null, 2)}\n`,
    );
  });
});
