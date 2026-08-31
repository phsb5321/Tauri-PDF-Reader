import { describe, expect, it } from "vitest";
import { readingBandScrollTarget } from "./read-along-motion";

const viewport = {
  top: 100,
  bottom: 500,
  scrollTop: 600,
  scrollHeight: 2_000,
  clientHeight: 400,
};

describe("read-along motion", () => {
  it("does not move a range inside the stable reading band", () => {
    expect(
      readingBandScrollTarget({ top: 240, bottom: 270 }, viewport),
    ).toBeNull();
  });

  it("returns one absolute target above or below the band", () => {
    expect(readingBandScrollTarget({ top: 120, bottom: 140 }, viewport)).toBe(
      430,
    );
    expect(readingBandScrollTarget({ top: 470, bottom: 490 }, viewport)).toBe(
      780,
    );
  });

  it("clamps to both scroll boundaries and rejects invalid geometry", () => {
    expect(
      readingBandScrollTarget(
        { top: -900, bottom: -880 },
        { ...viewport, scrollTop: 10 },
      ),
    ).toBe(0);
    expect(
      readingBandScrollTarget(
        { top: 2_400, bottom: 2_420 },
        { ...viewport, scrollTop: 1_500 },
      ),
    ).toBe(1_600);
    expect(
      readingBandScrollTarget(
        { top: 20, bottom: 10 },
        { ...viewport, top: 0, bottom: 0 },
      ),
    ).toBeNull();
  });
});
