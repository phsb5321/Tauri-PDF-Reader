/**
 * The telemetry fiction is gone (slice 103).
 *
 * The Privacy & Data panel claimed it "sends crash reports and error logs" —
 * nothing sends anything (the only egress is ElevenLabs; CMaps went local in
 * #97). The panel is deleted, the store default that disagreed with the DB
 * seed is flipped to false, and this test pins the absence so the fiction
 * cannot quietly return:
 *
 *  - no telemetry UI file exists, and the settings panel does not render it;
 *  - the store defaults to `false` for both telemetry keys (the DB seeds were
 *    already 'false' — the store was the outlier);
 *  - no analytics/telemetry client library exists anywhere in src or
 *    src-tauri (sentry/posthog/mixpanel/amplitude/segment).
 *
 * The settings keys themselves remain as inert compat shims (schemas +
 * settings-store + db-init seeds) so existing installs do not churn — the
 * same precedent #90's contract test documents for the fs scope.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { useSettingsStore } from "../../stores/settings-store";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const ANALYTICS_CLIENTS = [
  /sentry/i,
  /posthog/i,
  /mixpanel/i,
  /amplitude/i,
  /segment[-_ ]?(analytics|sdk)/i,
];

describe("the telemetry fiction (103)", () => {
  it("no telemetry UI file exists and the settings panel does not render one", () => {
    expect(() =>
      readFileSync(
        join(REPO_ROOT, "src/components/settings/TelemetrySettings.tsx"),
        "utf8",
      ),
    ).toThrow();

    const panel = readFileSync(
      join(REPO_ROOT, "src/components/settings/SettingsPanel.tsx"),
      "utf8",
    );
    expect(panel).not.toContain("TelemetrySettings");
    expect(panel).not.toContain("Privacy & Data");
    expect(panel).not.toContain("telemetry");
  });

  it("the store defaults both telemetry keys to false (matching the DB seeds)", () => {
    const state = useSettingsStore.getState();
    expect(state.telemetryErrors).toBe(false);
    expect(state.telemetryAnalytics).toBe(false);
  });

  it("no analytics client exists in src or src-tauri", () => {
    const roots = ["src", "src-tauri/src"];
    const offenders: string[] = [];
    for (const root of roots) {
      const full = join(REPO_ROOT, root);
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (
            /\.(ts|tsx|rs|js|mjs)$/.test(p) &&
            !p.includes("__tests__") &&
            !/\.test\.|\.spec\./.test(p)
          ) {
            const content = readFileSync(p, "utf8");
            if (ANALYTICS_CLIENTS.some((re) => re.test(content))) {
              offenders.push(p);
            }
          }
        }
      };
      walk(full);
    }
    expect(offenders).toEqual([]);
  });
});
