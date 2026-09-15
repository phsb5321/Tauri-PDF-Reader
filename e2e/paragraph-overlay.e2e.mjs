/* global browser, $, $$, expect */

async function focusPublicControl(element) {
  for (let step = 0; step < 100; step += 1) {
    if (await element.isFocused()) return;
    await browser.keys(["Tab"]);
  }
  throw new Error(
    "paragraph action was unreachable through keyboard Tab order",
  );
}

async function paragraphGeometry() {
  return browser.execute(() => {
    const button = document.querySelector(
      'button[aria-label^="Read from paragraph"][aria-label*="This book aims"]',
    );
    const firstLine = Array.from(
      document.querySelectorAll(".textLayer span"),
    ).find((span) => span.textContent?.includes("This book aims"));
    const canvas = document.querySelector("canvas.pdf-canvas");
    const page = document.querySelector(".pdf-page-container");
    const selected = document.querySelector(".zoom-select option:checked");
    const tickElement = button?.querySelector(".paragraph-action-tick");
    const iconElement = button?.querySelector("svg");
    if (
      !button ||
      !firstLine ||
      !canvas ||
      !page ||
      !selected ||
      !tickElement ||
      !iconElement
    )
      return null;

    const action = button.getBoundingClientRect();
    const line = firstLine.getBoundingClientRect();
    const tickRect = tickElement.getBoundingClientRect();
    const iconRect = iconElement.getBoundingClientRect();
    const tick = getComputedStyle(tickElement);
    const icon = getComputedStyle(iconElement);
    return {
      label: button.getAttribute("aria-label"),
      title: button.getAttribute("title"),
      selectedLabel: selected.textContent?.trim(),
      committedZoom: Number(page.getAttribute("data-render-zoom")),
      maxBackingSide: Math.max(canvas.width, canvas.height),
      action: {
        right: action.right,
        width: action.width,
        height: action.height,
        centerY: action.top + action.height / 2,
      },
      line: { left: line.left, centerY: line.top + line.height / 2 },
      tick: {
        right: tickRect.right,
        width: tickRect.width,
        centerY: tickRect.top + tickRect.height / 2,
      },
      icon: {
        right: iconRect.right,
        width: iconRect.width,
        centerY: iconRect.top + iconRect.height / 2,
      },
      tickBackground: tick.backgroundColor,
      iconVisibility: icon.visibility,
    };
  });
}

function assertProfessionalMarginAction(geometry) {
  expect(geometry).not.toBeNull();
  expect(geometry.action.width).toBeGreaterThanOrEqual(44);
  expect(geometry.action.height).toBeGreaterThanOrEqual(44);
  expect(geometry.action.right).toBeLessThanOrEqual(geometry.line.left);
  expect(geometry.line.left - geometry.tick.right).toBeGreaterThanOrEqual(7);
  expect(geometry.line.left - geometry.tick.right).toBeLessThanOrEqual(17);
  expect(geometry.line.left - geometry.icon.right).toBeGreaterThanOrEqual(7);
  expect(geometry.line.left - geometry.icon.right).toBeLessThanOrEqual(17);
  expect(
    Math.abs(geometry.action.centerY - geometry.line.centerY),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(geometry.tick.centerY - geometry.line.centerY),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(geometry.icon.centerY - geometry.line.centerY),
  ).toBeLessThanOrEqual(1);
  expect(geometry.title).toBeNull();
  expect(geometry.tickBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.iconVisibility).toBe("hidden");
  expect(geometry.maxBackingSide).toBeLessThanOrEqual(8192);
}

describe("Packaged paragraph narration overlay", () => {
  it("stays professional, keyboard-visible, and non-overlapping at real PDF zooms", async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      {
        timeout: 30000,
        timeoutMsg: "native fixture bootstrap never became ready",
      },
    );
    await browser.setWindowSize(1200, 800);
    await browser.keys(["Control", "l"]);
    await browser.pause(250);
    if (!(await $(".pdf-page-container").isExisting())) {
      await browser.keys(["Control", "l"]);
    }
    await browser.waitUntil(
      async () => {
        const page = await $(".pdf-page-container");
        return (
          (await page.isExisting()) &&
          (await page.getAttribute("data-render-ready")) === "true"
        );
      },
      { timeout: 30000, timeoutMsg: "prosody fixture never rendered" },
    );
    const initialTargets = await browser.execute(() =>
      Array.from(
        document.querySelectorAll('button[aria-label^="Read from paragraph"]'),
      ).map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      }),
    );
    for (let index = 1; index < initialTargets.length; index += 1) {
      expect(initialTargets[index - 1].bottom).toBeLessThanOrEqual(
        initialTargets[index].top,
      );
    }

    for (const [value, label] of [
      ["1", "100%"],
      ["3", "300%"],
    ]) {
      await $(".zoom-select").selectByAttribute("value", value);
      await browser.waitUntil(
        async () => {
          const geometry = await paragraphGeometry();
          return (
            geometry?.selectedLabel === label &&
            Math.abs(geometry.committedZoom - Number(value)) < 0.0001
          );
        },
        {
          timeout: 30000,
          timeoutMsg: `${label} paragraph geometry never committed`,
        },
      );
      assertProfessionalMarginAction(await paragraphGeometry());
    }

    const action = await $(
      'button[aria-label^="Read from paragraph"][aria-label*="This book aims"]',
    );
    await focusPublicControl(action);
    const focused = await browser.execute(() => {
      const button = document.activeElement;
      const icon = button?.querySelector("svg");
      const firstLine = Array.from(
        document.querySelectorAll(".textLayer span"),
      ).find((span) => span.textContent?.includes("This book aims"));
      const style = getComputedStyle(button);
      const iconRect = icon?.getBoundingClientRect();
      const lineRect = firstLine?.getBoundingClientRect();
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        iconVisibility: icon ? getComputedStyle(icon).visibility : null,
        paintedGap:
          iconRect && lineRect ? lineRect.left - iconRect.right : null,
        paintedCenterDelta:
          iconRect && lineRect
            ? Math.abs(
                iconRect.top +
                  iconRect.height / 2 -
                  (lineRect.top + lineRect.height / 2),
              )
            : null,
      };
    });
    expect(focused.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(focused.iconVisibility).toBe("visible");
    expect(focused.paintedGap).toBeGreaterThanOrEqual(7);
    expect(focused.paintedGap).toBeLessThanOrEqual(17);
    expect(focused.paintedCenterDelta).toBeLessThanOrEqual(1);

    const allActions = await $$('button[aria-label^="Read from paragraph"]');
    expect(allActions.length).toBeGreaterThanOrEqual(2);
    expect(await allActions[0].getAttribute("aria-label")).toMatch(
      /^Read from paragraph 1:/,
    );
    expect(await allActions[1].getAttribute("aria-label")).toMatch(
      /^Read from paragraph 2:/,
    );

    if (process.env.PARAGRAPH_OVERLAY_EVIDENCE_DIR) {
      await browser.saveScreenshot(
        `${process.env.PARAGRAPH_OVERLAY_EVIDENCE_DIR}/paragraph-overlay-300.png`,
      );
    }
  });
});
