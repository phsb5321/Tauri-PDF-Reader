#!/usr/bin/env bash
#
# Reproducible runner for the packaged cover-journey E2E
# (e2e/cover-journey.e2e.mjs) — slice 121's user-gate lane: real first-page
# cover rasters, the deterministic fallback, and the warm-cache relaunch.
#
# Two phases over ONE hermetic profile:
#
#   first   three seeded books (two real fixture PDFs + one deliberately
#           corrupt "coverless" file). Asserts real rasters (distinct
#           pixels), the fallback, the progress bar, the cover-cache
#           negative control, and card open at the stored page.
#   verify  the fixture PDFs have been DELETED from the profile — the cover
#           must still render with the SAME pixel hash. Only the disk cache
#           can serve it; regeneration would fail on the missing file.
#
# Hermetic profile via scripts/e2e-profile.sh (XDG_DATA/CONFIG/CACHE — the
# cache dir holds the cover rasters, so it is hermetic too). The corrupt
# coverless fixture is written here (not in the gen script): it must be a
# NON-PDF whose content hash is stable across runs.
#
# Not wired into CI: needs WebKitGTK + a display (vimeflow#65 software-render
# trap), same as the other tauri-driver lanes.
#
#     bash e2e/run-cover-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null
# The coverless book: right extension, wrong bytes — the pipeline must fall
# back deterministically instead of ever writing a raster for it.
printf 'not a pdf, just fixture bytes for the cover fallback lane\n' \
  > "$APP_DIR/e2e-coverless.pdf"

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=cover, no TTS)"
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=cover \
  VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
touch src-tauri/src/lib.rs

echo "==> Building debug binary (--features e2e-tts-fixture) + both phases in the devShell"
export CI=true
toolchain_run '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  # XDG_* were exported by scripts/e2e-profile.sh and pass through nix develop
  # unchanged — config + data + cache dirs stay hermetic for BOTH phases.
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-cover-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"
  # The toolchain shell does not inherit the outer APP_DIR; derive it from
  # the hermetic XDG_DATA_HOME it DID inherit.
  APP_DIR="$XDG_DATA_HOME/com.lectrice.reader"

  PHASE1_LOG=$(mktemp)
  echo "==> PHASE first"
  FIRST_STATUS=0
  COVER_PHASE=first E2E_SPEC=./e2e/cover-journey.e2e.mjs pnpm test:e2e >"$PHASE1_LOG" 2>&1 || FIRST_STATUS=$?
  echo "==> PHASE first exit: $FIRST_STATUS"
  grep -E "COVER_A_HASH|passing|failing" "$PHASE1_LOG" | head -6 || true
  if [ "$FIRST_STATUS" -ne 0 ]; then
    echo "==> PHASE first failure tail:"
    tail -40 "$PHASE1_LOG" || true
    # A failed first phase must NEVER mutate the profile/cache (no source
    # deletion, no corruption): report and exit with the phase status so the
    # runner is provably non-zero (shell NC pins this).
    echo "==> lane summary: first=$FIRST_STATUS verify=SKIPPED (cache untouched)"
    exit "$FIRST_STATUS"
  fi

  echo "==> checkpoint: phase 1 done, deleting sources"
  # The warm-cache oracle: remove the SOURCE PDFs. The covers must survive
  # from the disk cache alone — the coverless file stays (its fallback must
  # re-assert deterministically).
  rm -f "$APP_DIR/e2e-resume-fixture-a.pdf" "$APP_DIR/e2e-resume-fixture-b.pdf"
  echo "==> checkpoint: sources deleted"

  # Corrupt-cache negative control: one cached cover is truncated. The
  # backend must read it as a miss (quarantine) and, with the source gone,
  # the card must fall back — a corrupt cache must never render stale bytes.
  # Gated on EXACTLY two cached covers: a phase-1 hiccup must not corrupt a
  # half-written cache (the shell NC forces this path and proves non-zero).
  # NOTE: no sqlite3 here — the spec self-determines which card fell back
  # (exactly one of the two covers is corrupted, whichever sorts first).
  # The corruption is a REQUIRED negative control, not best-effort: a
  # phase-1 run that did not produce exactly two cached covers is a broken
  # lane, and continuing would produce a false green (Codex gate 121).
  COVERS_DIR="$XDG_CACHE_HOME/com.lectrice.reader/covers"
  COVER_COUNT=$(ls "$COVERS_DIR" 2>/dev/null | grep -c -- "-v1.png" || true)
  if [ "$COVER_COUNT" -ne 2 ]; then
    echo "==> FATAL: expected exactly 2 cached covers, got $COVER_COUNT — refusing to continue"
    exit 3
  fi
  FIRST_COVER=$(ls "$COVERS_DIR" | sort | head -1)
  printf "%s" "truncated cover bytes" > "$COVERS_DIR/$FIRST_COVER"
  echo "==> observer: corrupted cached cover $FIRST_COVER (negative control)"

  echo "==> checkpoint: covers dir contents: $(ls "$COVERS_DIR" 2>/dev/null | wc -l) files"
  echo "==> PHASE verify (fresh app process, same profile, sources deleted)"
  VERIFY_STATUS=0
  EXPECT_COVER_A_HASH="$(grep -oP "COVER_A_HASH=\K[0-9a-f]+" "$PHASE1_LOG" | head -1 || true)"
  EXPECT_COVER_B_HASH="$(grep -oP "COVER_B_HASH=\K[0-9a-f]+" "$PHASE1_LOG" | head -1 || true)"
  COVER_PHASE=verify EXPECT_COVER_A_HASH="$EXPECT_COVER_A_HASH" \
    EXPECT_COVER_B_HASH="$EXPECT_COVER_B_HASH" \
    E2E_SPEC=./e2e/cover-journey.e2e.mjs pnpm test:e2e || VERIFY_STATUS=$?
  echo "==> PHASE verify exit: $VERIFY_STATUS"

  echo "==> observer: cover cache files after both phases"
  ls -la "$XDG_CACHE_HOME/com.lectrice.reader/covers/" 2>/dev/null || echo "(no covers dir)"

  echo "==> lane summary: first=$FIRST_STATUS verify=$VERIFY_STATUS"
  [ "$FIRST_STATUS" -eq 0 ] && [ "$VERIFY_STATUS" -eq 0 ]
'
TOOLCHAIN_STATUS=$?
echo "==> runner exit: $TOOLCHAIN_STATUS"
exit "$TOOLCHAIN_STATUS"
