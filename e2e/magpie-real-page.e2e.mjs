/* global browser, $, expect */

async function openPerformance() {
  const settings = await $('button[aria-label="Settings"]');
  await settings.waitForClickable({ timeout: 10000 });
  await settings.click();
  const performance = await $("button*=Performance");
  await performance.waitForClickable({ timeout: 10000 });
  await performance.click();
  await $(".performance-settings").waitForDisplayed({ timeout: 10000 });
}

async function closeSettings() {
  await browser.keys(["Escape"]);
  await $(".settings-backdrop").waitForExist({ reverse: true, timeout: 5000 });
}

async function focusPublicControl(element) {
  for (let step = 0; step < 100; step += 1) {
    if (await element.isFocused()) return;
    await browser.keys(["Tab"]);
  }
  throw new Error("public control was unreachable through keyboard Tab order");
}

async function activatePublicControl(element, changed) {
  await element.click();
  await browser.pause(100);
  if (await changed()) return;
  await focusPublicControl(element);
  await browser.keys(["Enter"]);
}

describe("Magpie real-model page queue", () => {
  it("narrates bounded units on Vulkan and advances exactly once", async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "native bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);
    await browser.keys(["Control", "l"]);
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.provider() === "local" &&
            window.__E2E_READ__.connections().local === "connected" &&
            window.__E2E_READ__.playbackState() === "idle",
        ),
      {
        timeout: 20000,
        timeoutMsg: "Magpie local provider did not become idle",
      },
    );

    await openPerformance();
    const facts = await $(".performance-facts").getText();
    expect(facts).toContain("Magpie TTS Multilingual 357M");
    expect(facts).toContain("Vulkan/RADV");
    expect(facts).toContain("AMD Radeon RX 5700 XT");
    await closeSettings();

    const narrationSettings = await $(
      'button[aria-label="Narration settings"]',
    );
    await narrationSettings.waitForClickable({ timeout: 10000 });
    const cockpit = await $("#narration-cockpit");
    await activatePublicControl(narrationSettings, () => cockpit.isDisplayed());
    await cockpit.waitForDisplayed({ timeout: 10000 });
    const delivery = await $("#narration-tab-delivery");
    await delivery.waitForClickable({ timeout: 10000 });
    const deliveryPanel = await $("#narration-panel-delivery");
    await activatePublicControl(delivery, () => deliveryPanel.isDisplayed());
    await deliveryPanel.waitForDisplayed({ timeout: 10000 });
    const continuous = await $('input[value="continuous"]');
    await continuous.waitForEnabled({ timeout: 10000 });
    await browser.execute(() =>
      document.querySelector('input[value="continuous"]').focus(),
    );
    await browser.keys(["Space"]);
    await browser.waitUntil(() => continuous.isSelected(), {
      timeout: 5000,
      timeoutMsg: "Continuous profile did not become selected",
    });
    await browser.keys(["Escape"]);
    await $("#narration-cockpit").waitForExist({
      reverse: true,
      timeout: 5000,
    });

    const play = await $('.ai-playback-button[title="Play (Ctrl+Space)"]');
    await play.waitForEnabled({ timeout: 15000 });
    await browser.execute(() =>
      document
        .querySelector('.ai-playback-button[title="Play (Ctrl+Space)"]')
        .focus(),
    );
    const startedAt = Date.now();
    await browser.keys(["Enter"]);

    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const current = CSS.highlights?.get("tts-current-word");
          const source = [];
          current?.forEach((range) => source.push(range.toString()));
          return (
            window.__E2E_READ__.currentWordText() === "Reliable" &&
            source.includes("Reliable")
          );
        }),
      {
        timeout: 20000,
        interval: 50,
        timeoutMsg: "first Magpie unit never highlighted exact source text",
      },
    );

    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.currentPage() === 2),
      {
        timeout: 240000,
        interval: 200,
        timeoutMsg: "real Magpie queue did not naturally advance to page 2",
      },
    );

    // Public Escape maps to Stop. It must stay operable during the handoff and
    // invalidate the delayed page-two continuation scheduled by the advance.
    const stop = await $('.ai-playback-button[title="Stop (Esc)"]');
    await stop.waitForEnabled({ timeout: 5000 });
    await browser.keys(["Escape"]);
    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "idle"),
      { timeout: 10000, timeoutMsg: "public Stop did not return idle" },
    );
    await browser.pause(1500);
    expect(
      await browser.execute(() => window.__E2E_READ__.playbackState()),
    ).toBe("idle");
    expect(await browser.execute(() => window.__E2E_READ__.currentPage())).toBe(
      2,
    );
    expect(Date.now() - startedAt).toBeLessThan(240000);

    await openPerformance();
    await $(".performance-measurement").waitForDisplayed({ timeout: 10000 });
    const measurement = await $(".performance-measurement").getText();
    const rtf = Number.parseFloat(measurement.match(/([0-9.]+) RTF/u)?.[1]);
    expect(Number.isFinite(rtf)).toBe(true);
    expect(measurement).toContain(
      rtf <= 0.8
        ? "Sustains continuous playback"
        : "This sample may outrun the playback buffer",
    );
    await closeSettings();
  });
});
