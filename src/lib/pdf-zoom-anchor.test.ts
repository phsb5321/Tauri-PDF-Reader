import { describe, expect, it } from "vitest";
import { capturePdfZoomAnchor, restorePdfZoomAnchor } from "./pdf-zoom-anchor";

const viewer = { left: 0, top: 0, width: 800, height: 600 };

describe("PDF zoom anchor", () => {
  it("keeps the viewport-centre PDF point stable after real geometry doubles", () => {
    const anchor = capturePdfZoomAnchor(
      { left: 100, top: 40, width: 600, height: 800 },
      viewer,
      1,
      2,
    );

    expect(anchor).toMatchObject({ pageX: 0.5, pageY: 0.325 });
    if (!anchor) throw new Error("zoom anchor was not captured");
    expect(
      restorePdfZoomAnchor(
        anchor,
        { left: 40, top: 40, width: 1200, height: 1600 },
        viewer,
        { left: 0, top: 0, maxLeft: 480, maxTop: 1040 },
      ),
    ).toEqual({ left: 240, top: 260 });
  });

  it("uses the wheel pointer instead of silently substituting page centre", () => {
    const anchor = capturePdfZoomAnchor(
      { left: 100, top: 40, width: 600, height: 800 },
      viewer,
      3,
      2.8,
      { x: 250, y: 240 },
    );

    expect(anchor).toEqual({
      pageNumber: 3,
      targetZoom: 2.8,
      pageX: 0.25,
      pageY: 0.25,
      viewportX: 250,
      viewportY: 240,
    });
  });

  it("clamps restoration to reachable scroll bounds and rejects empty pages", () => {
    const anchor = capturePdfZoomAnchor(
      { left: 0, top: 0, width: 100, height: 100 },
      viewer,
      1,
      4,
      { x: 1000, y: 1000 },
    );

    if (!anchor) throw new Error("zoom anchor was not captured");
    expect(
      restorePdfZoomAnchor(
        anchor,
        { left: 0, top: 0, width: 1000, height: 1000 },
        viewer,
        { left: 10, top: 20, maxLeft: 200, maxTop: 300 },
      ),
    ).toEqual({ left: 200, top: 300 });
    expect(
      capturePdfZoomAnchor(
        { left: 0, top: 0, width: 0, height: 100 },
        viewer,
        1,
        2,
      ),
    ).toBeNull();
  });
});
