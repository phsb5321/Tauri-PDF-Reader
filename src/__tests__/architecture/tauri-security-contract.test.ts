/**
 * Executable contract over the Tauri security surface: CSP directives, the
 * capability/permission allowlist, and the fs plugin scope. Nothing failed
 * when these got looser before this file existed — `tauri.conf.json` and
 * `capabilities/default.json` are hand-edited JSON with no gate.
 *
 * SCOPE: this test covers what Tauri's own config enforces — the WebView CSP,
 * the declared capability permissions, and the `fs:scope` allow-list. It does
 * NOT cover the app's actual disk access. Several custom Rust command
 * handlers (`src-tauri/src/commands/library/{db,heal}.rs`,
 * `src-tauri/src/adapters/audio_cache.rs`,
 * `src-tauri/src/adapters/sqlite/audio_cache_repo.rs`,
 * `src-tauri/src/application/audio_export_service.rs`) call `std::fs`/
 * `tokio::fs` directly and are NOT bound by `fs:scope` — Tauri's fs-scope
 * mechanism only restricts the fs *plugin* JS API, not arbitrary Rust code
 * running inside a command. A green run here says the declared surface has
 * not widened; it says nothing about what those command handlers touch.
 *
 * Every assertion below is a RATCHET, not a snapshot:
 *  - CSP is asserted per-directive as a set of source tokens, so reordering
 *    or reformatting the string doesn't fail, but adding a token
 *    (`'unsafe-inline'` to `script-src`, a new host to `connect-src`, ...)
 *    does.
 *  - Permissions and fs-scope patterns are asserted as an ALLOWLIST: every
 *    permission/pattern actually declared must be a member of the expected
 *    set. Adding one that isn't in the set fails. Removing a declared one
 *    passes — capability narrowing is never penalised, so this file cannot
 *    become the reason a legitimate tightening is blocked.
 *
 * This slice makes today's posture assertable. It intentionally changes no
 * CSP/capability/scope value — tightening is a separate slice with its own
 * packaged-app falsifier.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// NB: `fileURLToPath(import.meta.url)` held in a const, not
// `new URL("<literal>", import.meta.url)` — Vite rewrites the latter into an
// http:// asset reference and readFileSync throws on it.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const TAURI_CONF = join(REPO_ROOT, "src-tauri/tauri.conf.json");
const DEFAULT_CAPABILITY = join(
  REPO_ROOT,
  "src-tauri/capabilities/default.json",
);

interface TauriConf {
  app: {
    security: {
      csp: string;
      assetProtocol: { enable: boolean; scope: string[] };
    };
  };
}

interface ScopePermission {
  identifier: string;
  allow?: Array<{ path: string }>;
}

interface CapabilityFile {
  identifier: string;
  windows: string[];
  permissions: Array<string | ScopePermission>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/** Splits a CSP header string into a directive -> sorted source-token list map. */
function parseCsp(csp: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const clause of csp.split(";")) {
    const tokens = clause.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [directive, ...sources] = tokens;
    directives[directive] = [...sources].sort();
  }
  return directives;
}

/** Canonicalizes a permission entry (string or scope object) to one string. */
function canonicalizePermission(perm: string | ScopePermission): string {
  if (typeof perm === "string") return perm;
  const allow = (perm.allow ?? [])
    .map((entry) => entry.path)
    .sort()
    .join(",");
  return `${perm.identifier}:allow=[${allow}]`;
}

describe("Tauri security contract", () => {
  const conf = readJson<TauriConf>(TAURI_CONF);
  const capability = readJson<CapabilityFile>(DEFAULT_CAPABILITY);

  describe("CSP directives", () => {
    const directives = parseCsp(conf.app.security.csp);

    // Pinned per-directive, not as one blob string: this fails when a source
    // token is added/removed/changed, not when the string is reformatted.
    const EXPECTED: Record<string, string[]> = {
      "default-src": ["'self'", "asset:", "http://asset.localhost"].sort(),
      "script-src": ["'self'", "'unsafe-eval'", "blob:"].sort(),
      "style-src": ["'self'", "'unsafe-inline'"].sort(),
      "img-src": [
        "'self'",
        "asset:",
        "http://asset.localhost",
        "blob:",
        "data:",
      ].sort(),
      "connect-src": [
        "'self'",
        "asset:",
        "http://asset.localhost",
        "https://cdn.jsdelivr.net",
      ].sort(),
      "worker-src": ["'self'", "blob:"].sort(),
    };

    it("declares exactly the expected directives, no more, no fewer", () => {
      expect(Object.keys(directives).sort()).toEqual(
        Object.keys(EXPECTED).sort(),
      );
    });

    for (const directive of Object.keys(EXPECTED)) {
      it(`${directive} carries exactly its expected source tokens`, () => {
        expect(directives[directive]).toEqual(EXPECTED[directive]);
      });
    }
  });

  describe("asset protocol scope", () => {
    it("stays empty (asset:// serves nothing outside the declared CSP hosts)", () => {
      expect(conf.app.security.assetProtocol.scope).toEqual([]);
    });
  });

  describe("capability permission allowlist", () => {
    // Every permission the capability file actually declares must be a
    // member of this set. An ADDITION not in the set fails. A REMOVAL from
    // the capability file (this set shrinking in practice) still passes —
    // narrowing capabilities is never blocked by this contract.
    const ALLOWED_PERMISSIONS = new Set([
      "core:default",
      "fs:default",
      "fs:allow-read-file",
      "fs:scope:allow=[$APPLOCALDATA/**]",
      "dialog:default",
      "dialog:allow-open",
      "sql:default",
      "sql:allow-execute",
      "sql:allow-select",
      "shell:allow-open",
    ]);

    it("declares only allowlisted permissions", () => {
      const declared = capability.permissions.map(canonicalizePermission);
      const notAllowed = declared.filter((p) => !ALLOWED_PERMISSIONS.has(p));
      expect(notAllowed).toEqual([]);
    });

    it("scopes to the main window only", () => {
      expect(capability.windows).toEqual(["main"]);
    });
  });

  describe("fs plugin scope", () => {
    // SCOPE NOTE: this only covers `fs:scope` in the capability file, which
    // gates the `@tauri-apps/plugin-fs` JS API. It does NOT cover
    // `std::fs`/`tokio::fs` calls made directly by custom Rust command
    // handlers (library heal/db, audio cache, audio export) — those bypass
    // this scope entirely and are outside what this file can assert.
    const scopePermission = capability.permissions.find(
      (p): p is ScopePermission =>
        typeof p !== "string" && p.identifier === "fs:scope",
    );

    const ALLOWED_SCOPE_PATTERNS = new Set(["$APPLOCALDATA/**"]);

    it("has an fs:scope permission", () => {
      expect(scopePermission).toBeDefined();
    });

    it("allows only allowlisted path patterns (widening fails, narrowing passes)", () => {
      const declared = (scopePermission?.allow ?? []).map((e) => e.path);
      const notAllowed = declared.filter((p) => !ALLOWED_SCOPE_PATTERNS.has(p));
      expect(notAllowed).toEqual([]);
    });
  });
});
