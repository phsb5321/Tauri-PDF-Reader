#!/usr/bin/env bash
# Import documents + highlights from a Lectrice database left behind by a
# bundle-identifier change.
#
# The app stores its SQLite under ~/.config/<identifier>/pdf-reader.db, so the
# 2026-05-29 rebrand (com.voxpage.pdf-reader -> com.lectrice.reader, commit
# 7c5de09) silently started a brand-new database and abandoned the old one. No
# migration shipped with that commit. This script is that migration, run by
# hand: there is no population of users to auto-migrate, and a permanent
# first-boot importer would be machinery carried forever for a one-time event.
#
# Properties worth knowing before running it:
#   - the source is opened read-only (mode=ro); it is never written or deleted
#   - the destination is backed up first, to <db>.pre-import-<timestamp>
#   - rows are INSERT OR IGNORE, so re-running it is a no-op, not a duplicate
#   - a highlight whose document already exists in the destination under the
#     same file_path is re-pointed at the destination's document id, rather
#     than being imported with a dangling document_id
#
# Usage:
#   tools/import-legacy-db.sh [SOURCE_DB] [DEST_DB]
#   tools/import-legacy-db.sh --self-check     # runs the logic on temp DBs
#
# Defaults target the known rename on Linux.

set -euo pipefail

CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
DEFAULT_SRC="$CONFIG_HOME/com.voxpage.pdf-reader/pdf-reader.db"
DEFAULT_DEST="$CONFIG_HOME/com.lectrice.reader/pdf-reader.db"

# The columns of migration 1. Listed explicitly rather than using SELECT * so a
# destination that has since gained a column cannot silently shift values into
# the wrong slots.
DOC_COLS="id, file_path, title, page_count, current_page, scroll_position, last_tts_chunk_id, last_opened_at, file_hash, created_at"
HL_COLS="id, document_id, page_number, rects, color, text_content, note, created_at, updated_at"

count() { sqlite3 "file:$1?mode=ro" "SELECT (SELECT count(*) FROM documents) || ' documents, ' || (SELECT count(*) FROM highlights) || ' highlights'"; }

import_into() {
  local src="$1" dest="$2"

  sqlite3 "$dest" <<SQL
ATTACH DATABASE 'file:${src}?mode=ro' AS legacy;
BEGIN;

INSERT OR IGNORE INTO documents (${DOC_COLS})
SELECT ${DOC_COLS} FROM legacy.documents;

-- Re-point each imported highlight at whichever document row now represents
-- its PDF. If the destination already knew that file under a different id,
-- COALESCE picks the destination's id; otherwise the legacy id was just
-- inserted above and is used as-is.
INSERT OR IGNORE INTO highlights (${HL_COLS})
SELECT
  h.id,
  COALESCE(
    (SELECT d.id FROM documents d
       JOIN legacy.documents ld ON ld.file_path = d.file_path
      WHERE ld.id = h.document_id),
    h.document_id
  ),
  h.page_number, h.rects, h.color, h.text_content, h.note, h.created_at, h.updated_at
FROM legacy.highlights h;

COMMIT;
DETACH DATABASE legacy;
SQL
}

self_check() {
  local src dest
  # Deliberately not `local`: the EXIT trap runs after this function returns, so
  # a function-scoped name would be unset by then and `set -u` would turn the
  # cleanup into a spurious failure.
  SELF_CHECK_DIR="$(mktemp -d)"
  trap 'rm -rf "$SELF_CHECK_DIR"' EXIT
  src="$SELF_CHECK_DIR/src.db"
  dest="$SELF_CHECK_DIR/dest.db"

  local schema="CREATE TABLE documents (id TEXT PRIMARY KEY, file_path TEXT NOT NULL UNIQUE, title TEXT, page_count INTEGER, current_page INTEGER NOT NULL DEFAULT 1, scroll_position REAL NOT NULL DEFAULT 0.0, last_tts_chunk_id TEXT, last_opened_at TEXT, file_hash TEXT, created_at TEXT NOT NULL);
CREATE TABLE highlights (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, page_number INTEGER NOT NULL, rects TEXT NOT NULL, color TEXT NOT NULL, text_content TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT, FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE);"

  sqlite3 "$src" "$schema
INSERT INTO documents (id, file_path, created_at) VALUES ('old-a','/a.pdf','t'), ('old-b','/b.pdf','t');
INSERT INTO highlights (id, document_id, page_number, rects, color, text_content, created_at)
  VALUES ('h1','old-a',1,'[]','#FFEB3B','from a','t'), ('h2','old-b',2,'[]','#FFEB3B','from b','t');"

  # The destination already knows /a.pdf under a DIFFERENT id — the case that
  # would otherwise produce a dangling document_id.
  sqlite3 "$dest" "$schema
INSERT INTO documents (id, file_path, created_at) VALUES ('new-a','/a.pdf','t');"

  import_into "$src" "$dest"
  import_into "$src" "$dest" # idempotence: second run must change nothing

  local docs highlights remapped dangling
  docs=$(sqlite3 "$dest" "SELECT count(*) FROM documents")
  highlights=$(sqlite3 "$dest" "SELECT count(*) FROM highlights")
  remapped=$(sqlite3 "$dest" "SELECT document_id FROM highlights WHERE id='h1'")
  dangling=$(sqlite3 "$dest" "SELECT count(*) FROM highlights h LEFT JOIN documents d ON d.id=h.document_id WHERE d.id IS NULL")

  local failed=0
  [ "$docs" = "2" ]        || { echo "FAIL: expected 2 documents, got $docs"; failed=1; }
  [ "$highlights" = "2" ]  || { echo "FAIL: expected 2 highlights, got $highlights"; failed=1; }
  [ "$remapped" = "new-a" ]|| { echo "FAIL: h1 should point at new-a, points at $remapped"; failed=1; }
  [ "$dangling" = "0" ]    || { echo "FAIL: $dangling highlight(s) reference a missing document"; failed=1; }

  [ "$failed" = "0" ] && echo "self-check OK: 2 documents, 2 highlights, h1 remapped to new-a, 0 dangling"
  return "$failed"
}

if [ "${1:-}" = "--self-check" ]; then
  self_check
  exit $?
fi

SRC="${1:-$DEFAULT_SRC}"
DEST="${2:-$DEFAULT_DEST}"

[ -f "$SRC" ]  || { echo "no legacy database at $SRC — nothing to import"; exit 0; }
[ -f "$DEST" ] || { echo "no destination database at $DEST — start Lectrice once first"; exit 1; }

# Match the process NAME (/proc/<pid>/comm) via -x, not the whole command line.
# `pgrep -f` would match any shell, editor or agent session that merely has the
# repo path or the app name somewhere in its argv — which is every terminal
# sitting in the checkout, so the guard would never let the script run.
# `Lectrice` is the bundled binary (productName); `tauri-pdf-reade` is the cargo
# binary as seen in dev, truncated because the kernel caps comm at 15 bytes.
if pgrep -x 'Lectrice|tauri-pdf-reade' >/dev/null 2>&1; then
  echo "Lectrice appears to be running. Close it first — importing under it risks writing against its WAL." >&2
  exit 1
fi

BACKUP="$DEST.pre-import-$(date +%Y%m%d-%H%M%S)"
sqlite3 "$DEST" ".backup '$BACKUP'"

echo "source:      $SRC          ($(count "$SRC"))"
echo "destination: $DEST ($(count "$DEST"))"
echo "backup:      $BACKUP"

import_into "$SRC" "$DEST"

echo "after:       $DEST ($(count "$DEST"))"
echo "source untouched:          ($(count "$SRC"))"
