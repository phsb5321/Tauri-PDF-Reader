/**
 * The design-token contract.
 *
 * Two properties, both of which the app silently violated before this file
 * existed:
 *
 *  1. Every `var(--token)` a stylesheet names is actually DEFINED. ~40
 *     stylesheets referenced a vocabulary the token layer never shipped
 *     (`--text-primary` where the system defines `--color-text-primary`). Each
 *     call site carried a fallback — `var(--text-primary, #1a1a1a)` — so the
 *     miss was invisible at build time and every one of them painted a
 *     hard-coded LIGHT literal regardless of theme. In dark mode that put
 *     #1a1a1a on the #1e1e2e base: 1.06:1. Invisible text, green build.
 *
 *  2. Every colour the app renders TEXT in clears WCAG AA 4.5:1 against every
 *     surface that text can sit on — in BOTH themes. Checked by computing the
 *     ratio from the token values themselves, so it holds for the values that
 *     actually ship rather than for a screenshot someone once looked at.
 *
 * Pixels are never the oracle here; the resolved token graph is.
 */

import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// NB: `fileURLToPath(import.meta.url)` held in a const. Vite rewrites
// `new URL("<string literal>", import.meta.url)` into an asset reference that
// resolves to an http:// URL, and readFileSync rejects it.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const SRC = join(REPO_ROOT, "src");
const TOKENS_CSS = join(SRC, "ui/tokens/colors.css");

/** WCAG 2.1 AA: normal-size text. */
const AA_TEXT = 4.5;
const DEFAULT_ROOT_PX = 16;
const MIN_TEXT_PX = 12;

const stripCssComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/**
 * A symlink resolving outside `REPO_ROOT` must never be scanned as source: a
 * symlinked directory would recurse arbitrarily far off-disk, and a symlinked
 * file would be read as if it were repo content. `lstatSync` (not `statSync`)
 * so a symlinked directory is never classified as a directory to recurse
 * into, and every accepted file is additionally realpath-checked.
 */
function assertContained(path: string): string {
  const real = realpathSync(path);
  if (real !== REPO_ROOT && !real.startsWith(`${REPO_ROOT}/`))
    throw new Error(`refusing to scan outside repo root: ${path} -> ${real}`);
  return real;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (lstatSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(?:css|tsx|jsx)$/.test(entry)) {
      assertContained(full);
      out.push(full);
    }
  }
  return out;
}

interface StylesheetSource {
  file: string;
  css: string;
  startLine: number;
}

/**
 * Extract only static CSS template literals mounted through a JSX `<style>`.
 * Parsing an entire TSX file as CSS would mistake object literals and strings
 * for declarations; silently ignoring a dynamic style sheet would recreate the
 * same coverage hole. Runtime sheets therefore have one explicit supported
 * shape and fail closed if a component introduces another.
 */
function embeddedStylesheets(file: string, source: string): StylesheetSource[] {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const sheets: StylesheetSource[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(syntax) === "style"
    )
      throw new Error(`${file}: a runtime <style> cannot be self-closing`);

    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(syntax) === "style"
    ) {
      const children = node.children.filter(
        (child) => !ts.isJsxText(child) || child.text.trim() !== "",
      );
      const expression =
        children.length === 1 && ts.isJsxExpression(children[0])
          ? children[0].expression
          : undefined;
      if (!expression || !ts.isNoSubstitutionTemplateLiteral(expression))
        throw new Error(
          `${file}: every runtime <style> must be a static template literal`,
        );
      const start = syntax.getLineAndCharacterOfPosition(
        expression.getStart(syntax) + 1,
      );
      sheets.push({ file, css: expression.text, startLine: start.line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  return sheets;
}

function stylesheetSources(dir: string): StylesheetSource[] {
  return sourceFiles(dir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return file.endsWith(".css")
      ? [{ file, css: source, startLine: 1 }]
      : embeddedStylesheets(file, source);
  });
}

function sourceLocation(source: StylesheetSource, index: number): string {
  const line =
    source.startLine + source.css.slice(0, index).split("\n").length - 1;
  return `${source.file.slice(REPO_ROOT.length + 1)}:${line}`;
}

// ── colour maths ──────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  let h = hex.slice(1);
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ── token graph ───────────────────────────────────────────────────────────

interface StyleRule {
  selector: string;
  body: string;
  atRules: readonly string[];
}

interface ThemeEnvironment {
  colorScheme: "light" | "dark";
  contrastMore: boolean;
  dataTheme?: "light" | "dark";
}

/**
 * Parse style rules while retaining their at-rule ancestry. A flat
 * `[^{}]*` regex cannot distinguish top-level `:root` from the `:root` nested
 * inside `@media (prefers-contrast: more)`, which previously made the default
 * theme inherit high-contrast overrides in this test only.
 */
function styleRules(css: string, atRules: readonly string[] = []): StyleRule[] {
  const rules: StyleRule[] = [];
  let cursor = 0;

  while (cursor < css.length) {
    const open = css.indexOf("{", cursor);
    if (open === -1) break;

    const prelude = css.slice(cursor, open).trim();
    let depth = 1;
    let close = open + 1;
    while (close < css.length && depth > 0) {
      if (css[close] === "{") depth++;
      if (css[close] === "}") depth--;
      close++;
    }
    if (depth !== 0) throw new Error(`unclosed CSS block: ${prelude}`);

    const body = css.slice(open + 1, close - 1);
    if (prelude.startsWith("@")) {
      rules.push(...styleRules(body, [...atRules, prelude]));
    } else if (prelude) {
      rules.push({ selector: prelude, body, atRules });
    }
    cursor = close;
  }

  return rules;
}

type Specificity = readonly [ids: number, attributes: number, elements: number];

function compareSpecificity(a: Specificity, b: Specificity): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Specificity for the root selectors the token layer ships. `:not()` itself
 * contributes nothing, but its argument does; therefore
 * `:root:not([data-theme="light"])` is (0,2,0), not equal to `:root`.
 */
function specificity(selector: string): Specificity {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const attributes = selector.match(/\[[^\]]+\]/g)?.length ?? 0;
  const pseudoClasses =
    selector.replace(/:not\([^)]*\)/g, "").match(/:(?!:)[\w-]+/g)?.length ?? 0;
  const withoutNonElements = selector
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, " ")
    .replace(/[>*+~]/g, " ");
  const elements = withoutNonElements.match(/[a-zA-Z][\w-]*/g)?.length ?? 0;
  return [ids, attributes + pseudoClasses, elements];
}

function selectorMatchesRoot(
  selector: string,
  environment: ThemeEnvironment,
): boolean {
  switch (selector) {
    case ":root":
      return true;
    case ':root:not([data-theme="light"])':
      return environment.dataTheme !== "light";
    case '[data-theme="dark"]':
      return environment.dataTheme === "dark";
    default:
      return false;
  }
}

function atRulesMatch(
  atRules: readonly string[],
  environment: ThemeEnvironment,
): boolean {
  return atRules.every((atRule) => {
    if (atRule === "@media (prefers-color-scheme: dark)")
      return environment.colorScheme === "dark";
    if (atRule === "@media (prefers-contrast: more)")
      return environment.contrastMore;
    return false;
  });
}

/** Resolve the custom properties on the document root using the CSS cascade. */
function themeDeclarations(
  css: string,
  environment: ThemeEnvironment,
): Map<string, string> {
  const winners = new Map<
    string,
    { value: string; specificity: Specificity }
  >();
  const clean = stripCssComments(css);

  for (const rule of styleRules(clean)) {
    if (!atRulesMatch(rule.atRules, environment)) continue;
    const matchingSelectors = splitTopLevel(rule.selector).filter((selector) =>
      selectorMatchesRoot(selector, environment),
    );
    if (matchingSelectors.length === 0) continue;
    const sortedSpecificities = matchingSelectors
      .map(specificity)
      .sort(compareSpecificity);
    const ruleSpecificity = sortedSpecificities[
      sortedSpecificities.length - 1
    ] as Specificity;

    for (const [, name, value] of rule.body.matchAll(
      /(--[\w-]+)\s*:\s*([^;]+);/g,
    )) {
      const previous = winners.get(name);
      if (
        previous &&
        compareSpecificity(ruleSpecificity, previous.specificity) < 0
      )
        continue;
      winners.set(name, {
        value: value.trim(),
        specificity: ruleSpecificity,
      });
    }
  }

  return new Map([...winners].map(([name, winner]) => [name, winner.value]));
}

/** Only declarations inherited from a root selector are globally available. */
function globalTokenNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const rule of styleRules(stripCssComments(css))) {
    if (
      !splitTopLevel(rule.selector).some((selector) =>
        [
          ":root",
          ':root:not([data-theme="light"])',
          '[data-theme="dark"]',
        ].includes(selector),
      )
    )
      continue;
    for (const [, name] of rule.body.matchAll(/(--[\w-]+)\s*:/g))
      names.add(name);
  }
  return names;
}

/** `transparent`, alpha mixes and rgba() — real values, just not opaque ones. */
const NOT_OPAQUE = Symbol("not-opaque");

function resolve(
  value: string,
  tokens: Map<string, string>,
  seen = new Set<string>(),
): Rgb | typeof NOT_OPAQUE {
  const v = value.trim();

  if (v.startsWith("#")) return parseHex(v);
  if (v === "transparent" || v.startsWith("rgba(")) return NOT_OPAQUE;

  const varMatch = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/.exec(v);
  if (varMatch) {
    const [, name, fallback] = varMatch;
    if (seen.has(name)) throw new Error(`circular token reference: ${name}`);
    const next = tokens.get(name);
    if (next !== undefined)
      return resolve(next, tokens, new Set([...seen, name]));
    if (fallback !== undefined) return resolve(fallback, tokens, seen);
    throw new Error(`undefined token: ${name}`);
  }

  const mixMatch = /^color-mix\(\s*in\s+srgb\s*,([\s\S]+)\)$/.exec(v);
  if (mixMatch) {
    const [first, second] = splitTopLevel(mixMatch[1]);
    const pct = (s: string) => {
      const m = /\s([\d.]+)%$/.exec(s);
      return m ? Number(m[1]) : null;
    };
    const strip = (s: string) => s.replace(/\s[\d.]+%$/, "").trim();
    const p1 = pct(first);
    const p2 = pct(second);
    // CSS fills in the missing half so the pair sums to 100.
    const w1 = p1 ?? (p2 === null ? 50 : 100 - p2);
    const a = resolve(strip(first), tokens, seen);
    const b = resolve(strip(second), tokens, seen);
    if (a === NOT_OPAQUE || b === NOT_OPAQUE) return NOT_OPAQUE;
    const t = w1 / 100;
    return [0, 1, 2].map((i) => Math.round(a[i] * t + b[i] * (1 - t))) as Rgb;
  }

  throw new Error(`unresolvable colour value: ${v}`);
}

const tokensCss = readFileSync(TOKENS_CSS, "utf8");

const LIGHT = themeDeclarations(tokensCss, {
  colorScheme: "light",
  contrastMore: false,
});
const LIGHT_EXPLICIT_ON_DARK_SYSTEM = themeDeclarations(tokensCss, {
  colorScheme: "dark",
  contrastMore: false,
  dataTheme: "light",
});
const DARK_SYSTEM = themeDeclarations(tokensCss, {
  colorScheme: "dark",
  contrastMore: false,
});
const DARK_EXPLICIT = themeDeclarations(tokensCss, {
  colorScheme: "light",
  contrastMore: false,
  dataTheme: "dark",
});
const DARK_EXPLICIT_ON_DARK_SYSTEM = themeDeclarations(tokensCss, {
  colorScheme: "dark",
  contrastMore: false,
  dataTheme: "dark",
});
const HIGH_CONTRAST_LIGHT = themeDeclarations(tokensCss, {
  colorScheme: "light",
  contrastMore: true,
});
const HIGH_CONTRAST_LIGHT_EXPLICIT_ON_DARK_SYSTEM = themeDeclarations(
  tokensCss,
  {
    colorScheme: "dark",
    contrastMore: true,
    dataTheme: "light",
  },
);
const HIGH_CONTRAST_SYSTEM_DARK = themeDeclarations(tokensCss, {
  colorScheme: "dark",
  contrastMore: true,
});
const HIGH_CONTRAST_EXPLICIT_DARK = themeDeclarations(tokensCss, {
  colorScheme: "light",
  contrastMore: true,
  dataTheme: "dark",
});
const HIGH_CONTRAST_EXPLICIT_DARK_ON_DARK_SYSTEM = themeDeclarations(
  tokensCss,
  {
    colorScheme: "dark",
    contrastMore: true,
    dataTheme: "dark",
  },
);

const THEMES: readonly [string, Map<string, string>][] = [
  ["light", LIGHT],
  ["explicit light on a dark system", LIGHT_EXPLICIT_ON_DARK_SYSTEM],
  ["system dark", DARK_SYSTEM],
  ["explicit dark", DARK_EXPLICIT],
  ["explicit dark on a dark system", DARK_EXPLICIT_ON_DARK_SYSTEM],
  ["high-contrast light", HIGH_CONTRAST_LIGHT],
  [
    "high-contrast explicit light on a dark system",
    HIGH_CONTRAST_LIGHT_EXPLICIT_ON_DARK_SYSTEM,
  ],
  ["high-contrast system dark", HIGH_CONTRAST_SYSTEM_DARK],
  ["high-contrast explicit dark", HIGH_CONTRAST_EXPLICIT_DARK],
  [
    "high-contrast explicit dark on a dark system",
    HIGH_CONTRAST_EXPLICIT_DARK_ON_DARK_SYSTEM,
  ],
];

/** Colours the app renders text in. */
const TEXT_TOKENS = [
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-accent-text",
  "--color-speak-text",
  "--color-error-text",
  "--color-warning-text",
  "--color-success-text",
  "--color-info-text",
] as const;

/** Surfaces that text sits on. */
const SURFACE_TOKENS = [
  "--color-bg",
  "--color-bg-surface",
  "--color-bg-toolbar",
  "--color-bg-viewer",
  "--color-bg-subtle",
  "--color-bg-disabled",
  "--color-button-bg",
  "--color-button-bg-hover",
  "--color-input-bg",
] as const;

/** Text-on-fill pairs, where the fill is the background. */
const ON_FILL_PAIRS = [
  ["--color-on-accent", "--color-accent"],
  ["--color-on-accent", "--color-accent-hover"],
  ["--color-on-accent", "--color-speak"],
  ["--color-on-accent", "--color-error"],
  ["--color-error-text", "--color-error-bg"],
  ["--color-error-text", "--color-error-hover"],
  ["--color-warning-text", "--color-warning-bg"],
  ["--color-success-text", "--color-success-bg"],
  ["--color-info-text", "--color-info-bg"],
] as const;

/** Palette/fill roles must never be used as foreground text. */
const FILL_ONLY_TOKENS = new Set([
  "--color-accent",
  "--color-speak",
  "--color-error",
  "--color-warning",
  "--color-success",
  "--color-info",
  "--accent-color",
  "--primary-color",
  "--color-primary",
  "--error-color",
]);

/**
 * CSS system-font and global keywords a `font` shorthand may carry instead of
 * an explicit size. None resolve to a pixel value here (the UA or the
 * cascade supplies it), so each is named explicitly rather than falling
 * through to "no size token found" and being mistaken for a scanner miss.
 */
const UNRESOLVABLE_FONT_SHORTHAND_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "caption",
  "icon",
  "menu",
  "message-box",
  "small-caption",
  "status-bar",
]);

/** Split a `font` shorthand value into space-separated components, treating a
 * `var(...)` call as one token even if its fallback contains spaces. */
function shorthandTokens(value: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current) tokens.push(current);
      current = "";
    } else current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Extract the size component of a `font` shorthand value, ready to hand to
 * `resolveFontSizePx`. Returns `undefined` for a known-unresolvable keyword
 * (explicitly safe to skip) and throws for anything else it cannot locate.
 */
function shorthandFontSize(value: string): string | undefined {
  // `!important` is a cascade modifier, not part of the value; a bare
  // keyword like `inherit !important` must skip-list the same as `inherit`.
  const trimmed = value.trim().replace(/\s*!important\s*$/i, "");
  if (UNRESOLVABLE_FONT_SHORTHAND_KEYWORDS.has(trimmed)) return undefined;

  for (const token of shorthandTokens(trimmed)) {
    const sizePart = token.split("/")[0];
    if (/^[\d.]+(?:px|rem)$/.test(sizePart) || /^var\(/.test(sizePart))
      return sizePart;
  }
  throw new Error(`unsupported font shorthand value: ${trimmed}`);
}

function fontSizeViolations(
  sources: readonly StylesheetSource[],
  tokens: ReadonlyMap<string, string>,
): string[] {
  const violations: string[] = [];

  const resolveFontSizePx = (
    rawValue: string,
    seen = new Set<string>(),
  ): number => {
    const value = rawValue.trim();

    const length = /^([\d.]+)(px|rem)$/.exec(value);
    if (length) {
      const amount = Number(length[1]);
      if (!Number.isFinite(amount))
        throw new Error(`invalid font-size value: ${value}`);
      if (length[2] === "rem") return amount * DEFAULT_ROOT_PX;
      return amount;
    }

    const variable = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/.exec(value);
    if (variable) {
      const [, name, fallback] = variable;
      if (seen.has(name))
        throw new Error(`circular font-size token reference: ${name}`);
      const tokenValue = tokens.get(name);
      if (tokenValue !== undefined)
        return resolveFontSizePx(tokenValue, new Set([...seen, name]));
      if (fallback !== undefined) return resolveFontSizePx(fallback, seen);
      throw new Error(`undefined font-size token: ${name}`);
    }

    throw new Error(`unsupported font-size value: ${value}`);
  };

  for (const source of sources) {
    const css = stripCssComments(source.css);
    for (const match of css.matchAll(
      /(?:^|[;{])\s*font-size\s*:\s*([^;{}]+?)\s*(?=;|})/gm,
    )) {
      const [, value] = match;
      const location = sourceLocation(source, match.index ?? 0);

      try {
        const pixels = resolveFontSizePx(value);
        if (pixels >= MIN_TEXT_PX) continue;
        const rendered = Number(pixels.toFixed(4));
        violations.push(
          `${location}  font-size ${value.trim()} resolves to ${rendered}px, below ${MIN_TEXT_PX}px`,
        );
      } catch (error) {
        violations.push(`${location}  ${(error as Error).message}`);
      }
    }

    for (const match of css.matchAll(
      /(?:^|[;{])\s*font\s*:\s*([^;{}]+?)\s*(?=;|})/gm,
    )) {
      const [, value] = match;
      const location = sourceLocation(source, match.index ?? 0);

      try {
        const sizeValue = shorthandFontSize(value);
        // A system-font keyword or a global CSS keyword has no resolvable
        // pixel size here; the browser (or the inherited value) supplies it,
        // so it is explicitly known-safe rather than silently skipped.
        if (sizeValue === undefined) continue;
        const pixels = resolveFontSizePx(sizeValue);
        if (pixels >= MIN_TEXT_PX) continue;
        const rendered = Number(pixels.toFixed(4));
        violations.push(
          `${location}  font ${value.trim()} resolves to ${rendered}px, below ${MIN_TEXT_PX}px`,
        );
      } catch (error) {
        violations.push(`${location}  ${(error as Error).message}`);
      }
    }
  }
  return violations;
}

/**
 * A second, separate hole from the one `fontSizeViolations` closes: a raw
 * `14px` literal at or above the 12px floor passes that check cleanly, but
 * it is frozen to the 16px-root default and never moves when the reader
 * raises their OS/browser text size — the exact harm `typography.css`'s own
 * comment names. This only fires on a bare `NNpx` literal; `var(--text-sm)`
 * and a raw `rem` value both pass, since both resolve relative to the root.
 *
 * Deliberately scoped to `GUARDED_REM_STYLESHEETS`, not every stylesheet in
 * the tree: a repo-wide run today finds 103 pre-existing hits, which is a
 * separately ranked, wide-blast-radius cleanup (P3 in the 04/08 UX audit),
 * not this fix. Grow the list file-by-file as each surface converts; it must
 * never shrink once a file is on it.
 */
const GUARDED_REM_STYLESHEETS = [
  "components/library/LibraryView.css",
  "components/library/ContinueReading.css",
  "components/library/DocumentCard.css",
  "components/library/ShelfSidebar.css",
  "components/library/SearchBar.css",
];

function nonRemFontSizeViolations(
  sources: readonly StylesheetSource[],
): string[] {
  const violations: string[] = [];
  const isLiteralPx = (value: string) => /^[\d.]+px$/.test(value.trim());

  for (const source of sources) {
    const css = stripCssComments(source.css);

    for (const match of css.matchAll(
      /(?:^|[;{])\s*font-size\s*:\s*([^;{}]+?)\s*(?=;|})/gm,
    )) {
      const [, value] = match;
      if (!isLiteralPx(value)) continue;
      violations.push(
        `${sourceLocation(source, match.index ?? 0)}  font-size ${value.trim()} is a literal px value — use rem or a --text-* token so it tracks the reader's OS/browser text size`,
      );
    }

    for (const match of css.matchAll(
      /(?:^|[;{])\s*font\s*:\s*([^;{}]+?)\s*(?=;|})/gm,
    )) {
      const [, value] = match;
      let sizeValue: string | undefined;
      try {
        sizeValue = shorthandFontSize(value);
      } catch {
        continue; // fontSizeViolations already reports unsupported forms
      }
      if (sizeValue === undefined || !isLiteralPx(sizeValue)) continue;
      violations.push(
        `${sourceLocation(source, match.index ?? 0)}  font ${value.trim()} sets a literal px size — use rem or a --text-* token so it tracks the reader's OS/browser text size`,
      );
    }
  }
  return violations;
}

describe("design tokens: every referenced token is defined", () => {
  it("extracts runtime style sheets without parsing unrelated TSX", () => {
    const [sheet] = embeddedStylesheets(
      "probe.tsx",
      [
        'const decoy = "<style>var(--not-css)</style>";',
        'const node = <div style={{ color: "white" }} />;',
        "const sheet = <style>{`.probe { color: var(--real-css); }`}</style>;",
      ].join("\n"),
    );
    expect(sheet.css).toContain("var(--real-css)");
    expect(sheet.css).not.toContain("--not-css");
    expect(sheet.css).not.toContain('color: "white"');
    expect(() =>
      embeddedStylesheets(
        "dynamic.tsx",
        "const sheet = <style>{runtimeCss}</style>;",
      ),
    ).toThrow("every runtime <style> must be a static template literal");
  });

  it("does not mistake a component-scoped declaration for a global token", () => {
    expect(
      globalTokenNames(
        ".owner { --local-only: red; } :root { --global: blue; }",
      ),
    ).toEqual(new Set(["--global"]));
  });

  it("no stylesheet names a var() the token layer never declares", () => {
    const sources = stylesheetSources(SRC);
    const environments: readonly [string, ThemeEnvironment][] = [
      ["light", { colorScheme: "light", contrastMore: false }],
      ["system dark", { colorScheme: "dark", contrastMore: false }],
      [
        "explicit light on dark system",
        { colorScheme: "dark", contrastMore: false, dataTheme: "light" },
      ],
      [
        "explicit dark",
        { colorScheme: "light", contrastMore: false, dataTheme: "dark" },
      ],
    ];
    const definitions = environments.map(([name, environment]) => {
      const defined = new Set<string>();
      for (const source of sources) {
        for (const token of themeDeclarations(source.css, environment).keys())
          defined.add(token);
      }
      return [name, defined] as const;
    });

    const undefinedRefs: string[] = [];
    for (const source of sources) {
      const css = stripCssComments(source.css);
      for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
        const name = match[1];
        const missingFrom = definitions
          .filter(([, defined]) => !defined.has(name))
          .map(([environment]) => environment);
        if (missingFrom.length === 0) continue;
        undefinedRefs.push(
          `${sourceLocation(source, match.index ?? 0)}  ${name} missing from ${missingFrom.join(", ")}`,
        );
      }
    }

    // A fallback does NOT make an undefined token acceptable: it pins a literal
    // that cannot theme, which is exactly how 21 rules ended up at 1.06:1.
    expect(undefinedRefs).toEqual([]);
  });
});

describe("design tokens: WCAG AA contrast floor", () => {
  it("models specificity before source order in overlapping media queries", () => {
    const probe = themeDeclarations(
      `
        :root { --probe: base; }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) { --probe: specific-dark; }
        }
        @media (prefers-contrast: more) {
          :root { --probe: later-but-less-specific; }
        }
      `,
      { colorScheme: "dark", contrastMore: true },
    );
    expect(probe.get("--probe")).toBe("specific-dark");
  });

  it.each([
    ["light", HIGH_CONTRAST_LIGHT],
    ["system dark", HIGH_CONTRAST_SYSTEM_DARK],
    ["explicit dark", HIGH_CONTRAST_EXPLICIT_DARK],
    [
      "explicit dark on a dark system",
      HIGH_CONTRAST_EXPLICIT_DARK_ON_DARK_SYSTEM,
    ],
  ] as const)(
    "%s high-contrast path applies its text and border overrides",
    (_name, tokens) => {
      const resolved = (token: string) =>
        resolve(tokens.get(token) as string, tokens);
      expect(resolved("--color-text-secondary")).toEqual(
        resolved("--color-text-primary"),
      );
      expect(resolved("--color-text-tertiary")).toEqual(
        resolved("--color-text-primary"),
      );
      expect(resolved("--color-border")).toEqual(resolved("--ctp-subtext0"));
      expect(resolved("--color-border-hover")).toEqual(resolved("--ctp-text"));
      expect(resolved("--color-accent-text")).toEqual(resolved("--ctp-text"));
    },
  );

  it("components use semantic tokens for explicit foreground colours", () => {
    const violations: string[] = [];
    for (const source of stylesheetSources(SRC)) {
      const css = stripCssComments(source.css);
      for (const match of css.matchAll(
        /(?:^|[;{}])\s*color\s*:\s*([^;]+);/gm,
      )) {
        const value = match[1].trim();
        if (value.startsWith("var(") || value === "inherit") continue;
        violations.push(
          `${sourceLocation(source, match.index ?? 0)}  ${value}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("system and explicit dark paths resolve to the same contract", () => {
    const contractTokens = new Set([
      ...TEXT_TOKENS,
      ...SURFACE_TOKENS,
      ...ON_FILL_PAIRS.flat(),
    ]);
    for (const token of contractTokens) {
      const systemValue = DARK_SYSTEM.get(token);
      const explicitValue = DARK_EXPLICIT.get(token);
      expect(systemValue, `${token} missing from system dark`).toBeDefined();
      expect(
        explicitValue,
        `${token} missing from explicit dark`,
      ).toBeDefined();
      expect(resolve(systemValue as string, DARK_SYSTEM), token).toEqual(
        resolve(explicitValue as string, DARK_EXPLICIT),
      );
    }
  });

  it("system and explicit high-contrast dark paths resolve identically", () => {
    const contractTokens = new Set([
      ...TEXT_TOKENS,
      ...SURFACE_TOKENS,
      ...ON_FILL_PAIRS.flat(),
      "--color-border",
      "--color-border-hover",
    ]);
    for (const token of contractTokens) {
      expect(
        resolve(
          HIGH_CONTRAST_SYSTEM_DARK.get(token) as string,
          HIGH_CONTRAST_SYSTEM_DARK,
        ),
        token,
      ).toEqual(
        resolve(
          HIGH_CONTRAST_EXPLICIT_DARK.get(token) as string,
          HIGH_CONTRAST_EXPLICIT_DARK,
        ),
      );
      expect(
        resolve(
          HIGH_CONTRAST_EXPLICIT_DARK_ON_DARK_SYSTEM.get(token) as string,
          HIGH_CONTRAST_EXPLICIT_DARK_ON_DARK_SYSTEM,
        ),
        `${token} differs when explicit dark and OS dark both match`,
      ).toEqual(
        resolve(
          HIGH_CONTRAST_EXPLICIT_DARK.get(token) as string,
          HIGH_CONTRAST_EXPLICIT_DARK,
        ),
      );
    }
  });

  it("binds the playback error banner to the tested semantic error surface", () => {
    const css = stripCssComments(
      readFileSync(
        join(SRC, "components/playback-bar/AiPlaybackBar.css"),
        "utf8",
      ),
    );
    const rule = styleRules(css).find(
      ({ selector }) => selector === ".ai-playback-error",
    );
    const buttonRule = styleRules(css).find(
      ({ selector }) => selector === ".ai-playback-error button",
    );
    const hoverRule = styleRules(css).find(
      ({ selector }) => selector === ".ai-playback-error button:hover",
    );
    expect(rule?.body).toMatch(/background:\s*var\(--color-error-bg\)/);
    expect(rule?.body).toMatch(/color:\s*var\(--color-error-text\)/);
    expect(buttonRule?.body).toMatch(/color:\s*var\(--color-error-text\)/);
    expect(hoverRule?.body).toMatch(/background:\s*var\(--color-error-hover\)/);
  });

  it("binds runtime status sheets to measured semantic pairs", () => {
    const runtimeRule = (relativeFile: string, selector: string) => {
      const file = join(SRC, relativeFile);
      const [sheet] = embeddedStylesheets(file, readFileSync(file, "utf8"));
      return styleRules(stripCssComments(sheet.css)).find(
        (rule) => rule.selector === selector,
      )?.body;
    };

    const scannedSurface = runtimeRule(
      "components/common/ScannedPdfWarning.tsx",
      ".warning-content",
    );
    const scannedText = runtimeRule(
      "components/common/ScannedPdfWarning.tsx",
      ".warning-text strong",
    );
    expect(scannedSurface).toMatch(/background:\s*var\(--color-warning-bg\)/);
    expect(scannedText).toMatch(/color:\s*var\(--color-warning-text\)/);

    const memorySurface = runtimeRule(
      "components/common/MemoryCapWarning.tsx",
      ".memory-cap-warning .warning-content",
    );
    const memoryText = runtimeRule(
      "components/common/MemoryCapWarning.tsx",
      ".memory-cap-warning .warning-text strong",
    );
    expect(memorySurface).toMatch(/background:\s*var\(--color-info-bg\)/);
    expect(memoryText).toMatch(/color:\s*var\(--color-info-text\)/);

    const debugButton = runtimeRule(
      "components/settings/DebugLogs.tsx",
      ".debug-logs-button.primary",
    );
    const debugHover = runtimeRule(
      "components/settings/DebugLogs.tsx",
      ".debug-logs-button.primary:hover:not(:disabled)",
    );
    const debugLevels = [
      ["error", "--color-error-text"],
      ["warn", "--color-warning-text"],
      ["info", "--color-info-text"],
      ["debug", "--color-text-secondary"],
    ] as const;
    const debugFile = readFileSync(
      join(SRC, "components/settings/DebugLogs.tsx"),
      "utf8",
    );
    expect(debugButton).toMatch(/background:\s*var\(--color-accent\)/);
    expect(debugButton).toMatch(/color:\s*var\(--color-on-accent\)/);
    expect(debugHover).toMatch(/background:\s*var\(--color-accent-hover\)/);
    expect(debugFile).toContain(
      "debug-log-level debug-log-level--${log.level}",
    );
    expect(debugFile).not.toMatch(/style\s*=\s*\{\{\s*color\s*:/);
    for (const [level, token] of debugLevels) {
      expect(
        runtimeRule(
          "components/settings/DebugLogs.tsx",
          `.debug-log-level--${level}`,
        ),
      ).toMatch(new RegExp(`color:\\s*var\\(${token}\\)`));
    }
  });

  it("components do not render text with a fill-only token", () => {
    const violations: string[] = [];
    for (const source of stylesheetSources(SRC)) {
      const css = source.css;
      for (const match of css.matchAll(
        /(?:^|[;{}])\s*color\s*:\s*var\(\s*(--[\w-]+)/gm,
      )) {
        const token = match[1];
        if (!FILL_ONLY_TOKENS.has(token)) continue;
        violations.push(
          `${sourceLocation(source, match.index ?? 0)}  ${token}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it.each(THEMES)("%s theme resolves every colour token", (_name, tokens) => {
    for (const token of [...TEXT_TOKENS, ...SURFACE_TOKENS]) {
      const value = tokens.get(token);
      expect(value, `${token} is not defined`).toBeDefined();
      expect(resolve(value as string, tokens)).not.toBe(NOT_OPAQUE);
    }
  });

  it.each(THEMES)(
    "%s theme: every text colour clears 4.5:1 on every surface",
    (_name, tokens) => {
      const failures: string[] = [];
      for (const text of TEXT_TOKENS) {
        const fg = resolve(tokens.get(text) as string, tokens) as Rgb;
        for (const surface of SURFACE_TOKENS) {
          const bg = resolve(tokens.get(surface) as string, tokens) as Rgb;
          const ratio = contrastRatio(fg, bg);
          if (ratio < AA_TEXT)
            failures.push(`${text} on ${surface} = ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it.each(THEMES)(
    "%s theme: text on a filled control clears 4.5:1",
    (_name, tokens) => {
      const failures: string[] = [];
      for (const [text, fill] of ON_FILL_PAIRS) {
        const fg = resolve(tokens.get(text) as string, tokens) as Rgb;
        const bg = resolve(tokens.get(fill) as string, tokens) as Rgb;
        const ratio = contrastRatio(fg, bg);
        if (ratio < AA_TEXT)
          failures.push(`${text} on ${fill} = ${ratio.toFixed(2)}:1`);
      }
      expect(failures).toEqual([]);
    },
  );

  it.each(THEMES)(
    "%s theme: on-dark text clears 4.5:1 on the lightest dark overlay",
    (_name, tokens) => {
      const foreground = resolve(
        tokens.get("--color-on-dark") as string,
        tokens,
      ) as Rgb;
      // The least-dark shipped overlay is 75% black. Over a white page it
      // composites to rgb(64 64 64); every darker backdrop increases contrast.
      expect(contrastRatio(foreground, [64, 64, 64])).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    },
  );

  it("the smallest permitted text size is at least 12px", () => {
    const typography = readFileSync(
      join(SRC, "ui/tokens/typography.css"),
      "utf8",
    );
    const xs = /--text-xs:\s*([\d.]+)rem/.exec(typography);
    expect(
      xs,
      "--text-xs must be declared in rem so it tracks OS text size",
    ).not.toBeNull();
    // rem keeps the scale proportional to the reader's root size; the floor is
    // the value at the 16px default.
    expect(Number(xs?.[1]) * DEFAULT_ROOT_PX).toBeGreaterThanOrEqual(
      MIN_TEXT_PX,
    );

    const typographyTokens = themeDeclarations(typography, {
      colorScheme: "light",
      contrastMore: false,
    });
    expect(
      fontSizeViolations(stylesheetSources(SRC), typographyTokens),
    ).toEqual([]);
  });

  it("guarded reading-home stylesheets never set font-size in a bare px literal", () => {
    const guarded = stylesheetSources(SRC).filter((s) =>
      GUARDED_REM_STYLESHEETS.some((rel) => s.file === join(SRC, rel)),
    );
    expect(guarded).toHaveLength(GUARDED_REM_STYLESHEETS.length);
    expect(nonRemFontSizeViolations(guarded)).toEqual([]);
  });

  it("catches a bare px literal even when it clears the 12px floor", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: ".probe { font-size: 14px; }",
      startLine: 1,
    };
    expect(nonRemFontSizeViolations([probe])).toEqual([
      "probe.css:1  font-size 14px is a literal px value \u2014 use rem or a --text-* token so it tracks the reader's OS/browser text size",
    ]);
  });

  it("rejects a rem size that renders below 12px at the default root", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: ".probe { font-size: 0.5rem; }",
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([
      "probe.css:1  font-size 0.5rem resolves to 8px, below 12px",
    ]);
  });

  it("fails closed on unsupported explicit font-size forms", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: [
        ".relative { font-size: 0.5em; }",
        ".calculated { font-size: calc(1rem - 8px); }",
      ].join("\n"),
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([
      "probe.css:1  unsupported font-size value: 0.5em",
      "probe.css:2  unsupported font-size value: calc(1rem - 8px)",
    ]);
  });

  it("catches a `font` shorthand whose size is below 12px, not just `font-size`", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: ".probe { font: 8px/1 sans-serif; }",
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([
      "probe.css:1  font 8px/1 sans-serif resolves to 8px, below 12px",
    ]);
  });

  it("fails closed on a `font` shorthand whose size token cannot be resolved", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: ".probe { font: var(--nope)/1.4 sans-serif; }",
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([
      "probe.css:1  undefined font-size token: --nope",
    ]);
  });

  it("treats a skip-listed keyword as safe even with an `!important` modifier", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: ".a { font: inherit !important; }",
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([]);
  });

  it("treats `font: inherit` and other system-font keywords as explicitly safe", () => {
    const probe = {
      file: join(REPO_ROOT, "probe.css"),
      css: [
        ".a { font: inherit; }",
        ".b { font: caption; }",
        ".c { font: menu; }",
      ].join("\n"),
      startLine: 1,
    };

    expect(fontSizeViolations([probe], new Map())).toEqual([]);
  });

  it("the three live `font: inherit` sites stay green", () => {
    const typographyTokens = themeDeclarations(
      readFileSync(join(SRC, "ui/tokens/typography.css"), "utf8"),
      { colorScheme: "light", contrastMore: false },
    );
    expect(
      fontSizeViolations(
        [
          {
            file: join(SRC, "components/highlights/HighlightsPanel.css"),
            css: readFileSync(
              join(SRC, "components/highlights/HighlightsPanel.css"),
              "utf8",
            ),
            startLine: 1,
          },
          {
            file: join(SRC, "components/library/ContinueReading.css"),
            css: readFileSync(
              join(SRC, "components/library/ContinueReading.css"),
              "utf8",
            ),
            startLine: 1,
          },
          {
            file: join(SRC, "components/library/DocumentCard.css"),
            css: readFileSync(
              join(SRC, "components/library/DocumentCard.css"),
              "utf8",
            ),
            startLine: 1,
          },
        ],
        typographyTokens,
      ),
    ).toEqual([]);
  });
});
