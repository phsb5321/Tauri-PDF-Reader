/// <reference types="vite/client" />

/**
 * E2E-native build lanes (VITE_E2E_NATIVE=true builds only — tree-shaken out
 * of normal builds). Typed so the type-coverage ratchet (≥ 99.9%) does not
 * count `import.meta.env.VITE_*` reads as untyped `any`.
 */
interface ImportMetaEnv {
  readonly VITE_E2E?: string;
  readonly VITE_E2E_NATIVE?: string;
  readonly VITE_E2E_NATIVE_TTS?: "fixture" | "none";
  readonly VITE_E2E_NATIVE_SEED?: "single" | "dual";
  readonly VITE_E2E_PROFILE_DIR?: string;
  readonly VITE_E2E_OPEN_PATH?: string;
  /** Delete lane: replace the WebDriver-impossible native confirm with accept. */
  readonly VITE_E2E_CONFIRM?: "accept";
}

/**
 * CSS Custom Highlight API type declarations
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
 */
declare class Highlight {
  constructor(...ranges: Range[]);
  add(range: Range): void;
  delete(range: Range): boolean;
  has(range: Range): boolean;
  clear(): void;
  readonly size: number;
  priority: number;
  type: "highlight" | "spelling-error" | "grammar-error";
}

interface HighlightRegistry {
  set(name: string, highlight: Highlight): void;
  get(name: string): Highlight | undefined;
  has(name: string): boolean;
  delete(name: string): boolean;
  clear(): void;
  readonly size: number;
  keys(): IterableIterator<string>;
  values(): IterableIterator<Highlight>;
  entries(): IterableIterator<[string, Highlight]>;
  forEach(
    callback: (value: Highlight, key: string, map: HighlightRegistry) => void,
  ): void;
}

interface CSS {
  highlights: HighlightRegistry;
}
