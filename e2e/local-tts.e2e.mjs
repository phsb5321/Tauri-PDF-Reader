/* global browser, $, expect */

// Runs in the WebdriverIO Node process, NOT inside browser.execute/WebKit. The
// production CSP therefore stays closed; this observer reads only the hermetic
// fixture's request ledger and performs no action in the app.
const readFixtureRequests = () =>
  globalThis
    .fetch("http://127.0.0.1:5301/requests")
    .then((response) => response.json());

async function openPerformance() {
  const settings = await $('button[aria-label="Settings"]');
  await settings.waitForClickable({ timeout: 10000 });
  await settings.click();
  const performance = await $("button*=Performance");
  await performance.waitForClickable({ timeout: 10000 });
  await performance.click();
  await $(".performance-settings").waitForDisplayed({ timeout: 10000 });
}

describe("Local TTS (native config → Rust HTTP → WAV playback)", () => {
  it("plays through local sentence audio with an estimated read-along", async () => {
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

    await openPerformance();
    expect(await $(".performance-facts").getText()).toContain(
      "Magpie TTS Multilingual 357M",
    );
    expect(await $(".performance-facts").getText()).toContain(
      "Vulkan/RADV fixture",
    );
    expect(await $(".performance-facts").getText()).toContain("Fixture GPU");
    const continuous = await $('input[value="continuous"]');
    await continuous.click();
    expect(await continuous.isSelected()).toBe(true);
    await $(".settings-close").click();

    await openPerformance();
    expect(await $('input[value="continuous"]').isSelected()).toBe(true);
    await $(".settings-close").click();

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
    // WebKitWebDriver's pointer click is observed as a document mouseup outside
    // the page and can miss React activation. Focus the same public Play button
    // and activate it with Enter — the keyboard-reachable user path, with no
    // store/IPC action performed by observer instrumentation.
    await browser.execute(() =>
      document.querySelector(".ai-playback-button").focus(),
    );
    await browser.keys(["Enter"]);
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

    const stop = await $('button[title="Stop (Esc)"]');
    await stop.waitForEnabled({ timeout: 5000 });
    await browser.execute(() =>
      document.querySelector('button[title="Stop (Esc)"]').click(),
    );
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

    expect(Date.now() - playbackStartedAt).toBeLessThan(15000);

    await openPerformance();
    await $(".performance-measurement").waitForDisplayed({ timeout: 10000 });
    expect(await $(".performance-measurement").getText()).toContain("RTF");
    expect(await $(".performance-measurement").getText()).toContain(
      "Sustains continuous playback",
    );
    await $(".settings-close").click();

    const completed = await readFixtureRequests();
    expect(completed.requests.map((request) => request.body.input)).toEqual([
      "What This Book Is About.",
      "This book aims to fill a gap. It connects the dots. Readers benefit.",
    ]);
  });
});
