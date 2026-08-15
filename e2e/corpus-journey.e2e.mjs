/**
 * Packaged real-book corpus journey (tauri-driver + WebdriverIO).
 *
 * Gates the REAL-BOOK claims through the packaged app, one book per run:
 *
 *   CORPUS_PHASE=open    — actor clicks Toolbar Open; the seam returns the
 *                          real book path (VITE_E2E_OPEN_PATH, built in);
 *                          the reader must render the book's first page
 *                          (non-blank production canvas, non-fixture), then
 *                          the actor clicks Next and the RENDERED page must move
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

function xpathLiteral(value) {
  if (!value.includes("'")) return `'${value}'`;
  const parts = value.split("'").map((part) => `'${part}'`);
  return `concat(${parts.join(`, "'", `)})`;
}

async function renderedPageRaster(pageNum) {
  // GPU-backed PDF canvases are intentionally unreadable in WebKitGTK. Bind
  // the oracle to the target page root, non-zero production canvas backing
  // store, and the post-promise PdfViewer completion receipt. This proves the
  // real renderer completed without retaining private page pixels.
  return browser.execute((n) => {
    const canvas = document.querySelector(
      `[data-page-number="${n}"] canvas`,
    );
    if (!canvas || typeof canvas.width !== "number") return null;
    let completion = null;
    for (const line of window.__E2E_READ__.logs()) {
      if (line.includes(`[PdfViewer] Rendered page ${n} `)) completion = line;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: canvas.style.width,
      cssHeight: canvas.style.height,
      completion: completion ?? null,
    };
  }, pageNum);
}

async function waitForPageRaster(pageNum, timeout, timeoutMsg) {
  await browser.waitUntil(
    async () => {
      const raster = await renderedPageRaster(pageNum);
      return !!raster?.completion && raster.width > 0 && raster.height > 0;
    },
    { timeout, timeoutMsg },
  );
  return renderedPageRaster(pageNum);
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
  // Library card page-count oracle, both view modes:
  //  - grid:  .document-card-meta span:first-child = "{N} pages"
  //  - list:  .document-card-pages = "{cur}/{N} pages"
  return browser.execute(() => {
    const grid = document.querySelector(
      ".document-card-meta span:first-child",
    );
    if (grid) return grid.textContent;
    const list = document.querySelector(".document-card-pages");
    return list ? list.textContent : null;
  });
}

async function cardPagesTotal() {
  // Normalize either card format to the TOTAL page count ("N" from "{N}
  // pages" or "{cur}/{N} pages").
  const text = (await cardPagesText()) ?? "";
  const m = text.match(/(?:\d+\/)?(\d+)\s+pages?/i);
  return m ? m[1] : null;
}

async function coverContentHash() {
  // Codex gate #5: real cover proof = the DISPLAYED raster's decoded RGBA
  // hash, distinct from any fallback. Blob fetch is unreliable in WebKitGTK;
  // drawing the already displayed same-origin image is the proven cover lane
  // oracle. The runner hashes cached PNG pixels in the same RGBA domain.
  return browser.execute(async (title) => {
    const button = Array.from(
      document.querySelectorAll("button.document-card-open"),
    ).find((node) => node.getAttribute("aria-label")?.startsWith(`Select ${title};`));
    const cover = button?.querySelector(".document-cover");
    const img = cover?.querySelector("img");
    if (!img || img.tagName !== "IMG" || !img.src) return null;
    if (!img.src.startsWith("blob:") && !img.src.startsWith("data:")) {
      return { error: "cover src is not blob:/data: (egress risk)", src: img.src.slice(0, 40) };
    }
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return { error: "cover canvas context unavailable" };
    context.drawImage(img, 0, 0);
    const buf = context.getImageData(0, 0, canvas.width, canvas.height).data;
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
  }, TITLE);
}

async function bookCoverDiagnostic() {
  return browser.execute((title) => {
    const button = Array.from(
      document.querySelectorAll("button.document-card-open"),
    ).find((node) => node.getAttribute("aria-label")?.startsWith(`Select ${title};`));
    const cover = button?.querySelector(".document-cover");
    const img = cover?.querySelector("img");
    return {
      surfaceExists: !!cover,
      state: cover?.getAttribute("data-state") ?? null,
      isImg: !!img,
      naturalWidth: img?.naturalWidth ?? 0,
      srcPrefix: img?.src ? img.src.slice(0, 30) : null,
    };
  }, TITLE);
}


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
      const initialTitle = await documentTitleText();
      const initialLogCount = await browser.execute(
        () => window.__E2E_READ__.logs().length,
      );
      await browser.execute(() =>
        document.querySelector("button.open-button")?.click(),
      );

      const settleStart = Date.now();
      let verdict = null;
      while (Date.now() - settleStart < 10000) {
        verdict = await browser.execute(([beforeTitle, logStart]) => {
          const err = document.querySelector(
            ".pdf-viewer-error, [class*='error']:not([class*='error-hidden'])",
          );
          const currentTitle = document.querySelector(".document-title")?.textContent ?? null;
          const storeError = window.__E2E_READ__.storeError();
          const errText = (err?.textContent || "").trim();
          const storeErrorText = storeError
            ? `${String(storeError)} ${JSON.stringify(storeError)}`
            : "";
          if (currentTitle && currentTitle !== beforeTitle) {
            return { ok: false, reason: "reader changed to corrupt file" };
          }
          const newLogs = window.__E2E_READ__.logs().slice(logStart).join(" ");
          const reason = `${errText} ${storeErrorText} ${newLogs}`.trim();
          if (/PDF_INVALID/i.test(reason)) {
            return { ok: true, reason: reason.slice(0, 500) };
          }
          return null;
        }, [initialTitle, initialLogCount]);
        if (verdict) break;
        await browser.pause(500);
      }
      // Codex gate: the surfaced error must be the stable PDF_INVALID code
      // (pdf-service), NOT any visible error — a stale/unrelated banner
      // must not pass the control.
      if (!verdict || !verdict.ok || !/PDF_INVALID/i.test(verdict.reason || "")) {
        console.log(
          "DIAG corrupt-control:",
          JSON.stringify({ ...BOOK, phase: "corrupt-control", verdict }),
        );
        throw new Error(
          `corrupt open did not surface PDF_INVALID: ${JSON.stringify(verdict)}`,
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
      await browser.waitUntil(
        async () => {
          const candidate = await bookCoverDiagnostic();
          return candidate.surfaceExists && candidate.state === "ready" && candidate.naturalWidth > 0;
        },
        { timeout: 60000, timeoutMsg: "real card cover never reached ready" },
      );
      const cover = await bookCoverDiagnostic();
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

      // ── Codex gate #4: the card's public meta must show the manifest page
      //    count (grid "{N} pages" or list "{cur}/{N} pages").
      const cardPages = await cardPagesText();
      const cardTotal = await cardPagesTotal();
      if (!cardTotal || String(cardTotal) !== String(PAGES)) {
        console.log(
          "DIAG card-total-fail:",
          JSON.stringify({ ...BOOK, phase: "card-open", step: "card-total", expected: PAGES, got: cardPages }),
        );
        throw new Error(`card page count mismatch: expected ${PAGES}, got ${cardPages}`);
      }

      const card = await $(".document-card-open");
      await card.waitForExist({ timeout: 15000 });
      await card.waitForClickable({ timeout: 15000 });
      await card.doubleClick();

      try {
        const raster = await waitForPageRaster(
          2,
          90000,
          "reader never restored and painted page 2 after card double-click",
        );
        console.log(
          "DIAG card-open-ok:",
          JSON.stringify({ ...BOOK, phase: "card-open", readerMounted: true, raster }),
        );
      } catch (err) {
        console.log(
          "DIAG card-open-fail:",
          JSON.stringify({
            ...BOOK,
            phase: "card-open",
            rasterPage2: await renderedPageRaster(2),
            libraryStillShowing: await browser.execute(
              () => !!document.querySelector(".library-view, .library-body, .resume-section"),
            ),
          }),
        );
        throw err;
      }
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
      const initialTitle = await documentTitleText();
      const initialLogCount = await browser.execute(
        () => window.__E2E_READ__.logs().length,
      );
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
        verdict = await browser.execute(([beforeTitle, logStart]) => {
          const err = document.querySelector(
            ".pdf-viewer-error, [class*='error']:not([class*='error-hidden'])",
          );
          const currentTitle = document.querySelector(".document-title")?.textContent ?? null;
          const storeError = window.__E2E_READ__.storeError();
          const errText = (err?.textContent || "").trim();
          const storeErrorText = storeError
            ? `${String(storeError)} ${JSON.stringify(storeError)}`
            : "";
          if (currentTitle && currentTitle !== beforeTitle) {
            return { refused: false, reason: "reader changed to EPUB" };
          }
          const newLogs = window.__E2E_READ__.logs().slice(logStart).join(" ");
          const reason = `${errText} ${storeErrorText} ${newLogs}`.trim();
          if (/PDF_INVALID/i.test(reason)) {
            return { refused: true, reason: reason.slice(0, 500) };
          }
          return null;
        }, [initialTitle, initialLogCount]);
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
      // Codex gate (epub): the surfaced error must be the app's stable
      // open-failure code — pdf-service throws "PDF_INVALID: The file is not
      // a valid PDF or is corrupted" for any file pdf.js rejects. Requiring
      // this code excludes generic "Error loading file" false passes.
      const explicit = /PDF_INVALID/i.test(verdict.reason || "");
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

describe(`Packaged corpus journey — ${BASENAME}`, () => {
  it(`${PHASE}: ${PHASE === "open"
      ? "open/import → cover → page rasters → next-page → text-backed TTS"
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
      // A cover page may be image-only. Require a non-blank production canvas
      // scoped to page 1 rather than assuming every valid PDF has text spans.
      let page1Raster;
      try {
        page1Raster = await waitForPageRaster(
          1,
          90000,
          "reader never painted page 1 for the real book",
        );
      } catch (err) {
        console.log(
          "DIAG open-fail:",
          JSON.stringify({
            ...BOOK,
            phase: "open",
            step: "render",
            rasterPage1: await renderedPageRaster(1),
            pageInput: await pageInputValue().catch(() => null),
            documentTitle: await documentTitleText(),
            pageRoots: await browser.execute(() =>
              Array.from(document.querySelectorAll("[data-page-number]")).map((node) => ({
                page: node.getAttribute("data-page-number"),
                canvases: node.querySelectorAll("canvas").length,
              })),
            ),
            bootstrapLogs: await browser.execute(() =>
              window.__E2E_READ__
                .logs()
                .slice(-20)
                .map((line) => line.replace(/\/home\/[^ )\]]+/g, "<private-path>")),
            ),
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
      const page2Raster = await waitForPageRaster(
        2,
        30000,
        "page 2 never painted a non-blank production canvas",
      );
      // Exercise TTS when this page exposes selectable PDF text. Some real
      // books begin with image-only front matter; no OCR exists in v0.2.0.
      // ponytail: skip only that unsupported page shape; an OCR feature can
      // replace this condition when the product gains one.
      await browser.pause(1000);
      const textSpanCount = await browser.execute(() =>
        document.querySelectorAll('[data-page-number="2"] .textLayer span').length,
      );
      if (textSpanCount > 0) {
        const playBtn = await $(".ai-playback-button");
        await playBtn.waitForExist({ timeout: 15000 });
        await playBtn.waitForEnabled({ timeout: 15000 });
        await playBtn.waitForClickable({ timeout: 15000 });
        await browser.execute(() =>
          document.querySelector(".ai-playback-button")?.click(),
        );
        await browser.waitUntil(
          async () => browser.execute(() => window.__E2E_READ__.wordCount() > 0),
          { timeout: 15000, timeoutMsg: "text-backed page produced no TTS marks" },
        );
      } else {
        console.log("DIAG tts-not-applicable:", JSON.stringify({ ...BOOK, page: 2, reason: "no text spans" }));
      }
      console.log(
        "DIAG open-ok:",
        JSON.stringify({ ...BOOK, phase: "open", pageInput: "2", page1Raster, page2Raster }),
      );
      return;
    }

    // ── VERIFY phase: relaunch on the same profile. ────────────────────────
    // CLAIM 4: the library row persisted page 2 of N (the autosave), and
    // resuming lands on the RENDERED page 2.
    const resume = await $(
      `//button[starts-with(@aria-label, ${xpathLiteral(`Resume ${TITLE}`)})]`,
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
    await browser.execute((title) => {
      const button = Array.from(document.querySelectorAll("button")).find((node) =>
        node.getAttribute("aria-label")?.startsWith(`Resume ${title}`),
      );
      button?.click();
    }, TITLE);
    await browser.waitUntil(
      async () => (await pageInputValue()) === "2",
      { timeout: 60000, timeoutMsg: "resume did not land on saved page 2" },
    );
    await waitForPageRaster(
      2,
      30000,
      "restored page 2 never painted a non-blank production canvas",
    );

    // CLAIM 5: delete the book through the public card control; the target
    // row (by title) must be absent afterwards (Fix 4: NOT a global-zero
    // assertion — the profile may legitimately hold other rows). Cache
    // cleanup is verified by the runner post-phase fs check keyed by SHA.
    // Return to the library via the public Ctrl+L shortcut
    // (useCommandKeys toggle-library).
    await browser.keys(["Control", "l"]);
    const card = await $(".document-card");
    await card.waitForExist({ timeout: 15000 });
    await card.moveTo();
    const del = await $(".document-card-delete");
    await del.waitForExist({ timeout: 15000 });
    await browser.waitUntil(
      async () => Number.parseFloat((await del.getCSSProperty("opacity")).value) === 1,
      { timeout: 5000, timeoutMsg: "delete control never revealed on card hover" },
    );
    await del.waitForClickable({ timeout: 15000 });
    expect(await browser.execute(() => window.__E2E_READ__.confirmSeamed())).toBe(true);
    expect(await browser.execute(() => window.__E2E_READ__.confirmCalls())).toBe(0);
    await browser.execute(() =>
      document.querySelector(".document-card-delete")?.click(),
    );
    await browser.waitUntil(
      async () => browser.execute(() => window.__E2E_READ__.confirmCalls() === 1),
      { timeout: 5000, timeoutMsg: "delete flow never invoked confirmation" },
    );
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
          const resumeHasTitle = Array.from(
            document.querySelectorAll("button[aria-label]"),
          ).some((button) =>
            button.getAttribute("aria-label")?.startsWith(`Resume ${title}`),
          );
          return !cardHasTitle && !resumeHasTitle;
        }, TITLE),
      { timeout: 15000, timeoutMsg: "target book row still present after delete" },
    );

    const observerClean = await browser.execute(async (title) => {
      const b = window.__E2E_READ__;
      // #121 added ipcDocumentRowPageByTitle — a REAL read-only IPC probe:
      // after delete the target row must be GONE at the backend, not just
      // hidden in the DOM.
      let rowAfterDelete = "probe-unavailable";
      if (b?.ipcDocumentRowPageByTitle) {
        try {
          rowAfterDelete = await b.ipcDocumentRowPageByTitle(title);
        } catch (e) {
          rowAfterDelete = `probe-error: ${String(e)}`;
        }
      }
      return {
        rowAfterDelete,
        storeError: b?.storeError ? b.storeError() : null,
      };
    }, TITLE);
    // BLOCKED-not-green: a missing probe oracle (probe-unavailable) or a
    // probe that threw (probe-error, e.g. IPC failure) must FAIL the
    // journey — only a clean null (row genuinely absent, IPC healthy)
    // proves deletion.
    if (observerClean.rowAfterDelete !== null) {
      console.log(
        "DIAG verify-row-gone:",
        JSON.stringify({ ...BOOK, phase: "verify", rowAfterDelete: observerClean.rowAfterDelete }),
      );
      throw new Error(
        `deleted row oracle did not prove absence: ${JSON.stringify(observerClean.rowAfterDelete)}`,
      );
    }
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
