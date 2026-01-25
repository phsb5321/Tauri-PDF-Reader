/// <reference types="vite/client" />

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
  type: 'highlight' | 'spelling-error' | 'grammar-error';
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
  forEach(callback: (value: Highlight, key: string, map: HighlightRegistry) => void): void;
}

interface CSS {
  highlights: HighlightRegistry;
}

