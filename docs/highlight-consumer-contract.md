# Reading Lectrice's highlights from another program

Lectrice keeps everything in one SQLite file:

```
~/.config/com.lectrice.reader/pdf-reader.db      # Linux
```

Other tools already read it — the Pearson knowledge-gap anchorer turns highlights
into sourced citations (`F1 p.42 — "…"`). This document says which parts of that
file they may rely on.

## The supported surface is one view

```sql
SELECT * FROM v_highlight_citations;
```

| column                    | meaning                                            |
| ------------------------- | -------------------------------------------------- |
| `highlight_id`            | stable id of the highlight                          |
| `document_id`             | stable id of the document                           |
| `file_path`               | absolute path to the PDF as Lectrice last saw it    |
| `title`                   | document title, may be `NULL`                       |
| `page_number`             | 1-based page the highlight is on                    |
| `text_content`            | the highlighted text, may be `NULL` for old rows    |
| `note`                    | free-text note attached to the highlight, or `NULL` |
| `color`                   | hex string, e.g. `#FFEB3B`                          |
| `created_at`              | ISO-8601, when the highlight was made               |
| `document_last_opened_at` | ISO-8601, or `NULL` if never opened                 |

Guarantees:

- **These column names do not change without a change to this file.** The names
  in the base tables are *not* part of the contract — the view exists so they can
  be refactored without breaking anybody.
- A column may be **added**. Select the ones you need rather than depending on
  position or on `SELECT *` returning a fixed width.
- Removing or renaming a column here is a breaking change and needs a note in
  this document.
- `src-tauri/tests/frontend_schema_contract.rs` reads the production DDL out of
  `src/lib/db-init.ts`, executes it against a real SQLite database, and asserts
  every name above — plus the values, so a view joined the wrong way fails too.
  Rename a base column without updating the view and that test goes red before it
  ships.
- The view is dropped and recreated every time the app starts, so a database that
  has been opened once by a given build has that build's definition. It is not a
  versioned migration: there is no profile out there running an older view.

Not covered by any guarantee: the base tables (`documents`, `highlights`,
`settings`, `tts_cache_metadata`, `reading_sessions`, `session_documents`,
`cache_settings`), the `_migrations` table, and anything in the audio cache
directory.

## How to read it safely

Open it **read-only** and let SQLite handle the fact that Lectrice may be
running:

```python
import sqlite3, pathlib

db = pathlib.Path.home() / ".config/com.lectrice.reader/pdf-reader.db"
con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
con.row_factory = sqlite3.Row

rows = con.execute("""
    SELECT file_path, title, page_number, text_content, note, created_at
    FROM v_highlight_citations
    WHERE text_content IS NOT NULL
    ORDER BY file_path, page_number, created_at
""").fetchall()
```

Two things worth handling:

- **`file_path` can point at a file that no longer exists.** Lectrice stores the
  path it opened; moving or deleting the PDF does not update the row.
- **The view is created at app start-up.** A profile that has not launched a
  build containing it will not have it yet — fall back to the base tables for
  one release, or launch Lectrice once.

## Why a view and not `lectrice export --json`

An export command is the tidier coupling and is still the eventual answer, but
it needs a headless entry point the app does not have — today every command is
reachable only over Tauri IPC from a running window
(`highlights_export` in `src-tauri/src/commands/highlights/mod.rs` already
produces JSON and Markdown, but only to the frontend). The view costs nothing,
works with the tools consumers already use, and does not go stale, so it is the
contract until a CLI exists.

## The com.voxpage.pdf-reader database

Before 30/05/2026 the bundle identifier was `com.voxpage.pdf-reader`, so the
database lived at `~/.config/com.voxpage.pdf-reader/pdf-reader.db`. The rename
(commit `7c5de09`) shipped no migration: the app simply started a new, empty
database and left the old one in place.

`tools/import-legacy-db.sh` merges the old one into the current one. It opens the
source read-only, backs the destination up first, uses `INSERT OR IGNORE` so
re-running is a no-op, and re-points imported highlights at the destination's
document row when both know the same `file_path`. Run `--self-check` to exercise
that logic on throwaway databases.
