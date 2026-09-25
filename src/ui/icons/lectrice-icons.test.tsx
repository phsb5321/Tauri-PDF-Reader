import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { iconPairs } from "./lectrice-icons";

const sizes = [16, 23, 24, 48];

// Captured from the pre-change 8e8a6b1 detail components, not the new cuts.
const detailHashes: Record<string, string> = {
  bookmark: "6d2e7c64377fea72cd11164e0644d0da3920ffe3d09546ecdd3dbec1634263c6",
  library: "81b838240c469e228a3d6108b8cd534b608492f32bb445f68cfddfdd11c0113e",
  narrate: "6fe4c95e11a52522e382a950d777691f68e9d364259e14a2cfa19550cbce19c6",
  next: "6ddfbc704b927aa5755a6732ea0171bce74a5e0d44232227f5a67c552f266ffb",
  night: "383f5212d9c088a38723bd0aec238bba403a5209f1323c5fe3683ec04b5347ba",
  play: "c22806eb2d3b813767182c01da34e39bd7bc8d477d3f463a14f8414542efb923",
};

function geometry(markup: string) {
  return markup.replace(/width="\d+" height="\d+"/, "");
}

describe("branded optical cuts", () => {
  for (const [name, { branded: Icon, general: General }] of Object.entries(
    iconPairs,
  )) {
    it(`${name}: automatically switches below 24, preserving IconProps`, () => {
      const rendered = sizes.map((size) =>
        renderToStaticMarkup(<Icon size={size} className="proof" />),
      );
      for (const [index, markup] of rendered.entries()) {
        expect(markup).toContain(
          `width="${sizes[index]}" height="${sizes[index]}"`,
        );
        expect(markup).toContain('viewBox="0 0 24 24"');
        expect(markup).toContain('class="proof"');
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).toContain('focusable="false"');
        expect(markup).toContain('fill="currentColor"');
        expect(markup).toContain("scale(0.100000,-0.100000)");
        expect(markup).not.toMatch(/<(image|script|foreignObject)\b/);
      }
      expect(geometry(rendered[0])).toBe(geometry(rendered[1]));
      expect(geometry(rendered[2])).toBe(geometry(rendered[3]));
      expect(geometry(rendered[0])).not.toBe(geometry(rendered[2]));
      expect(renderToStaticMarkup(<Icon />)).toBe(
        renderToStaticMarkup(<Icon size={24} />),
      );
      const detail = geometry(renderToStaticMarkup(<Icon size={48} />)).replace(
        /\s+/g,
        " ",
      );
      expect(createHash("sha256").update(detail).digest("hex")).toBe(
        detailHashes[name],
      );
      expect(geometry(renderToStaticMarkup(<General size={16} />))).toBe(
        geometry(renderToStaticMarkup(<General size={48} />)),
      );
    });
  }
});

// Optional evidence export uses the ACTUAL component output, not a parallel mock.
// BRAND_RENDER_DIR=docs/brand/vector-evidence/icons pnpm exec vitest run ...
if (process.env.BRAND_RENDER_DIR) {
  const directory = resolve(process.env.BRAND_RENDER_DIR);
  mkdirSync(directory, { recursive: true });
  for (const [name, { branded: Icon }] of Object.entries(iconPairs)) {
    for (const size of sizes) {
      const svg = renderToStaticMarkup(<Icon size={size} />).replace(
        "<svg ",
        '<svg xmlns="http://www.w3.org/2000/svg" ',
      );
      writeFileSync(resolve(directory, `${name}-${size}.svg`), svg);
    }
  }
}
