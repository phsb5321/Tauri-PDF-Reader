/**
 * Packaged real-book corpus journey (tauri-driver + WebdriverIO).
 *
 * Gates the REAL-BOOK claims through the packaged app, one book per run:
 *
 *   CORPUS_PHASE=open    — actor clicks Toolbar Open; the seam returns the
 *                          real book path (VITE_E2E_OPEN_PATH, built in);
 *                          the reader must render the book's first page
 *                          (real text layer spans, non-fixture), then the
 *                          actor clicks Next and the RENDERED page must move
 *                          to 2. Cover claim: if the DocumentCover surface
 *                          exists in this build, assert a real cover image
 *                          (naturalWidth > 0); if it does NOT exist (main
 *                          pre-121), record BLOCKED — never a silent pass.
 *   CORPUS_PHASE=verify  — app relaunches on the same profile; the library
 *                          row must show the persisted page (2 of N, %);
 *                          resume lands on RENDERED page 2; then the actor
 *                          deletes the book via the card's public delete
 *                          control; the library must be empty and the
 *                          observer must see no leftover cached cover/audio
 *                          for that document id.
 *
 * The seam (VITE_E2E_OPEN_PATH) is the WebDriver-impossible GTK dialog; the
 * ACTOR clicks the real control, the real handler chain runs below it.
 * `window.__E2E_READ__` is read-only observer instrumentation.
 *
 * Environment per run:
 *   E2E_SPEC=./e2e/corpus-journey.e2e.mjs
 *   CORPUS_PHASE=open|verify
 *   CORPUS_BASENAME=<book file name>          (for DIAG + failure records)
 *   CORPUS_SHA=<sha256 of the book>           (for DIAG + failure records)
 *   CORPUS_PAGES=<expected page count>        (assertion target, from manifest)
 * against a binary built --features e2e-tts-fixture and a frontend built
 * with VITE_E2E_NATIVE=true and VITE_E2E_OPEN_PATH=<real book path> —
 * see e2e/run-corpus-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.CORPUS_PHASE || "open";
const BASENAME = process.env.CORPUS_BASENAME || "(unnamed)";
const SHA = process.env.CORPUS_SHA || "(unset)";
const PAGES = Number(process.env.CORPUS_PAGES || "0");

const BOOK = { basename: BASENAME, sha: SHA, pages: PAGES };

// The library row title is the file stem (backend derives it via
// Path::file_stem in library_add_document); the resume button's aria-label
// is "Resume {title}, page …". The runner passes the full basename, so the
// stem is derived here — same rule the backend applies.
const TITLE = BASENAME.replace(/\.pdf$/i, "");

if (PHASE === "corrupt-control") {
  // NEGATIVE CONTROL #2: a corrupt .pdf (garbage bytes) must surface an
  // explicit error after a bounded settle — the open flow must fail
  // visibly, never silently stay on the library.
  describe(`Packaged corpus negative control — ${BASENAME} (corrupt)`, () => {
    it("corrupt-control: a corrupt pdf surfaces an explicit error", async () => {
      await browser.waitUntil(
        async () =>
          browser.execute(
            () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
          ),
        { timeout: 60000, timeoutMsg: "bootstrap never became ready" },
      );
      await browser.setWindowSize(1200, 800);

      const openBtn = await $("button.open-button");
      await openBtn.waitForExist({ timeout: 15000 });
      await openBtn.waitForClickable({ timeout: 15000 });
      await browser.execute(() =>
        document.querySelector("button.open-button")?.click(),
      );

      const settleStart = Date.now();
      let verdict = null;
      while (Date.now() - settleStart < 10000) {
        verdict = await browser.execute(() => {
          const err = document.querySelector(
            ".pdf-viewer-error, [class*='error']:not([class*='error-hidden'])",
          );
          const readerMounted = !!document.querySelector(
            "input[aria-label='Current page']",
          );
          const errText = err && (err.textContent || "").trim();
          if (readerMounted) return { ok: false, reason: "reader mounted on corrupt file" };
          if (errText && errText.length > 0) return { ok: true, reason: errText.slice(0, 200) };
          return null;
        });
        if (verdict) break;
        await browser.pause(500);
      }
      if (!verdict || !verdict.ok) {
        console.log(
          "DIAG corrupt-control:",
          JSON.stringify({ ...BOOK, phase: "corrupt-control", verdict }),
        );
        throw new Error(
          `corrupt open did not surface an explicit error: ${JSON.stringify(verdict)}`,
        );
      }
      console.log(
        "DIAG corrupt-control:",
        JSON.stringify({
          ...BOOK,
          phase: "corrupt-control",
          errorSurfaced: verdict.reason.slice(0, 120),
        }),
      );
    });
  });
} else if (PHASE === "card-open") {
  // Re-check of the Mac card-open failure (issue #120 corpus finding):
  // AXPress on the library card left the UI at Library after 8s. This phase
  // inspects the cover ON THE LIBRARY (before any navigation), then clicks
  // the SAME public control (.document-card-open) on Linux and requires the
  // reader to mount — the Linux-vs-macOS discriminator.
  describe(`Packaged corpus journey — ${BASENAME} (card-open)`, () => {
    it("card-open: cover present on library; clicking the card mounts the reader", async () => {
      await browser.waitUntil(
        async () =>
          browser.execute(
            () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
          ),
        { timeout: 60000, timeoutMsg: "bootstrap never became ready" },
      );
      await browser.setWindowSize(1200, 800);

      // ── COVER on the LIBRARY surface (Fix 1 + Codex gate #5): the book
      //    card is showing before any navigation; inspect the cover here.
      //    A cover-capable build (post-121) must show a real raster with a
      //    content hash distinct from the fallback; a build without the
      //    surface records BLOCKED — never a silent pass. ────────────────
      const cover = await bookCoverDiagnostic();
      if (cover.surfaceExists) {
        const hash = await coverContentHash();
        if (!hash || hash.error || !hash.sha256 || hash.naturalWidth <= 0) {
          console.log(
            "DIAG cover-fail:",
            JSON.stringify({ ...BOOK, phase: "card-open", step: "cover", cover, hash }),
          );
          throw new Error(
            `cover surface present but no real raster content hash: ${JSON.stringify({ cover, hash })}`,
          );
        }
        console.log(
          "DIAG cover:",
          JSON.stringify({ ...BOOK, phase: "card-open", step: "cover", ...cover, contentSha256: hash.sha256, bytes: hash.bytes }),
        );
      } else {
        console.log(
          "DIAG cover:",
          JSON.stringify({
            ...BOOK,
            phase: "card-open",
            step: "cover",
            status: "BLOCKED — DocumentCover surface absent on this base; owner 121-cover-pipeline",
          }),
        );
      }

      // ── Codex gate #4: the card's public meta must show the manifest page
      //    count ("{cur}/{total} pages").
      const cardPages = await cardPagesText();
      const cardTotal = cardPages ? cardPages.match(/\/(\d+)\s+pages/) : null;
      if (!cardTotal || String(cardTotal[1]) !== String(PAGES)) {
        console.log(
          "DIAG card-total-fail:",
          JSON.stringify({ ...BOOK, phase: "card-open", step: "card-total", expected: PAGES, got: cardPages }),
        );
        throw new Error(`card page count mismatch: expected ${PAGES}, got ${cardPages}`);
      }

      const card = await $(".document-card-open");
      await card.waitForExist({ timeout: 15000 });
      await card.waitForClickable({ timeout: 15000 });
      await browser.execute(() =>
        document.querySelector(".document-card-open")?.click(),
      );

      try {
        await browser.waitUntil(
          async () => (await renderedTextLayerCount(1)) > 0,
          { timeout: 90000, timeoutMsg: "reader never mounted after card click" },
        );
      } catch (err) {
        console.log(
          "DIAG card-open-fail:",
          JSON.stringify({
            ...BOOK,
            phase: "card-open",
            textLayerPage1: await renderedTextLayerCount(1),
            libraryStillShowing: await browser.execute(
              () => !!document.querySelector(".library-view, .library-body, .resume-section"),
            ),
          }),
        );
        throw err;
      }
      console.log(
        "DIAG card-open-ok:",
        JSON.stringify({ ...BOOK, phase: "card-open", readerMounted: true }),
      );
    });
  });
} else if (PHASE === "epub-control") {
  // NEGATIVE CONTROL: the open flow must REFUSE an unsupported format.
  // The seam returns the .epub path; the open flow's PDF filter must not
  // accept it. Expected: the reader never mounts and the open is refused
  // (either a dialog filter rejection or an error surfaced). This phase
  // PASSES when the refusal is observable — it is the negative control.
  describe(`Packaged corpus negative control — ${BASENAME}`, () => {
    it("epub-control: the open flow refuses the unsupported format", async () => {
      await browser.waitUntil(
        async () =>
          browser.execute(() => !!(window.__E2E_READ__ && window.__E2E_READ__.ready)),
        { timeout: 60000, timeoutMsg: "bootstrap never became ready" },
      );
      await browser.setWindowSize(1200, 800);

      const openBtn = await $("button.open-button");
      await openBtn.waitForExist({ timeout: 15000 });
      await openBtn.waitForClickable({ timeout: 15000 });
      await browser.execute(() =>
        document.querySelector("button.open-button")?.click(),
      );

      // ── BOUNDED SETTLE (Fix 2): the open is async — a refusal must be
      //    observed after the open flow settles, never at t≈0. Wait up to
      //    8s for one of: reader mounted (FAIL), explicit error surfaced
      //    (PASS with the message), or settle timeout (FAIL — no verdict).
      const settleStart = Date.now();
      let verdict = null;
      while (Date.now() - settleStart < 8000) {
        verdict = await browser.execute(() => {
          const err = document.querySelector(
            ".pdf-viewer-error, [class*='error']:not([class*='error-hidden'])",
          );
          const readerMounted = !!document.querySelector(
            "input[aria-label='Current page']",
          );
          const errText = err && (err.textContent || "").trim();
          if (readerMounted) return { refused: false, reason: "reader mounted" };
          if (errText && errText.length > 0) {
            return { refused: true, reason: errText.slice(0, 200) };
          }
          return null;
        });
        if (verdict) break;
        await browser.pause(500);
      }

      // ── EXPLICIT UNSUPPORTED-FORMAT CHECK: a generic error is a refusal,
      //    but an unsupported-format error is the specific contract. The
      //    surfaced message must indicate the file/format was rejected —
      //    PDF_INVALID or an equivalent unsupported/format text.
      if (!verdict) {
        console.log(
          "DIAG epub-control:",
          JSON.stringify({
            ...BOOK,
            phase: "epub-control",
            status: "FAIL — no verdict after 8s settle; open flow neither mounted nor errored",
          }),
        );
        throw new Error("epub open flow did not settle: no refusal surfaced");
      }
      // Codex gate (epub): require BOTH a format term AND a document-type
      // term — a generic "invalid api key" or "request rejected" must not
      // pass as an unsupported-format refusal.
      const explicit =
        /(invalid|unsupported|not\s+supported|reject|error)/i.test(verdict.reason || "") &&
        /(pdf|epub|document|file|format)/i.test(verdict.reason || "");
      if (!verdict.refused || !explicit) {
        console.log(
          "DIAG epub-control:",
          JSON.stringify({ ...BOOK, phase: "epub-control", verdict }),
        );
        throw new Error(
          `epub refused without explicit unsupported-format signal: ${JSON.stringify(verdict)}`,
        );
      }
      console.log(
        "DIAG epub-control:",
        JSON.stringify({
          ...BOOK,
          phase: "epub-control",
          refused: true,
          reason: verdict.reason.slice(0, 120),
        }),
      );
    });
  });
} else {

async function renderedTextLayerCount(pageNum) {
  // Codex gate #4: scope the render check to the RENDERED page's root
  // ([data-page-number]), not a global "any text spans exist" — the native
  // bootstrap may leave fixture spans around.
  return browser.execute(
    (n) => {
      const scope = n
        ? document.querySelector(`[data-page-number="${n}"]`)
        : document;
      return (scope?.querySelectorAll(".textLayer span, [class*='textLayer'] span") ?? [])
        .length;
    },
    pageNum ?? null,
  );
}

async function pageInputValue() {
  const input = await $('input[aria-label="Current page"]');
  return input.getValue();
}

async function documentTitleText() {
  return browser.execute(
    () => document.querySelector(".document-title")?.textContent ?? null,
  );
}

async function totalPagesText() {
  return browser.execute(
    () => document.querySelector(".total-pages")?.textContent ?? null,
  );
}

async function cardPagesText() {
  // Library card meta: "{current}/{total} pages" — the public total-pages
  // oracle on the library surface.
  return browser.execute(
    () => document.querySelector(".document-card-pages")?.textContent ?? null,
  );
}

async function coverContentHash() {
  // Codex gate #5: real cover proof = the DISPLAYED raster's content hash,
  // distinct from any fallback. The observer fetches the rendered img's
  // blob/data URL (same-origin — CSP allows blob: for img-src) and SHA-256s
  // the bytes. Returns null when no cover img exists.
  return browser.execute(async () => {
    const cover = document.querySelector(
      "[class*='DocumentCover'], [class*='document-cover'], img[class*='cover']",
    );
    const img = cover?.querySelector("img") ?? cover;
    if (!img || img.tagName !== "IMG" || !img.src) return null;
    if (!img.src.startsWith("blob:") && !img.src.startsWith("data:")) {
      return { error: "cover src is not blob:/data: (egress risk)", src: img.src.slice(0, 40) };
    }
    const resp = await fetch(img.src);
    const buf = new Uint8Array(await resp.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return {
      sha256: hex,
      bytes: buf.byteLength,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
}

async function bookCoverDiagnostic() {
  return browser.execute(() => {
    const cover = document.querySelector(
      "[class*='DocumentCover'], [class*='document-cover'], img[class*='cover']",
    );
    const img = cover?.querySelector("img") ?? cover;
    return {
      surfaceExists: !!cover,
      isImg: !!img && img.tagName === "IMG",
      naturalWidth: img && img.tagName === "IMG" ? img.naturalWidth : 0,
      srcPrefix: img && img.src ? img.src.slice(0, 30) : null,
    };
  });
}

describe(`Packaged corpus journey — ${BASENAME}`, () => {
  it(`${PHASE}: ${PHASE === "open"
      ? "open/import → cover → first-page render → next-page"
      : "restart/restore → delete/cache cleanup"}`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 60000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    if (PHASE === "open") {
      // ── ACTOR: Toolbar Open (public control). ────────────────────────────
      const openBtn = await $("button.open-button");
      await openBtn.waitForExist({ timeout: 15000 });
      await openBtn.waitForClickable({ timeout: 15000 });
      await browser.execute(() =>
        document.querySelector("button.open-button")?.click(),
      );

      // ── CLAIM 1: the reader surface displays the REAL first page. ────────
      // Scope the text-layer check to the RENDERED page root ([data-page-
      // number="1"]) so pre-existing spans cannot satisfy it (Codex gate #4).
      try {
        await browser.waitUntil(
          async () => (await renderedTextLayerCount(1)) > 0,
          { timeout: 90000, timeoutMsg: "reader never rendered page-1 text for the real book" },
        );
      } catch (err) {
        console.log(
          "DIAG open-fail:",
          JSON.stringify({
            ...BOOK,
            phase: "open",
            step: "render",
            textLayerPage1: await renderedTextLayerCount(1),
            pageInput: await pageInputValue().catch(() => null),
            hasReader: !!(await $("input[aria-label='Current page']").isExisting()),
          }),
        );
        throw err;
      }

      // ── CLAIM 1b (Codex gate #4): the document title must be THIS book. ──
      const title = await documentTitleText();
      if (!title || title.trim() !== TITLE) {
        console.log(
          "DIAG title-fail:",
          JSON.stringify({ ...BOOK, phase: "open", step: "title", expected: TITLE, got: title }),
        );
        throw new Error(`document title mismatch: expected ${TITLE}, got ${title}`);
      }

      // ── CLAIM 1c (Codex gate #4): the reader total-pages equals the
      //    manifest page count.
      const total = await totalPagesText();
      if (String(total ?? "").trim() !== String(PAGES)) {
        console.log(
          "DIAG total-fail:",
          JSON.stringify({ ...BOOK, phase: "open", step: "total", expected: PAGES, got: total }),
        );
        throw new Error(`total pages mismatch: expected ${PAGES}, got ${total}`);
      }

      // ── CLAIM 2: cover surface — real content hash, or BLOCKED. ─────────
      const cover = await bookCoverDiagnostic();
      if (cover.surfaceExists) {
        // Codex gate #5: real proof = the DISPLAYED raster's content hash,
        // fetched from its blob:/data: URL — NOT naturalWidth alone (a
        // fallback placeholder also has a width). The hash must differ from
        // the deterministic fallback and be recorded for cross-book
        // distinctness and cache-file comparison.
        const hash = await coverContentHash();
        if (!hash || hash.error || !hash.sha256 || hash.naturalWidth <= 0) {
          console.log(
            "DIAG cover-fail:",
            JSON.stringify({ ...BOOK, phase: "open", step: "cover", cover, hash }),
          );
          throw new Error(
            `cover surface present but no real raster content hash: ${JSON.stringify({ cover, hash })}`,
          );
        }
        console.log(
          "DIAG cover:",
          JSON.stringify({ ...BOOK, phase: "open", step: "cover", ...cover, contentSha256: hash.sha256, bytes: hash.bytes }),
        );
      } else {
        // Surface absent on this base (main pre-121). RECORDED, never passed.
        console.log(
          "DIAG cover:",
          JSON.stringify({
            ...BOOK,
            phase: "open",
            step: "cover",
            status: "BLOCKED — DocumentCover surface absent on this base; owner 121-cover-pipeline",
          }),
        );
      }

      // ── CLAIM 3: page input shows 1, Next moves the RENDERED page to 2. ──
      if ((await pageInputValue()) !== "1") {
        console.log(
          "DIAG page1-fail:",
          JSON.stringify({ ...BOOK, phase: "open", step: "page1", pageInput: await pageInputValue() }),
        );
        throw new Error(`expected page 1 after open, got ${await pageInputValue()}`);
      }
      const nextBtn = await $("button[aria-label='Next page'], button.next-page");
      await nextBtn.waitForExist({ timeout: 10000 });
      await nextBtn.waitForClickable({ timeout: 10000 });
      await browser.execute(() =>
        document.querySelector("button[aria-label='Next page'], button.next-page")?.click(),
      );
      await browser.waitUntil(
        async () => (await pageInputValue()) === "2",
        { timeout: 15000, timeoutMsg: "Next did not land on page 2" },
      );
      await browser.waitUntil(
        async () => (await renderedTextLayerCount(2)) > 0,
        { timeout: 15000, timeoutMsg: "page 2 rendered no text layer (scoped to page 2)" },
      );
      console.log(
        "DIAG open-ok:",
        JSON.stringify({ ...BOOK, phase: "open", pageInput: "2" }),
      );
      return;
    }

    // ── VERIFY phase: relaunch on the same profile. ────────────────────────
    // CLAIM 4: the library row persisted page 2 of N (the autosave), and
    // resuming lands on the RENDERED page 2.
    const resume = await $(
      `button[aria-label^="Resume ${TITLE.replace(/"/g, '\\"')}"]`,
    );
    await resume.waitForExist({ timeout: 30000 });
    const resumeLabel = await resume.getAttribute("aria-label");
    const rowMatch = resumeLabel.match(/page (\d+) of (\d+)/i);
    // Codex gate #4: the resume label must show page 2 AND the manifest
    // total ("…page 2 of {PAGES}…") — a wrong total is a data-integrity
    // failure, not just a wrong current page.
    if (!rowMatch || rowMatch[1] !== "2" || String(rowMatch[2]) !== String(PAGES)) {
      console.log(
        "DIAG restore-fail:",
        JSON.stringify({ ...BOOK, phase: "verify", step: "row", resumeLabel, expectedTotal: PAGES }),
      );
      throw new Error(`library row did not persist page 2 of ${PAGES}: ${resumeLabel}`);
    }
    await resume.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document
        .querySelector(`button[aria-label^="Resume ${TITLE.replace(/"/g, '\\"')}"]`)
        ?.click(),
    );
    await browser.waitUntil(
      async () => (await pageInputValue()) === "2",
      { timeout: 60000, timeoutMsg: "resume did not land on saved page 2" },
    );
    await browser.waitUntil(
      async () => (await renderedTextLayerCount(2)) > 0,
      { timeout: 30000, timeoutMsg: "restored page 2 rendered no text layer (scoped)" },
    );

    // CLAIM 5: delete the book through the public card control; the target
    // row (by title) must be absent afterwards (Fix 4: NOT a global-zero
    // assertion — the profile may legitimately hold other rows). Cache
    // cleanup is verified by the runner post-phase fs check keyed by SHA.
    // Return to the library via the public Ctrl+L shortcut
    // (useCommandKeys toggle-library).
    await browser.keys(["Control", "l"]);
    const del = await $(".document-card-delete");
    await del.waitForExist({ timeout: 15000 });
    await del.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document.querySelector(".document-card-delete")?.click(),
    );
    // The delete flow shows window.confirm — accept it (public dialog).
    try {
      await browser.acceptAlert();
    } catch {
      /* alert may already be gone; the target-row wait is the verdict */
    }
    await browser.waitUntil(
      async () =>
        browser.execute((title) => {
          // Target row absent: no card carries this book's title, and no
          // Resume button names it.
          const cards = Array.from(
            document.querySelectorAll(".document-card, [class*='document-card']"),
          );
          const cardHasTitle = cards.some((c) =>
            (c.textContent || "").includes(title),
          );
          const resumeHasTitle = !!document.querySelector(
            `button[aria-label^="Resume ${title.replace(/"/g, '\\"')}"]`,
          );
          return !cardHasTitle && !resumeHasTitle;
        }, TITLE),
      { timeout: 15000, timeoutMsg: "target book row still present after delete" },
    );

    const observerClean = await browser.execute(() => {
      const b = window.__E2E_READ__;
      return {
        // Read-only observer probes that exist on this base.
        storeError: b?.storeError ? b.storeError() : null,
      };
    });
    console.log(
      "DIAG verify-ok:",
      JSON.stringify({
        ...BOOK,
        phase: "verify",
        resumeLabel,
        deleted: true,
        targetRowAbsent: true,
        observer: observerClean,
      }),
    );
  });
});
}
