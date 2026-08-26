/* global browser, $, $$, expect */

const ELEVEN_KEY = process.env.E2E_ELEVEN_KEY;
const GROQ_KEY = process.env.E2E_GROQ_KEY;
const EVIDENCE_DIR = process.env.E2E_CONNECTIONS_EVIDENCE_DIR;

async function readObserver(expression, ...args) {
  return browser.execute(expression, ...args);
}

async function chooseConnection(name) {
  const buttons = await $$(".ai-tts-connection-select");
  for (const button of buttons) {
    if ((await button.getText()).startsWith(name)) {
      await button.waitForClickable({ timeout: 10000 });
      await browser.execute((element) => element.click(), button);
      return;
    }
  }
  throw new Error(`connection control not found: ${name}`);
}

async function connectCloud(name, inputSelector, key) {
  await chooseConnection(name);
  const input = await $(inputSelector);
  await input.waitForDisplayed({ timeout: 10000 });
  await input.setValue(key);
  const submit = await $('.ai-tts-settings-form button[type="submit"]');
  await submit.waitForEnabled({ timeout: 10000 });
  await browser.execute((element) => element.click(), submit);
  await browser.waitUntil(
    async () =>
      (await readObserver(
        (provider) => window.__E2E_READ__.connections()[provider],
        name.toLowerCase(),
      )) === "connected",
    { timeout: 15000, timeoutMsg: `${name} did not become connected` },
  );
}

async function stopPlayback() {
  const stop = await $('button[title="Stop (Esc)"]');
  await stop.waitForClickable({ timeout: 10000 });
  await browser.execute((element) => element.click(), stop);
  await browser.waitUntil(
    async () =>
      (await readObserver(() => window.__E2E_READ__.playbackState())) ===
      "idle",
    { timeout: 10000, timeoutMsg: "playback did not stop before provider switch" },
  );
}

async function playAndExpectRoute(provider, expectedCount) {
  const play = await $('button[title="Play (Ctrl+Space)"]');
  await play.waitForClickable({ timeout: 10000 });
  await browser.execute((element) => element.click(), play);
  await browser.waitUntil(
    async () =>
      (await readObserver(
        (route) => window.__E2E_READ__.providerRoutes()[route] || 0,
        provider,
      )) === expectedCount,
    {
      timeout: 10000,
      timeoutMsg: `${provider} route count did not reach ${expectedCount}`,
    },
  );
  await browser.waitUntil(
    async () =>
      (await readObserver(() => window.__E2E_READ__.wordCount())) > 0,
    { timeout: 10000, timeoutMsg: `${provider} produced no read-along marks` },
  );
}

describe("multiple TTS connections", () => {
  it("connects cloud routes, switches from public controls, and routes only to the active provider", async () => {
    expect(ELEVEN_KEY).toBeTruthy();
    expect(GROQ_KEY).toBeTruthy();

    await browser.waitUntil(
      async () =>
        readObserver(() => Boolean(window.__E2E_READ__?.ready)),
      { timeout: 40000, timeoutMsg: "native bootstrap did not become ready" },
    );
    await browser.setWindowSize(1200, 800);
    // The narration hook lives on the reader surface; enter through the public
    // Library command before waiting for config-owned Local TTS initialization.
    await browser.keys(["Control", "l"]);
    await browser.waitUntil(
      async () =>
        (await readObserver(
          () => window.__E2E_READ__.connections().local,
        )) === "connected",
      { timeout: 20000, timeoutMsg: "configured Local TTS did not connect" },
    );
    expect(await readObserver(() => window.__E2E_READ__.provider())).toBe(
      "local",
    );

    const settingsButton = await $('button[aria-label="Voice settings"]');
    await settingsButton.waitForClickable({ timeout: 15000 });
    await browser.execute((element) => element.click(), settingsButton);
    await $(".ai-tts-settings").waitForDisplayed({ timeout: 10000 });

    await connectCloud(
      "ElevenLabs",
      'input[aria-describedby="elevenlabs-egress-disclosure"]',
      ELEVEN_KEY,
    );
    await connectCloud(
      "Groq",
      'input[aria-describedby="groq-egress-disclosure"]',
      GROQ_KEY,
    );

    await browser.waitUntil(
      async () =>
        (await readObserver(() => window.__E2E_READ__.provider())) === "groq",
      { timeout: 10000, timeoutMsg: "Groq did not become active after connect" },
    );
    expect(await readObserver(() => window.__E2E_READ__.connections())).toEqual({
      local: "connected",
      elevenlabs: "connected",
      groq: "connected",
    });

    const close = await $('button[aria-label="Close AI TTS settings"]');
    await browser.execute((element) => element.click(), close);
    const selector = await $('select[aria-label="Narration connection"]');
    await selector.waitForDisplayed({ timeout: 10000 });
    expect(await selector.$$("option")).toHaveLength(3);

    await playAndExpectRoute("groq", 1);
    await stopPlayback();

    await selector.selectByAttribute("value", "elevenlabs");
    await browser.waitUntil(
      async () =>
        (await readObserver(() => window.__E2E_READ__.provider())) ===
        "elevenlabs",
      { timeout: 10000, timeoutMsg: "dock selector did not activate ElevenLabs" },
    );
    await playAndExpectRoute("elevenlabs", 1);
    await stopPlayback();

    await selector.selectByAttribute("value", "local");
    await browser.waitUntil(
      async () =>
        (await readObserver(() => window.__E2E_READ__.provider())) === "local",
      { timeout: 10000, timeoutMsg: "dock selector did not reactivate Local TTS" },
    );
    await playAndExpectRoute("local", 1);
    await stopPlayback();

    const receipt = await readObserver(
      (secrets) => ({
        active: window.__E2E_READ__.provider(),
        connections: window.__E2E_READ__.connections(),
        routes: window.__E2E_READ__.providerRoutes(),
        storageContainsSecret: Object.values(localStorage).some((value) =>
          secrets.some((secret) => String(value).includes(secret)),
        ),
        logsContainSecret: window.__E2E_READ__
          .logs()
          .some((line) => secrets.some((secret) => line.includes(secret))),
      }),
      [ELEVEN_KEY, GROQ_KEY],
    );
    expect(receipt).toEqual({
      active: "local",
      connections: {
        local: "connected",
        elevenlabs: "connected",
        groq: "connected",
      },
      routes: { local: 1, elevenlabs: 1, groq: 1 },
      storageContainsSecret: false,
      logsContainSecret: false,
    });
    console.log(`TTS_CONNECTIONS_RECEIPT ${JSON.stringify(receipt)}`);
    if (EVIDENCE_DIR) {
      await browser.saveScreenshot(`${EVIDENCE_DIR}/connections-active-local.png`);
    }
  });
});
