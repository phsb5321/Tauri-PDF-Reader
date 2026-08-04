/**
 * The raw-colour contract, for guarded stylesheets.
 *
 * `design-tokens.test.ts` proves every named token resolves and clears AA
 * contrast; it does not stop a component from painting a colour that never
 * went through a token at all — `AiPlaybackBar.css` shipped a hardcoded
 * `#a855f7` gradient stop and a `rgba(124, 58, 237, …)` glow on the one
 * surface the brand calls "mauve = the voice," off-palette in both light and
 * dark. This file is deliberately narrow, not a repo-wide sweep: pre-existing
 * `var(--x, #fallback)` literals and grayscale overlay/shadow values
 * (`rgba(0, 0, 0, …)`-style, used for elevation and scrims everywhere in this
 * codebase) are an accepted, separate convention and out of scope here — see
 * `GUARDED_STYLESHEETS` below for the list this contract actually enforces.
 * Grow that list file-by-file as each stylesheet earns it; it must never
 * shrink once a file is on it.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const SRC = join(REPO_ROOT, "src");

/** Files this contract actually enforces. Only ever append. */
const GUARDED_STYLESHEETS = ["components/playback-bar/AiPlaybackBar.css"];

const stripCssComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/** True for black/white/gray literals — the accepted overlay/shadow convention. */
function isGrayscale(r: number, g: number, b: number): boolean {
  return r === g && g === b;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.slice(1);
  if (clean.length === 3) {
    const [r, g, b] = clean.split("");
    return [
      parseInt(r + r, 16),
      parseInt(g + g, 16),
      parseInt(b + b, 16),
    ];
  }
  if (clean.length === 6 || clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

interface Violation {
  file: string;
  line: number;
  literal: string;
}

/**
 * Find colour literals that are (a) not inside a `var(...)` call — a
 * fallback is a pre-existing, tolerated compatibility shim, not a live
 * paint — and (b) not grayscale, since grayscale rgba() is the codebase's
 * established overlay/shadow idiom.
 */
function findRawColorLiterals(css: string): Array<{ line: number; literal: string }> {
  const clean = stripCssComments(css);
  const found: Array<{ line: number; literal: string }> = [];

  const colorPattern = /(#[0-9a-fA-F]{3,8}\b)|(rgba?\([^)]+\))/g;
  let match: RegExpExecArray | null;
  while ((match = colorPattern.exec(clean))) {
    const literal = match[0];
    const index = match.index;

    // Skip literals that live inside a var(--x, <fallback>) call — walk
    // backward to the nearest unmatched "var(" before this position.
    const before = clean.slice(0, index);
    const lastVarOpen = before.lastIndexOf("var(");
    if (lastVarOpen !== -1) {
      const between = clean.slice(lastVarOpen, index);
      const opens = (between.match(/\(/g) ?? []).length;
      const closes = (between.match(/\)/g) ?? []).length;
      if (opens > closes) continue; // still inside the var(...) call
    }

    let rgb: [number, number, number] | null = null;
    if (literal.startsWith("#")) {
      rgb = hexToRgb(literal);
    } else {
      const nums = literal
        .slice(literal.indexOf("(") + 1, literal.lastIndexOf(")"))
        .split(",")
        .slice(0, 3)
        .map((n) => Number(n.trim()));
      if (nums.length === 3 && nums.every((n) => !Number.isNaN(n))) {
        rgb = [nums[0], nums[1], nums[2]];
      }
    }
    if (!rgb || isGrayscale(...rgb)) continue;

    const line = clean.slice(0, index).split("\n").length;
    found.push({ line, literal });
  }
  return found;
}

describe("raw-color contract (guarded stylesheets)", () => {
  it("guarded stylesheets never paint an off-palette colour literal", () => {
    const violations: Violation[] = [];
    for (const relPath of GUARDED_STYLESHEETS) {
      const file = join(SRC, relPath);
      const css = readFileSync(file, "utf8");
      for (const { line, literal } of findRawColorLiterals(css)) {
        violations.push({ file: relPath, line, literal });
      }
    }
    expect(
      violations.map((v) => `${v.file}:${v.line}  ${v.literal}`),
    ).toEqual([]);
  });
});
