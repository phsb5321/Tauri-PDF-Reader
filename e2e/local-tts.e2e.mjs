/* global browser, $, expect */

// Runs in the WebdriverIO Node process, NOT inside browser.execute/WebKit. The
// production CSP therefore stays closed; this observer reads only the hermetic
// fixture's request ledger and performs no action in the app.
const readFixtureRequests = () =>
  globalThis
    .fetch("http://127.0.0.1:5301/requests")
    .then((response) => response.json());

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

    await browser.execute(() =>
      document.querySelector(".ai-playback-button").click(),
    );

    await browser.waitUntil(
      async () => {
        const body = await readFixtureRequests();
        return body.requests.length >= 1;
      },
      {
        timeout: 15000,
        timeoutMsg: "local fixture received no synthesis request",
      },
    );
    const receipt = await readFixtureRequests();
    expect(receipt.requests[0].body.voice).toBe("F1-pt");
    expect(receipt.requests[0].body.input).toMatch(/alpha|lectrice|fixture/i);
    expect(receipt.requests[0].idempotencyKey).toMatch(/^[0-9a-f]{64}$/);

    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            window.__E2E_READ__.wordCount() > 0 &&
            window.__E2E_READ__.isActive() &&
            document.querySelector(".ai-playback-progress") !== null &&
            CSS.highlights?.has("tts-current-word") === true,
        ),
      {
        timeout: 15000,
        timeoutMsg: "estimated local read-along did not become active",
      },
    );

    expect(
      await browser.execute(
        () => document.querySelector(".tts-word-debug") === null,
      ),
    ).toBe(true);

    await browser.waitUntil(
      async () =>
        browser.execute(() => window.__E2E_READ__.playbackState() === "idle"),
      { timeout: 15000, timeoutMsg: "WAV sink did not finish back at idle" },
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
  });
});
