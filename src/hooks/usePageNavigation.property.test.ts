import { execFileSync } from "node:child_process";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri-invoke", () => ({
  aiTtsStop: vi.fn(() => Promise.resolve()),
}));

import { aiTtsStop } from "../lib/tauri-invoke";
import { useAiTtsStore } from "../stores/ai-tts-store";
import { useDocumentStore } from "../stores/document-store";
import { navigatePageBy } from "./usePageNavigation";

type PlaybackState = "idle" | "playing" | "paused";

interface NavigationModel {
  page: number;
  readonly totalPages: number;
  readonly actions: NavigationAction[];
}

type NavigationReal = Record<string, never>;

interface NavigationAction {
  kind: "navigate";
  delta: number;
  playback: PlaybackState;
}

interface NavigationTrace {
  version: 1;
  modelRevision: "page-navigation-v1";
  buildRevision: string;
  seed: number;
  path: string | undefined;
  numRuns: number;
  initialState: { page: number; totalPages: number } | undefined;
  actions: NavigationAction[];
  failingAssertion: string | null;
  minimizedActions: NavigationAction[] | null;
  failed: boolean;
  replayCommand: string;
}

interface ModelRunOptions {
  seed: number;
  path: string | undefined;
  numRuns: number;
  commands: fc.Arbitrary<fc.AsyncCommand<NavigationModel, NavigationReal>>;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function replayPath(): string | undefined {
  const path = process.env.FC_PATH;
  return path && path.trim() ? path : undefined;
}

function buildRevision(): string {
  const fromCi = process.env.GITHUB_SHA?.trim();
  if (fromCi) return fromCi;
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (!revision)
    throw new Error("cannot emit fuzz evidence without a build revision");
  return revision;
}

function clamp(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}

class NavigateCommand implements fc.AsyncCommand<
  NavigationModel,
  NavigationReal
> {
  constructor(
    private readonly delta: number,
    private readonly playback: PlaybackState,
    private readonly plantedFailure = false,
  ) {}

  check(): boolean {
    return true;
  }

  async run(model: NavigationModel): Promise<void> {
    model.actions.push({
      kind: "navigate",
      delta: this.delta,
      playback: this.playback,
    });
    useAiTtsStore.setState({ playbackState: this.playback });
    const stopsBefore = vi.mocked(aiTtsStop).mock.calls.length;

    await navigatePageBy(this.delta);

    model.page = clamp(model.page + this.delta, model.totalPages);
    expect(useDocumentStore.getState().currentPage).toBe(model.page);
    expect(vi.mocked(aiTtsStop).mock.calls.length - stopsBefore).toBe(
      this.playback === "idle" ? 0 : 1,
    );
    if (this.plantedFailure)
      throw new Error("planted navigation oracle failure");
  }

  toString(): string {
    return `navigate(${this.delta}) while ${this.playback}`;
  }
}

const command = fc
  .record({
    delta: fc.integer({ min: -10, max: 10 }).filter((value) => value !== 0),
    playback: fc.constantFrom<PlaybackState>("idle", "playing", "paused"),
  })
  .map(({ delta, playback }) => new NavigateCommand(delta, playback));

async function runNavigationModel({
  seed,
  path,
  numRuns,
  commands,
}: ModelRunOptions): Promise<NavigationTrace> {
  const trace: NavigationTrace = {
    version: 1,
    modelRevision: "page-navigation-v1",
    buildRevision: buildRevision(),
    seed,
    path,
    numRuns,
    initialState: undefined,
    actions: [],
    failingAssertion: null,
    minimizedActions: null,
    failed: false,
    replayCommand: "",
  };
  let capturedFailure = false;
  const result = await fc.check(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 2_000 }),
      fc.integer({ min: -2_000, max: 4_000 }),
      fc.commands([commands], { maxCommands: 100 }),
      async (totalPages, requestedPage, generatedCommands) => {
        const page = clamp(requestedPage, totalPages);
        useDocumentStore.setState({ currentPage: page, totalPages });
        const model: NavigationModel = { page, totalPages, actions: [] };
        trace.initialState = { page, totalPages };
        let failed = false;
        try {
          await fc.asyncModelRun(
            () => ({ model, real: {} }),
            generatedCommands,
          );
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          // `asyncModelRun` throws before its await resolves on an oracle failure.
          // Preserve its action prefix, and never let successful shrink probes
          // overwrite the last failing (ultimately minimized) attempt.
          if (failed || !capturedFailure) {
            trace.initialState = { page, totalPages };
            trace.actions = [...model.actions];
          }
          if (failed) capturedFailure = true;
        }
      },
    ),
    { seed, path, numRuns, verbose: true },
  );
  trace.failed = result.failed;
  trace.failingAssertion = result.failed ? String(result.errorInstance) : null;
  trace.minimizedActions = result.failed ? [...trace.actions] : null;
  const replayPathValue = result.counterexamplePath ?? path;
  trace.path = replayPathValue;
  trace.replayCommand = [
    `FC_SEED=${seed}`,
    replayPathValue ? `FC_PATH=${replayPathValue}` : undefined,
    `FC_NUM_RUNS=${numRuns}`,
    "pnpm test:fuzz",
  ]
    .filter(Boolean)
    .join(" ");
  return trace;
}

beforeEach(() => {
  useDocumentStore.getState().reset();
  useAiTtsStore.setState({ playbackState: "idle" });
  vi.mocked(aiTtsStop).mockReset();
  vi.mocked(aiTtsStop).mockResolvedValue(undefined);
});

describe("page navigation model", () => {
  it("preserves page bounds and the stop-before-navigation contract across action sequences", async () => {
    const seed = positiveInteger("FC_SEED", 20260801);
    const numRuns = positiveInteger("FC_NUM_RUNS", 100);
    const path = replayPath();
    const trace = await runNavigationModel({
      seed,
      path,
      numRuns,
      commands: command,
    });
    console.error(JSON.stringify(trace));
    expect(trace.failed, trace.replayCommand).toBe(false);
  });

  it("retains and replays the shrunk action prefix for a planted oracle failure", async () => {
    const planted = fc.constant(new NavigateCommand(1, "idle", true));
    const first = await runNavigationModel({
      seed: 17,
      path: undefined,
      numRuns: 1,
      commands: planted,
    });
    expect(first.failed).toBe(true);
    expect(first.actions).toEqual([
      { kind: "navigate", delta: 1, playback: "idle" },
    ]);
    expect(first.minimizedActions).toEqual(first.actions);
    expect(first.replayCommand).toContain("FC_SEED=17");
    expect(first.path).toBeTruthy();
    expect(first.replayCommand).toContain(`FC_PATH=${first.path}`);
    expect(JSON.parse(JSON.stringify(first))).toMatchObject({
      failed: true,
      minimizedActions: first.actions,
    });

    const replay = await runNavigationModel({
      seed: 17,
      path: first.path,
      numRuns: 1,
      commands: planted,
    });
    expect(replay.failed).toBe(true);
    expect(replay.actions).toEqual(first.minimizedActions);
  });
});
