/**
 * Migration runner tests.
 *
 * The regression these pin: the previous runner executed one flat statement
 * list and always stamped `version = 1`, so a database could never advance past
 * migration 1 and `reading_sessions` — which the toolbar's session menu queries
 * — was never created outside Rust unit tests.
 *
 * Scope split: these cover version gating, ordering and idempotency, plus the
 * bootstrap wrapper's failure and sequencing semantics. Whether the SQL itself
 * is valid is covered on the Rust side, where the mirrored DDL in
 * `src-tauri/src/db/migrations.rs` runs against a real in-memory SQLite
 * (`session_repo.rs`, `audio_cache_repo.rs`). Node's own `node:sqlite` would be
 * the better oracle here but only exists from Node 22.5; CI is on 20. Where the
 * database file lands, and the columns external readers are promised, are
 * likewise Rust-side (`src-tauri/tests/frontend_schema_contract.rs`).
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const dbLoad = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: dbLoad } }));
import {
  CONTRACT_VIEWS,
  CONTRACT_VIEW_DROPS,
  MIGRATIONS,
  initSchema,
  pendingMigrations,
  runMigrations,
  type Migration,
  type MigrationRunnerDb,
} from "./db-init";

/**
 * Records every statement the runner executes, and answers the version query
 * from the stamps it has seen. Seed the constructor to simulate a database
 * already at some version.
 */
class RecordingDb implements MigrationRunnerDb {
  readonly executed: string[] = [];

  constructor(
    private readonly applied: Set<number> = new Set(),
    /** Statements this database refuses, so a caller's error path can run. */
    private readonly refuses: (sql: string) => boolean = () => false,
  ) {}

  async execute(sql: string, values: unknown[] = []): Promise<unknown> {
    this.executed.push(sql);
    if (this.refuses(sql)) {
      throw new Error(`database refused: ${sql.slice(0, 40)}`);
    }
    if (sql.includes("INSERT OR IGNORE INTO _migrations")) {
      this.applied.add(values[0] as number);
    }
    return undefined;
  }

  async select<T>(sql: string): Promise<T> {
    if (!/FROM _migrations/.test(sql)) {
      throw new Error(`unexpected query: ${sql}`);
    }
    return [...this.applied].map((version) => ({ version })) as T;
  }

  /** Index of a statement in execution order, or -1. */
  indexOf(sql: string): number {
    return this.executed.indexOf(sql);
  }
}

const versions = (migrations: readonly Migration[]) =>
  migrations.map((m) => m.version);

describe("MIGRATIONS", () => {
  it("numbers versions uniquely and ascending", () => {
    const declared = versions(MIGRATIONS);
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared).toEqual([...declared].sort((a, b) => a - b));
  });

  it("declares only idempotent statements", () => {
    // A migration runs once per database, but a crash between the DDL and the
    // version stamp replays it. Every statement has to survive that.
    const guarded =
      /^(CREATE TABLE IF NOT EXISTS|CREATE (UNIQUE )?INDEX IF NOT EXISTS|INSERT OR IGNORE)/;
    for (const migration of MIGRATIONS) {
      for (const sql of migration.statements) {
        expect(sql.trimStart()).toMatch(guarded);
      }
    }
  });
});

describe("pendingMigrations", () => {
  const fixture: Migration[] = [
    { version: 1, statements: [] },
    { version: 2, statements: [] },
    { version: 3, statements: [] },
  ];

  it("returns every migration for an empty database", () => {
    expect(versions(pendingMigrations(new Set(), fixture))).toEqual([1, 2, 3]);
  });

  it("skips versions already recorded", () => {
    expect(versions(pendingMigrations(new Set([1]), fixture))).toEqual([2, 3]);
  });

  it("returns nothing when fully applied", () => {
    expect(pendingMigrations(new Set([1, 2, 3]), fixture)).toEqual([]);
  });

  it("orders ascending regardless of declaration order", () => {
    const shuffled: Migration[] = [
      { version: 3, statements: [] },
      { version: 1, statements: [] },
      { version: 2, statements: [] },
    ];
    expect(versions(pendingMigrations(new Set(), shuffled))).toEqual([1, 2, 3]);
  });
});

describe("runMigrations", () => {
  it("applies every migration to a fresh database", async () => {
    const db = new RecordingDb();

    await expect(runMigrations(db)).resolves.toEqual(versions(MIGRATIONS));
  });

  it("creates the tracking table before any migration runs", async () => {
    const db = new RecordingDb();
    await runMigrations(db);

    expect(db.executed[0]).toContain("CREATE TABLE IF NOT EXISTS _migrations");
  });

  it("executes each migration statement in declared order", async () => {
    const db = new RecordingDb();
    await runMigrations(db);

    const declared = MIGRATIONS.flatMap((m) => m.statements);
    const indexes = declared.map((sql) => db.indexOf(sql));
    expect(indexes).not.toContain(-1);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("stamps a version only after that migration ran", async () => {
    const db = new RecordingDb();
    await runMigrations(db);

    const stamps = db.executed
      .map((sql, i) => ({ sql, i }))
      .filter(({ sql }) => sql.includes("INSERT OR IGNORE INTO _migrations"))
      .map(({ i }) => i);

    MIGRATIONS.forEach((migration, n) => {
      const last = Math.max(
        ...migration.statements.map((sql) => db.indexOf(sql)),
      );
      expect(stamps[n]).toBeGreaterThan(last);
    });
  });

  it("creates the session tables the toolbar menu queries", async () => {
    const db = new RecordingDb();
    await runMigrations(db);

    // The bug: these existed only in Rust unit tests, never in a real database.
    expect(
      db.executed.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS reading_sessions"),
      ),
    ).toBe(true);
    expect(
      db.executed.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS session_documents"),
      ),
    ).toBe(true);
  });

  it("advances a database stranded at version 1 by the old runner", async () => {
    // Exactly the shape a real installation was left in: migration 1 applied,
    // version 1 recorded, nothing after it.
    const db = new RecordingDb(new Set([1]));

    // Everything declared after 1, whatever that is today — the claim is that
    // the stranded database catches all the way up, not that it stops at 3.
    await expect(runMigrations(db)).resolves.toEqual(
      versions(MIGRATIONS).filter((v) => v > 1),
    );
    // Migration 1 is not replayed.
    for (const sql of MIGRATIONS[0].statements) {
      expect(db.indexOf(sql)).toBe(-1);
    }
  });

  it("is a no-op on a second run", async () => {
    const db = new RecordingDb();
    await runMigrations(db);
    const after = db.executed.length;

    await expect(runMigrations(db)).resolves.toEqual([]);
    // Only the CREATE TABLE IF NOT EXISTS _migrations probe.
    expect(db.executed.length).toBe(after + 1);
  });
});

describe("initSchema", () => {
  const firstMigrationStatement = MIGRATIONS[0].statements[0];

  it("drops the contract views before any migration runs", async () => {
    // SQLite will not drop a column a view still selects, and a migration that
    // throws is never stamped — so a future `ALTER TABLE … DROP COLUMN` landing
    // while the old view is attached would fail on every launch, forever.
    const db = new RecordingDb();
    await initSchema(db);

    for (const sql of CONTRACT_VIEW_DROPS) {
      expect(db.indexOf(sql)).toBeGreaterThanOrEqual(0);
      expect(db.indexOf(sql)).toBeLessThan(db.indexOf(firstMigrationStatement));
    }
  });

  it("recreates them after, on the shape the migrations just produced", async () => {
    const db = new RecordingDb();
    await initSchema(db);

    const lastMigrationStatement = MIGRATIONS.flatMap(
      (m) => m.statements,
    ).reduce((latest, sql) =>
      db.indexOf(sql) > db.indexOf(latest) ? sql : latest,
    );

    for (const sql of CONTRACT_VIEWS) {
      expect(db.indexOf(sql)).toBeGreaterThan(
        db.indexOf(lastMigrationStatement),
      );
    }
  });

  it("rebuilds the views even when no migration is pending", async () => {
    // The point of keeping them out of `MIGRATIONS`: an edited view definition
    // has to reach databases that are already fully migrated.
    const db = new RecordingDb(new Set(MIGRATIONS.map((m) => m.version)));

    await expect(initSchema(db)).resolves.toEqual([]);
    for (const sql of [...CONTRACT_VIEW_DROPS, ...CONTRACT_VIEWS]) {
      expect(db.indexOf(sql)).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * The bootstrap wrapper — the only caller of `initSchema` in the app, invoked
 * once from `main.tsx` before React mounts.
 *
 * Tested through a fresh module instance per case, because the run-once latch
 * is module state: a static import would carry one test's `initialized` into
 * the next.
 */
describe("initDatabase", () => {
  /**
   * How many default settings the wrapper *attempted*, not how many landed —
   * `RecordingDb` records a statement before deciding to refuse it. Attempts
   * are the right count here: the property under test is that the loop runs to
   * the end, and a refused key is still a key the loop reached.
   */
  const settingsAttempted = (db: RecordingDb) =>
    db.executed.filter((sql) => /INSERT OR IGNORE INTO settings\b/.test(sql))
      .length;

  async function freshModule() {
    vi.resetModules();
    return import("./db-init");
  }

  const TAURI = "__TAURI_INTERNALS__";
  let hadTauri: { value?: unknown } = {};

  function tauriPresent(present: boolean) {
    const w = window as unknown as Record<string, unknown>;
    if (present) w[TAURI] = {};
    else delete w[TAURI];
  }

  beforeEach(() => {
    // Restored rather than deleted in `afterEach`: `pdf-service.ts` reads this
    // same global to decide whether it is running under Tauri, so a test that
    // deletes a flag it did not set would be reaching outside its own subject.
    const w = window as unknown as Record<string, unknown>;
    hadTauri = TAURI in w ? { value: w[TAURI] } : {};

    dbLoad.mockReset();
    tauriPresent(true);
    // The wrapper narrates itself to the console; keep the suite's output about
    // the suite.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const w = window as unknown as Record<string, unknown>;
    if ("value" in hadTauri) w[TAURI] = hadTauri.value;
    else delete w[TAURI];
  });

  it("opens no database when there is no Tauri to open one against", async () => {
    // `main.tsx` calls this unconditionally, so it also runs under `vite dev`
    // in a plain browser and under vitest. Reaching for the sql plugin there
    // throws on a missing IPC handler and takes the mount down with it.
    tauriPresent(false);
    const { initDatabase } = await freshModule();

    await expect(initDatabase()).resolves.toBeUndefined();
    expect(dbLoad).not.toHaveBeenCalled();
  });

  it("runs the schema once however often it is called", async () => {
    dbLoad.mockResolvedValue(new RecordingDb());
    const { initDatabase } = await freshModule();

    await initDatabase();
    await initDatabase();

    expect(dbLoad).toHaveBeenCalledTimes(1);
  });

  it("seeds the default settings only after the migration that creates the table", async () => {
    // Ordering is load-bearing *and* silent if broken: `settings` is created by
    // migration 1, and each seed is individually caught below, so seeding first
    // would raise `no such table: settings` eight times into console.warn and
    // otherwise look like a clean start. Every default would simply be missing
    // — no highlight colours, no TTS rate — with nothing in the app to say so.
    const db = new RecordingDb();
    dbLoad.mockResolvedValue(db);
    const { initDatabase } = await freshModule();

    await initDatabase();

    const created = db.executed.findIndex((sql) =>
      /CREATE TABLE IF NOT EXISTS settings\b/.test(sql),
    );
    const firstSeed = db.executed.findIndex((sql) =>
      /INSERT OR IGNORE INTO settings\b/.test(sql),
    );

    expect(created).toBeGreaterThanOrEqual(0);
    expect(firstSeed).toBeGreaterThan(created);
  });

  it("keeps seeding the rest when one default setting is refused", async () => {
    // The per-setting catch exists so a single bad key costs that key, not the
    // seven behind it in the loop — and not the whole launch.
    const clean = new RecordingDb();
    dbLoad.mockResolvedValue(clean);
    await (await freshModule()).initDatabase();
    const total = settingsAttempted(clean);
    expect(total).toBeGreaterThan(1); // else the claim below is vacuous

    let seen = 0;
    const flaky = new RecordingDb(
      new Set(),
      (sql) => /INSERT OR IGNORE INTO settings\b/.test(sql) && seen++ === 0,
    );
    dbLoad.mockResolvedValue(flaky);
    const { initDatabase } = await freshModule();

    await expect(initDatabase()).resolves.toBeUndefined();
    // Equal, not `total` or `total - 1`: a loop that aborted on the refusal
    // would stop at one attempt, which is neither, so the looser form would
    // only blur what counts as passing.
    expect(settingsAttempted(flaky)).toBe(total);
  });

  it("stays un-initialized when the schema fails, so the next call retries", async () => {
    // The opposite — latching on failure — leaves the app running against a
    // half-migrated database while believing it is ready, and every later call
    // returns early instead of repairing it. The throw is what `main.tsx` needs
    // to see, but the retry is what makes a transient failure survivable.
    // Matched on the table name rather than the exact DDL: the point is that
    // the schema step fails, not which statement does it, and a reworded
    // `CREATE TABLE IF NOT EXISTS _migrations` would otherwise stop matching
    // and let the first call succeed — failing this test for a reason that has
    // nothing to do with the property it is named for.
    const refusesMigrations = new RecordingDb(new Set(), (sql) =>
      /\b_migrations\b/.test(sql),
    );
    dbLoad.mockResolvedValueOnce(refusesMigrations);
    const healthy = new RecordingDb();
    dbLoad.mockResolvedValueOnce(healthy);
    const { initDatabase } = await freshModule();

    await expect(initDatabase()).rejects.toThrow("database refused");

    await expect(initDatabase()).resolves.toBeUndefined();
    expect(dbLoad).toHaveBeenCalledTimes(2);
    expect(settingsAttempted(healthy)).toBeGreaterThan(0);
  });
});
