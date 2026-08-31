import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/* global browser, $, $$, expect */

const PHASE = process.env.LIBRARY_COMPLETENESS_PHASE;
const OUT = process.env.LIBRARY_COMPLETENESS_OUT;
const REAL_TITLE = "Legacy readable book";
const MISSING_TITLE = "Missing book control";

function xdotool(...args) {
  return execFileSync("xdotool", args, { encoding: "utf8" }).trim();
}

function windowGeometry(id) {
  const fields = Object.fromEntries(
    xdotool("getwindowgeometry", "--shell", id)
      .split("\n")
      .map((line) => line.split("=")),
  );
  return {
    x: Number(fields.X),
    y: Number(fields.Y),
    width: Number(fields.WIDTH),
    height: Number(fields.HEIGHT),
  };
}

async function waitForXWindow(pid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const ids = xdotool("search", "--pid", String(pid)).split(/\s+/);
      for (const id of ids) {
        const geometry = windowGeometry(id);
        // dragon also maps a 10×10 GTK implementation window. It is not the
        // visible drag source and cannot emit Xdnd; pick the real file strip.
        if (geometry.width * geometry.height > 10_000) return id;
      }
    } catch {
      // The visible drag source has not mapped its window yet.
    }
    await delay(50);
  }
  throw new Error(`visible dragon-drop window for pid ${pid} did not appear`);
}

async function physicalFileDrag(filePath, onHover) {
  const appWindow = xdotool("search", "--name", "^Lectrice$").split(/\s+/)[0];
  if (!appWindow) throw new Error("Lectrice X11 window not found");
  xdotool("windowmove", appWindow, "400", "80");
  xdotool("windowsize", appWindow, "800", "800");

  const source = spawn("dragon-drop", [filePath], {
    env: process.env,
    stdio: "ignore",
  });
  const sourceWindow = await waitForXWindow(source.pid);
  xdotool("windowmove", sourceWindow, "40", "140");
  xdotool("windowraise", sourceWindow);
  const sourceGeometry = windowGeometry(sourceWindow);
  const appGeometry = windowGeometry(appWindow);
  const sourceX = Math.floor(sourceGeometry.width / 2);
  const sourceY = Math.floor(sourceGeometry.height / 2);
  const start = {
    x: sourceGeometry.x + sourceX,
    y: sourceGeometry.y + sourceY,
  };
  const end = {
    x: appGeometry.x + Math.floor(appGeometry.width / 2),
    y: appGeometry.y + Math.floor(appGeometry.height / 2),
  };
  const points = Array.from({ length: 12 }, (_, index) => {
    const progress = (index + 1) / 12;
    return `${Math.round(start.x + (end.x - start.x) * progress)} ${Math.round(start.y + (end.y - start.y) * progress)}`;
  })
    .map((point) => `'${point}'`)
    .join(" ");
  console.log(
    `OS_DRAG source=${sourceWindow} ${JSON.stringify(sourceGeometry)} target=${appWindow} ${JSON.stringify(appGeometry)}`,
  );

  const drag = spawn(
    "sh",
    [
      "-c",
      `set -eu; xdotool mousemove --window ${sourceWindow} ${sourceX} ${sourceY}; ` +
        `xdotool mousedown 1; sleep 0.4; ` +
        `for point in ${points}; do set -- $point; xdotool mousemove --sync "$1" "$2"; sleep 0.12; done; ` +
        `sleep 3; xdotool mouseup 1`,
    ],
    { env: process.env, stdio: "inherit" },
  );

  try {
    await onHover();
    await new Promise((resolve, reject) => {
      drag.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`xdotool drag exited ${code}`)),
      );
    });
  } finally {
    if (drag.exitCode === null) drag.kill("SIGTERM");
    if (source.exitCode === null) source.kill("SIGTERM");
  }
}

async function physicalWheel(button, modified, clientPoint = null) {
  const appWindow = xdotool("search", "--name", "^Lectrice$").split(/\s+/)[0];
  if (!appWindow) throw new Error("Lectrice X11 window not found");
  const geometry = windowGeometry(appWindow);
  const point = clientPoint ?? {
    x: Math.floor(geometry.width / 2),
    y: Math.floor(geometry.height / 2),
  };

  await browser.execute(() => {
    window.__E2E_LAST_POINTER__ = null;
    if (window.__E2E_POINTER_OBSERVER__) return;
    window.__E2E_POINTER_OBSERVER__ = true;
    window.addEventListener("mousemove", (event) => {
      window.__E2E_LAST_POINTER__ = { x: event.clientX, y: event.clientY };
    });
  });
  xdotool("windowraise", appWindow);
  xdotool("windowfocus", "--sync", appWindow);
  xdotool(
    "mousemove",
    "--window",
    appWindow,
    String(Math.round(point.x)),
    String(Math.round(point.y)),
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
  const corrected = {
    x: Math.round(point.x + (point.x - observed.x)),
    y: Math.round(point.y + (point.y - observed.y)),
  };
  xdotool(
    "mousemove",
    "--window",
    appWindow,
    String(corrected.x),
    String(corrected.y),
  );
  await browser.pause(50);
  const landed = await browser.execute(() => window.__E2E_LAST_POINTER__);
  expect(Math.abs(landed.x - point.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(landed.y - point.y)).toBeLessThanOrEqual(2);

  if (modified) xdotool("keydown", "ctrl");
  try {
    xdotool("click", String(button));
  } finally {
    if (modified) xdotool("keyup", "ctrl");
  }
}

async function zoomSnapshot(clientPoint = null) {
  return browser.execute((requestedPoint) => {
    const viewer = document.querySelector(".pdf-viewer");
    const page = document.querySelector(".pdf-page-container");
    const canvas = page?.querySelector("canvas.pdf-canvas");
    const text = page?.querySelector(".textLayer");
    const firstSpan = text?.querySelector("span");
    const selected = document.querySelector(".zoom-select option:checked");
    if (!viewer || !page || !canvas || !text || !firstSpan || !selected) {
      return null;
    }

    const viewerRect = viewer.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const spanRect = firstSpan.getBoundingClientRect();
    const actionRects = Array.from(
      page.querySelectorAll("button.paragraph-action-button"),
      (button) => button.getBoundingClientRect(),
    );
    const textRects = Array.from(text.querySelectorAll("span"), (span) =>
      span.getBoundingClientRect(),
    );
    const intersectionCount = actionRects.reduce(
      (count, action) =>
        count +
        textRects.filter(
          (line) =>
            Math.min(action.right, line.right) >
              Math.max(action.left, line.left) &&
            Math.min(action.bottom, line.bottom) >
              Math.max(action.top, line.top),
        ).length,
      0,
    );
    const point = requestedPoint ?? {
      x: Math.max(
        pageRect.left,
        Math.min(pageRect.right, viewerRect.left + viewerRect.width / 2),
      ),
      y: Math.max(
        pageRect.top,
        Math.min(pageRect.bottom, viewerRect.top + viewerRect.height / 2),
      ),
    };

    return {
      point,
      ready: page.getAttribute("data-render-ready"),
      committedZoom: Number(page.getAttribute("data-render-zoom")),
      selectedLabel: selected.textContent?.trim() ?? "",
      selectedValue: selected.value,
      selectedCount: document.querySelectorAll(".zoom-select option:checked")
        .length,
      intersectionCount,
      viewer: {
        left: viewerRect.left,
        top: viewerRect.top,
        width: viewerRect.width,
        height: viewerRect.height,
      },
      page: {
        left: pageRect.left,
        top: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
      },
      canvas: {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        previewTransform: canvas.style.transform,
      },
      text: {
        left: textRect.left,
        top: textRect.top,
        width: textRect.width,
        height: textRect.height,
        scale: getComputedStyle(text).getPropertyValue("--scale-factor").trim(),
        previewTransform: text.style.transform,
      },
      span: {
        x: (spanRect.left - canvasRect.left) / canvasRect.width,
        y: (spanRect.top - canvasRect.top) / canvasRect.height,
      },
      anchor: {
        x: (point.x - pageRect.left) / pageRect.width,
        y: (point.y - pageRect.top) / pageRect.height,
      },
      scroll: {
        left: viewer.scrollLeft,
        top: viewer.scrollTop,
        width: viewer.scrollWidth,
        height: viewer.scrollHeight,
        clientWidth: viewer.clientWidth,
        clientHeight: viewer.clientHeight,
      },
    };
  }, clientPoint);
}

async function cardByTitle(title) {
  const cards = await $$(".document-card");
  for (const card of cards) {
    const text = await card
      .$(".document-card-title")
      .getAttribute("textContent");
    if (text?.trim() === title) return card;
  }
  return null;
}

async function coverReceipt(card) {
  const cover = await card.$(".document-cover");
  const cardAction = await card.$(".document-card-open");
  return {
    state: await cover.getAttribute("data-state"),
    cardAccessibleName: await cardAction.getAttribute("aria-label"),
  };
}

describe("packaged legacy library completeness", () => {
  it(`phase=${PHASE}`, async function () {
    this.timeout(120000);
    await browser.waitUntil(
      async () => (await browser.getTitle()) === "Lectrice",
      {
        timeout: 30000,
        timeoutMsg: "Lectrice window did not become ready",
      },
    );

    if (PHASE === "bootstrap") {
      await browser.waitUntil(
        async () => await $(".library-view").isExisting(),
        { timeout: 30000, timeoutMsg: "library did not mount" },
      );
      return;
    }

    expect(["verify", "reader", "drop"]).toContain(PHASE);
    await browser.waitUntil(
      async () => (await $$(".document-card")).length === 2,
      { timeout: 30000, timeoutMsg: "two legacy cards did not render" },
    );

    const real = await cardByTitle(REAL_TITLE);
    expect(real).not.toBeNull();

    if (PHASE === "drop") {
      const hover = async () => {
        const overlay = await $(".pdf-drop-overlay");
        await overlay.waitForDisplayed({
          timeout: 10000,
          timeoutMsg: "real OS drag did not expose the public PDF drop target",
        });
        expect(await overlay.getAttribute("aria-label")).toBe(
          "Drop one PDF to create a reading session",
        );
        await browser.saveScreenshot(`${process.env.RUN_ROOT}/drop-hover.png`);
      };

      await physicalFileDrag(process.env.SOURCE, hover);
      const viewer = await $(".pdf-viewer");
      await viewer.waitForDisplayed({
        timeout: 30000,
        timeoutMsg: "dropped PDF did not open in the reader",
      });
      const status = await $(".library-drop-status");
      await status.waitForDisplayed({
        timeout: 30000,
        timeoutMsg: "session-created status did not appear",
      });
      expect(await status.getAttribute("aria-label")).toBe(
        "Session “Legacy readable book” created",
      );

      await browser.setWindowSize(1200, 800);
      await browser.waitUntil(
        async () => (await zoomSnapshot())?.ready === "true",
        { timeout: 30000, timeoutMsg: "initial PDF geometry never committed" },
      );
      const zoomBefore = await zoomSnapshot();
      expect(zoomBefore).not.toBeNull();

      await physicalWheel(4, true, zoomBefore.point);
      await browser.waitUntil(
        async () => {
          const snapshot = await zoomSnapshot(zoomBefore.point);
          return (
            snapshot?.ready === "true" &&
            snapshot.committedZoom > zoomBefore.committedZoom
          );
        },
        {
          timeout: 30000,
          timeoutMsg:
            "Ctrl+wheel-up changed state but never committed PDF geometry",
        },
      );
      const zoomAfter = await zoomSnapshot(zoomBefore.point);
      expect(zoomAfter).not.toBeNull();

      const ratio = zoomAfter.committedZoom / zoomBefore.committedZoom;
      expect(
        Math.abs(zoomAfter.canvas.width - zoomBefore.canvas.width * ratio),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(zoomAfter.canvas.height - zoomBefore.canvas.height * ratio),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(zoomAfter.canvas.left - zoomAfter.text.left),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(zoomAfter.canvas.top - zoomAfter.text.top),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(zoomAfter.canvas.width - zoomAfter.text.width),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(zoomAfter.canvas.height - zoomAfter.text.height),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.max(zoomAfter.canvas.backingWidth, zoomAfter.canvas.backingHeight),
      ).toBeLessThanOrEqual(8192);
      expect(zoomAfter.canvas.previewTransform).toBe("");
      expect(zoomAfter.text.previewTransform).toBe("");
      expect(Number(zoomAfter.text.scale)).toBeCloseTo(
        zoomAfter.committedZoom,
        3,
      );
      expect(Number(zoomAfter.selectedLabel.match(/(\d+)%$/)?.[1])).toBe(
        Math.round(zoomAfter.committedZoom * 100),
      );
      expect(
        Math.abs(zoomAfter.span.x - zoomBefore.span.x),
      ).toBeLessThanOrEqual(0.005);
      expect(
        Math.abs(zoomAfter.span.y - zoomBefore.span.y),
      ).toBeLessThanOrEqual(0.005);
      const pointerAnchorDeltaPixels = {
        x:
          Math.abs(zoomAfter.anchor.x - zoomBefore.anchor.x) *
          zoomAfter.page.width,
        y:
          Math.abs(zoomAfter.anchor.y - zoomBefore.anchor.y) *
          zoomAfter.page.height,
      };
      expect(pointerAnchorDeltaPixels.x).toBeLessThanOrEqual(2);
      expect(pointerAnchorDeltaPixels.y).toBeLessThanOrEqual(2);
      expect(zoomAfter.scroll.width).toBeGreaterThanOrEqual(
        zoomAfter.page.width,
      );
      expect(zoomAfter.scroll.height).toBeGreaterThanOrEqual(
        zoomAfter.page.height,
      );

      await physicalWheel(5, false, zoomAfter.point);
      await delay(300);
      expect((await zoomSnapshot(zoomAfter.point)).committedZoom).toBe(
        zoomAfter.committedZoom,
      );

      const zoomSelect = await $(".zoom-select");
      const zoomStates = [];
      let baseline = null;
      for (const targetZoom of [1, 2, 2.8, 3.3, 4]) {
        const before = await zoomSnapshot();
        await zoomSelect.selectByAttribute("value", String(targetZoom));
        await browser.waitUntil(
          async () => {
            const snapshot = await zoomSnapshot(before.point);
            return (
              snapshot?.ready === "true" &&
              Math.abs(snapshot.committedZoom - targetZoom) < 0.0001
            );
          },
          {
            timeout: 30000,
            timeoutMsg: `${targetZoom * 100}% did not produce a real zoom commit`,
          },
        );
        const snapshot = await zoomSnapshot(before.point);
        if (targetZoom === 1) baseline = snapshot;
        expect(baseline).not.toBeNull();
        expect(snapshot.selectedCount).toBe(1);
        expect(snapshot.selectedValue).toBe(String(targetZoom));
        expect(snapshot.selectedLabel).toBe(`${Math.round(targetZoom * 100)}%`);
        expect(snapshot.intersectionCount).toBe(0);
        expect(
          Math.abs(snapshot.page.width - baseline.page.width * targetZoom),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(snapshot.page.height - baseline.page.height * targetZoom),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(snapshot.canvas.width - snapshot.page.width),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(snapshot.canvas.height - snapshot.page.height),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(snapshot.text.width - snapshot.page.width),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(snapshot.text.height - snapshot.page.height),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.max(snapshot.canvas.backingWidth, snapshot.canvas.backingHeight),
        ).toBeLessThanOrEqual(8192);
        expect(snapshot.canvas.previewTransform).toBe("");
        expect(snapshot.text.previewTransform).toBe("");
        expect(Number(snapshot.text.scale)).toBeCloseTo(targetZoom, 3);
        const anchorDeltaPixels = {
          x:
            Math.abs(snapshot.anchor.x - before.anchor.x) * snapshot.page.width,
          y:
            Math.abs(snapshot.anchor.y - before.anchor.y) *
            snapshot.page.height,
        };
        expect(anchorDeltaPixels.x).toBeLessThanOrEqual(2);
        expect(anchorDeltaPixels.y).toBeLessThanOrEqual(2);
        expect(snapshot.scroll.width).toBeGreaterThanOrEqual(
          snapshot.page.width,
        );
        expect(snapshot.scroll.height).toBeGreaterThanOrEqual(
          snapshot.page.height,
        );
        zoomStates.push({
          committed: snapshot.committedZoom,
          label: snapshot.selectedLabel,
          page: { width: snapshot.page.width, height: snapshot.page.height },
          canvas: {
            width: snapshot.canvas.width,
            height: snapshot.canvas.height,
            backingWidth: snapshot.canvas.backingWidth,
            backingHeight: snapshot.canvas.backingHeight,
          },
          text: { width: snapshot.text.width, height: snapshot.text.height },
          anchorDeltaPixels,
          intersectionCount: snapshot.intersectionCount,
        });
      }
      const highZoom = await zoomSnapshot();
      expect(highZoom.committedZoom).toBe(4);
      expect(highZoom.scroll.width).toBeGreaterThan(
        highZoom.scroll.clientWidth,
      );
      expect(highZoom.scroll.height).toBeGreaterThan(
        highZoom.scroll.clientHeight,
      );
      const edgeReachability = await browser.execute(() => {
        const viewer = document.querySelector(".pdf-viewer");
        const page = document.querySelector(".pdf-page-container");
        if (!viewer || !page) return null;
        viewer.scrollLeft = 0;
        viewer.scrollTop = 0;
        const startViewer = viewer.getBoundingClientRect();
        const startPage = page.getBoundingClientRect();
        viewer.scrollLeft = viewer.scrollWidth;
        viewer.scrollTop = viewer.scrollHeight;
        const endViewer = viewer.getBoundingClientRect();
        const endPage = page.getBoundingClientRect();
        return {
          leftDelta: startPage.left - startViewer.left,
          topDelta: startPage.top - startViewer.top,
          rightDelta: endViewer.right - endPage.right,
          bottomDelta: endViewer.bottom - endPage.bottom,
        };
      });
      expect(edgeReachability).not.toBeNull();
      expect(edgeReachability.leftDelta).toBeGreaterThanOrEqual(-1);
      expect(edgeReachability.topDelta).toBeGreaterThanOrEqual(-1);
      expect(edgeReachability.rightDelta).toBeGreaterThanOrEqual(-1);
      expect(edgeReachability.bottomDelta).toBeGreaterThanOrEqual(-1);

      await browser.setWindowSize(640, 800);
      const readerNarrow = await browser.execute(() => {
        const toolbar = document
          .querySelector(".toolbar")
          ?.getBoundingClientRect();
        return {
          viewport: window.innerWidth,
          toolbar: toolbar
            ? { x: toolbar.x, right: toolbar.right, width: toolbar.width }
            : null,
          shellNames: Array.from(
            document.querySelectorAll("button.toolbar-roving-item"),
          ).map((button) => button.getAttribute("aria-label")),
        };
      });
      expect(readerNarrow.viewport).toBeGreaterThanOrEqual(600);
      expect(readerNarrow.viewport).toBeLessThanOrEqual(640);
      expect(readerNarrow.toolbar?.x).toBeGreaterThanOrEqual(-1);
      expect(readerNarrow.toolbar?.right).toBeLessThanOrEqual(
        readerNarrow.viewport + 1,
      );
      expect(readerNarrow.shellNames).toEqual([
        "Back to library",
        "Chapters",
        "Sessions",
        "Open PDF",
        "Settings",
      ]);
      await browser.saveScreenshot(`${process.env.RUN_ROOT}/drop-success.png`);
      await status.$("button").click();

      const chaptersAction = await $('button[aria-label="Chapters"]');
      await chaptersAction.waitForClickable({ timeout: 10000 });
      await chaptersAction.click();
      const contentsDialog = await $('dialog[aria-labelledby="toc-title"]');
      await contentsDialog.waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "visible Chapters action did not open the PDF outline",
      });
      await contentsDialog
        .$('button[aria-label="Close table of contents"]')
        .click();
      await contentsDialog.waitForDisplayed({ reverse: true, timeout: 10000 });

      const libraryAction = await $('button[aria-label="Back to library"]');
      await libraryAction.waitForClickable({ timeout: 10000 });
      await libraryAction.click();
      await $(".library-view").waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "visible Back to library action did not return home",
      });

      await physicalFileDrag(process.env.NON_PDF, hover);
      const alert = await $(".library-error-banner");
      await alert.waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "invalid drop did not expose a public error",
      });
      expect(await alert.getText()).toContain("DROP_INVALID");

      const sessions = await $("button.sessions-button");
      await sessions.click();
      const menu = await $(".session-menu");
      await menu.waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "Sessions panel did not open after the drop",
      });
      expect(await menu.getText()).toContain("Active session");
      const activeRow = await menu.$(
        '.session-item__row[aria-selected="true"]',
      );
      await activeRow.waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "created session is not visibly selected",
      });
      expect(
        (
          await activeRow.$(".list-row__primary").getAttribute("textContent")
        )?.trim(),
      ).toBe("Legacy readable book");
      await browser.saveScreenshot(
        `${process.env.RUN_ROOT}/drop-active-session.png`,
      );

      const receipt = JSON.parse(fs.readFileSync(OUT, "utf8"));
      receipt.dropSession = {
        target: "Drop one PDF to create a reading session",
        status: "Session “Legacy readable book” created",
        invalidError: "DROP_INVALID",
        viewerDisplayed: true,
        chaptersSurface: true,
        ctrlWheel: {
          before: zoomBefore.committedZoom,
          after: zoomAfter.committedZoom,
          exactLabel: zoomAfter.selectedLabel,
          anchorDeltaPixels: pointerAnchorDeltaPixels,
          ordinaryWheelPreservedZoom: true,
        },
        zoomStates,
        highZoom: {
          committed: highZoom.committedZoom,
          label: highZoom.selectedLabel,
          maxBackingSide: Math.max(
            highZoom.canvas.backingWidth,
            highZoom.canvas.backingHeight,
          ),
          edgeReachability,
        },
        returnedToLibrary: true,
        activeSession: "Legacy readable book",
        readerNarrow,
      };
      fs.writeFileSync(OUT, `${JSON.stringify(receipt, null, 2)}\n`);
      return;
    }

    if (PHASE === "reader") {
      await real.scrollIntoView();
      await real.$(".document-card-open").doubleClick();
      const viewer = await $(".pdf-viewer");
      await viewer.waitForDisplayed({
        timeout: 30000,
        timeoutMsg: "legacy book did not open on the reader surface",
      });
      const readerSettings = await $('button[aria-label="Settings"]');
      await readerSettings.waitForClickable({ timeout: 15000 });
      await readerSettings.click();
      await $('dialog[aria-labelledby="settings-title"]').waitForDisplayed({
        timeout: 10000,
        timeoutMsg: "reader toolbar Settings did not open the dialog",
      });
      const receipt = JSON.parse(fs.readFileSync(OUT, "utf8"));
      receipt.readerSettings = { viewerDisplayed: true, dialogDisplayed: true };
      fs.writeFileSync(OUT, `${JSON.stringify(receipt, null, 2)}\n`);
      return;
    }

    const missing = await cardByTitle(MISSING_TITLE);
    expect(missing).not.toBeNull();

    await browser.waitUntil(
      async () => {
        const states = await Promise.all(
          [real, missing].map(
            async (card) =>
              await card.$(".document-cover").getAttribute("data-state"),
          ),
        );
        return states.every((state) => state !== "loading");
      },
      { timeout: 30000, timeoutMsg: "cover states never settled" },
    );

    const titles = [];
    for (const card of [real, missing]) {
      await card.scrollIntoView();
      const title = await card.$(".document-card-title");
      await title.waitForDisplayed({ timeout: 10000 });
      titles.push({
        text: (await title.getAttribute("textContent"))?.trim() ?? "",
        displayed: await title.isDisplayed(),
        rect: {
          x: await title.getLocation("x"),
          y: await title.getLocation("y"),
          width: await title.getSize("width"),
          height: await title.getSize("height"),
        },
      });
    }
    const realCover = await coverReceipt(real);
    const missingCover = await coverReceipt(missing);
    const receipt = { titles, realCover, missingCover };
    console.log(`LIBRARY_COMPLETENESS ${JSON.stringify(receipt)}`);
    fs.writeFileSync(OUT, `${JSON.stringify(receipt, null, 2)}\n`);

    expect(
      titles.every((title) => title.displayed && title.text.length > 0),
    ).toBe(true);
    expect(realCover.state).toBe("ready");
    expect(realCover.cardAccessibleName).toContain(REAL_TITLE);
    expect(missingCover.state).toBe("fallback");
    expect(missingCover.cardAccessibleName).toContain(MISSING_TITLE);

    const settings = await $('button[aria-label="Settings"]');
    await settings.waitForClickable({
      timeout: 15000,
      timeoutMsg: "visible Settings toolbar action is missing",
    });
    await settings.click();
    const dialog = await $('dialog[aria-labelledby="settings-title"]');
    await dialog.waitForDisplayed({
      timeout: 10000,
      timeoutMsg: "Settings action did not open the existing dialog",
    });
  });
});
