import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scripts = ["scripts/e2e-local-tts.sh", "scripts/e2e-magpie.sh"];

describe("TTS packaged evidence fails closed", () => {
  it.each(scripts)(
    "removes a prior PASS receipt before %s launches",
    (path) => {
      const source = readFileSync(path, "utf8");
      const remove = source.indexOf('rm -f "$EVIDENCE_DIR/receipt.json"');
      const actor = source.indexOf("pnpm test:e2e");
      const write = source.lastIndexOf("receipt.json");

      expect(remove).toBeGreaterThan(0);
      expect(actor).toBeGreaterThan(remove);
      expect(write).toBeGreaterThan(actor);
    },
  );

  it("starts a fresh Magpie process before the real-model actor", () => {
    const source = readFileSync("scripts/e2e-magpie.sh", "utf8");
    expect(source.indexOf("./tools/magpie/start-transient.sh")).toBeLessThan(
      source.indexOf("pnpm test:e2e"),
    );
  });
});
