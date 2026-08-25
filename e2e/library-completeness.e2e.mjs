import fs from "node:fs";

/* global browser, $, $$, expect */

const PHASE = process.env.LIBRARY_COMPLETENESS_PHASE;
const OUT = process.env.LIBRARY_COMPLETENESS_OUT;
const REAL_TITLE = "Legacy readable book";
const MISSING_TITLE = "Missing book control";

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
    await browser.waitUntil(async () => (await browser.getTitle()) === "Lectrice", {
      timeout: 30000,
      timeoutMsg: "Lectrice window did not become ready",
    });

    if (PHASE === "bootstrap") {
      await browser.waitUntil(
        async () => (await $(".library-view").isExisting()),
        { timeout: 30000, timeoutMsg: "library did not mount" },
      );
      return;
    }

    expect(PHASE).toBe("verify");
    await browser.waitUntil(
      async () => (await $$(".document-card")).length === 2,
      { timeout: 30000, timeoutMsg: "two legacy cards did not render" },
    );

    const real = await cardByTitle(REAL_TITLE);
    const missing = await cardByTitle(MISSING_TITLE);
    expect(real).not.toBeNull();
    expect(missing).not.toBeNull();

    await browser.waitUntil(
      async () => {
        const states = await Promise.all(
          [real, missing].map(async (card) =>
            (await card.$(".document-cover").getAttribute("data-state")),
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

    expect(titles.every((title) => title.displayed && title.text.length > 0)).toBe(true);
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
