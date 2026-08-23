import { describe, expect, it } from "vitest";
import { consumeNaturalCompletion } from "../../components/playback-bar/AiPlaybackBar";

describe("local no-mark natural completion", () => {
  it("advances exactly once for a requested playback", () => {
    expect(consumeNaturalCompletion(1, 0, true, false)).toEqual({
      consumed: 1,
      advance: true,
    });
    expect(consumeNaturalCompletion(1, 1, true, false)).toEqual({
      consumed: 1,
      advance: false,
    });
  });

  it("does not double-advance marks mode, which has its own completion consumer", () => {
    expect(consumeNaturalCompletion(2, 1, true, true)).toEqual({
      consumed: 2,
      advance: false,
    });
  });

  it("consumes but never advances after explicit Stop cleared the request", () => {
    expect(consumeNaturalCompletion(2, 1, false, false)).toEqual({
      consumed: 2,
      advance: false,
    });
  });
});
